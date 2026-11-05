import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig } from "drizzle-kit";

// npm run db:push:prod → .env.prod 의 DATABASE_URL(운영 DB)로 schema.ts 를 맞춘다
// (개발 DB 는 npm run db:push → drizzle.config.ts → .env)
// drizzle-kit 이 .env 를 먼저 읽어 두기 때문에 process.env 가 아니라 .env.prod 파일 값을 직접 쓴다
const prodUrl = parseEnv(readFileSync(".env.prod", "utf8")).DATABASE_URL; // 파일이 없으면 여기서 멈춤
if (!prodUrl) throw new Error(".env.prod 에 DATABASE_URL 을 넣어 주세요");
console.log(`운영 DB 에 반영: ${new URL(prodUrl).host}`);

export default defineConfig({
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: prodUrl },
});
