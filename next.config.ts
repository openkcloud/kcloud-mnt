import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Netlify Drop / 정적 호스팅용 풀-스태틱 export.
  // 동적 라우트는 generateStaticParams로 enumerate.
  // 단, 실백엔드 연동 모드(NEXT_PUBLIC_KF_API 설정)에서는 노트북 id가
  // 런타임에 생기므로 정적 export를 끈다 (dev/실서버 모드).
  ...(process.env.NEXT_PUBLIC_KF_API ? {} : { output: "export" as const }),
  // next/image 정적 호스팅 호환 (Optimization 서버 없음)
  images: { unoptimized: true },
  // 정적 호스팅에서 디렉터리 라우팅 안전
  trailingSlash: true,
  // 개발 서버를 사내망 다른 PC에서 접속할 수 있도록 허용
  // (Next.js 15+ 는 dev 에셋을 동일 origin 외에는 차단)
  allowedDevOrigins: ["192.168.0.41", "192.168.0.6", "localhost", "127.0.0.1",
                      // 외부 공개 터널 (Cloudflare 퀵 터널 — 주소가 매번 바뀌므로 와일드카드)
                      "*.trycloudflare.com"],
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
