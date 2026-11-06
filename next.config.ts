import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 원장님 한 명이 쓰는 관리 화면이라 서버는 요청마다 새로 그린다 (서버 캐시 없음)
  // 브라우저 쪽만 짧게: 방금 본 화면으로 30초 안에 돌아가면 다시 안 부름(dynamic), 메뉴에 손 댈 때 미리 받아 둔 화면은 60초(static).
  // 원장님이 고치는 동작(서버 액션)은 revalidatePath 를 부르므로 그때는 이 캐시가 바로 비워져 새 데이터가 보임
  experimental: {
    staleTimes: { dynamic: 30, static: 60 },
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
