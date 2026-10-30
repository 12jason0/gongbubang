import Link from "next/link";
import { ChevronLeft, ChevronRight, History, Users } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { db, students, attendance, notes } from "@/db";
import { requireAcademy } from "@/lib/session";
import { formatDateLabel, isValidDate, shiftDate, timeKST, todayKST } from "@/lib/date";
import { GROUPS, byGroupGradeName } from "@/lib/templates";
import { AttendanceRow, type RowData } from "@/components/AttendanceRow";
import { FeedbackBar } from "@/components/FeedbackBar";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; group?: string }>;
}) {
  const academy = await requireAcademy();
  const sp = await searchParams;
  const today = todayKST();
  const date = isValidDate(sp.date) && sp.date <= today ? sp.date : today;
  const group = GROUPS.includes(sp.group as (typeof GROUPS)[number]) ? sp.group! : "전체";
  const isToday = date === today;

  const [studentRows, attRows, noteRows] = await Promise.all([
    db
      .select()
      .from(students)
      .where(and(eq(students.academyId, academy.id), eq(students.active, true))),
    db.select().from(attendance).where(and(eq(attendance.academyId, academy.id), eq(attendance.date, date))),
    db.select().from(notes).where(and(eq(notes.academyId, academy.id), eq(notes.date, date))),
  ]);

  const attBy = new Map(attRows.map((a) => [a.studentId, a]));
  const noteBy = new Map(noteRows.map((n) => [n.studentId, n]));

  const all: RowData[] = studentRows
    .sort(byGroupGradeName)
    .map((s) => {
      const a = attBy.get(s.id);
      const n = noteBy.get(s.id);
      return {
        id: s.id,
        name: s.name,
        grade: s.grade,
        group: s.group,
        status: (a?.status as RowData["status"]) ?? null,
        notifiedTime: a?.notifiedAt ? timeKST(a.notifiedAt) : null,
        note: n?.content ?? "",
        noteSentTime: n?.sentAt ? timeKST(n.sentAt) : null,
      };
    });

  const rows = group === "전체" ? all : all.filter((r) => r.group === group);
  const present = all.filter((r) => r.status === "PRESENT").length;
  const absent = all.filter((r) => r.status === "ABSENT").length;
  const pendingFeedback = all.filter((r) => r.note && !r.noteSentTime).length;

  const q = (d: string, g: string) => {
    const p = new URLSearchParams();
    if (d !== today) p.set("date", d);
    if (g !== "전체") p.set("group", g);
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };

  const remaining = all.length - present - absent;
  const pct = (n: number) => (all.length ? (n / all.length) * 100 : 0);
  const groupCount = (g: string) => (g === "전체" ? all.length : all.filter((r) => r.group === g).length);

  return (
    <main className="px-3 pt-3">
      {/* 날짜 */}
      <div className="flex items-center justify-between">
        <Link
          href={q(shiftDate(date, -1), group)}
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
            <Link href={q(today, group)} className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-semibold text-white">
              오늘로
            </Link>
          )}
        </div>
        {isToday ? (
          <span className="h-11 w-11" />
        ) : (
          <Link
            href={q(shiftDate(date, 1), group)}
            aria-label="다음날"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 active:bg-black/5"
          >
            <ChevronRight size={24} />
          </Link>
        )}
      </div>

      {/* 요약 */}
      <section className="mt-1 rounded-2xl bg-white px-4 py-3 ring-1 ring-black/5">
        <div className="flex items-center gap-4">
          <Stat label="출석" value={present} className="text-emerald-600" />
          <Stat label="결석" value={absent} className="text-rose-500" />
          <Stat label="남음" value={remaining} className="text-slate-400" />
          <p className="ml-auto text-xs text-slate-400">전체 {all.length}명</p>
        </div>
        <div className="mt-2.5 flex h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
          <div className="bg-emerald-500" style={{ width: `${pct(present)}%` }} />
          <div className="bg-rose-400" style={{ width: `${pct(absent)}%` }} />
        </div>
      </section>

      {!isToday && (
        <p className="mt-2 flex items-center gap-1.5 rounded-xl bg-slate-200/60 px-3 py-2 text-xs text-slate-600">
          <History size={14} /> 지난 날짜예요. 출석을 고쳐도 등원 문자는 나가지 않아요.
        </p>
      )}

      {/* 반 필터 */}
      <div className="mt-2.5 flex gap-1.5">
        {["전체", ...GROUPS].map((g) => (
          <Link
            key={g}
            href={q(date, g)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium ${
              g === group ? "bg-brand text-white" : "bg-white text-slate-500 ring-1 ring-black/5"
            }`}
          >
            {g} <span className={g === group ? "text-white/60" : "text-slate-300"}>{groupCount(g)}</span>
          </Link>
        ))}
      </div>

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
      ) : (
        <ul className="mt-2.5 divide-y divide-black/5 overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
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
