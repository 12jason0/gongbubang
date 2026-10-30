import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 원장님 한 명이 쓰는 관리 화면이라 모든 화면을 요청마다 새로 그린다 (캐시 없음)
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
