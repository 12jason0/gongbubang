import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 원장님 한 명이 쓰는 관리 화면이라 서버는 요청마다 새로 그린다 (서버 캐시 없음)
  // 브라우저 쪽만 짧게: 방금 본 화면으로 30초 안에 돌아가면 서버를 다시 안 부름 (운영 측정 다시 가기 0.3초 → 0.05초).
  // 원장님이 고치는 동작(서버 액션)은 revalidatePath 를 부르므로 그때는 이 캐시가 바로 비워져 새 데이터가 보임
  experimental: {
    staleTimes: { dynamic: 30 },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
