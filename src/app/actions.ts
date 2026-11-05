"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { db, academies, students, attendance, notes, notices, classes, classStudents, payments, messageLogs, deletedParentHashes } from "@/db";
import { createSession, deleteSession, requireAcademy, requireActiveAcademy } from "@/lib/session";
import { sendMessages, smsBytes } from "@/lib/sms";
import { unresolvedFailures } from "@/lib/failed";
import { attendanceText, byGradeName, feedbackText, monthLabel, NOTICE_MAX_CHARS, noticeLinkText, noticeText, parseDays, paymentText } from "@/lib/templates";
import { formatDateLabel, isValidDate, isValidMonth, spokenTimeKST, thisMonthKST, todayKST } from "@/lib/date";
import { appUrl, consentLink, feedbackLink, noticeLink, readConsentCode, renderAlimtalk } from "@/lib/alimtalk";
import { isPaymentMethod, parseWon } from "@/lib/money";
import { isValidMobile, normalizePhone } from "@/lib/phone";
import { parseRoster, rosterKey, ROSTER_MAX_LINES } from "@/lib/roster";
import { TRIAL_DAYS, isPaidTier } from "@/lib/pricing";
import { endTrialIfOverlap, parentPhoneHash, trialPhoneHash, trialUsedByPhone } from "@/lib/account";
import { PHONE_VERIFY, phoneCodeOk } from "@/lib/phone-verify";
import { billingReady, createOrderRow, orderName, priceFor, type OrderKind } from "@/lib/billing";

// ───────────────────────── 로그인 ─────────────────────────

export async function login(_prev: string | null, formData: FormData): Promise<string | null> {
  const loginId = String(formData.get("loginId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!loginId || !password) return "아이디와 비밀번호를 입력해 주세요.";

  const [academy] = await db
    .select()
    .from(academies)
    .where(and(eq(academies.loginId, loginId), isNull(academies.deletedAt)));
  if (!academy || !(await bcrypt.compare(password, academy.passwordHash))) {
    return "아이디 또는 비밀번호가 맞지 않아요.";
  }
  await createSession(academy.id);
  // PC(화면 넓음)는 대시보드, 휴대폰은 출석부가 첫 화면
  redirect(formData.get("pc") === "1" ? "/dashboard" : "/");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}

// ───────────────────────── 회원가입 (원장님이 직접) ─────────────────────────

/**
 * 가입하면 바로 로그인되고 무료 체험(TRIAL_DAYS일)이 시작된다.
 * 체험 중 카톡은 30통까지 (lib/pricing.ts PLANS.TRIAL).
 * 문자 대체발송·문자 공지에 쓰는 발신번호는 공용 번호(DEFAULT_SENDER_PHONE) — 원장님 번호는 연락용으로만 보관.
 */
export async function signup(_prev: string | null, formData: FormData): Promise<string | null> {
  const name = String(formData.get("name") ?? "").trim();
  const loginId = String(formData.get("loginId") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const ownerPhone = normalizePhone(String(formData.get("ownerPhone") ?? ""));

  if (!name || name.length > 20) return "공부방 이름을 1~20자로 입력해 주세요.";
  if (!/^[a-z0-9_]{4,20}$/.test(loginId)) return "아이디는 영문 소문자·숫자 4~20자로 만들어 주세요.";
  if (password.length < 8) return "비밀번호는 8자 이상으로 만들어 주세요.";
  if (!isValidMobile(ownerPhone)) return "원장님 휴대폰 번호를 확인해 주세요.";
  if (formData.get("agree") !== "on") return "이용약관과 개인정보 처리방침에 동의해 주세요.";
  if (PHONE_VERIFY && !(await phoneCodeOk(ownerPhone, String(formData.get("phoneCode") ?? "")))) {
    return "휴대폰 인증번호를 확인해 주세요.";
  }

  const [taken] = await db.select({ id: academies.id }).from(academies).where(eq(academies.loginId, loginId));
  if (taken) return "이미 쓰고 있는 아이디예요. 다른 아이디로 해 주세요.";

  // 이 번호로 체험을 쓴 계정(살아 있는 계정·탈퇴 계정)이 있으면 무료 체험 없이 바로 요금제 결제로 (lib/account.ts)
  const usedTrial = await trialUsedByPhone(ownerPhone);

  const [created] = await db
    .insert(academies)
    .values({
      name,
      loginId,
      passwordHash: await bcrypt.hash(password, 10),
      ownerPhone,
      senderPhone: (process.env.DEFAULT_SENDER_PHONE ?? "").replace(/\D/g, ""),
      plan: "TRIAL",
      serviceUntil: usedTrial ? new Date() : new Date(Date.now() + TRIAL_DAYS * 86_400_000),
      attendanceNotify: false, // 등원 카톡은 원장님이 설정에서 켤 때부터
      trialPhoneHash: trialPhoneHash(ownerPhone), // 체험을 쓴 번호 — 연락처를 바꾸거나 탈퇴해도 남는다
    })
    .onConflictDoNothing({ target: academies.loginId })
    .returning({ id: academies.id });
  if (!created) return "이미 쓰고 있는 아이디예요. 다른 아이디로 해 주세요.";

  await createSession(created.id);
  redirect(usedTrial ? "/billing?trial=used" : "/students");
}

// ───────────────────────── 출석 ─────────────────────────

export type SmsState = "sent" | "test" | "failed" | "none" | "noconsent"; // noconsent: 학부모 동의 전이라 안 보냄

async function getOwnStudent(academyId: string, studentId: string) {
  const [s] = await db
    .select()
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.academyId, academyId)));
  return s ?? null;
}

// ── 학부모님께 가는 메시지 한 통 (문자판 + 알림톡판). 어느 쪽으로 나갈지는 lib/sms.ts 가 정함 ──

type Wording = Parameters<typeof attendanceText>[0];
type StudentLite = { id: string; name: string; parentPhone: string };

function attendanceMessage(academy: Wording, s: StudentLite, time: string, date: string) {
  return {
    to: s.parentPhone,
    text: attendanceText(academy, s.name, time),
    alimtalk: { key: "ATTENDANCE" as const, vars: { 학원: academy.name, 이름: s.name, 시각: time } },
    studentId: s.id,
    refDate: date,
  };
}

