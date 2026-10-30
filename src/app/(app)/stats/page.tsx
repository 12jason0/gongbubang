import Link from "next/link";
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

  return (
    <main className="px-3 py-4">
      <div className="flex items-center justify-between rounded-2xl bg-white px-2 py-3">
        <Link href={`/stats?month=${shiftMonth(month, -1)}`} className="px-3 text-xl text-slate-400" aria-label="이전 달">
          ‹
        </Link>
        <p className="text-lg font-bold">
          {y}년 {m}월 출결
        </p>
        {month < current ? (
          <Link href={`/stats?month=${shiftMonth(month, 1)}`} className="px-3 text-xl text-slate-400" aria-label="다음 달">
            ›
          </Link>
        ) : (
          <span className="px-3 text-xl text-slate-200">›</span>
        )}
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left font-normal">학생</th>
              <th className="px-3 py-2 text-right font-normal">출석</th>
              <th className="px-3 py-2 text-right font-normal">결석</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-slate-400">
                  학생이 없어요
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-3 py-2.5">
                  {r.name} <span className="text-xs text-slate-400">{r.grade}</span>
                  {!r.active && <span className="ml-1 text-xs text-slate-400">(그만둠)</span>}
                </td>
                <td className="px-3 py-2.5 text-right text-emerald-600">{r.present}</td>
                <td className={`px-3 py-2.5 text-right ${r.absent ? "font-semibold text-rose-500" : "text-slate-300"}`}>
                  {r.absent}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 rounded-2xl bg-white p-3 text-sm">
        <p className="font-semibold">이번 달 문자</p>
        <p className="mt-1 text-slate-600">
          단문 {usage.short}건 · 장문 {usage.long}건
          {usage.failed > 0 && <span className="text-rose-500"> · 실패 {usage.failed}건</span>}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">
          {Object.entries(byKind)
            .map(([k, n]) => `${KIND_LABEL[k] ?? k} ${n}`)
            .join(" · ") || "아직 보낸 문자가 없어요"}
        </p>
      </div>
    </main>
  );
}
