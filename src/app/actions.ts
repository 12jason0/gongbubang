"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { db, academies, students, attendance, notes, notices, classes, classStudents, payments, messageLogs } from "@/db";
import { createSession, deleteSession, requireAcademy } from "@/lib/session";
import { sendMessages, smsBytes } from "@/lib/sms";
import { unresolvedFailures } from "@/lib/failed";
import { attendanceText, feedbackText, noticeText, parseDays } from "@/lib/templates";
import { isValidDate, isValidMonth, spokenTimeKST, todayKST } from "@/lib/date";
import { isPaymentMethod, parseWon } from "@/lib/money";
import { isValidMobile, normalizePhone } from "@/lib/phone";

// ───────────────────────── 로그인 ─────────────────────────

export async function login(_prev: string | null, formData: FormData): Promise<string | null> {
  const loginId = String(formData.get("loginId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!loginId || !password) return "아이디와 비밀번호를 입력해 주세요.";

  const [academy] = await db.select().from(academies).where(eq(academies.loginId, loginId));
  if (!academy || !(await bcrypt.compare(password, academy.passwordHash))) {
    return "아이디 또는 비밀번호가 맞지 않아요.";
  }
  await createSession(academy.id);
  redirect("/");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}

// ───────────────────────── 출석 ─────────────────────────

export type SmsState = "sent" | "test" | "failed" | "none";

async function getOwnStudent(academyId: string, studentId: string) {
  const [s] = await db
    .select()
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.academyId, academyId)));
  return s ?? null;
}

/**
 * 출석/결석 체크.
 * - 오늘 날짜에 "출석"을 누르면 학부모에게 등원 문자 (하루 한 번만)
 * - 같은 버튼을 다시 누르면 체크 해제. 등원 문자가 이미 나갔으면 줄은 남기고 상태만 비움
 *   (보낸 시각이 남아 있어서 다시 출석을 눌러도 문자는 또 안 나감)
 * - 지난 날짜를 고치는 건 기록만 바뀌고 문자는 안 나감
 */
