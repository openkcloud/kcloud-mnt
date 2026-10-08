#!/bin/bash
# 연습 클러스터 기능 시험 — 포털 인그레스(127.0.0.1:18080, Host okc-ai.localhost)로만 부른다
R=/opt/okc-rehearsal; K="kubectl --kubeconfig $R/kubeconfig"
eval "$(grep '^CMP_USERS=' $R/values.env)"
AP=$(echo "$CMP_USERS" | tr ',' '\n' | grep '^admin:' | cut -d: -f2)
U=http://127.0.0.1:18080; H="Host: okc-ai.localhost"; CJ=$R/cj.txt; rm -f $CJ
NS=rehearsal-ws
ok(){ echo "  [OK]  $*"; }; ng(){ echo "  [실패] $*"; FAILS=$((FAILS+1)); }; FAILS=0
api(){ local m=$1 p=$2; shift 2; curl -s -m 120 -b $CJ -c $CJ -H "$H" -H 'Content-Type: application/json' -X $m "$U$p" "$@"; }
code(){ curl -s -o /dev/null -w '%{http_code}' -m 60 -b $CJ -c $CJ -H "$H" "$U$1"; }
js(){ python3 -c "import sys,json; d=json.load(sys.stdin); print($1)" 2>/dev/null; }
step(){ echo "[$(date +%T)] $*"; }

step "1) 화면과 로그인"
for p in /login/ /ai-development/ /ai-development/profiles/; do c=$(code $p); [ "$c" = 200 ] && ok "화면 $p 200" || ng "화면 $p $c"; done
c=$(curl -s -o /dev/null -w '%{http_code}' -b $CJ -c $CJ -H "$H" -H 'Content-Type: application/json' -X POST $U/api/v1/auth/login -d "{\"username\":\"admin\",\"password\":\"$AP\"}")
[ "$c" = 200 ] && ok "관리자 로그인 200" || ng "관리자 로그인 $c"
c=$(curl -s -o /dev/null -w '%{http_code}' -H "$H" -H 'Content-Type: application/json' -X POST $U/api/v1/auth/login -d '{"username":"admin","password":"wrong"}')
[ "$c" = 401 ] && ok "틀린 비밀번호 401" || ng "틀린 비밀번호 $c"
for p in profiles notebooks serving experiments pipelines models metrics/gpu workspace-requests; do c=$(code /api/v1/$p); [ "$c" = 200 ] && ok "목록 /api/v1/$p 200" || ng "목록 /api/v1/$p $c"; done

step "2) 워크스페이스 만들기"
api POST /api/v1/profiles -d "{\"name\":\"$NS\",\"ownerEmail\":\"rehearsal@example.com\",\"cpu\":4,\"memoryGi\":8,\"storageGi\":20}" | head -c 200; echo
for i in $(seq 1 30); do $K get ns $NS >/dev/null 2>&1 && break; sleep 2; done
$K get ns $NS >/dev/null 2>&1 && ok "네임스페이스 $NS 생성" || ng "네임스페이스 없음"
$K -n $NS get resourcequota --no-headers 2>/dev/null | grep -q . && ok "자원 한도(ResourceQuota) 생성" || ng "자원 한도 없음"

step "3) 노트북 만들기 → IDE 열기"
api POST /api/v1/notebooks -d "{\"name\":\"nb1\",\"namespace\":\"$NS\",\"image\":\"kubeflownotebookswg/jupyter-scipy:v1.9.2\",\"cpu\":\"1\",\"memoryGi\":2}" | head -c 200; echo
for i in $(seq 1 90); do st=$(api GET "/api/v1/notebooks/nb1?namespace=$NS" | js 'd.get("status")'); [ "$st" = "Running" ] && break; sleep 10; done
[ "$st" = "Running" ] && ok "노트북 Running" || ng "노트북 상태 $st"
url=$(api GET "/api/v1/notebooks/nb1/connect?namespace=$NS" | js 'd.get("connectUrl","")')
path=$(echo "$url" | sed -E 's#^https?://[^/]+##')
c=$(curl -s -o /dev/null -w '%{http_code}' -L -m 60 -b $CJ -c $CJ -H "$H" "$U$path")
[ "$c" = 200 ] && ok "IDE 열기 200 ($path)" || ng "IDE 열기 $c ($url)"

