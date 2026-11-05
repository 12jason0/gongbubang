import { and, eq, gte, like, lt } from "drizzle-orm";
import { db, calendarChanges, calendarMemos, classes, notices, students } from "@/db";
import { currentAcademyId, requireAcademy } from "@/lib/session";
import { isValidMonth, shiftMonth, thisMonthKST, timeKST, todayKST } from "@/lib/date";
import { dueDateOf } from "@/lib/money";
import { byTimeName } from "@/lib/templates";
import { CalendarView } from "@/components/CalendarView";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; date?: string }> }) {
  const academyId = await currentAcademyId(); // 쿠키만 확인 — 아래 쿼리를 공부방 조회와 동시에
  const sp = await searchParams;
  const month = isValidMonth(sp.month) ? sp.month : thisMonthKST();
  // 한국 시간 기준 이 달 1일 0시 ~ 다음 달 1일 0시 (보낸 공지)
  const from = new Date(`${month}-01T00:00:00+09:00`);
  const to = new Date(`${shiftMonth(month, 1)}-01T00:00:00+09:00`);

  const [, classRows, changes, memos, sent, dueRows] = await Promise.all([
    requireAcademy(),
    db
      .select({ id: classes.id, name: classes.name, days: classes.days, time: classes.time, endTime: classes.endTime })
      .from(classes)
      .where(and(eq(classes.academyId, academyId), eq(classes.active, true))),
    db.select().from(calendarChanges).where(and(eq(calendarChanges.academyId, academyId), like(calendarChanges.date, `${month}-%`))),
    db
      .select()
      .from(calendarMemos)
      .where(and(eq(calendarMemos.academyId, academyId), like(calendarMemos.date, `${month}-%`)))
      .orderBy(calendarMemos.createdAt),
    db
      .select()
      .from(notices)
      .where(and(eq(notices.academyId, academyId), gte(notices.sentAt, from), lt(notices.sentAt, to)))
      .orderBy(notices.sentAt),
    db
      .select({ name: students.name, dueDay: students.dueDay })
      .from(students)
      .where(and(eq(students.academyId, academyId), eq(students.active, true))),
  ]);

  const stamp = (d: Date) => `${Number(todayKST(d).slice(5, 7))}/${Number(todayKST(d).slice(8))} ${timeKST(d)}`;

  return (
    <CalendarView
      key={month}
      month={month}
      today={todayKST()}
      initialDate={sp.date?.startsWith(month) ? sp.date : undefined}
      classes={classRows.sort(byTimeName)}
      changes={changes.map((c) => ({ id: c.id, date: c.date, kind: c.kind, classId: c.classId, name: c.name, start: c.start, end: c.end }))}
      memos={memos.map((m) => ({ id: m.id, date: m.date, content: m.content, at: stamp(m.createdAt), edited: !!m.updatedAt }))}
      notices={sent.map((n) => ({ id: n.id, date: todayKST(n.sentAt), time: timeKST(n.sentAt), target: n.target, count: n.recipientCount, content: n.content }))}
      dues={dueRows.flatMap((s) => (s.dueDay ? [{ date: dueDateOf(month, s.dueDay), name: s.name }] : []))}
    />
  );
}
