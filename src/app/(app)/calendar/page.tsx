import { and, count, eq, gte, lt, lte } from "drizzle-orm";
import { db, calendarChanges, calendarMemos, classes, classStudents, notices, students } from "@/db";
import { currentAcademyId, requireAcademy } from "@/lib/session";
import { isValidDate, isValidMonth, shiftDate, shiftMonth, thisMonthKST, timeKST, todayKST } from "@/lib/date";
import { dueDateOf } from "@/lib/money";
import { byTimeName, weekdayOf } from "@/lib/templates";
import { classHex } from "@/lib/class-colors";
import { CalendarView } from "@/components/CalendarView";

/** 달력 — 월(?month=2026-11) / 주(?view=week&date=2026-11-05, 그 날이 든 일~토) */
export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; date?: string; view?: string }> }) {
  const academyId = await currentAcademyId(); // 쿠키만 확인 — 아래 쿼리를 공부방 조회와 동시에
  const sp = await searchParams;
  const today = todayKST();
  const view = sp.view === "week" ? "week" : "month";
  const date = isValidDate(sp.date) ? sp.date : undefined;

  let from: string, to: string;
  if (view === "week") {
    const anchor = date ?? today;
    from = shiftDate(anchor, -weekdayOf(anchor));
    to = shiftDate(from, 6);
  } else {
    const month = isValidMonth(sp.month) ? sp.month : (date?.slice(0, 7) ?? thisMonthKST());
    from = `${month}-01`;
    to = shiftDate(`${shiftMonth(month, 1)}-01`, -1);
  }
  // 보낸 공지: 한국 시간 from 0시 ~ to 다음 날 0시
  const sentFrom = new Date(`${from}T00:00:00+09:00`);
  const sentTo = new Date(`${shiftDate(to, 1)}T00:00:00+09:00`);

  const [, classRows, counts, changes, memos, sent, dueRows] = await Promise.all([
    requireAcademy(),
    db
      .select({ id: classes.id, name: classes.name, days: classes.days, time: classes.time, endTime: classes.endTime, color: classes.color })
      .from(classes)
      .where(and(eq(classes.academyId, academyId), eq(classes.active, true))),
    // 반별 다니는 학생 수 (주간 블록에 표시)
    db
      .select({ classId: classStudents.classId, n: count() })
      .from(classStudents)
      .innerJoin(students, eq(students.id, classStudents.studentId))
      .where(and(eq(students.academyId, academyId), eq(students.active, true)))
      .groupBy(classStudents.classId),
    db
      .select()
      .from(calendarChanges)
      .where(and(eq(calendarChanges.academyId, academyId), gte(calendarChanges.date, from), lte(calendarChanges.date, to))),
    db
      .select()
      .from(calendarMemos)
      .where(and(eq(calendarMemos.academyId, academyId), gte(calendarMemos.date, from), lte(calendarMemos.date, to)))
      .orderBy(calendarMemos.createdAt),
    db
      .select()
      .from(notices)
      .where(and(eq(notices.academyId, academyId), gte(notices.sentAt, sentFrom), lt(notices.sentAt, sentTo)))
      .orderBy(notices.sentAt),
    db
      .select({ name: students.name, dueDay: students.dueDay })
      .from(students)
      .where(and(eq(students.academyId, academyId), eq(students.active, true))),
  ]);

  const countOf = new Map(counts.map((c) => [c.classId, c.n]));
  const months = [...new Set([from.slice(0, 7), to.slice(0, 7)])];
  const stamp = (d: Date) => `${Number(todayKST(d).slice(5, 7))}/${Number(todayKST(d).slice(8))} ${timeKST(d)}`;

  return (
    <CalendarView
      key={`${view}-${from}`}
      view={view}
      from={from}
      to={to}
      today={today}
      initialDate={date && date >= from && date <= to ? date : undefined}
      classes={classRows.sort(byTimeName).map((c) => ({ ...c, hex: classHex(c), count: countOf.get(c.id) ?? 0 }))}
      changes={changes.map((c) => ({ id: c.id, date: c.date, kind: c.kind, classId: c.classId, name: c.name, start: c.start, end: c.end }))}
      memos={memos.map((m) => ({ id: m.id, date: m.date, content: m.content, at: stamp(m.createdAt), edited: !!m.updatedAt }))}
      notices={sent.map((n) => ({ id: n.id, date: todayKST(n.sentAt), time: timeKST(n.sentAt), target: n.target, count: n.recipientCount, content: n.content }))}
      dues={dueRows.flatMap((s) =>
        s.dueDay ? months.map((m) => ({ date: dueDateOf(m, s.dueDay!), name: s.name })).filter((d) => d.date >= from && d.date <= to) : [],
      )}
    />
  );
}
