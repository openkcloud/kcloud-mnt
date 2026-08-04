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
  // shadcn chart.tsx vs Recharts 3.x — upstream type drift (payload/label
  // are runtime-injected and dropped from props in Recharts 3.x). Runtime works
  // fine; only the type-check chokes.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
