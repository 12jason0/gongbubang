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
  registrationNo: text("registration_no").notNull().default(""), // 개인과외교습자 신고번호 (영수증 원부용)
  // 문자 문구 — 원장님은 빈칸만 채우고, 학생 이름·시각·메모 자리는 코드가 정한다 (lib/templates.ts)
  attendanceEnding: text("attendance_ending").notNull().default("등원했습니다."), // 등원 문자 끝 문장
  attendanceExtra: text("attendance_extra").notNull().default(""), // 등원 문자 덧붙일 말 (선택)
  feedbackTitle: text("feedback_title").notNull().default("오늘 수업 피드백"), // 피드백 문자 첫 줄
  feedbackClosing: text("feedback_closing").notNull().default(""), // 피드백 문자 마지막 인사 (선택)
  // 출석 체크하면 학부모님께 등원 카톡 보내기. 새로 가입한 공부방은 false 로 만든다 (기존 공부방은 켜진 채로 유지)
  attendanceNotify: boolean("attendance_notify").notNull().default(true),
  // 이용 기간·결제
  ownerPhone: text("owner_phone").notNull().default(""), // 원장님 연락처 (가입 때 입력, 두나가 연락용)
  serviceUntil: timestamp("service_until", { withTimezone: true }), // 이 시각까지 사용 가능. null = 기한 없음(관리자·데모 계정)
  plan: text("plan").notNull().default("TRIAL"), // 요금제 TRIAL(무료 체험) / BASIC(기본) / PLUS(넉넉). 예전 PAID = BASIC (lib/pricing.ts)
  // 카톡 통수 — periodStart(마지막 결제일, 없으면 가입일)부터 한 달씩 끊어서 센다 (lib/plan.ts quotaState)
  periodStart: timestamp("period_start", { withTimezone: true }),
  msgPeriod: text("msg_period").notNull().default(""), // msgUsed 를 세고 있는 기간의 시작 (ISO). 기간이 바뀌면 0부터
  msgUsed: integer("msg_used").notNull().default(0), // 이번 기간에 보낸 통수 (실패·접수 거절은 돌려놓음)
  // 탈퇴: 이 줄은 지우지 않고(결제 기록 orders 를 법정 기간 보관하려고) 이름·연락처·아이디·비밀번호를 비우고 시각만 남긴다
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  // 탈퇴한 원장님 연락처를 되돌릴 수 없게 바꾼 값 — 같은 번호로 다시 가입해도 무료 체험을 또 주지 않으려고 (lib/account.ts)
  // 가입 때도 넣는다(체험을 쓴 번호). 탈퇴해서 연락처를 지워도 이 값으로 같은 번호 재가입을 알아본다
  trialPhoneHash: text("trial_phone_hash").notNull().default(""),
  // 학부모 번호가 다른 공부방과 5개 이상 겹쳐 체험을 끝낸 계정: "" / BLOCKED(막힘) / CLEARED(관리자가 풀어줌 → 다시 검사 안 함)
  trialBlock: text("trial_block").notNull().default(""),
  trialBlockNote: text("trial_block_note").notNull().default(""), // 어느 계정과 몇 개 겹쳤는지 (관리자 확인용)
  creditWon: integer("credit_won").notNull().default(0), // (안 씀) 예전 충전금 잔액 — 요금제로 바뀌며 기록만 남김
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
    birthDate: text("birth_date"), // 생년월일 "2014-03-02" (선택, 영수증 원부용)
    monthlyFee: integer("monthly_fee"), // 월 교습비(원, 선택) — 납부 기록 미리 채우기·미납 금액·원비 안내
    dueDay: integer("due_day"), // 납부일 매달 1~31 (31 = 말일, 선택). 없으면 미납 판단은 예전처럼(기록 없으면 미납)
    // 학부모 동의 — AGREED(동의) / PENDING(대기) / DECLINED(거부). 동의한 학부모님께만 등원·피드백·공지·원비 안내가 간다
    // (이 칸이 생기기 전 학생은 원장님이 체크하고 추가했으므로 AGREED)
    consent: text("consent").notNull().default("AGREED"),
    consentBy: text("consent_by").notNull().default("OWNER"), // OWNER(원장님이 종이·문자로 받고 체크) / PARENT(학부모님이 링크에서 누름)
    consentAt: timestamp("consent_at", { withTimezone: true }), // 동의·거부한 시각
    consentRequestedAt: timestamp("consent_requested_at", { withTimezone: true }), // 동의 요청 카톡이 처음 나간 시각 (학부모당 첫 1통은 무료)
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
    time: text("time").notNull().default(""), // 시작 시각 "16:30" (표시·정렬용, 비워도 됨). 있으면 달력에 매주 표시
    endTime: text("end_time").notNull().default(""), // 끝 시각 "18:00" (선택, 달력 표시용)
    color: text("color").notNull().default(""), // 반 색 lib/class-colors.ts 키 (예: "blue"). 비면 id 로 정해진 색
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
    status: text("status").notNull(), // PRESENT(출석) / ABSENT(결석) / ""(문자 나간 뒤 체크만 지움)
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

