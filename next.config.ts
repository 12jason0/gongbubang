import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 원장님 한 명이 쓰는 관리 화면이라 서버는 요청마다 새로 그린다 (서버 캐시 없음)
  // 해 보고 뺀 것 (운영에서 재 보니 첫 이동이 0.3초 → 1.3초로 오히려 느려짐 — 데이터는 0.4초에 왔는데 화면이 늦게 바뀜):
  //  - experimental.staleTimes.dynamic(방금 본 화면 30초 다시 쓰기)
  //  - 메뉴에 손 댈 때 router.prefetch 로 화면 전체 미리 받기
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