function feedbackMessage(academy: Wording, s: StudentLite, note: { id: string; content: string; date: string }) {
  return {
    to: s.parentPhone,
    text: feedbackText(academy, s.name, note.content),
    alimtalk: {
      key: "FEEDBACK" as const,
      vars: { 학원: academy.name, 이름: s.name, 날짜: formatDateLabel(note.date), 링크: feedbackLink(note.id) },
    },
    studentId: s.id,
    refDate: note.date,
  };
}

function paymentMessage(academy: Wording, s: StudentLite, month: string) {
  return {
    to: s.parentPhone,
    text: paymentText(academy.name, s.name, monthLabel(month)),
    alimtalk: { key: "PAYMENT" as const, vars: { 학원: academy.name, 이름: s.name, 월: monthLabel(month) } },
    studentId: s.id,
    refDate: month,
  };
}

/**
 * 출석/결석 체크.
 * - 오늘 날짜에 "출석"을 누르면 학부모에게 등원 문자 (하루 한 번만). 설정에서 등원 카톡을 꺼 두면 기록만
 * - 같은 버튼을 다시 누르면 체크 해제. 등원 문자가 이미 나갔으면 줄은 남기고 상태만 비움
 *   (보낸 시각이 남아 있어서 다시 출석을 눌러도 문자는 또 안 나감)
 * - 지난 날짜를 고치는 건 기록만 바뀌고 문자는 안 나감
 */
export async function setAttendance(
  studentId: string,
  date: string,
  status: "PRESENT" | "ABSENT" | null,
): Promise<{ ok: boolean; sms: SmsState; error?: string }> {
  const academy = await requireActiveAcademy();
  if (!isValidDate(date)) return { ok: false, sms: "none", error: "날짜가 올바르지 않아요." };
  const student = await getOwnStudent(academy.id, studentId);
  if (!student) return { ok: false, sms: "none", error: "학생을 찾을 수 없어요." };

  if (status === null) {
    const where = and(eq(attendance.studentId, studentId), eq(attendance.date, date));
    await db.delete(attendance).where(and(where, isNull(attendance.notifiedAt)));
    await db.update(attendance).set({ status: "" }).where(where); // 남은 건 문자 나간 줄뿐 — 상태만 비움
    revalidatePath("/");
    return { ok: true, sms: "none" };
  }

  const [row] = await db
    .insert(attendance)
    .values({ academyId: academy.id, studentId, date, status })
    .onConflictDoUpdate({
      target: [attendance.studentId, attendance.date],
      set: { status, checkedAt: new Date() },
    })
    .returning();

  let sms: SmsState = "none";
  let error: string | undefined;

  if (status === "PRESENT" && date === todayKST() && academy.attendanceNotify && student.consent !== "AGREED") {
    sms = "noconsent";
  } else if (status === "PRESENT" && date === todayKST() && academy.attendanceNotify) {
    // 동시에 두 번 눌려도 한 번만 나가도록: notifiedAt 이 비어 있을 때만 "내가 보낸다"고 먼저 찍는다
    const claimed = await db
      .update(attendance)
      .set({ notifiedAt: new Date() })
      .where(and(eq(attendance.id, row.id), isNull(attendance.notifiedAt)))
      .returning({ id: attendance.id });

    if (claimed.length === 1) {
      const [result] = await sendMessages(academy, "ATTENDANCE", [attendanceMessage(academy, student, spokenTimeKST(), date)]);
      if (result.ok) {
        sms = result.test ? "test" : "sent";
      } else {
        // 실패하면 표시를 되돌려서 다시 누르면 재발송되게
        await db.update(attendance).set({ notifiedAt: null }).where(eq(attendance.id, row.id));
        sms = "failed";
        error = result.error;
      }
    }
  }

  revalidatePath("/");
  return { ok: true, sms, error };
}

// ───────────────────────── 수업 메모 / 피드백 ─────────────────────────

/** 메모 저장. 이미 학부모에게 보낸 메모는 고칠 수 없음 */
export async function saveNote(studentId: string, date: string, content: string) {
  const academy = await requireActiveAcademy();
  if (!isValidDate(date)) return { ok: false, error: "날짜가 올바르지 않아요." };
  if (!(await getOwnStudent(academy.id, studentId))) return { ok: false, error: "학생을 찾을 수 없어요." };

  const text = content.trim().slice(0, 900);
  const [existing] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.studentId, studentId), eq(notes.date, date)));

  if (existing?.sentAt) return { ok: false, error: "이미 보낸 메모라 고칠 수 없어요." };

  if (!text) {
    if (existing) await db.delete(notes).where(eq(notes.id, existing.id));
  } else if (existing) {
    await db.update(notes).set({ content: text, updatedAt: new Date() }).where(eq(notes.id, existing.id));
  } else {
    await db.insert(notes).values({ academyId: academy.id, studentId, date, content: text });
  }
  revalidatePath("/");
  return { ok: true };
}

