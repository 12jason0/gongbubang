import Link from "next/link";
import { ChevronLeft, ChevronRight, History, Users } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { db, students, attendance, notes, classes, classStudents } from "@/db";
import { requireAcademy } from "@/lib/session";
import { formatDateLabel, isValidDate, shiftDate, timeKST, todayKST } from "@/lib/date";
import { byGradeName, byTimeName, parseDays, weekdayOf } from "@/lib/templates";
import { AttendanceRow, type RowData } from "@/components/AttendanceRow";
import { FeedbackBar } from "@/components/FeedbackBar";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; c?: string }>;
}) {
  const academy = await requireAcademy();
  const sp = await searchParams;
  const today = todayKST();
  const date = isValidDate(sp.date) && sp.date <= today ? sp.date : today;
  const isToday = date === today;
  const weekday = weekdayOf(date);

  const [studentRows, classRows, memberRows, attRows, noteRows] = await Promise.all([
    db
      .select()
      .from(students)
      .where(and(eq(students.academyId, academy.id), eq(students.active, true))),
    db
      .select()
      .from(classes)
      .where(and(eq(classes.academyId, academy.id), eq(classes.active, true))),
    db
      .select({ classId: classStudents.classId, studentId: classStudents.studentId })
      .from(classStudents)
      .innerJoin(classes, eq(classes.id, classStudents.classId))
      .where(eq(classes.academyId, academy.id)),
    db.select().from(attendance).where(and(eq(attendance.academyId, academy.id), eq(attendance.date, date))),
    db.select().from(notes).where(and(eq(notes.academyId, academy.id), eq(notes.date, date))),
  ]);

  // 이 날짜 요일에 수업 있는 반
  classRows.sort(byTimeName);
  const dayClasses = classRows.filter((c) => parseDays(c.days).includes(weekday));
  const classById = new Map(classRows.map((c) => [c.id, c]));

  const classesOf = new Map<string, string[]>(); // 학생 → 반 id 목록
  for (const m of memberRows) {
    classesOf.set(m.studentId, [...(classesOf.get(m.studentId) ?? []), m.classId]);
  }
  const inDayClass = (sid: string) => (classesOf.get(sid) ?? []).some((cid) => dayClasses.some((c) => c.id === cid));

  // 필터: today(이 날 수업) / all(전체) / 반 id
  const filter =
    sp.c === "all" || dayClasses.some((c) => c.id === sp.c) || (sp.c === "today" && dayClasses.length > 0)
      ? sp.c!
      : dayClasses.length
        ? "today"
        : "all";

  const attBy = new Map(attRows.map((a) => [a.studentId, a]));
  const noteBy = new Map(noteRows.map((n) => [n.studentId, n]));

  const all: (RowData & { classIds: string[] })[] = studentRows.sort(byGradeName).map((s) => {
    const a = attBy.get(s.id);
    const n = noteBy.get(s.id);
    const cids = classesOf.get(s.id) ?? [];
    // 이 날 수업 있는 반을 앞에
    const labels = cids
      .map((id) => classById.get(id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .sort((x, y) => Number(dayClasses.includes(y)) - Number(dayClasses.includes(x)) || byTimeName(x, y))
      .map((c) => c.name);
    return {
      id: s.id,
      name: s.name,
      grade: s.grade,
      classLabel: labels.join(" · ") || "반 없음",
      classIds: cids,
      status: (a?.status as RowData["status"]) ?? null,
      notifiedTime: a?.notifiedAt ? timeKST(a.notifiedAt) : null,
      note: n?.content ?? "",
      noteSentTime: n?.sentAt ? timeKST(n.sentAt) : null,
    };
  });

  const pick = (f: string) =>
    f === "all" ? all : f === "today" ? all.filter((r) => inDayClass(r.id)) : all.filter((r) => r.classIds.includes(f));
  // 수업 없는 날 출석한 학생도 "오늘 수업"에서 빠지지 않게
  const rows = filter === "today" ? all.filter((r) => inDayClass(r.id) || r.status) : pick(filter);

  const present = rows.filter((r) => r.status === "PRESENT").length;
  const absent = rows.filter((r) => r.status === "ABSENT").length;
  const pendingFeedback = all.filter((r) => r.note && !r.noteSentTime).length;

  const q = (d: string, g: string | null) => {
    const p = new URLSearchParams();
    if (d !== today) p.set("date", d);
    if (g) p.set("c", g);
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };

  const remaining = rows.length - present - absent;
  const pct = (n: number) => (rows.length ? (n / rows.length) * 100 : 0);
  const chips = [
    ...(dayClasses.length ? [{ key: "today", label: `${["일", "월", "화", "수", "목", "금", "토"][weekday]}요일 수업`, n: pick("today").length }] : []),
    { key: "all", label: "전체", n: all.length },
    ...dayClasses.map((c) => ({ key: c.id, label: c.time ? `${c.name} ${c.time}` : c.name, n: pick(c.id).length })),
  ];

  return (
    <main className="px-3 pt-3">
      {/* PC: 날짜와 요약을 한 줄에 */}
      <div className="md:grid md:grid-cols-2 md:items-center md:gap-3">
      {/* 날짜 */}
      <div className="flex items-center justify-between md:rounded-2xl md:bg-white md:px-2 md:py-1.5 md:ring-1 md:ring-black/5">
        <Link
          href={q(shiftDate(date, -1), null)}
          aria-label="전날"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 active:bg-black/5"
        >
          <ChevronLeft size={24} />
        </Link>
        <div className="flex items-center gap-2">
          <p className="text-[19px] font-bold tracking-tight">{formatDateLabel(date)}</p>
          {isToday ? (
            <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[11px] font-semibold text-[#8a6d35]">오늘</span>
          ) : (
            <Link href={q(today, null)} className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-semibold text-white">
              오늘로
            </Link>
          )}
        </div>
        {isToday ? (
          <span className="h-11 w-11" />
        ) : (
          <Link
            href={q(shiftDate(date, 1), null)}
            aria-label="다음날"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 active:bg-black/5"
          >
            <ChevronRight size={24} />
          </Link>
        )}
      </div>

      {/* 요약 */}
      <section className="mt-1 rounded-2xl bg-white px-4 py-3 ring-1 ring-black/5 md:mt-0">
        <div className="flex items-center gap-4">
          <Stat label="출석" value={present} className="text-emerald-600" />
          <Stat label="결석" value={absent} className="text-rose-500" />
          <Stat label="남음" value={remaining} className="text-slate-400" />
          <p className="ml-auto text-xs text-slate-400">{rows.length}명</p>
        </div>
        <div className="mt-2.5 flex h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
          <div className="bg-emerald-500" style={{ width: `${pct(present)}%` }} />
          <div className="bg-rose-400" style={{ width: `${pct(absent)}%` }} />
        </div>
      </section>
      </div>

      {!isToday && (
        <p className="mt-2 flex items-center gap-1.5 rounded-xl bg-slate-200/60 px-3 py-2 text-xs text-slate-600">
          <History size={14} /> 지난 날짜예요. 출석을 고쳐도 등원 문자는 나가지 않아요.
        </p>
      )}

      {/* 반 필터 */}
      <div className="-mx-3 mt-2.5 flex gap-1.5 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none]">
        {chips.map((c) => (
          <Link
            key={c.key}
            href={q(date, c.key === (dayClasses.length ? "today" : "all") ? null : c.key)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium whitespace-nowrap ${
              c.key === filter ? "bg-brand text-white" : "bg-white text-slate-500 ring-1 ring-black/5"
            }`}
          >
            {c.label} <span className={c.key === filter ? "text-gold" : "text-slate-300"}>{c.n}</span>
          </Link>
        ))}
      </div>
      {classRows.length === 0 && all.length > 0 && (
        <Link href="/students?tab=classes" className="mt-2 block rounded-xl bg-gold-soft px-3 py-2 text-xs text-[#8a6d35]">
          반을 만들면 요일마다 그날 수업 있는 학생만 보여요 → 반 만들기
        </Link>
      )}
      {filter === "today" && rows.length === 0 && (
        <p className="mt-2 rounded-xl bg-white px-3 py-6 text-center text-sm text-slate-400 ring-1 ring-black/5">
          이 날 수업 있는 반에 학생이 없어요
        </p>
      )}

      {/* 학생 목록 */}
      {all.length === 0 ? (
        <div className="mt-3 rounded-2xl bg-white px-4 py-14 text-center ring-1 ring-black/5">
          <Users className="mx-auto text-slate-300" size={32} />
          <p className="mt-2 font-semibold">첫 학생을 등록해 주세요</p>
          <p className="mt-1 text-sm text-slate-400">학부모 번호를 넣으면 바로 출석 문자를 보낼 수 있어요.</p>
          <Link href="/students" className="mt-4 inline-block rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white">
            학생 추가
          </Link>
        </div>
      ) : rows.length === 0 ? null : (
        <ul className="mt-2.5 divide-y divide-black/5 overflow-hidden rounded-2xl bg-white ring-1 ring-black/5 lg:grid lg:grid-cols-2 lg:divide-y-0">
          {rows.map((r) => (
            <AttendanceRow key={`${r.id}-${date}-${r.noteSentTime ?? ""}`} row={r} date={date} />
          ))}
        </ul>
      )}
      <div className="h-20" />

      <FeedbackBar date={date} pending={pendingFeedback} />
    </main>
  );
}

function Stat({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <p className="flex items-baseline gap-1">
      <span className={`text-[22px] leading-none font-bold tabular-nums ${className}`}>{value}</span>
      <span className="text-xs font-medium text-slate-400">{label}</span>
    </p>
  );
}