// 교습비 납부 기록 — 원장님이 직접 입력 (결제선생·카드·계좌이체·현금, 선납 포함). 영수증 원부의 근거
export const payments = pgTable(
  "payments",
  {
    id: id(),
    academyId: text("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
    studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    paidOn: text("paid_on").notNull(), // 받은 날 "2026-10-30"
    period: text("period").notNull(), // 교습기간(월) "2026-11" — 선납이면 앞으로의 달
    subject: text("subject").notNull(), // 교습과목. 예: 영어, 수학
    tuition: integer("tuition").notNull(), // 교습비 (원)
    otherFee: integer("other_fee").notNull().default(0), // 기타경비 (원, 교재비 등)
    method: text("method").notNull(), // lib/money.ts PAYMENT_METHODS 중 하나
    memo: text("memo").notNull().default(""), // 원비가 바뀐 이유 등 (예: 결석 2회 차감)
    createdAt: createdAt(),
  },
  (t) => [
    index("payments_academy_period_idx").on(t.academyId, t.period),
    index("payments_student_idx").on(t.studentId),
  ],
);

// 나간 문자 전부 기록 (실패 원인 확인 + 월 문자 사용량 계산용)
export const messageLogs = pgTable(
  "message_logs",
  {
    id: id(),
    academyId: text("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
    studentId: text("student_id"),
    to: text("to").notNull(),
    kind: text("kind").notNull(), // ATTENDANCE / FEEDBACK / NOTICE / PAYMENT(원비 안내)
    channel: text("channel").notNull().default("SMS"), // SMS(문자) / ALIMTALK(카카오 알림톡, 실패 시 솔라피가 문자 대체 발송)
    text: text("text").notNull(),
    status: text("status").notNull(), // SENT / FAILED / TEST (솔라피 키 없을 때)
    error: text("error"),
    refDate: text("ref_date"), // 등원·피드백: 출석부 날짜 "2026-10-30" / 원비 안내: 교습 월 "2026-10" (다시 보내기용)
    resolvedAt: timestamp("resolved_at", { withTimezone: true }), // 실패 문자를 다시 보냈거나 더 보낼 필요 없어진 시각
    createdAt: createdAt(),
  },
  (t) => [index("message_logs_academy_idx").on(t.academyId, t.createdAt)],
);

// (안 씀) 예전 충전금 내역 — 요금제로 바뀌며 기록만 남김. 충전(+) / 발송 차감(-) / 실패 환불(+) / 관리자 조정
export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: id(),
    academyId: text("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(), // + 들어옴 / - 나감 (원)
    balanceAfter: integer("balance_after").notNull(),
    kind: text("kind").notNull(), // CHARGE / USE / REFUND / ADMIN
    memo: text("memo").notNull().default(""), // 예: "등원 3건", "카드 충전"
    createdAt: createdAt(),
  },
  (t) => [index("credit_ledger_academy_idx").on(t.academyId, t.createdAt)],
);

// 결제 주문 (토스페이먼츠). id 가 그대로 토스 orderId
export const orders = pgTable(
  "orders",
  {
    id: id(),
    academyId: text("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // BASIC / PLUS (1개월 요금제). 예전 주문: SUBSCRIPTION(=BASIC) / CREDIT(충전금)
    amount: integer("amount").notNull(), // 결제 금액(원). 승인할 때 토스가 돌려준 금액과 같아야 함
    status: text("status").notNull().default("READY"), // READY → CONFIRMING → DONE / FAILED
    paymentKey: text("payment_key"),
    failReason: text("fail_reason"),
    createdAt: createdAt(),
    doneAt: timestamp("done_at", { withTimezone: true }),
  },
  (t) => [index("orders_academy_idx").on(t.academyId, t.createdAt)],
);

// 탈퇴한 공부방의 학부모 번호 — 번호는 지우고 되돌릴 수 없는 값(HMAC)만 남긴다.
// 탈퇴 뒤 같은 학부모 명단으로 다시 가입해 무료 체험을 또 받는지 비교하는 데만 쓴다 (lib/account.ts)
export const deletedParentHashes = pgTable(
  "deleted_parent_hashes",
  {
    academyId: text("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
    hash: text("hash").notNull(),
  },
  (t) => [uniqueIndex("deleted_parent_hashes_uq").on(t.academyId, t.hash), index("deleted_parent_hashes_hash_idx").on(t.hash)],
);

// ── 달력 ── 매주 수업은 반(classes)의 요일·시각을 그대로 쓰고, 여기엔 그날만 바뀌는 것과 메모만 둔다
// 그날만 바뀌는 수업: EXTRA(보강 — 이름·시간) / CANCEL(휴강 — 반의 매주 수업을 그날만 뺌)
export const calendarChanges = pgTable(
  "calendar_changes",
  {
    id: id(),
    academyId: text("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // "2026-11-05"
    kind: text("kind").notNull(),
    classId: text("class_id").references(() => classes.id, { onDelete: "cascade" }), // CANCEL 만
    name: text("name").notNull().default(""), // EXTRA 만
    start: text("start").notNull().default(""),
    end: text("end").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("calendar_changes_academy_date_idx").on(t.academyId, t.date), uniqueIndex("calendar_changes_cancel_uq").on(t.classId, t.date)],
);

// 날짜별 메모 (댓글처럼 쌓임). 예: "공지 보내는 날"
export const calendarMemos = pgTable(
  "calendar_memos",
  {
    id: id(),
    academyId: text("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    content: text("content").notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }), // 고친 적 있으면
  },
  (t) => [index("calendar_memos_academy_date_idx").on(t.academyId, t.date)],
);

export type Student = typeof students.$inferSelect;
export type ClassRow = typeof classes.$inferSelect;