/** 그날 아직 안 보낸 메모를 학부모들에게 한 번에 발송 */
export async function sendFeedbacks(date: string) {
  const academy = await requireActiveAcademy();
  if (!isValidDate(date)) return { ok: false, sent: 0, failed: 0, waiting: 0, test: false, error: "날짜가 올바르지 않아요." };

  // 보낼 메모를 먼저 "보냄"으로 찍어서 확보 (두 번 눌러도 중복 발송 안 됨)
  const claimed = await db
    .update(notes)
    .set({ sentAt: new Date() })
    .where(
      and(eq(notes.academyId, academy.id), eq(notes.date, date), isNull(notes.sentAt), ne(notes.content, "")),
    )
    .returning();

  if (claimed.length === 0) return { ok: true, sent: 0, failed: 0, waiting: 0, test: false };

  const studentRows = await db
    .select()
    .from(students)
    .where(inArray(students.id, claimed.map((n) => n.studentId)));
  const byId = new Map(studentRows.map((s) => [s.id, s]));

  // 그만둔 학생, 학부모 동의 전인 학생은 빼고 메모는 "안 보냄"으로 되돌림
  const sendable = (n: (typeof claimed)[number]) => byId.get(n.studentId)?.active && byId.get(n.studentId)?.consent === "AGREED";
  const targets = claimed.filter(sendable);
  const skipped = claimed.filter((n) => !sendable(n));
  const waiting = skipped.filter((n) => byId.get(n.studentId)?.active).length;
  if (skipped.length) {
    await db.update(notes).set({ sentAt: null }).where(inArray(notes.id, skipped.map((n) => n.id)));
  }

  const results = await sendMessages(
    academy,
    "FEEDBACK",
    targets.map((n) => feedbackMessage(academy, byId.get(n.studentId)!, n)),
  );

  const failedIds = targets.filter((_, i) => !results[i].ok).map((n) => n.id);
  if (failedIds.length) {
    await db.update(notes).set({ sentAt: null }).where(inArray(notes.id, failedIds));
  }

  revalidatePath("/");
  return {
    ok: failedIds.length === 0,
    sent: targets.length - failedIds.length,
    failed: failedIds.length,
    waiting,
    test: results.some((r) => r.test),
    error: results.find((r) => !r.ok)?.error,
  };
}

// ───────────────────────── 실패한 문자 다시 보내기 ─────────────────────────

/**
 * 실패한 문자를 다시 보낸다. 중복 방지:
 * - 실패 기록을 먼저 "해결됨"으로 찍어서 확보 (두 번 눌러도 한 번만)
 * - 등원: 오늘 출석이고 아직 문자 안 나간 줄만 notifiedAt 을 찍고 보냄 (실패하면 되돌림)
 * - 피드백: 아직 안 보낸 메모만 sentAt 을 찍고 지금 메모로 보냄 (실패하면 되돌림)
 * - 공지: 실패한 번호로 같은 내용 다시
 */
export async function resendFailedMessages() {
  const academy = await requireActiveAcademy();
  const logs = await db.select().from(messageLogs).where(unresolvedFailures(academy.id)).orderBy(messageLogs.createdAt);

  let sent = 0;
  let failed = 0;
  let skipped = 0; // 이미 나갔거나(다른 경로로 재발송) 출석이 취소돼서 보낼 필요 없음
  const today = todayKST();

  for (const log of logs) {
    const mine = await db
      .update(messageLogs)
      .set({ resolvedAt: new Date() })
      .where(and(eq(messageLogs.id, log.id), isNull(messageLogs.resolvedAt)))
      .returning({ id: messageLogs.id });
    if (mine.length === 0) continue;

    const student = log.studentId ? await getOwnStudent(academy.id, log.studentId) : null;
    // 그사이 동의를 거두었거나 아직 동의 전이면 안내는 안 보냄 (동의 요청만 예외)
    if (student && log.kind !== "CONSENT" && student.consent !== "AGREED") {
      skipped++;
      continue;
    }

    if (log.kind === "ATTENDANCE" && student && log.refDate === today && academy.attendanceNotify) {
      const [row] = await db
        .update(attendance)
        .set({ notifiedAt: new Date() })
        .where(
          and(
            eq(attendance.studentId, student.id),
            eq(attendance.date, today),
            eq(attendance.status, "PRESENT"),
            isNull(attendance.notifiedAt),
          ),
        )
        .returning({ id: attendance.id, checkedAt: attendance.checkedAt });
      if (!row) {
        skipped++;
        continue;
      }
      // 시각은 출석을 누른 그때 시각으로
      const [r] = await sendMessages(academy, "ATTENDANCE", [attendanceMessage(academy, student, spokenTimeKST(row.checkedAt), today)]);
      if (r.ok) sent++;
      else {
        failed++;
        await db.update(attendance).set({ notifiedAt: null }).where(eq(attendance.id, row.id));
      }
    } else if (log.kind === "FEEDBACK" && student && log.refDate) {
      const [note] = await db
        .update(notes)
        .set({ sentAt: new Date() })
        .where(and(eq(notes.studentId, student.id), eq(notes.date, log.refDate), isNull(notes.sentAt), ne(notes.content, "")))
        .returning();
      if (!note || !student.active) {
        if (note) await db.update(notes).set({ sentAt: null }).where(eq(notes.id, note.id));
        skipped++;
        continue;
      }
      const [r] = await sendMessages(academy, "FEEDBACK", [feedbackMessage(academy, student, note)]);
      if (r.ok) sent++;
      else {
        failed++;
        await db.update(notes).set({ sentAt: null }).where(eq(notes.id, note.id));
      }
    } else if (log.kind === "PAYMENT" && student && log.refDate) {
      // 그사이 납부했거나 그만둔 학생이면 안 보냄
      const [paid] = await db
        .select({ id: payments.id })
        .from(payments)
        .where(and(eq(payments.studentId, student.id), eq(payments.period, log.refDate)))
        .limit(1);
      if (paid || !student.active) {
        skipped++;
        continue;
      }
      const [r] = await sendMessages(academy, "PAYMENT", [paymentMessage(academy, student, log.refDate)]);
      if (r.ok) sent++;
      else failed++;
    } else if (log.kind === "NOTICE") {
      const [r] = await sendMessages(academy, "NOTICE", [{ to: log.to, text: log.text }]);
      if (r.ok) sent++;
      else failed++;
    } else if (log.kind === "CONSENT" && student?.active && student.consent === "PENDING" && appUrl()) {
      const [r] = await sendConsentTo(academy, [[student.parentPhone, [student]]]);
      if (r.ok) sent++;
      else failed++;
    } else {
      skipped++;
    }
  }

  revalidatePath("/");
  revalidatePath("/stats");
  return { sent, failed, skipped };
}

// ───────────────────────── 원비 안내 (미납) ─────────────────────────

/**
 * 고른 학생들의 학부모님께 "○월분 교습비 납부 안내".
 * - 이 공부방의 다니는 학생 + 그 달 납부 기록이 없는 학생에게만 (화면 목록을 믿지 않고 다시 확인)
 * - 결제는 원장님이 지금처럼 결제선생 등으로 받음. 여기서는 안내만
 */
