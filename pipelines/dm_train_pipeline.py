"""DM코드 판독 성공/실패 분류 모델 — 실제 학습 파이프라인.

노트북(dm_train.ipynb)에서 검증한 학습 레시피를 KFP 3단계로 옮긴 것이다.
sleep으로 시간만 끄는 데모가 아니라 실제로 ResNet18을 학습시켜 모델을 만든다.

  준비(prep) → 학습(train) → 평가(eval)

데이터·모델은 MinIO를 거쳐 단계 간 전달한다 (파일서버 불필요).
  입력  s3://datasets/dm-code/dm_dataset.tgz
  출력  s3://models/dm-code/<run>/dm_model_best.pt

컴파일 (환경마다 값이 달라 환경변수로 넘긴다):
  # 개발 PC (파드가 사외망에 직접 못 나가 호스트 프록시 경유, 백엔드는 클러스터 밖)
  TRAIN_PROXY=http://192.168.0.41:3128 CMP_API=http://192.168.0.41:8000     python dm_train_pipeline.py                      # → dm_train_pipeline.yaml
  # ETRI (프록시 없음, 백엔드는 클러스터 안 okc-ai 네임스페이스, GPU 없으면 TRAIN_ACCEL= 로 CPU 학습)
  PIPELINE_OUT=dm_train_pipeline_etri.yaml python dm_train_pipeline.py

주의: 각 단계가 실행 중에 pip로 minio 등을 받고, 학습은 사전학습 가중치를 내려받는다.
인터넷이 없는 환경이면 TRAIN_IMAGE에 패키지·가중치를 미리 넣은 이미지를 지정해야 한다.
"""
import os

from kfp import dsl, compiler

# 노트북과 동일한 이미지 — torch·torchvision·kfp가 이미 들어 있어
# 파드에서 따로 받을 필요가 없다 (노드에 캐시되어 있어 기동도 빠름).
IMAGE = os.environ.get("TRAIN_IMAGE",
                       "kubeflownotebookswg/jupyter-pytorch-cuda-full:v1.9.2")

# 사외 통신 프록시 (사전학습 가중치·pip 패키지 다운로드용). 비우면 쓰지 않는다.
# 개발 PC는 파드가 사내망 밖으로 직접 못 나가 호스트 프록시(http://192.168.0.41:3128)를 쓴다.
PROXY = os.environ.get("TRAIN_PROXY", "")

# 배포 단계가 부르는 AI 노트북 백엔드 주소 (기본은 클러스터 안 설치 기준)
CMP_API = os.environ.get("CMP_API", "http://okc-ai-backend.okc-ai.svc:8000")

# 학습 단계 가속기 자원 이름. 비우면 CPU로 학습한다
ACCEL = os.environ.get("TRAIN_ACCEL", "nvidia.com/gpu")

S3_ENDPOINT = "minio-service.kubeflow:9000"
S3_KEY, S3_SECRET = "minio", "minio123"


@dsl.component(base_image=IMAGE, packages_to_install=["minio"])
def prep(dataset_uri: str, val_ratio: float, seed: int,
         manifest: dsl.Output[dsl.Dataset]) -> str:
    """원본 이미지를 내려받아 학습/검증으로 나눈 목록을 만든다."""
    import json, tarfile, os
    from minio import Minio

    bucket, key = dataset_uri.replace("s3://", "").split("/", 1)
    cli = Minio(os.environ["S3_ENDPOINT"], access_key=os.environ["S3_KEY"],
                secret_key=os.environ["S3_SECRET"], secure=False)
    cli.fget_object(bucket, key, "/tmp/ds.tgz")
    with tarfile.open("/tmp/ds.tgz") as t:
        t.extractall("/tmp/data")

    ok = sorted(f"qr_crops/{f}" for f in os.listdir("/tmp/data/qr_crops")
                if f.endswith(".jpg"))
    ng = sorted(f"qr_crops_failed/{f}"
                for f in os.listdir("/tmp/data/qr_crops_failed")
                if f.endswith(".jpg"))

    # 노트북과 동일하게 seed 고정 — 매 실행 같은 분할이 나온다
    import random
    files = [(p, 0) for p in ok] + [(p, 1) for p in ng]
    random.Random(seed).shuffle(files)
    n_val = int(len(files) * val_ratio)
    split = {"val": files[:n_val], "train": files[n_val:]}

    with open(manifest.path, "w") as f:
        json.dump(split, f)
    msg = (f"판독 성공 {len(ok):,}장 · 실패 {len(ng):,}장 → "
           f"학습 {len(split['train']):,}장 / 검증 {len(split['val']):,}장")
    print(msg)
    return msg


