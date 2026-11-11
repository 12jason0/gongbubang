import { desc, eq, isNull } from "drizzle-orm";
import { db, academies, orders, creditLedger } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { formatUntil, quotaState } from "@/lib/plan";
import { PAID_TIERS, PLANS, tierOf } from "@/lib/pricing";
import { formatWon } from "@/lib/money";
import { PageTitle } from "@/components/PageTitle";
import { adminAddMessages, adminExtend } from "./actions";

export const metadata = { title: "관리자", robots: { index: false } };

const when = (d: Date) => d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" });

export default async function AdminPage() {
  await requireAdmin();
  const [rows, extended, added] = await Promise.all([
    db.select().from(academies).where(isNull(academies.deletedAt)).orderBy(desc(academies.createdAt)),
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
  ]);
  const log = [
    ...extended.map((r) => ({ at: r.at, text: `${r.name} · ${PLANS[tierOf(r.kind)].label} 1달 연장 (${formatWon(r.amount)} 입금)` })),
    ...added.map((r) => ({ at: r.at, text: `${r.name} · ${r.memo}` })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 30);

  return (
    <main className="px-3 pt-4 md:max-w-4xl">
      <PageTitle title="관리자" sub="계좌이체 입금 확인 → 연장 · 카톡 충전" />

      <div className="space-y-2">
        {rows.map((a) => {
          const q = quotaState(a);
          return (
            <section key={a.id} className="card flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl p-3.5 text-[13.5px]">
              <div className="min-w-40 flex-1">
                <p className="font-bold">{a.name}</p>
                <p className="text-slate-500">
                  {a.loginId} · {a.ownerPhone || "연락처 없음"}
                </p>
                <p className="text-slate-500">
                  {q.label} · {a.serviceUntil ? `${formatUntil(a.serviceUntil)}까지` : "기한 없음"} · 카톡 {q.remaining}/{q.total}통
                </p>
              </div>
              <form action={adminExtend} className="flex items-center gap-1.5">
                <input type="hidden" name="academyId" value={a.id} />
                <select name="tier" defaultValue={q.tier === "PLUS" ? "PLUS" : "BASIC"} className="rounded-lg border border-slate-200 px-2 py-1.5">
                  {PAID_TIERS.map((t) => (
                    <option key={t} value={t}>
                      {PLANS[t].label} {formatWon(PLANS[t].price)}
                    </option>
                  ))}
                </select>
                <button className="rounded-lg bg-brand px-3 py-1.5 font-semibold text-white">이용권 1달 연장</button>
              </form>
              <form action={adminAddMessages} className="flex items-center gap-1.5">
                <input type="hidden" name="academyId" value={a.id} />
                <input name="count" type="number" min={1} max={10000} defaultValue={50} required aria-label="충전할 통수" className="w-20 rounded-lg border border-slate-200 px-2 py-1.5" />
                <button className="rounded-lg bg-brand-soft px-3 py-1.5 font-semibold text-brand">카톡 충전</button>
              </form>
            </section>
          );
        })}
      </div>

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