export async function sendPaymentReminders(month: string, studentIds: string[]) {
  const academy = await requireActiveAcademy();
  if (!isValidMonth(month) || month > thisMonthKST()) return { ok: false, sent: 0, failed: 0, test: false, error: "이번 달까지만 안내할 수 있어요." };
  if (studentIds.length === 0) return { ok: false, sent: 0, failed: 0, test: false, error: "안내할 학생을 골라 주세요." };

  const targets = await db
    .select()
    .from(students)
    .where(and(eq(students.academyId, academy.id), eq(students.active, true), inArray(students.id, studentIds)));
  const paid = new Set(
    (
      await db
        .select({ studentId: payments.studentId })
        .from(payments)
        .where(and(eq(payments.academyId, academy.id), eq(payments.period, month)))
    ).map((p) => p.studentId),
  );
  const unpaid = targets.filter((s) => !paid.has(s.id) && s.consent === "AGREED");
  const waiting = targets.filter((s) => !paid.has(s.id) && s.consent !== "AGREED").length;
  if (unpaid.length === 0) {
    return waiting
      ? { ok: false, sent: 0, failed: 0, waiting, test: false, error: `학부모 동의 대기 ${waiting}명이라 보내지 않았어요` }
      : { ok: true, sent: 0, failed: 0, waiting, test: false };
  }

  const results = await sendMessages(academy, "PAYMENT", unpaid.map((s) => paymentMessage(academy, s, month)));
  revalidatePath("/stats");
  revalidatePath("/");
  const failedN = results.filter((r) => !r.ok).length;
  return {
    ok: failedN === 0,
    sent: unpaid.length - failedN,
    failed: failedN,
    waiting,
    test: results.some((r) => r.test),
    error: results.find((r) => !r.ok)?.error,
  };
}

// ───────────────────────── 단체 공지 ─────────────────────────

export type NoticeResult = { ok: boolean; message: string } | null;

/**
 * 단체 공지 — 받을 학생: 전체(mode=all) / 반(mode=class, classId) / 개별(mode=pick, studentIds).
 * 학부모마다 따로 "[공부방] 김민수 학부모님, 새 공지가 있어요 + 링크(/n/…)" — 링크를 열면 공지 전체.
 * 형제처럼 학부모 번호가 같으면 한 번만, 이름은 "김민수·김민지".
 * APP_URL 이 없어서 링크를 못 만들면 예전처럼 문자에 공지 전체를 넣는다.
 */
export async function sendNotice(_prev: NoticeResult, formData: FormData): Promise<NoticeResult> {
  const academy = await requireActiveAcademy();
  const mode = String(formData.get("mode") ?? "all");
  const content = String(formData.get("content") ?? "").trim();

  if (!content) return { ok: false, message: "공지 내용을 입력해 주세요." };
  if (content.length > NOTICE_MAX_CHARS) return { ok: false, message: `공지는 ${NOTICE_MAX_CHARS.toLocaleString("ko-KR")}자까지 쓸 수 있어요.` };
  const linkMode = !!appUrl();
  if (!linkMode && smsBytes(noticeText(academy.name, content)) > 2000) {
    return { ok: false, message: "공지가 너무 길어요. 한글 약 1,000자까지 보낼 수 있어요." };
  }

  // 받을 학생 — 화면 값을 믿지 않고 이 공부방의 다니는 학생만 다시 고른다
  // 학부모 동의한 학생만 (동의 대기·거부는 빠짐 — 공지 화면에서 미리 알려 줌)
  const mine = and(eq(students.academyId, academy.id), eq(students.active, true), eq(students.consent, "AGREED"));
  const cols = { id: students.id, name: students.name, grade: students.grade, phone: students.parentPhone };
  let targetName = "전체";
  let rows: { id: string; name: string; grade: string; phone: string }[];
  if (mode === "class") {
    const [cls] = await db
      .select()
      .from(classes)
      .where(and(eq(classes.id, String(formData.get("classId") ?? "")), eq(classes.academyId, academy.id)));
    if (!cls) return { ok: false, message: "받는 반을 다시 선택해 주세요." };
    targetName = cls.name;
    rows = await db
      .select(cols)
      .from(classStudents)
      .innerJoin(students, eq(students.id, classStudents.studentId))
      .where(and(eq(classStudents.classId, cls.id), mine));
  } else if (mode === "pick") {
    const ids = formData.getAll("studentIds").map(String).slice(0, 500);
    if (ids.length === 0) return { ok: false, message: "받을 학생을 골라 주세요." };
    rows = await db.select(cols).from(students).where(and(mine, inArray(students.id, ids)));
    targetName = `개별 ${rows.length}명`;
  } else {
    rows = await db.select(cols).from(students).where(mine);
  }

  // 학부모 번호별로 묶기 (형제는 한 통, 이름은 학년·이름 순으로 "김민수·김민지")
  const byPhone = new Map<string, typeof rows>();
  for (const r of rows.sort(byGradeName)) byPhone.set(r.phone, [...(byPhone.get(r.phone) ?? []), r]);
  if (byPhone.size === 0) return { ok: false, message: "보낼 학부모님이 없어요. (학부모 동의를 받은 학생에게만 보내요)" };

  // 링크에 공지 id 가 들어가므로 먼저 저장
  const [notice] = await db
    .insert(notices)
    .values({ academyId: academy.id, target: targetName, content, recipientCount: byPhone.size })
    .returning({ id: notices.id });
  const link = noticeLink(notice.id);

  const groups = [...byPhone.entries()];
  const results = await sendMessages(
    academy,
    "NOTICE",
    groups.map(([to, kids]) => {
      const names = kids.map((k) => k.name).join("·");
      return {
        to,
        text: linkMode ? noticeLinkText(academy.name, names, link) : noticeText(academy.name, content),
        alimtalk: { key: "NOTICE" as const, vars: { 학원: academy.name, 이름: names, 링크: link } },
        studentId: kids[0].id,
      };
    }),
  );
  const failed = results.filter((r) => !r.ok).length;
  if (failed) await db.update(notices).set({ failedCount: failed }).where(eq(notices.id, notice.id));

  revalidatePath("/notice");
  revalidatePath("/dashboard");
  const n = groups.length;
  const test = results.some((r) => r.test);
  if (failed) {
    return { ok: false, message: `${n - failed}명 발송, ${failed}명 실패 (${results.find((r) => !r.ok)?.error ?? ""})` };
  }
  return { ok: true, message: `학부모님 ${n}명께 보냈어요.${test ? " (테스트 모드: 실제 카톡·문자는 안 나감)" : ""}` };
}