export async function setAttendance(
  studentId: string,
  date: string,
  status: "PRESENT" | "ABSENT" | null,
): Promise<{ ok: boolean; sms: SmsState; error?: string }> {
  const academy = await requireAcademy();
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

  if (status === "PRESENT" && date === todayKST()) {
    // 동시에 두 번 눌려도 한 번만 나가도록: notifiedAt 이 비어 있을 때만 "내가 보낸다"고 먼저 찍는다
    const claimed = await db
      .update(attendance)
      .set({ notifiedAt: new Date() })
      .where(and(eq(attendance.id, row.id), isNull(attendance.notifiedAt)))
      .returning({ id: attendance.id });

    if (claimed.length === 1) {
      const [result] = await sendMessages(academy, "ATTENDANCE", [
        { to: student.parentPhone, text: attendanceText(academy, student.name, spokenTimeKST()), studentId, refDate: date },
      ]);
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
  const academy = await requireAcademy();
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
  const academy = await requireAcademy();
  if (!isValidDate(date)) return { ok: false, sent: 0, failed: 0, test: false, error: "날짜가 올바르지 않아요." };

  // 보낼 메모를 먼저 "보냄"으로 찍어서 확보 (두 번 눌러도 중복 발송 안 됨)
  const claimed = await db
    .update(notes)
    .set({ sentAt: new Date() })
    .where(
      and(eq(notes.academyId, academy.id), eq(notes.date, date), isNull(notes.sentAt), ne(notes.content, "")),
    )
    .returning();

  if (claimed.length === 0) return { ok: true, sent: 0, failed: 0, test: false };

  const studentRows = await db
    .select()
    .from(students)
    .where(inArray(students.id, claimed.map((n) => n.studentId)));
  const byId = new Map(studentRows.map((s) => [s.id, s]));

  const targets = claimed.filter((n) => byId.get(n.studentId)?.active);
  const skipped = claimed.filter((n) => !byId.get(n.studentId)?.active);
  if (skipped.length) {
    await db.update(notes).set({ sentAt: null }).where(inArray(notes.id, skipped.map((n) => n.id)));
  }

  const results = await sendMessages(
    academy,
    "FEEDBACK",
    targets.map((n) => {
      const s = byId.get(n.studentId)!;
      return { to: s.parentPhone, text: feedbackText(academy, s.name, n.content), studentId: s.id, refDate: date };
    }),
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
  const academy = await requireAcademy();
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

    if (log.kind === "ATTENDANCE" && student && log.refDate === today) {
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
        .returning({ id: attendance.id });
      if (!row) {
        skipped++;
        continue;
      }
      // 원래 문구 그대로 (처음 출석 누른 시각이 들어 있음)
      const [r] = await sendMessages(academy, "ATTENDANCE", [{ to: student.parentPhone, text: log.text, studentId: student.id, refDate: today }]);
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
      const [r] = await sendMessages(academy, "FEEDBACK", [
        { to: student.parentPhone, text: feedbackText(academy, student.name, note.content), studentId: student.id, refDate: log.refDate },
      ]);
      if (r.ok) sent++;
      else {
        failed++;
        await db.update(notes).set({ sentAt: null }).where(eq(notes.id, note.id));
      }
    } else if (log.kind === "NOTICE") {
      const [r] = await sendMessages(academy, "NOTICE", [{ to: log.to, text: log.text }]);
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

// ───────────────────────── 단체 공지 ─────────────────────────

export type NoticeResult = { ok: boolean; message: string } | null;

export async function sendNotice(_prev: NoticeResult, formData: FormData): Promise<NoticeResult> {
  const academy = await requireAcademy();
  const target = String(formData.get("target") ?? "all"); // "all" 또는 반 id
  const content = String(formData.get("content") ?? "").trim();

  if (!content) return { ok: false, message: "공지 내용을 입력해 주세요." };
  const text = noticeText(academy.name, content);
  if (smsBytes(text) > 2000) return { ok: false, message: "공지가 너무 길어요. 한글 약 1,000자까지 보낼 수 있어요." };

  let targetName = "전체";
  let rows: { phone: string }[];
  if (target === "all") {
    rows = await db
      .select({ phone: students.parentPhone })
      .from(students)
      .where(and(eq(students.academyId, academy.id), eq(students.active, true)));
  } else {
    const [cls] = await db
      .select()
      .from(classes)
      .where(and(eq(classes.id, target), eq(classes.academyId, academy.id)));
    if (!cls) return { ok: false, message: "받는 반을 다시 선택해 주세요." };
    targetName = cls.name;
    rows = await db
      .select({ phone: students.parentPhone })
      .from(classStudents)
      .innerJoin(students, eq(students.id, classStudents.studentId))
      .where(and(eq(classStudents.classId, cls.id), eq(students.active, true)));
  }

  // 형제가 같이 다니면 같은 번호로 두 번 가지 않게
  const phones = [...new Set(rows.map((r) => r.phone))];
  if (phones.length === 0) return { ok: false, message: "보낼 학부모 번호가 없어요." };

  const results = await sendMessages(
    academy,
    "NOTICE",
    phones.map((to) => ({ to, text })),
  );
  const failed = results.filter((r) => !r.ok).length;

  await db.insert(notices).values({
    academyId: academy.id,
    target: targetName,
    content,
    recipientCount: phones.length,
    failedCount: failed,
  });

  revalidatePath("/notice");
  const test = results.some((r) => r.test);
  if (failed) {
    return { ok: false, message: `${phones.length - failed}명 발송, ${failed}명 실패 (${results.find((r) => !r.ok)?.error ?? ""})` };
  }
  return { ok: true, message: `${phones.length}명에게 보냈어요.${test ? " (테스트 모드: 실제 문자는 안 나감)" : ""}` };
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
  const academy = await requireAcademy();
  const parsed = readStudentForm(formData);
  if ("error" in parsed) return { ok: false, message: parsed.error! };

  const [created] = await db
    .insert(students)
    .values({ academyId: academy.id, ...parsed.data })
    .returning({ id: students.id });
  await setStudentClasses(academy.id, created.id, parsed.classIds);
  revalidatePath("/students");
  revalidatePath("/");
  return { ok: true, message: `${parsed.data.name} 학생을 추가했어요.` };
}

export async function updateStudent(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const academy = await requireAcademy();
  const id = String(formData.get("id") ?? "");
  const parsed = readStudentForm(formData);
  if ("error" in parsed) return { ok: false, message: parsed.error! };

  const updated = await db
    .update(students)
    .set(parsed.data)
    .where(and(eq(students.id, id), eq(students.academyId, academy.id)))
    .returning({ id: students.id });
  if (updated.length === 0) return { ok: false, message: "학생을 찾을 수 없어요." };
  await setStudentClasses(academy.id, id, parsed.classIds);

  revalidatePath("/students");
  revalidatePath("/");
  return { ok: true, message: "저장했어요." };
}

/** 그만둔 학생은 지우지 않고 숨김 (지난 출결 기록 보존) */
export async function setStudentActive(studentId: string, active: boolean) {
  const academy = await requireAcademy();
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
  const academy = await requireAcademy();
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
  const academy = await requireAcademy();
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
  const academy = await requireAcademy();
  const parsed = readClassForm(formData);
  if ("error" in parsed) return { ok: false, message: parsed.error! };
  await db.insert(classes).values({ academyId: academy.id, ...parsed.data });
  revalidatePath("/students");
  revalidatePath("/");
  return { ok: true, message: `${parsed.data.name} 반을 만들었어요.` };
}

export async function updateClass(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const academy = await requireAcademy();
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
  const academy = await requireAcademy();
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