step "4) HPO 실험 (random, 시험 2회)"
api POST /api/v1/experiments -d "{\"name\":\"hpo1\",\"namespace\":\"$NS\",\"algorithm\":\"random\",\"maxTrials\":2,\"parallelTrials\":1,\"trialType\":\"demo\"}" | head -c 200; echo
for i in $(seq 1 60); do n=$(api GET /api/v1/experiments | js '[e["trialsSucceeded"] for e in d["items"] if e["name"]=="hpo1"][0]'); [ "${n:-0}" -ge 2 ] 2>/dev/null && break; sleep 10; done
[ "${n:-0}" -ge 1 ] 2>/dev/null && ok "HPO 시험 성공 ${n}회" || ng "HPO 성공 0회"

step "5) 노트북 파일 → 모델 저장소 → 모델 배포(sklearn) → 예측"
mkdir -p $R/model && chmod 777 $R/model
docker run --rm -v $R/model:/out --entrypoint python kserve/sklearnserver:v0.14.1 -c "from sklearn import svm, datasets; import joblib; X,y=datasets.load_iris(return_X_y=True); joblib.dump(svm.SVC(gamma='scale').fit(X,y),'/out/model.joblib')" >/dev/null 2>&1
[ -s $R/model/model.joblib ] && ok "예시 모델 파일 생성" || ng "예시 모델 파일 없음"
pod=$($K -n $NS get pod -l notebook-name=nb1 -o jsonpath='{.items[0].metadata.name}')
$K -n $NS exec $pod -c notebook -- mkdir -p /home/jovyan/deploy/iris && $K -n $NS cp $R/model/model.joblib $pod:/home/jovyan/deploy/iris/model.joblib -c notebook && ok "노트북에 모델 파일 복사"
api POST /api/v1/models/import -d "{\"notebook\":\"nb1\",\"path\":\"deploy/iris\",\"modelName\":\"iris\",\"namespace\":\"$NS\"}" | head -c 200; echo
api POST /api/v1/serving -d "{\"name\":\"iris\",\"namespace\":\"$NS\",\"modelFormat\":\"sklearn\",\"storageUri\":\"s3://models/iris\",\"cpu\":\"1\",\"memoryGi\":1}" | head -c 200; echo
$K -n $NS get sa kserve-minio-sa >/dev/null 2>&1 && ok "새 워크스페이스에 저장소 계정 자동 생성" || ng "저장소 계정 없음"
for i in $(seq 1 60); do r=$($K -n $NS get isvc iris -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null); [ "$r" = True ] && break; sleep 10; done
[ "$r" = True ] && ok "모델 서비스 Ready" || ng "모델 서비스 Ready=$r"
out=$(api POST "/api/v1/serving/iris/predict?namespace=$NS" -d '{"instances":[[6.8,2.8,4.8,1.4],[6.0,3.4,4.5,1.6]]}')
echo "$out" | grep -q predictions && ok "예측 응답 $(echo $out | head -c 80)" || ng "예측 실패 $(echo $out | head -c 200)"

step "6) 파이프라인 업로드 → 실행"
if [ -s $R/hello.yaml ]; then
  body=$(python3 -c "import json;print(json.dumps({'name':'rehearsal-hello','description':'연습','yaml':open('$R/hello.yaml').read()}))")
  pid=$(api POST /api/v1/pipelines/upload -d "$body" | js 'd.get("pipeline_id","")')
  [ -n "$pid" ] && ok "파이프라인 업로드 $pid" || ng "파이프라인 업로드 실패"
  api POST /api/v1/pipelines/$pid/runs -d '{"name":"run1","params":{}}' | head -c 200; echo
  for i in $(seq 1 60); do s=$(api GET /api/v1/pipelines/$pid/runs | js 'd["items"][0]["state"] if d["items"] else ""'); case "$s" in SUCCEEDED|FAILED|ERROR) break;; esac; sleep 10; done
  [ "$s" = SUCCEEDED ] && ok "파이프라인 실행 SUCCEEDED" || ng "파이프라인 실행 $s"
else ng "hello.yaml 없음"; fi

step "끝 — 실패 ${FAILS}건"