// ───────────────────────── 학부모 동의 ─────────────────────────

/** 새 학생의 동의 칸: 원장님이 이미 받았으면(종이·문자) 동의, 아니면 대기 */
function consentFields(paper: boolean) {
  return paper
    ? { consent: "AGREED", consentBy: "OWNER", consentAt: new Date() }
    : { consent: "PENDING", consentBy: "OWNER", consentAt: null };
}

type ConsentKid = { id: string; name: string; grade: string; parentPhone: string };

/**
 * 학부모 번호별로 동의 요청 카톡 (형제는 한 통, 이름은 "김민수·김민지").
 * 그 번호로 동의 요청이 한 번도 안 나갔으면 통수에서 빼지 않는다 (학부모당 첫 1통 무료). 보낸 번호는 요청 시각을 남긴다.
 */
async function sendConsentTo(academy: { id: string; name: string; senderPhone: string }, groups: [string, ConsentKid[]][]) {
  const phones = groups.map(([p]) => p);
  const asked = new Set(
    (
      await db
        .selectDistinct({ p: students.parentPhone })
        .from(students)
        .where(and(eq(students.academyId, academy.id), inArray(students.parentPhone, phones), isNotNull(students.consentRequestedAt)))
    ).map((r) => r.p),
  );
  const results = await sendMessages(
    academy,
    "CONSENT",
    groups.map(([to, kids]) => {
      const vars = { 학원: academy.name, 이름: kids.map((k) => k.name).join("·"), 링크: consentLink(kids[0].id) };
      return { to, text: renderAlimtalk("CONSENT", vars), alimtalk: { key: "CONSENT" as const, vars }, studentId: kids[0].id, free: !asked.has(to) };
    }),
  );
  const okPhones = phones.filter((_, i) => results[i].ok);
  if (okPhones.length) {
    await db
      .update(students)
      .set({ consentRequestedAt: sql`coalesce(${students.consentRequestedAt}, now())` })
      .where(and(eq(students.academyId, academy.id), inArray(students.parentPhone, okPhones)));
  }
  return results.map((r, i) => ({ ...r, free: !asked.has(phones[i]) }));
}

/** 학생·반 화면 [동의 요청 보내기] — 동의 대기인 다니는 학생의 학부모님께 */
export async function sendConsentRequests(): Promise<FormResult> {
  const academy = await requireActiveAcademy();
  if (!appUrl()) return { ok: false, message: "동의 링크를 만들 주소(APP_URL)가 설정되지 않았어요. 관리자에게 문의해 주세요." };
  const rows = await db
    .select({ id: students.id, name: students.name, grade: students.grade, parentPhone: students.parentPhone })
    .from(students)
    .where(and(eq(students.academyId, academy.id), eq(students.active, true), eq(students.consent, "PENDING")));
  if (rows.length === 0) return { ok: true, message: "동의를 기다리는 학부모님이 없어요." };

  const byPhone = new Map<string, ConsentKid[]>();
  for (const r of rows.sort(byGradeName)) byPhone.set(r.parentPhone, [...(byPhone.get(r.parentPhone) ?? []), r]);
  const results = await sendConsentTo(academy, [...byPhone.entries()]);
  revalidatePath("/students");

  const sent = results.filter((r) => r.ok);
  const failed = results.length - sent.length;
  const charged = sent.filter((r) => !r.free).length;
  const test = results.some((r) => r.test) ? " (테스트 모드: 실제 카톡은 안 나감)" : "";
  if (failed) {
    return { ok: false, message: `${sent.length}명 보냄, ${failed}명 실패 (${results.find((r) => !r.ok)?.error ?? ""})` };
  }
  return {
    ok: true,
    message: `학부모님 ${sent.length}명께 동의 요청을 보냈어요${charged ? ` · 다시 보낸 ${charged}통은 카톡 통수에서 빠져요` : ""}${test}`,
  };
}

/**
 * 학부모님이 동의 링크(/c/…)에서 누름 — 로그인 없이. 링크 서명이 곧 권한.
 * 같은 공부방에서 같은 학부모 번호인 학생(형제) 모두에게 적용하고 시각을 남긴다.
 */
export async function answerConsent(code: string, agree: boolean): Promise<{ ok: boolean }> {
  const studentId = readConsentCode(code);
  if (!studentId) return { ok: false };
  const [s] = await db
    .select({ academyId: students.academyId, parentPhone: students.parentPhone })
    .from(students)
    .innerJoin(academies, eq(academies.id, students.academyId))
    .where(and(eq(students.id, studentId), isNull(academies.deletedAt)));
  if (!s) return { ok: false };
  await db
    .update(students)
    .set({ consent: agree ? "AGREED" : "DECLINED", consentBy: "PARENT", consentAt: new Date() })
    .where(and(eq(students.academyId, s.academyId), eq(students.parentPhone, s.parentPhone)));
  revalidatePath("/students");
  return { ok: true };
}

// ───────────────────────── 학생 관리 ─────────────────────────

export type FormResult = { ok: boolean; message: string } | null;
export type StudentFormResult = FormResult;

function readStudentForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const grade = String(formData.get("grade") ?? "").trim();
  const parentPhone = normalizePhone(String(formData.get("parentPhone") ?? ""));
  const birthDate = String(formData.get("birthDate") ?? "").trim() || null;
  const classIds = formData.getAll("classIds").map(String);

  if (!name) return { error: "학생 이름을 입력해 주세요." } as const;
  if (!grade) return { error: "학년을 입력해 주세요. (예: 초5)" } as const;
  if (!isValidMobile(parentPhone)) return { error: "학부모 휴대폰 번호를 확인해 주세요. (예: 010-1234-5678)" } as const;
  if (birthDate && (!isValidDate(birthDate) || birthDate > todayKST() || birthDate < "1900-01-01")) {
    return { error: "생년월일을 확인해 주세요." } as const;
  }
  return { data: { name, grade, parentPhone, birthDate }, classIds } as const;
}

