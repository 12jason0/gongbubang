import Link from "next/link";
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

  return (
    <main>
      {/* 날짜 */}
      <div className="flex items-center justify-between bg-white px-2 py-3">
        <Link href={q(shiftDate(date, -1), group)} className="px-3 py-1 text-xl text-slate-400" aria-label="전날">
          ‹
        </Link>
        <div className="text-center">
          <p className="text-lg font-bold">{formatDateLabel(date)}</p>
          {!isToday && (
            <Link href={q(today, group)} className="text-xs text-brand underline">
              오늘로
            </Link>
          )}
        </div>
        {isToday ? (
          <span className="px-3 py-1 text-xl text-slate-200">›</span>
        ) : (
          <Link href={q(shiftDate(date, 1), group)} className="px-3 py-1 text-xl text-slate-400" aria-label="다음날">
            ›
          </Link>
        )}
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-3 border-y border-slate-100 bg-white text-center text-sm">
        <div className="py-2">
          <p className="text-slate-400">출석</p>
          <p className="text-lg font-bold text-emerald-600">{present}</p>
        </div>
        <div className="py-2">
          <p className="text-slate-400">결석</p>
          <p className="text-lg font-bold text-rose-500">{absent}</p>
        </div>
        <div className="py-2">
          <p className="text-slate-400">미체크</p>
          <p className="text-lg font-bold text-slate-500">{all.length - present - absent}</p>
        </div>
      </div>

      {!isToday && (
        <p className="bg-slate-100 px-4 py-2 text-xs text-slate-500">
          지난 날짜예요. 출석을 고쳐도 등원 문자는 나가지 않아요.
        </p>
      )}

      {/* 반 필터 */}
      <div className="flex gap-2 px-4 py-3">
        {["전체", ...GROUPS].map((g) => (
          <Link
            key={g}
            href={q(date, g)}
            className={`rounded-full px-3.5 py-1.5 text-sm ${
              g === group ? "bg-brand text-white" : "bg-white text-slate-500"
            }`}
          >
            {g}
          </Link>
        ))}
      </div>

      {/* 학생 목록 */}
      {all.length === 0 ? (
        <div className="px-4 py-16 text-center text-slate-400">
          <p>등록된 학생이 없어요.</p>
          <Link href="/students" className="mt-3 inline-block rounded-xl bg-brand px-4 py-2.5 text-sm text-white">
            학생 추가하기
          </Link>
        </div>
      ) : (
        <ul className="space-y-2 px-3 pb-20">
          {rows.map((r) => (
            <AttendanceRow key={`${r.id}-${date}-${r.noteSentTime ?? ""}`} row={r} date={date} isToday={isToday} />
          ))}
        </ul>
      )}

      <FeedbackBar date={date} pending={pendingFeedback} />
    </main>
  );
}
