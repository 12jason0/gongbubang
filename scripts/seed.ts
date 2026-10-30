// 원장님 계정 만들기: npm run seed
// .env 의 SEED_* 값으로 공부방 1개를 만든다. 이미 있으면 비밀번호·이름·발신번호만 갱신.
// SEED_SAMPLE_STUDENTS="true" 이고 학생이 하나도 없으면 예시 반 5개 + 학생 8명을 넣는다.
// npm run seed:reset 은 예시 데이터를 지우고 다시 넣는다 (실사용 계정에는 쓰지 말 것).

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, academies, students, classes, classStudents } from "../src/db";

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

  if (process.env.SEED_SAMPLE_STUDENTS !== "true") return process.exit(0);

  // npm run seed:reset → 이 공부방의 학생·반(출결·메모 포함)을 지우고 예시 데이터로 다시 채움
  if (process.argv.includes("--reset")) {
    await db.delete(students).where(eq(students.academyId, academy.id));
    await db.delete(classes).where(eq(classes.academyId, academy.id));
    console.log("기존 학생·반 삭제");
  }

  const existing = await db.select({ id: students.id }).from(students).where(eq(students.academyId, academy.id)).limit(1);
  if (existing.length > 0) {
    console.log("학생이 이미 있어서 예시 데이터는 건너뜀");
    return process.exit(0);
  }

  // 요일: 0=일 1=월 … 6=토
  const classDefs = [
    { key: "초영", name: "초등 영어", days: "1,3,5", time: "16:00" },
    { key: "초수", name: "초등 수학", days: "2,4", time: "16:00" },
    { key: "중영", name: "중등 영어", days: "1,3", time: "18:00" },
    { key: "중수", name: "중등 수학", days: "2,4", time: "18:00" },
    { key: "고영", name: "고등 영어", days: "2,5", time: "20:00" },
  ];
  const created = await db
    .insert(classes)
    .values(classDefs.map(({ name, days, time }) => ({ academyId: academy.id, name, days, time })))
    .returning();
  const classId = Object.fromEntries(classDefs.map((c, i) => [c.key, created[i].id]));

  const studentDefs = [
    { name: "김하늘", grade: "초4", parentPhone: "01011112222", in: ["초영", "초수"] },
    { name: "강지우", grade: "초3", parentPhone: "01020001001", in: ["초영"] },
    { name: "이도윤", grade: "초6", parentPhone: "01033334444", in: ["초영", "초수"] },
    { name: "윤서아", grade: "초5", parentPhone: "01020001002", in: ["초수"] },
    { name: "이서윤", grade: "중1", parentPhone: "01033334444", in: ["중영", "중수"] }, // 도윤이와 형제
    { name: "박지호", grade: "중2", parentPhone: "01055556666", in: ["중영"] },
    { name: "오시윤", grade: "중2", parentPhone: "01020001006", in: ["중수"] },
    { name: "최유나", grade: "고1", parentPhone: "01077778888", in: ["고영"] },
  ];
  const createdStudents = await db
    .insert(students)
    .values(studentDefs.map(({ name, grade, parentPhone }) => ({ academyId: academy.id, name, grade, parentPhone })))
    .returning();
  await db
    .insert(classStudents)
    .values(studentDefs.flatMap((s, i) => s.in.map((k) => ({ classId: classId[k], studentId: createdStudents[i].id }))));

  console.log(`예시 반 ${created.length}개, 학생 ${createdStudents.length}명 추가`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