/** 학생의 반을 통째로 다시 지정 (이 공부방의 반만 허용) */
async function setStudentClasses(academyId: string, studentId: string, classIds: string[]) {
  const valid = classIds.length
    ? await db
        .select({ id: classes.id })
        .from(classes)
        .where(and(eq(classes.academyId, academyId), inArray(classes.id, classIds)))
    : [];
  await db.delete(classStudents).where(eq(classStudents.studentId, studentId));
  if (valid.length) {
    await db.insert(classStudents).values(valid.map((c) => ({ classId: c.id, studentId })));
  }
}

export async function addStudent(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const academy = await requireActiveAcademy();
  const parsed = readStudentForm(formData);
  if ("error" in parsed) return { ok: false, message: parsed.error! };
  const paper = formData.get("consent") === "on"; // 원장님이 종이·문자로 이미 동의를 받았으면 체크. 아니면 대기 → 동의 요청 카톡

  const [created] = await db
    .insert(students)
    .values({ academyId: academy.id, ...parsed.data, ...consentFields(paper) })
    .returning({ id: students.id });
  await setStudentClasses(academy.id, created.id, parsed.classIds);
  revalidatePath("/students");
  revalidatePath("/");
  if (await endTrialIfOverlap(academy)) redirect("/billing");
  return { ok: true, message: `${parsed.data.name} 학생을 추가했어요.${paper ? "" : " 학부모 동의는 '동의 요청 보내기'로 받아요."}` };
}

export async function updateStudent(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const academy = await requireActiveAcademy();
  const id = String(formData.get("id") ?? "");
  const parsed = readStudentForm(formData);
  if ("error" in parsed) return { ok: false, message: parsed.error! };

  const before = await getOwnStudent(academy.id, id);
  if (!before) return { ok: false, message: "학생을 찾을 수 없어요." };
  // 원장님이 동의 상태를 직접 바꾼 경우 (종이로 받음 / 학부모님이 그만 받겠다고 하심)
  const consent = String(formData.get("consentState") ?? before.consent);
  const consentChange =
    consent !== before.consent && ["AGREED", "PENDING", "DECLINED"].includes(consent)
      ? { consent, consentBy: "OWNER", consentAt: consent === "PENDING" ? null : new Date() }
      : {};

  await db
    .update(students)
    .set({ ...parsed.data, ...consentChange })
    .where(and(eq(students.id, id), eq(students.academyId, academy.id)));
  await setStudentClasses(academy.id, id, parsed.classIds);

  revalidatePath("/students");
  revalidatePath("/");
  if (await endTrialIfOverlap(academy)) redirect("/billing");
  return { ok: true, message: "저장했어요." };
}

/** 그만둔 학생은 지우지 않고 숨김 (지난 출결 기록 보존) */
/**
 * 명단 붙여넣기로 여러 명 한 번에 추가.
 * - 줄 해석은 화면 미리보기와 같은 parseRoster 를 다시 돌린다 (화면 값을 믿지 않음)
 * - 오류 줄은 건너뛰고, 이미 등록된 학생(이름+학부모 번호, 그만둔 학생 포함)도 건너뜀
 * - 고른 반은 추가되는 학생 모두에게 배정
 */
export async function addStudentsBulk(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const academy = await requireActiveAcademy();
  const paper = formData.get("consent") === "on";
  const rows = parseRoster(String(formData.get("roster") ?? ""));
  if (rows.length > ROSTER_MAX_LINES) return { ok: false, message: `한 번에 ${ROSTER_MAX_LINES}명까지 넣을 수 있어요.` };
  const okRows = rows.filter((r) => r.ok);
  if (okRows.length === 0) return { ok: false, message: "추가할 수 있는 학생이 없어요. 빨간 줄을 확인해 주세요." };

  const existing = await db
    .select({ name: students.name, parentPhone: students.parentPhone })
    .from(students)
    .where(eq(students.academyId, academy.id));
  const have = new Set(existing.map((s) => rosterKey(s.name, s.parentPhone)));
  const fresh = okRows.filter((r) => !have.has(rosterKey(r.name, r.parentPhone)));
  const skippedDup = okRows.length - fresh.length;
  const skippedErr = rows.length - okRows.length;

  if (fresh.length > 0) {
    const classIds = formData.getAll("classIds").map(String);
    const validClasses = classIds.length
      ? await db
          .select({ id: classes.id })
          .from(classes)
          .where(and(eq(classes.academyId, academy.id), inArray(classes.id, classIds)))
      : [];
    await db.transaction(async (tx) => {
      const created = await tx
        .insert(students)
        .values(
          fresh.map((r) => ({
            academyId: academy.id,
            name: r.name,
            grade: r.grade,
            parentPhone: r.parentPhone,
            birthDate: r.birthDate,
            ...consentFields(paper),
          })),
        )
        .returning({ id: students.id });
      if (validClasses.length) {
        await tx
          .insert(classStudents)
          .values(created.flatMap((s) => validClasses.map((c) => ({ classId: c.id, studentId: s.id }))));
      }
    });
    revalidatePath("/students");
    revalidatePath("/");
    if (await endTrialIfOverlap(academy)) redirect("/billing");
  }

  const skipped = [
    skippedDup ? `이미 있는 학생 ${skippedDup}명` : "",
    skippedErr ? `확인이 필요한 줄 ${skippedErr}개` : "",
  ].filter(Boolean);
  if (fresh.length === 0) return { ok: false, message: `새로 추가할 학생이 없어요 (${skipped.join(", ")}).` };
  return {
    ok: true,
    message: `${fresh.length}명을 추가했어요.${skipped.length ? ` 건너뜀: ${skipped.join(", ")}` : ""}`,
  };
}

export async function setStudentActive(studentId: string, active: boolean) {
  const academy = await requireActiveAcademy();
  await db
    .update(students)
    .set({ active })
    .where(and(eq(students.id, studentId), eq(students.academyId, academy.id)));
  revalidatePath("/students");
  revalidatePath("/");
}

