import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// 연결은 인스턴스마다 하나의 풀로 재사용 (개발 중 핫리로드 때도 늘어나지 않게 전역에 둔다)
// - max 10: 화면 하나의 쿼리(최대 9개)가 한 번에 나가게 (5면 두 번에 나눠 가서 DB 왕복이 하나 더 생김)
// - idleTimeoutMillis 60초: 새 연결은 TLS+인증으로 왕복 여러 번이라, 화면을 옮겨 다니는 동안은 열어 둔다
// - Neon 은 pooled 주소(호스트에 -pooler)를 쓰면 서버리스 인스턴스가 늘어나도 연결 수가 안 터진다
const globalForDb = globalThis as unknown as { pool?: Pool };

const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 60_000,
    connectionTimeoutMillis: 10_000,
  });

if (!globalForDb.pool) {
  // 쉬고 있던 연결이 끊기면(Neon 자동 절전 등) 프로세스가 죽지 않게 기록만. 풀이 다음 쿼리 때 새로 연결함
  pool.on("error", (e) => console.error("DB 연결 끊김", e.message));
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });
export * from "./schema";
