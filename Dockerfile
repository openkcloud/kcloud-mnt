# openKcloud 포털(AI 노트북 실연동 모드) 이미지
#   빌드:  docker build -t okc-ai-portal:0.1 .
#   NEXT_PUBLIC_KF_API는 빌드 시점에 코드에 박힌다.
#   same-origin = 포털과 같은 주소로 백엔드를 부른다 (Ingress가 /api·/notebook을 백엔드로 넘김)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG KF_API=same-origin
ENV NEXT_PUBLIC_KF_API=${KF_API} \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ARG KF_API=same-origin
# next.config.ts가 실행 시에도 이 값을 보고 서버 모드(정적 export 아님)를 고른다
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 \
    NEXT_PUBLIC_KF_API=${KF_API}
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./
EXPOSE 3000
USER node
CMD ["npx", "next", "start", "-p", "3000"]
