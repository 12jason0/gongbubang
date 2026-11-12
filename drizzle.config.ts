import { defineConfig } from "drizzle-kit";

// npm run db:push → .env 의 DATABASE_URL(Neon dev 브랜치)에 schema.ts 대로 테이블을 만든다/맞춘다
// 운영 DB(.env.prod)에는 push 하지 않는다 — 다른 브랜치에서 만든 칸까지 지워 버림(2026-11-13 orders.receipt_url).
// 운영은 실행할 SQL(ALTER/CREATE)을 먼저 보여 주고 OK 받은 뒤 손으로 실행

process.loadEnvFile?.(".env");

export default defineConfig({
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
