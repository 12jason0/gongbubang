// 공부방 출결·학부모 문자 알림 — DB 테이블
// 모든 테이블에 academyId 를 둬서, 원장님이 늘어나도 같은 코드로 데이터만 나눠 쓴다.

import { pgTable, text, boolean, integer, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createId } from "./id";

const id = () => text("id").primaryKey().$defaultFn(createId);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// 공부방 (원장님 계정 1개 = 공부방 1개)
export const academies = pgTable("academies", {
  id: id(),
  name: text("name").notNull(), // 문자 앞에 붙는 이름. 예: 현샘영수
  loginId: text("login_id").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  senderPhone: text("sender_phone").notNull(), // 솔라피에 등록한 발신번호 (원장님 번호)
  // 문자 문구 (비어 있으면 기본 문구). {학원} {이름} {시각} {메모} 를 바꿔 넣는다
  attendanceTemplate: text("attendance_template"),
  feedbackTemplate: text("feedback_template"),
  createdAt: createdAt(),
});

export const students = pgTable(
  "students",
  {
    id: id(),
    academyId: text("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    grade: text("grade").notNull(), // 예: 초5, 중2
    parentPhone: text("parent_phone").notNull(), // 숫자만. 예: 01012345678
    active: boolean("active").notNull().default(true), // 그만둔 학생은 false (기록은 남김)
    createdAt: createdAt(),
  },
  (t) => [index("students_academy_idx").on(t.academyId, t.active)],
);

// 반 — 원장님이 직접 만든다 (예: 초등 영어 A, 중1 수학)
export const classes = pgTable(
  "classes",
  {
    id: id(),
    academyId: text("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    days: text("days").notNull().default(""), // 수업 요일. 0=일 1=월 … 6=토, 쉼표로. 예: "1,3,5"
    time: text("time").notNull().default(""), // 시작 시각 "16:30" (표시·정렬용, 비워도 됨)
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("classes_academy_idx").on(t.academyId, t.active)],
);

// 반 ↔ 학생 (한 학생이 여러 반 가능)
export const classStudents = pgTable(
  "class_students",
  {
    classId: text("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
    studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("class_students_uq").on(t.classId, t.studentId), index("class_students_student_idx").on(t.studentId)],
);

// 하루에 학생당 한 줄. date 는 한국 날짜 "2026-10-30" 문자열 (시간대 꼬임 방지)
export const attendance = pgTable(
  "attendance",
  {
    id: id(),
    academyId: text("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
    studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    status: text("status").notNull(), // PRESENT(출석) / ABSENT(결석)
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
    notifiedAt: timestamp("notified_at", { withTimezone: true }), // 등원 문자 보낸 시각. 있으면 다시 안 보냄
  },
  (t) => [
    uniqueIndex("attendance_student_date_uq").on(t.studentId, t.date),
    index("attendance_academy_date_idx").on(t.academyId, t.date),
  ],
);

// 수업 메모 (학부모 피드백). 하루에 학생당 한 줄
export const notes = pgTable(
  "notes",
  {
    id: id(),
    academyId: text("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
    studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    content: text("content").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }), // 피드백 문자 보낸 시각. 있으면 다시 안 보냄
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("notes_student_date_uq").on(t.studentId, t.date),
    index("notes_academy_date_idx").on(t.academyId, t.date),
  ],
);

// 단체 공지
export const notices = pgTable(
  "notices",
  {
    id: id(),
    academyId: text("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
    target: text("target").notNull(), // "전체" 또는 반 이름
    content: text("content").notNull(),
    recipientCount: integer("recipient_count").notNull(),
    failedCount: integer("failed_count").notNull().default(0),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notices_academy_idx").on(t.academyId, t.sentAt)],
);

// 나간 문자 전부 기록 (실패 원인 확인 + 월 문자 사용량 계산용)
export const messageLogs = pgTable(
  "message_logs",
  {
    id: id(),
    academyId: text("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
    studentId: text("student_id"),
    to: text("to").notNull(),
    kind: text("kind").notNull(), // ATTENDANCE / FEEDBACK / NOTICE
    text: text("text").notNull(),
    status: text("status").notNull(), // SENT / FAILED / TEST (솔라피 키 없을 때)
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [index("message_logs_academy_idx").on(t.academyId, t.createdAt)],
);

export type Student = typeof students.$inferSelect;
export type ClassRow = typeof classes.$inferSelect;
