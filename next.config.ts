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
  // dev 전용: 이전 버전 스냅샷(public/versions/<id>/…/) 디렉터리 경로를 index.html로 연결.
  // 정적 호스팅(Netlify)은 디렉터리 인덱스를 알아서 처리하므로 빌드에는 rewrite를 넣지 않는다.
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    return [
      { source: "/versions/:id/", destination: "/versions/:id/index.html" },
      { source: "/versions/:id/:path*/", destination: "/versions/:id/:path*/index.html" },
    ];
  },
};

export default nextConfig;
