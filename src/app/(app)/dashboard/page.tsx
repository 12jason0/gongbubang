import { and, count, desc, eq, gte } from "drizzle-orm";
import { db, attendance, classes, classStudents, messageLogs, notices, payments, students } from "@/db";
import { currentAcademyId, requireAcademy } from "@/lib/session";
import { shiftDate, thisMonthKST, timeKST, todayKST } from "@/lib/date";
import { byTimeName, parseDays, weekdayOf } from "@/lib/templates";
import { quotaNote, quotaState } from "@/lib/plan";
import type { DashboardData } from "@/lib/dashboard-example";
import { Dashboard } from "@/components/Dashboard";

const KIND_LABEL: Record<string, string> = { ATTENDANCE: "등원", FEEDBACK: "피드백", NOTICE: "공지", PAYMENT: "원비 안내" };

/** PC 첫 화면 — 학생·출석·원비·공지·메시지 기록에서 바로 계산 (따로 저장하는 표 없음) */
export default async function DashboardPage() {
  const academyId = await currentAcademyId(); // 쿠키만 확인 — 아래 쿼리를 공부방 조회와 동시에
  const today = todayKST();
  const month = thisMonthKST();
  const from30 = shiftDate(today, -29);
  const weekday = weekdayOf(today);
  const monday = shiftDate(today, -((weekday + 6) % 7));

  const [academy, studentRows, classRows, memberRows, attRows, monthPaid, lastPaid, [{ n: noticesThisWeek }], logRows] = await Promise.all([
    requireAcademy(),
    db
      .select({ id: students.id, name: students.name, grade: students.grade })
      .from(students)
      .where(and(eq(students.academyId, academyId), eq(students.active, true))),
    db
      .select({ id: classes.id, name: classes.name, days: classes.days, time: classes.time })
      .from(classes)
      .where(and(eq(classes.academyId, academyId), eq(classes.active, true))),
    db
      .select({ classId: classStudents.classId, studentId: classStudents.studentId })
      .from(classStudents)
      .innerJoin(classes, eq(classes.id, classStudents.classId))
      .where(eq(classes.academyId, academyId)),
    db
      .select({ studentId: attendance.studentId, date: attendance.date, status: attendance.status })
      .from(attendance)
      .where(and(eq(attendance.academyId, academyId), gte(attendance.date, from30))),
    db
      .selectDistinct({ studentId: payments.studentId })
      .from(payments)
      .where(and(eq(payments.academyId, academyId), eq(payments.period, month))),
    // 미납 금액은 학생별 가장 최근 납부액으로 어림 (월별 화면 입력칸 기본값과 같은 기준)
    db
      .selectDistinctOn([payments.studentId], { studentId: payments.studentId, tuition: payments.tuition, otherFee: payments.otherFee })
      .from(payments)
      .where(eq(payments.academyId, academyId))
      .orderBy(payments.studentId, desc(payments.createdAt)),
    db
      .select({ n: count() })
      .from(notices)
      .where(and(eq(notices.academyId, academyId), gte(notices.sentAt, new Date(`${monday}T00:00:00+09:00`)))),
    db
      .select({
        id: messageLogs.id,
        kind: messageLogs.kind,
        channel: messageLogs.channel,
        to: messageLogs.to,
        status: messageLogs.status,
        createdAt: messageLogs.createdAt,
        name: students.name,
      })
      .from(messageLogs)
      .leftJoin(students, eq(students.id, messageLogs.studentId))
      .where(eq(messageLogs.academyId, academyId))
      .orderBy(desc(messageLogs.createdAt))
      .limit(6),
  ]);

  const activeIds = new Set(studentRows.map((s) => s.id));
  const membersOf = (classId: string) => memberRows.filter((m) => m.classId === classId && activeIds.has(m.studentId)).map((m) => m.studentId);

  // 오늘: 오늘 요일 수업 반 학생 + (수업 없어도) 오늘 체크한 학생
  const todayAtt = new Map(attRows.filter((a) => a.date === today).map((a) => [a.studentId, a.status]));
  const dayClasses = classRows.filter((c) => parseDays(c.days).includes(weekday)).sort(byTimeName);
  const todayStudents = new Set([...dayClasses.flatMap((c) => membersOf(c.id)), ...[...todayAtt.keys()].filter((id) => activeIds.has(id))]);
  const isPresent = (sid: string) => todayAtt.get(sid) === "PRESENT";

  // 30일: 그날 체크한 학생 중 출석
  const byDate = new Map<string, { present: number; checked: number }>();
  for (const a of attRows) {
    if (a.status !== "PRESENT" && a.status !== "ABSENT") continue;
    const d = byDate.get(a.date) ?? { present: 0, checked: 0 };
    d.checked++;
    if (a.status === "PRESENT") d.present++;
    byDate.set(a.date, d);
  }

  const paidIds = new Set(monthPaid.map((p) => p.studentId));
  const lastAmount = new Map(lastPaid.map((p) => [p.studentId, p.tuition + p.otherFee]));
  const unpaidList = studentRows
    .filter((s) => !paidIds.has(s.id))
    .map((s) => ({ id: s.id, name: s.name, grade: s.grade, amount: lastAmount.get(s.id) ?? null }));

  const yesterday = shiftDate(today, -1);
  const when = (d: Date) => {
    const day = todayKST(d);
    const t = timeKST(d);
    if (day === today) return t;
    if (day === yesterday) return `어제 ${t}`;
    return `${Number(day.slice(5, 7))}/${Number(day.slice(8))} ${t}`;
  };

  const data: DashboardData = {
    studentCount: studentRows.length,
    today: { present: [...todayStudents].filter(isPresent).length, total: todayStudents.size },
    unpaid: {
      month,
      count: unpaidList.length,
      amount: unpaidList.reduce((n, s) => n + (s.amount ?? 0), 0),
      unknown: unpaidList.filter((s) => s.amount === null).length,
    },
    quota: (() => {
      const q = quotaState(academy);
      return { remaining: q.remaining, total: q.total, note: quotaNote(q, academy.serviceUntil) };
    })(),
    noticesThisWeek,
    daily: Array.from({ length: 30 }, (_, i) => {
      const date = shiftDate(from30, i);
      return { date, ...(byDate.get(date) ?? { present: 0, checked: 0 }) };
    }),
    classSizes: [...classRows].sort(byTimeName).map((c) => ({ id: c.id, name: c.name, count: membersOf(c.id).length })),
    todayClasses: dayClasses.map((c) => {
      const ids = membersOf(c.id);
      return { id: c.id, name: c.name, time: c.time, present: ids.filter(isPresent).length, total: ids.length };
    }),
    unpaidList,
    recent: logRows.map((l) => ({
      id: l.id,
      kind: KIND_LABEL[l.kind] ?? l.kind,
      channel: l.channel === "ALIMTALK" ? "카톡" : "문자",
      to: l.name ?? `${l.to.slice(0, 3)}-****-${l.to.slice(-4)}`,
      ok: l.status === "TEST" ? null : l.status !== "FAILED",
      at: when(l.createdAt),
    })),
  };

  return <Dashboard data={data} today={today} />;
}
