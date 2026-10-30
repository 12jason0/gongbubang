// 원장님 계정 만들기: npm run seed
// .env 의 SEED_* 값으로 공부방 1개를 만든다. 이미 있으면 비밀번호·이름·발신번호만 갱신.

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, academies, students } from "../src/db";

async function main() {
  const name = process.env.SEED_ACADEMY_NAME ?? "현샘영수";
  const loginId = process.env.SEED_LOGIN_ID ?? "hyunsaem";
  const password = process.env.SEED_PASSWORD;
  const senderPhone = (process.env.SEED_SENDER_PHONE ?? "").replace(/\D/g, "");

  if (!password || password.length < 8) throw new Error("SEED_PASSWORD 를 8자 이상으로 넣어주세요");
  const passwordHash = await bcrypt.hash(password, 10);

  const [academy] = await db
    .insert(academies)
    .values({ name, loginId, passwordHash, senderPhone })
    .onConflictDoUpdate({ target: academies.loginId, set: { name, passwordHash, senderPhone } })
    .returning();
  console.log(`공부방 준비 완료: ${academy.name} (아이디 ${academy.loginId})`);

  if (process.env.SEED_SAMPLE_STUDENTS === "true") {
    const existing = await db.select({ id: students.id }).from(students).where(eq(students.academyId, academy.id)).limit(1);
    if (existing.length === 0) {
      await db.insert(students).values(
        [
          { name: "김하늘", grade: "초4", group: "초등", parentPhone: "01011112222" },
          { name: "이도윤", grade: "초6", group: "초등", parentPhone: "01033334444" },
          { name: "이서윤", grade: "중1", group: "중등", parentPhone: "01033334444" }, // 도윤이와 형제
          { name: "박지호", grade: "중2", group: "중등", parentPhone: "01055556666" },
          { name: "최유나", grade: "고1", group: "고등", parentPhone: "01077778888" },
        ].map((s) => ({ ...s, academyId: academy.id })),
      );
      console.log("예시 학생 5명 추가");
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
