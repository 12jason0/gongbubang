"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, ne, inArray } from "drizzle-orm";
import { db, academies, students, attendance, notes, notices } from "@/db";
import { createSession, deleteSession, requireAcademy } from "@/lib/session";
import { sendMessages, smsBytes } from "@/lib/sms";
import { attendanceText, feedbackText, noticeText, GROUPS } from "@/lib/templates";
import { isValidDate, timeKST, todayKST } from "@/lib/date";
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
 * - 같은 버튼을 다시 누르면 체크 해제 (단, 문자가 이미 나갔으면 해제 안 됨 — 결석으로 바꾸는 건 가능)
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
    // 문자 안 나간 기록만 지울 수 있음
    const deleted = await db
      .delete(attendance)
      .where(and(eq(attendance.studentId, studentId), eq(attendance.date, date), isNull(attendance.notifiedAt)))
      .returning({ id: attendance.id });
    revalidatePath("/");
    if (deleted.length === 0) {
      return { ok: false, sms: "none", error: "이미 등원 문자가 나가서 체크를 지울 수 없어요. 결석으로는 바꿀 수 있어요." };
    }
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
        { to: student.parentPhone, text: attendanceText(academy.name, student.name, timeKST()), studentId },
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
      return { to: s.parentPhone, text: feedbackText(academy.name, s.name, n.content), studentId: s.id };
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

// ───────────────────────── 단체 공지 ─────────────────────────

export type NoticeResult = { ok: boolean; message: string } | null;

export async function sendNotice(_prev: NoticeResult, formData: FormData): Promise<NoticeResult> {
  const academy = await requireAcademy();
  const target = String(formData.get("target") ?? "전체");
  const content = String(formData.get("content") ?? "").trim();

  if (!content) return { ok: false, message: "공지 내용을 입력해 주세요." };
  if (target !== "전체" && !GROUPS.includes(target as (typeof GROUPS)[number])) {
    return { ok: false, message: "받는 반을 다시 선택해 주세요." };
  }
  const text = noticeText(academy.name, content);
  if (smsBytes(text) > 2000) return { ok: false, message: "공지가 너무 길어요. 한글 약 1,000자까지 보낼 수 있어요." };

  const where =
    target === "전체"
      ? and(eq(students.academyId, academy.id), eq(students.active, true))
      : and(eq(students.academyId, academy.id), eq(students.active, true), eq(students.group, target));
  const rows = await db.select({ phone: students.parentPhone }).from(students).where(where);

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
    target,
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

export type StudentFormResult = { ok: boolean; message: string } | null;

function readStudentForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const grade = String(formData.get("grade") ?? "").trim();
  const group = String(formData.get("group") ?? "");
  const parentPhone = normalizePhone(String(formData.get("parentPhone") ?? ""));

  if (!name) return { error: "학생 이름을 입력해 주세요." } as const;
  if (!grade) return { error: "학년을 입력해 주세요. (예: 초5)" } as const;
  if (!GROUPS.includes(group as (typeof GROUPS)[number])) return { error: "반을 선택해 주세요." } as const;
  if (!isValidMobile(parentPhone)) return { error: "학부모 휴대폰 번호를 확인해 주세요. (예: 010-1234-5678)" } as const;
  return { data: { name, grade, group, parentPhone } } as const;
}

export async function addStudent(_prev: StudentFormResult, formData: FormData): Promise<StudentFormResult> {
  const academy = await requireAcademy();
  const parsed = readStudentForm(formData);
  if ("error" in parsed) return { ok: false, message: parsed.error! };

  await db.insert(students).values({ academyId: academy.id, ...parsed.data });
  revalidatePath("/students");
  revalidatePath("/");
  return { ok: true, message: `${parsed.data.name} 학생을 추가했어요.` };
}

export async function updateStudent(_prev: StudentFormResult, formData: FormData): Promise<StudentFormResult> {
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
