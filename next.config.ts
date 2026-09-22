import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Netlify Drop / 정적 호스팅용 풀-스태틱 export.
  // 동적 라우트는 generateStaticParams로 enumerate.
  output: "export",
  // next/image 정적 호스팅 호환 (Optimization 서버 없음)
  images: { unoptimized: true },
  // 정적 호스팅에서 디렉터리 라우팅 안전
  trailingSlash: true,
  // shadcn chart.tsx vs Recharts 3.x — upstream type drift (payload/label
  // are runtime-injected and dropped from props in Recharts 3.x). Runtime works
  // fine; only the type-check chokes.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // 터널(cloudflared 퀵터널 등) 도메인에서 오는 dev 요청·HMR 웹소켓 허용.
  // 없으면 Next dev가 크로스오리진으로 보고 /_next/* 요청을 거부 → cloudflared
  // 쪽에 "malformed HTTP response Unauthorized" 에러로 나타난다. dev 전용 설정.
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
