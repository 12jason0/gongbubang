import { defineConfig } from "drizzle-kit";

// npm run db:push → .env 의 DATABASE_URL(개발 DB)에 schema.ts 대로 테이블을 만든다/맞춘다
// 운영 DB 는 npm run db:push:prod → drizzle.prod.config.ts → .env.prod
process.loadEnvFile?.(".env");

export default defineConfig({
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