// ───────────────────────── 교습비 납부 ─────────────────────────

/** 납부 기록 추가 (결제선생·카드·계좌이체·현금 모두 원장님이 직접 입력, 선납은 앞으로의 달로) */
export async function addPayment(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const academy = await requireActiveAcademy();
  const studentId = String(formData.get("studentId") ?? "");
  const paidOn = String(formData.get("paidOn") ?? "");
  const period = String(formData.get("period") ?? "");
  const subject = String(formData.get("subject") ?? "").trim().slice(0, 30);
  const tuition = parseWon(String(formData.get("tuition") ?? ""));
  const otherFee = parseWon(String(formData.get("otherFee") ?? ""));
  const method = String(formData.get("method") ?? "");
  const memo = String(formData.get("memo") ?? "").trim().slice(0, 100);

  if (!(await getOwnStudent(academy.id, studentId))) return { ok: false, message: "학생을 찾을 수 없어요." };
  if (!isValidDate(paidOn) || paidOn > todayKST()) return { ok: false, message: "받은 날짜를 확인해 주세요." };
  if (!isValidMonth(period)) return { ok: false, message: "교습기간(월)을 골라 주세요." };
  if (!subject) return { ok: false, message: "교습과목을 입력해 주세요. (예: 영어)" };
  if (!Number.isFinite(tuition) || !Number.isFinite(otherFee)) return { ok: false, message: "금액은 숫자로 입력해 주세요." };
  if (tuition + otherFee <= 0 || tuition > 10_000_000 || otherFee > 10_000_000) {
    return { ok: false, message: "금액을 확인해 주세요." };
  }
  if (!isPaymentMethod(method)) return { ok: false, message: "결제수단을 골라 주세요." };

  await db.insert(payments).values({ academyId: academy.id, studentId, paidOn, period, subject, tuition, otherFee, method, memo });
  revalidatePath("/stats");
  return { ok: true, message: "납부 기록을 저장했어요." };
}

export async function deletePayment(paymentId: string) {
  const academy = await requireActiveAcademy();
  await db.delete(payments).where(and(eq(payments.id, paymentId), eq(payments.academyId, academy.id)));
  revalidatePath("/stats");
}

// ───────────────────────── 반 관리 ─────────────────────────

function readClassForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, 30);
  const days = parseDays(formData.getAll("days").map(String).join(","));
  const time = String(formData.get("time") ?? "").trim();
  if (!name) return { error: "반 이름을 입력해 주세요. (예: 초등 영어 A)" } as const;
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { error: "시작 시각을 확인해 주세요." } as const;
  return { data: { name, days: [...new Set(days)].sort().join(","), time } } as const;
}

export async function addClass(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const academy = await requireActiveAcademy();
  const parsed = readClassForm(formData);
  if ("error" in parsed) return { ok: false, message: parsed.error! };
  await db.insert(classes).values({ academyId: academy.id, ...parsed.data });
  revalidatePath("/students");
  revalidatePath("/");
  return { ok: true, message: `${parsed.data.name} 반을 만들었어요.` };
}

export async function updateClass(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const academy = await requireActiveAcademy();
  const id = String(formData.get("id") ?? "");
  const parsed = readClassForm(formData);
  if ("error" in parsed) return { ok: false, message: parsed.error! };
  const updated = await db
    .update(classes)
    .set(parsed.data)
    .where(and(eq(classes.id, id), eq(classes.academyId, academy.id)))
    .returning({ id: classes.id });
  if (updated.length === 0) return { ok: false, message: "반을 찾을 수 없어요." };
  revalidatePath("/students");
  revalidatePath("/");
  return { ok: true, message: "저장했어요." };
}

/** 반 삭제 — 학생과 출결 기록은 그대로, 반 배정만 사라짐 */
export async function deleteClass(classId: string) {
  const academy = await requireActiveAcademy();
  await db.delete(classes).where(and(eq(classes.id, classId), eq(classes.academyId, academy.id)));
  revalidatePath("/students");
  revalidatePath("/");
}

// ───────────────────────── 설정 ─────────────────────────

export async function saveSettings(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const academy = await requireAcademy();
  // 한 줄 칸이라 줄바꿈은 빼고 받는다
  const field = (k: string) => String(formData.get(k) ?? "").replace(/\s+/g, " ").trim();
  const wording = {
    name: field("name"),
    attendanceEnding: field("attendanceEnding"),
    attendanceExtra: field("attendanceExtra"),
    feedbackTitle: field("feedbackTitle"),
    feedbackClosing: field("feedbackClosing"),
  };

  if (!wording.name || wording.name.length > 20) return { ok: false, message: "학원 이름은 1~20자로 입력해 주세요." };
  if (!wording.attendanceEnding) return { ok: false, message: "등원 문자 끝 문장을 입력해 주세요. (예: 등원했습니다.)" };
  if (!wording.feedbackTitle) return { ok: false, message: "피드백 문자 첫 줄을 입력해 주세요. (예: 오늘 수업 피드백)" };
  if (wording.attendanceEnding.length > 30 || wording.feedbackTitle.length > 30) {
    return { ok: false, message: "끝 문장·첫 줄은 30자 이내로 써 주세요." };
  }
  if (wording.attendanceExtra.length > 60 || wording.feedbackClosing.length > 60) {
    return { ok: false, message: "덧붙일 말·마지막 인사는 60자 이내로 써 주세요." };
  }

  const registrationNo = field("registrationNo");
  if (registrationNo.length > 40) return { ok: false, message: "신고번호를 확인해 주세요." };

  await db
    .update(academies)
    .set({ ...wording, registrationNo })
    .where(eq(academies.id, academy.id));
  revalidatePath("/", "layout");
  return { ok: true, message: "저장했어요. 다음 문자부터 바뀐 문구로 나가요." };
}

/** 설정: 출석 체크하면 학부모님께 등원 카톡 보내기 켜기/끄기 */
export async function setAttendanceNotify(on: boolean) {
  const academy = await requireAcademy();
  await db.update(academies).set({ attendanceNotify: !!on }).where(eq(academies.id, academy.id));
  revalidatePath("/", "layout");
}

