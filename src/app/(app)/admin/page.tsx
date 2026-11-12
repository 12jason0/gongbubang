import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { desc, eq, isNull, max, sql } from "drizzle-orm";
import { db, academies, orders, creditLedger, students, messageLogs, pageViews } from "@/db";
import { agoLabel } from "@/lib/date";
import { isAdminLoginId, requireAdmin } from "@/lib/admin";
import { PLANS, tierOf } from "@/lib/pricing";
import { formatWon } from "@/lib/money";
import { PageTitle } from "@/components/PageTitle";

export const metadata = { title: "관리자", robots: { index: false } };

const day = (d: Date) => d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short" });
const when = (d: Date) => d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" });

/** 관리자 첫 화면: 공부방 목록 (누르면 /admin/[id] 상세 — 이용권·연장·충전·이용 기록) */
export default async function AdminPage() {
  await requireAdmin();
  const ok = sql`${messageLogs.status} <> 'FAILED'`;
  const [allRows, extended, added, studentStats, messageStats, viewStats] = await Promise.all([
    db
      .select({ id: academies.id, name: academies.name, loginId: academies.loginId, createdAt: academies.createdAt, signupSource: academies.signupSource })
      .from(academies)
      .where(isNull(academies.deletedAt))
      .orderBy(desc(academies.createdAt)),
    db
      .select({ at: orders.createdAt, name: academies.name, kind: orders.kind, amount: orders.amount })
      .from(orders)
      .innerJoin(academies, eq(orders.academyId, academies.id))
      .where(eq(orders.paymentKey, "BANK"))
      .orderBy(desc(orders.createdAt))
      .limit(30),
    db
      .select({ at: creditLedger.createdAt, name: academies.name, memo: creditLedger.memo })
      .from(creditLedger)
      .innerJoin(academies, eq(creditLedger.academyId, academies.id))
      .where(eq(creditLedger.kind, "ADMIN_MSG"))
      .orderBy(desc(creditLedger.createdAt))
      .limit(30),
    // 숫자만 (학생 이름·번호는 안 꺼냄)
    db
      .select({
        academyId: students.academyId,
        total: sql<number>`count(*) filter (where ${students.active})`.mapWith(Number),
        everAgreed: sql<boolean>`bool_or(${students.consent} = 'AGREED')`,
        requested: sql<boolean>`bool_or(${students.consentRequestedAt} is not null)`,
      })
      .from(students)
      .groupBy(students.academyId),
    db
      .select({
        academyId: messageLogs.academyId,
        consentSent: sql<boolean>`bool_or(${messageLogs.kind} = 'CONSENT' and ${ok})`,
        firstSent: sql<boolean>`bool_or(${messageLogs.kind} <> 'CONSENT' and ${ok})`,
      })
      .from(messageLogs)
      .groupBy(messageLogs.academyId),
    db.select({ academyId: pageViews.academyId, lastSeen: max(pageViews.createdAt) }).from(pageViews).groupBy(pageViews.academyId),
  ]);
  const rows = allRows.filter((a) => !isAdminLoginId(a.loginId)); // 관리자(개발자) 계정은 뺌
  const sByA = new Map(studentStats.map((r) => [r.academyId, r]));
  const mByA = new Map(messageStats.map((r) => [r.academyId, r]));
  const vByA = new Map(viewStats.map((r) => [r.academyId, r.lastSeen]));
  const log = [
    ...extended.map((r) => ({ at: r.at, text: `${r.name} · ${PLANS[tierOf(r.kind)].label} 1달 연장 (${formatWon(r.amount)} 입금)` })),
    ...added.map((r) => ({ at: r.at, text: `${r.name} · ${r.memo}` })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 30);

  return (
    <main className="px-3 pt-4">
      <PageTitle title="관리자" sub={`공부방 ${rows.length}곳 · 이름을 누르면 이용권·연장·충전·이용 기록`} />

      {/* PC: 화면 폭에 맞춰 2~4줄로 */}
      <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {rows.length === 0 && <li className="card rounded-2xl p-3 text-[13px] text-slate-400">아직 없어요</li>}
        {rows.map((a) => {
          const s = sByA.get(a.id);
          const m = mByA.get(a.id);
          const lastSeen = vByA.get(a.id);
          const steps = [
            { label: "학생 등록", done: (s?.total ?? 0) > 0 },
            { label: "동의 요청", done: !!(s?.requested || m?.consentSent) },
            { label: "동의 받음", done: !!s?.everAgreed },
            { label: "첫 카톡", done: !!m?.firstSent },
          ];
          return (
            <li key={a.id} className="card rounded-2xl">
              <Link href={`/admin/${a.id}`} className="flex h-full items-center gap-2 rounded-2xl p-3.5 text-[13px] active:bg-black/5 md:hover:bg-black/[0.02]">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-[15px] font-bold">{a.name}</span>
                    <span className="ml-auto shrink-0 text-slate-500">{lastSeen ? `${agoLabel(lastSeen)} 접속` : "접속 기록 없음"}</span>
                  </div>
                  <p className="text-slate-500 tabular-nums">
                    {day(a.createdAt)} 가입 · {a.signupSource || "경로 모름"} · 학생 {s?.total ?? 0}명
                  </p>
                  <p className="flex flex-wrap gap-x-2">
                    {steps.map((st) => (
                      <span key={st.label} className={st.done ? "text-brand" : "text-slate-300"}>
                        {st.done ? "✓" : "○"} {st.label}
                      </span>
                    ))}
                  </p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-slate-300" />
              </Link>
            </li>
          );
        })}
      </ul>

      <h2 className="mt-6 mb-2 text-[15px] font-bold">기록 (최근 30개)</h2>
      <ul className="card divide-y divide-slate-100 rounded-2xl text-[13px]">
        {log.length === 0 && <li className="p-3 text-slate-400">아직 없어요</li>}
        {log.map((l, i) => (
          <li key={i} className="flex gap-3 p-3">
            <span className="shrink-0 text-slate-400 tabular-nums">{when(l.at)}</span>
            <span>{l.text}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