@dsl.component(base_image=IMAGE, packages_to_install=["minio"])
def train(dataset_uri: str, manifest: dsl.Input[dsl.Dataset],
          epochs: int, batch: int, img_size: int, lr: float,
          model_prefix: str,
          model: dsl.Output[dsl.Model]) -> float:
    """ResNet18 전이학습 — 노트북에서 94.96%를 낸 그 레시피 그대로."""
    import json, os, tarfile, time
    import torch, torch.nn as nn
    from torch.utils.data import Dataset, DataLoader
    from torchvision import transforms
    from torchvision.models import resnet18, ResNet18_Weights
    from PIL import Image
    from minio import Minio

    bucket, key = dataset_uri.replace("s3://", "").split("/", 1)
    cli = Minio(os.environ["S3_ENDPOINT"], access_key=os.environ["S3_KEY"],
                secret_key=os.environ["S3_SECRET"], secure=False)
    cli.fget_object(bucket, key, "/tmp/ds.tgz")
    with tarfile.open("/tmp/ds.tgz") as t:
        t.extractall("/tmp/data")
    split = json.load(open(manifest.path))

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"학습 장비: {device}"
          + (f" ({torch.cuda.get_device_name(0)})"
             if device.type == "cuda" else " — GPU를 못 잡아 CPU로 진행"))

    norm = transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    train_tf = transforms.Compose([
        transforms.Resize((img_size, img_size)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(10),
        transforms.ColorJitter(brightness=0.2, contrast=0.2),
        transforms.ToTensor(), norm,
    ])
    eval_tf = transforms.Compose([
        transforms.Resize((img_size, img_size)), transforms.ToTensor(), norm,
    ])

    class DM(Dataset):
        def __init__(self, rows, tf):
            self.rows, self.tf = rows, tf

        def __len__(self):
            return len(self.rows)

        def __getitem__(self, i):
            rel, y = self.rows[i]
            img = Image.open(f"/tmp/data/{rel}").convert("RGB")
            return self.tf(img), y

    tr = DataLoader(DM(split["train"], train_tf), batch_size=batch,
                    shuffle=True, num_workers=2)
    va = DataLoader(DM(split["val"], eval_tf), batch_size=batch,
                    num_workers=2)

    net = resnet18(weights=ResNet18_Weights.DEFAULT)
    net.fc = nn.Linear(net.fc.in_features, 2)   # 0=성공, 1=실패
    net = net.to(device)
    crit = nn.CrossEntropyLoss()
    opt = torch.optim.AdamW(net.parameters(), lr=lr)

    best = 0.0
    for ep in range(1, epochs + 1):
        t0 = time.time()
        net.train()
        loss_sum = 0.0
        for x, y in tr:
            x, y = x.to(device), y.to(device)
            opt.zero_grad()
            loss = crit(net(x), y)
            loss.backward()
            opt.step()
            loss_sum += loss.item() * x.size(0)

        net.eval()
        ok = tot = 0
        with torch.no_grad():
            for x, y in va:
                x, y = x.to(device), y.to(device)
                ok += (net(x).argmax(1) == y).sum().item()
                tot += y.size(0)
        acc = ok / tot
        print(f"[{ep}/{epochs}] 학습손실 {loss_sum/len(split['train']):.4f} | "
              f"검증 정확도 {acc*100:.2f}% | {time.time()-t0:.0f}초")
        if acc > best:
            best = acc
            torch.save(net.state_dict(), model.path)

    # 배포·재사용을 위해 MinIO에도 남긴다
    if not cli.bucket_exists("models"):
        cli.make_bucket("models")
    cli.fput_object("models", f"{model_prefix}/dm_model_best.pt", model.path)
    print(f"\n최고 검증 정확도 {best*100:.2f}% — "
          f"s3://models/{model_prefix}/dm_model_best.pt 저장 완료")
    return round(best * 100, 2)


@dsl.component(base_image=IMAGE, packages_to_install=["minio"])
def evaluate(dataset_uri: str, manifest: dsl.Input[dsl.Dataset],
             model: dsl.Input[dsl.Model], img_size: int, batch: int,
             metrics: dsl.Output[dsl.Metrics]) -> str:
    """검증셋 혼동행렬 — 현장에서 중요한 '불량 검출률'까지 계산."""
    import json, os, tarfile
    import torch, torch.nn as nn
    from torch.utils.data import Dataset, DataLoader
    from torchvision import transforms
    from torchvision.models import resnet18
    from PIL import Image
    from minio import Minio

    bucket, key = dataset_uri.replace("s3://", "").split("/", 1)
    cli = Minio(os.environ["S3_ENDPOINT"], access_key=os.environ["S3_KEY"],
                secret_key=os.environ["S3_SECRET"], secure=False)
    cli.fget_object(bucket, key, "/tmp/ds.tgz")
    with tarfile.open("/tmp/ds.tgz") as t:
        t.extractall("/tmp/data")
    rows = json.load(open(manifest.path))["val"]

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    tf = transforms.Compose([
        transforms.Resize((img_size, img_size)), transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    class DM(Dataset):
        def __len__(self):
            return len(rows)

        def __getitem__(self, i):
            rel, y = rows[i]
            return tf(Image.open(f"/tmp/data/{rel}").convert("RGB")), y

    net = resnet18()
    net.fc = nn.Linear(net.fc.in_features, 2)
    net.load_state_dict(torch.load(model.path, map_location=device))
    net = net.to(device).eval()

    cm = [[0, 0], [0, 0]]
    with torch.no_grad():
        for x, y in DataLoader(DM(), batch_size=batch, num_workers=2):
            p = net(x.to(device)).argmax(1).cpu()
            for t, pr in zip(y.tolist(), p.tolist()):
                cm[t][pr] += 1

    total = sum(map(sum, cm))
    acc = (cm[0][0] + cm[1][1]) / total * 100
    recall_ng = cm[1][1] / max(sum(cm[1]), 1) * 100
    precision_ng = cm[1][1] / max(cm[0][1] + cm[1][1], 1) * 100

    metrics.log_metric("정확도(%)", round(acc, 2))
    metrics.log_metric("불량 검출률(%)", round(recall_ng, 2))
    metrics.log_metric("불량 판정 정밀도(%)", round(precision_ng, 2))
    metrics.log_metric("검증 이미지 수", total)

    print("            예측:성공   예측:실패")
    print(f"실제 성공(OK)   {cm[0][0]:6d} {cm[0][1]:9d}")
    print(f"실제 실패(FAIL) {cm[1][0]:6d} {cm[1][1]:9d}")
    msg = (f"정확도 {acc:.2f}% · 불량 검출률 {recall_ng:.2f}% "
           f"(검증 {total:,}장)")
    print("\n" + msg)
    return msg


@dsl.component(base_image=IMAGE,
               packages_to_install=["minio", "torch-model-archiver"])
def package(model: dsl.Input[dsl.Model], serve_prefix: str,
            img_size: int, model_name: str) -> str:
    """학습된 가중치를 서빙이 바로 읽을 수 있는 형태로 포장한다.

    KServe의 PyTorch 서버(TorchServe)는 .mar 패키지를 요구하므로
    학습 산출물(state_dict)을 TorchScript로 변환해 묶는다.
    """
    import json, os, subprocess
    import torch, torch.nn as nn
    from torchvision.models import resnet18
    from minio import Minio

    net = resnet18()
    net.fc = nn.Linear(net.fc.in_features, 2)
    net.load_state_dict(torch.load(model.path, map_location="cpu"))
    net.eval()
    # 모델 정의 없이도 불러올 수 있게 TorchScript로 고정
    traced = torch.jit.trace(net, torch.randn(1, 3, img_size, img_size))
    traced.save("/tmp/model.pt")

    handler = r'''
import io, base64, torch
from PIL import Image
from torchvision import transforms
from ts.torch_handler.base_handler import BaseHandler


class DMHandler(BaseHandler):
    """DataMatrix 판독 가능성 분류 (KServe v1 프로토콜)"""

    def initialize(self, ctx):
        super().initialize(ctx)
        self.tf = transforms.Compose([
            transforms.Resize((IMG, IMG)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ])
        self.classes = ["OK", "FAIL"]

    def _to_bytes(self, row):
        if isinstance(row, dict):
            for k in ("image_b64", "data", "body", "b64"):
                v = row.get(k)
                if v is None:
                    continue
                if isinstance(v, (bytes, bytearray)):
                    return bytes(v)
                if isinstance(v, str):
                    return base64.b64decode(v)
                if isinstance(v, dict):
                    return self._to_bytes(v)
        if isinstance(row, str):
            return base64.b64decode(row)
        if isinstance(row, (bytes, bytearray)):
            return bytes(row)
        raise ValueError("지원하지 않는 입력 형식")

    def preprocess(self, data):
        imgs = []
        for row in data:
            img = Image.open(io.BytesIO(self._to_bytes(row))).convert("RGB")
            imgs.append(self.tf(img))
        return torch.stack(imgs).to(self.device)

    def inference(self, x, *args, **kwargs):
        with torch.no_grad():
            return torch.softmax(self.model(x), 1)

    def postprocess(self, out):
        res = []
        for p in out:
            i = int(p.argmax())
            res.append({"prediction": self.classes[i],
                        "confidence": round(float(p[i]) * 100, 1),
                        "probabilities": {"OK": round(float(p[0]) * 100, 1),
                                          "FAIL": round(float(p[1]) * 100, 1)}})
        return res
'''.replace("IMG", str(img_size))
    with open("/tmp/dm_handler.py", "w") as f:
        f.write(handler)

    os.makedirs("/tmp/pkg/model-store", exist_ok=True)
    subprocess.run([
        "torch-model-archiver", "--model-name", model_name,
        "--version", "1.0", "--serialized-file", "/tmp/model.pt",
        "--handler", "/tmp/dm_handler.py",
        "--export-path", "/tmp/pkg/model-store", "--force",
    ], check=True)

    # KServe 래퍼는 model_snapshot과 service_envelope을 요구한다.
    # 이게 없으면 TorchServe는 뜨지만 래퍼가 KeyError로 죽는다.
    snapshot = json.dumps({
        "name": "startup.cfg", "modelCount": 1,
        "models": {model_name: {"1.0": {
            "defaultVersion": True, "marName": f"{model_name}.mar",
            "minWorkers": 1, "maxWorkers": 1, "batchSize": 1,
            "maxBatchDelay": 100, "responseTimeout": 120}}},
    }, separators=(",", ":"))
    cfg = ("inference_address=http://0.0.0.0:8085\n"
           "management_address=http://0.0.0.0:8085\n"
           "metrics_address=http://0.0.0.0:8082\n"
           "grpc_inference_port=7070\n"
           "grpc_management_port=7071\n"
           "enable_envvars_config=true\n"
           "install_py_dep_per_model=true\n"
           "enable_metrics_api=true\n"
           "metrics_mode=logical\n"
           "NUM_WORKERS=1\n"
           "number_of_netty_threads=4\n"
           "job_queue_size=10\n"
           "service_envelope=kserve\n"
           "model_store=/mnt/models/model-store\n"
           f"model_snapshot={snapshot}\n")

    cli = Minio(os.environ["S3_ENDPOINT"], access_key=os.environ["S3_KEY"],
                secret_key=os.environ["S3_SECRET"], secure=False)
    if not cli.bucket_exists("models"):
        cli.make_bucket("models")
    cli.fput_object("models", f"{serve_prefix}/model-store/{model_name}.mar",
                    f"/tmp/pkg/model-store/{model_name}.mar")
    import io as _io
    data = cfg.encode()
    cli.put_object("models", f"{serve_prefix}/config/config.properties",
                   _io.BytesIO(data), len(data))

    mb = os.path.getsize(f"/tmp/pkg/model-store/{model_name}.mar") / 1024 / 1024
    uri = f"s3://models/{serve_prefix}"
    print(f"패키지 생성 완료 ({mb:.1f}MB) → {uri}")
    return uri


@dsl.component(base_image=IMAGE, packages_to_install=["httpx"])
def deploy(serve_uri: str, service_name: str, cmp_api: str,
           gpu: int) -> str:
    """포장된 모델을 서비스에 반영한다 (없으면 새로 배포, 있으면 교체)."""
    import httpx

    existing = httpx.get(f"{cmp_api}/api/v1/serving", timeout=30).json()
    names = [s["name"] for s in existing.get("items", [])]

    if service_name in names:
        r = httpx.patch(f"{cmp_api}/api/v1/serving/{service_name}", timeout=60,
                        json={"storageUri": serve_uri, "modelFormat": "pytorch",
                              "gpu": gpu})
        action = "교체"
    else:
        r = httpx.post(f"{cmp_api}/api/v1/serving", timeout=60,
                       json={"name": service_name, "namespace": "ai-dev-team",
                             "modelFormat": "pytorch", "storageUri": serve_uri,
                             "cpu": "2", "memoryGi": 4, "gpu": gpu})
        action = "신규 배포"
    r.raise_for_status()

    msg = (f"서비스 '{service_name}' {action} 완료 — {serve_uri}\n"
           f"호출 주소: {cmp_api}/api/v1/serving/{service_name}/predict\n"
           f"준비까지 1~2분 걸립니다 (그동안 기존 서버가 계속 응답)")
    print(msg)
    return msg


@dsl.pipeline(
    name="dm-code-train",
    description="DM코드 판독 성공/실패 분류 모델 실제 학습 (준비→학습→평가)",
)
def dm_code_train(
    dataset_uri: str = "s3://datasets/dm-code/dm_dataset.tgz",
    model_prefix: str = "dm-code/latest",
    epochs: int = 5,
    batch: int = 64,
    img_size: int = 128,
    lr: float = 0.0003,
    val_ratio: float = 0.2,
    seed: int = 42,
    serve_prefix: str = "dm-code/serve",
    service_name: str = "dm-code-classifier",
    serve_gpu: int = 0,
    cmp_api: str = CMP_API,
):
    def wire(task, gpu: bool = False):
        task.set_env_variable("S3_ENDPOINT", S3_ENDPOINT)
        task.set_env_variable("S3_KEY", S3_KEY)
        task.set_env_variable("S3_SECRET", S3_SECRET)
        if PROXY:
            # 사전학습 가중치·pip 패키지 다운로드용
            task.set_env_variable("HTTP_PROXY", PROXY)
            task.set_env_variable("HTTPS_PROXY", PROXY)
            # 주의: 이 프록시 설정은 KFP launcher(Go)에도 그대로 적용된다.
            # 클러스터 내부 주소를 NO_PROXY에서 빠뜨리면 launcher가 메타데이터
            # 서비스를 사외 프록시로 찾아가다 죽는다.
            task.set_env_variable(
                "NO_PROXY",
                "localhost,127.0.0.1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,"
                ".svc,.cluster.local,.kubeflow,.kserve,metadata-grpc-service,"
                "ml-pipeline,minio-service,cache-server,mysql")
        if gpu and ACCEL:
            task.set_accelerator_type(ACCEL)
            task.set_accelerator_limit(1)
        return task

    p = wire(prep(dataset_uri=dataset_uri, val_ratio=val_ratio, seed=seed))

    t = wire(train(dataset_uri=dataset_uri, manifest=p.outputs["manifest"],
                   epochs=epochs, batch=batch, img_size=img_size, lr=lr,
                   model_prefix=model_prefix), gpu=True)

    e = wire(evaluate(dataset_uri=dataset_uri, manifest=p.outputs["manifest"],
                      model=t.outputs["model"],
                      img_size=img_size, batch=batch))

    # 평가까지 끝난 모델만 서비스에 올린다
    k = wire(package(model=t.outputs["model"], serve_prefix=serve_prefix,
                     img_size=img_size, model_name=service_name))
    k.after(e)

    d = wire(deploy(serve_uri=k.output, service_name=service_name,
                    cmp_api=cmp_api, gpu=serve_gpu))
    d.after(k)


if __name__ == "__main__":
    out = os.environ.get("PIPELINE_OUT", "dm_train_pipeline.yaml")
    compiler.Compiler().compile(dm_code_train, out)
    print(f"컴파일 완료 → {out} (proxy={PROXY or '없음'}, cmp_api={CMP_API}, accel={ACCEL or 'CPU'})")
