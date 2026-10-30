import { defineConfig } from "drizzle-kit";

// npm run db:push → schema.ts 대로 DB 테이블을 만든다/맞춘다
process.loadEnvFile?.(".env");

export default defineConfig({
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