// ───────────────────────── 마이페이지 (/me) ─────────────────────────

/** 원장님 연락처 바꾸기 (두나가 연락할 때 쓰는 번호) */
export async function updateOwnerPhone(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const academy = await requireAcademy();
  const ownerPhone = normalizePhone(String(formData.get("ownerPhone") ?? ""));
  if (!isValidMobile(ownerPhone)) return { ok: false, message: "휴대폰 번호를 확인해 주세요. (예: 010-1234-5678)" };
  await db.update(academies).set({ ownerPhone }).where(eq(academies.id, academy.id));
  revalidatePath("/me");
  return { ok: true, message: "연락처를 바꿨어요." };
}

async function passwordMatches(academyId: string, password: string) {
  const [row] = await db.select({ hash: academies.passwordHash }).from(academies).where(eq(academies.id, academyId));
  return !!row && !!password && (await bcrypt.compare(password, row.hash));
}

/** 비밀번호 바꾸기 — 지금 비밀번호를 먼저 확인 */
export async function changePassword(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const academy = await requireAcademy();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const again = String(formData.get("again") ?? "");
  if (!(await passwordMatches(academy.id, current))) return { ok: false, message: "지금 비밀번호가 맞지 않아요." };
  if (next.length < 8) return { ok: false, message: "새 비밀번호는 8자 이상으로 만들어 주세요." };
  if (next !== again) return { ok: false, message: "새 비밀번호 두 칸이 서로 달라요." };
  if (next === current) return { ok: false, message: "지금과 다른 비밀번호로 만들어 주세요." };
  await db.update(academies).set({ passwordHash: await bcrypt.hash(next, 10) }).where(eq(academies.id, academy.id));
  return { ok: true, message: "비밀번호를 바꿨어요. 다음 로그인부터 새 비밀번호를 쓰세요." };
}

/**
 * 탈퇴 — 비밀번호 확인 뒤 공부방 데이터를 지운다.
 * - 지움: 학생·학부모 번호·반·출결·수업 메모·교습비(원비) 기록·공지·보낸 메시지 기록
 * - 남김: 결제 기록(orders, 예전 충전금 내역) — 전자상거래법상 5년. 공부방 줄은 지우지 않고(지우면 결제 기록도 같이 지워짐)
 *   이름·아이디·비밀번호·연락처·발신번호를 비워서 사람과의 연결을 끊는다
 * - 원장님 연락처는 되돌릴 수 없는 값(trialPhoneHash)으로만 남겨서, 같은 번호로 다시 가입하면 무료 체험을 또 주지 않는다
 * - 학부모 번호도 되돌릴 수 없는 값(deleted_parent_hashes)으로만 남겨서, 같은 명단으로 다시 체험하는지 비교한다
 */
export async function deleteAccount(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const academy = await requireAcademy();
  if (formData.get("confirm") !== "on") return { ok: false, message: "안내를 읽고 체크해 주세요." };
  if (!(await passwordMatches(academy.id, String(formData.get("password") ?? "")))) {
    return { ok: false, message: "비밀번호가 맞지 않아요." };
  }
  const id = academy.id;
  const parentPhones = await db.selectDistinct({ p: students.parentPhone }).from(students).where(eq(students.academyId, id));
  await db.transaction(async (tx) => {
    if (parentPhones.length) {
      await tx
        .insert(deletedParentHashes)
        .values(parentPhones.map((r) => ({ academyId: id, hash: parentPhoneHash(r.p) })))
        .onConflictDoNothing();
    }
    // 학생을 지우면 반 배정·출결·메모·교습비도 같이 지워지지만(FK cascade), 공부방 기준으로도 한 번 더 지운다
    await tx.delete(attendance).where(eq(attendance.academyId, id));
    await tx.delete(notes).where(eq(notes.academyId, id));
    await tx.delete(payments).where(eq(payments.academyId, id));
    await tx.delete(messageLogs).where(eq(messageLogs.academyId, id));
    await tx.delete(notices).where(eq(notices.academyId, id));
    await tx.delete(students).where(eq(students.academyId, id));
    await tx.delete(classes).where(eq(classes.academyId, id)); // class_students 는 cascade
    await tx
      .update(academies)
      .set({
        name: "탈퇴한 공부방",
        loginId: `deleted-${id}`, // 원래 아이디는 다시 가입할 때 쓸 수 있게 비워 둠
        passwordHash: await bcrypt.hash(crypto.randomUUID(), 10), // 아무도 모르는 비밀번호 → 로그인 불가
        ownerPhone: "",
        senderPhone: "",
        registrationNo: "",
        attendanceExtra: "",
        feedbackClosing: "",
        attendanceNotify: false,
        serviceUntil: new Date(),
        msgUsed: 0,
        msgPeriod: "",
        // 가입 때 넣은 값(체험을 쓴 번호)을 지키고, 예전 계정이라 없으면 지금 연락처로
        trialPhoneHash: academy.trialPhoneHash || (academy.ownerPhone ? trialPhoneHash(academy.ownerPhone) : ""),
        deletedAt: new Date(),
      })
      .where(eq(academies.id, id));
  });
  await deleteSession();
  redirect("/login");
}

// ───────────────────────── 결제 (요금제) ─────────────────────────

/**
 * 결제창을 열기 전에 주문을 만든다. 금액은 서버가 정하고, 화면은 받은 값 그대로 결제창에 넘긴다.
 * 이용 기간이 끝나도 결제는 돼야 하므로 requireAcademy.
 */
export async function createOrder(kind: OrderKind) {
  const academy = await requireAcademy();
  if (!billingReady()) return { ok: false as const, error: "결제 준비 중이에요. 관리자에게 문의해 주세요." };
  if (!isPaidTier(kind)) return { ok: false as const, error: "요금제를 다시 골라 주세요." };
  const amount = priceFor(kind);

  const orderId = await createOrderRow(academy.id, kind, amount);
  return {
    ok: true as const,
    orderId,
    amount,
    orderName: orderName(kind),
    clientKey: process.env.TOSS_CLIENT_KEY!,
    customerKey: academy.id,
  };
}
