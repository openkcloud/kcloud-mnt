#!/bin/bash
# 시험용 최소 파이프라인 컴파일 — WSL 기본 파이썬(3.14)에는 kfp 2.7.0이 안 깔려 python:3.11-slim 컨테이너에서 한다
R=/opt/okc-rehearsal; mkdir -p $R
cat > $R/hello.py <<'PY'
from kfp import dsl, compiler
@dsl.component(base_image="python:3.11-slim")
def add(a: int, b: int) -> int:
    return a + b
@dsl.pipeline(name="rehearsal-hello", description="설치 연습용 최소 파이프라인")
def hello(x: int = 1, y: int = 2):
    t = add(a=x, b=y)
    add(a=t.output, b=10)
compiler.Compiler().compile(hello, "/w/hello.yaml")
PY
docker run --rm -v $R:/w python:3.11-slim sh -c "pip install -q --root-user-action=ignore kfp==2.7.0 >/dev/null 2>&1 && python /w/hello.py" \
  && echo "hello.yaml $(wc -c < $R/hello.yaml) bytes"
