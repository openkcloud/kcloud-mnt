# 테스트배드 Keycloak 이미지 — 공식 이미지(개발·테스트배드와 같은 26.7.4)에 로그인 테마 openkcloud 만 더한다.
# 빌드·푸시(저장소 루트에서):
#   docker build --platform linux/amd64 -t harbor.io:7443/mnt/keycloak-openkcloud:26.7.4-<git sha> charts/infra/keycloak-theme
#   docker push harbor.io:7443/mnt/keycloak-openkcloud:26.7.4-<git sha>
FROM quay.io/keycloak/keycloak:26.7.4
COPY openkcloud /opt/keycloak/themes/openkcloud
