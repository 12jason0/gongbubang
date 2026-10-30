import Link from "next/link";
import { ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import { and, eq, gte, like, lt } from "drizzle-orm";
import { db, attendance, messageLogs, students } from "@/db";
import { requireAcademy } from "@/lib/session";
import { isValidMonth, shiftMonth, thisMonthKST } from "@/lib/date";
import { isLongMessage } from "@/lib/sms";
import { byGroupGradeName } from "@/lib/templates";

const KIND_LABEL: Record<string, string> = { ATTENDANCE: "등원", FEEDBACK: "피드백", NOTICE: "공지" };

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const academy = await requireAcademy();
  const sp = await searchParams;
  const current = thisMonthKST();
  const month = isValidMonth(sp.month) && sp.month <= current ? sp.month : current;
  const [y, m] = month.split("-").map(Number);

  // 한국 시간 기준 이번 달 1일 0시 ~ 다음 달 1일 0시
  const from = new Date(`${month}-01T00:00:00+09:00`);
  const to = new Date(`${shiftMonth(month, 1)}-01T00:00:00+09:00`);

  const [studentRows, attRows, logs] = await Promise.all([
    db.select().from(students).where(eq(students.academyId, academy.id)),
    db
      .select({ studentId: attendance.studentId, status: attendance.status })
      .from(attendance)
      .where(and(eq(attendance.academyId, academy.id), like(attendance.date, `${month}-%`))),
    db
      .select({ kind: messageLogs.kind, text: messageLogs.text, status: messageLogs.status })
      .from(messageLogs)
      .where(and(eq(messageLogs.academyId, academy.id), gte(messageLogs.createdAt, from), lt(messageLogs.createdAt, to))),
  ]);

  const tally = new Map<string, { present: number; absent: number }>();
  for (const a of attRows) {
    const t = tally.get(a.studentId) ?? { present: 0, absent: 0 };
    if (a.status === "PRESENT") t.present++;
    else t.absent++;
    tally.set(a.studentId, t);
  }

  // 다니는 학생 + 이번 달 기록이 있는 그만둔 학생
  const rows = studentRows
    .filter((s) => s.active || tally.has(s.id))
    .sort(byGroupGradeName)
    .map((s) => ({ ...s, ...(tally.get(s.id) ?? { present: 0, absent: 0 }) }));

  // 문자 사용량 (월 관리비·문자비 계산 근거)
  const sentLogs = logs.filter((l) => l.status !== "FAILED");
  const usage = { short: 0, long: 0, failed: logs.length - sentLogs.length };
  const byKind: Record<string, number> = {};
  for (const l of sentLogs) {
    if (isLongMessage(l.text)) usage.long++;
    else usage.short++;
    byKind[l.kind] = (byKind[l.kind] ?? 0) + 1;
  }

  const totalPresent = rows.reduce((n, r) => n + r.present, 0);
  const totalAbsent = rows.reduce((n, r) => n + r.absent, 0);

  return (
    <main className="px-3 pt-3">
      <div className="flex items-center justify-between">
        <Link
          href={`/stats?month=${shiftMonth(month, -1)}`}
          aria-label="이전 달"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 active:bg-black/5"
        >
          <ChevronLeft size={24} />
        </Link>
        <p className="text-[19px] font-bold tracking-tight">
          {y}년 {m}월
        </p>
        {month < current ? (
          <Link
            href={`/stats?month=${shiftMonth(month, 1)}`}
            aria-label="다음 달"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 active:bg-black/5"
          >
            <ChevronRight size={24} />
          </Link>
        ) : (
          <span className="h-11 w-11" />
        )}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
          <p className="text-[11px] font-medium text-slate-400">이번 달 출석</p>
          <p className="text-[26px] leading-tight font-bold text-emerald-600 tabular-nums">{totalPresent}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
          <p className="text-[11px] font-medium text-slate-400">이번 달 결석</p>
          <p className="text-[26px] leading-tight font-bold text-rose-500 tabular-nums">{totalAbsent}</p>
        </div>
      </div>

      <section className="mt-3 rounded-2xl bg-white ring-1 ring-black/5">
        <div className="flex px-4 pt-3 pb-2 text-[11px] font-medium text-slate-400">
          <span className="flex-1">학생</span>
          <span className="w-12 text-right">출석</span>
          <span className="w-12 text-right">결석</span>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">학생이 없어요</p>
        ) : (
          <ul className="divide-y divide-black/5 border-t border-black/5">
            {rows.map((r) => {
              const total = r.present + r.absent;
              return (
                <li key={r.id} className="flex items-center px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">
                      {r.name} <span className="text-xs text-slate-400">{r.grade}</span>
                      {!r.active && <span className="ml-1 text-xs text-slate-400">(그만둠)</span>}
                    </p>
                    <div className="mt-1 flex h-1.5 w-28 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                      {total > 0 && (
                        <>
                          <div className="bg-emerald-500" style={{ width: `${(r.present / total) * 100}%` }} />
                          <div className="bg-rose-400" style={{ width: `${(r.absent / total) * 100}%` }} />
                        </>
                      )}
                    </div>
                  </div>
                  <span className="w-12 text-right text-[15px] font-semibold text-emerald-600 tabular-nums">{r.present}</span>
                  <span
                    className={`w-12 text-right text-[15px] tabular-nums ${r.absent ? "font-bold text-rose-500" : "text-slate-300"}`}
                  >
                    {r.absent}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-3 flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-black/5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-soft text-[#8a6d35]">
          <MessageSquare size={19} />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">
            문자 단문 {usage.short}건 · 장문 {usage.long}건
            {usage.failed > 0 && <span className="text-rose-500"> · 실패 {usage.failed}</span>}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {Object.entries(byKind)
              .map(([k, n]) => `${KIND_LABEL[k] ?? k} ${n}`)
              .join(" · ") || "아직 보낸 문자가 없어요"}
          </p>
        </div>
      </section>
    </main>
  );
}
