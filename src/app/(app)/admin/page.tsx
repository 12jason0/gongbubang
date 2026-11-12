import { desc, eq, isNull, sql } from "drizzle-orm";
import { db, academies, orders, creditLedger, students, messageLogs } from "@/db";
import { thisMonthKST } from "@/lib/date";
import { requireAdmin } from "@/lib/admin";
import { formatUntil, quotaState } from "@/lib/plan";
import { PAID_TIERS, PLANS, tierOf } from "@/lib/pricing";
import { formatWon } from "@/lib/money";
import { PageTitle } from "@/components/PageTitle";
import { ConfirmButton } from "@/components/ConfirmButton";
import { adminAddMessages, adminExtend } from "./actions";

export const metadata = { title: "관리자", robots: { index: false } };

const day = (d: Date) => d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short" });
const when = (d: Date) => d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" });

export default async function AdminPage() {
  await requireAdmin();
  const monthStart = new Date(`${thisMonthKST()}-01T00:00:00+09:00`); // 이번 달 1일 0시 (한국)
  const ok = sql`${messageLogs.status} <> 'FAILED'`; // SENT (+ 테스트 모드 TEST)
  const [rows, extended, added, studentStats, messageStats] = await Promise.all([
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
    // 쓰는지 보기 — 숫자만 (학생 이름·번호는 안 꺼냄)
    db
      .select({
        academyId: students.academyId,
        total: sql<number>`count(*) filter (where ${students.active})`.mapWith(Number),
        agreed: sql<number>`count(*) filter (where ${students.active} and ${students.consent} = 'AGREED')`.mapWith(Number),
        pending: sql<number>`count(*) filter (where ${students.active} and ${students.consent} = 'PENDING')`.mapWith(Number),
        everAgreed: sql<boolean>`bool_or(${students.consent} = 'AGREED')`,
        requested: sql<boolean>`bool_or(${students.consentRequestedAt} is not null)`,
      })
      .from(students)
      .groupBy(students.academyId),
    db
      .select({
        academyId: messageLogs.academyId,
        kakao: sql<number>`count(*) filter (where ${messageLogs.createdAt} >= ${monthStart} and ${ok} and ${messageLogs.channel} = 'ALIMTALK')`.mapWith(Number),
        sms: sql<number>`count(*) filter (where ${messageLogs.createdAt} >= ${monthStart} and ${ok} and ${messageLogs.channel} = 'SMS')`.mapWith(Number),
        failed: sql<number>`count(*) filter (where ${messageLogs.createdAt} >= ${monthStart} and ${messageLogs.status} = 'FAILED')`.mapWith(Number),
        lastSent: sql<Date | null>`max(${messageLogs.createdAt}) filter (where ${ok})`.mapWith((v) => (v ? new Date(v) : null)),
        consentSent: sql<boolean>`bool_or(${messageLogs.kind} = 'CONSENT' and ${ok})`,
        firstSent: sql<boolean>`bool_or(${messageLogs.kind} <> 'CONSENT' and ${ok})`,
      })
      .from(messageLogs)
      .groupBy(messageLogs.academyId),
  ]);
  const sByA = new Map(studentStats.map((r) => [r.academyId, r]));
  const mByA = new Map(messageStats.map((r) => [r.academyId, r]));
  const usage = rows.map((a) => {
    const s = sByA.get(a.id);
    const m = mByA.get(a.id);
    return {
      id: a.id,
      name: a.name,
      joined: a.createdAt,
      steps: [
        { label: "학생 등록", done: (s?.total ?? 0) > 0 },
        { label: "동의 요청", done: !!(s?.requested || m?.consentSent) },
        { label: "동의 받음", done: !!s?.everAgreed },
        { label: "첫 카톡", done: !!m?.firstSent },
      ],
      total: s?.total ?? 0,
      agreed: s?.agreed ?? 0,
      pending: s?.pending ?? 0,
      kakao: m?.kakao ?? 0,
      sms: m?.sms ?? 0,
      failed: m?.failed ?? 0,
      lastSent: m?.lastSent ?? null,
    };
  });
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
                <ConfirmButton message={`${a.name}: 이용권을 1달 연장할까요? (정말 할까요?)`} className="rounded-lg bg-brand px-3 py-1.5 font-semibold text-white">
                  이용권 1달 연장
                </ConfirmButton>
              </form>
              <form action={adminAddMessages} className="flex items-center gap-1.5">
                <input type="hidden" name="academyId" value={a.id} />
                <input name="count" type="number" min={1} max={10000} defaultValue={50} required aria-label="충전할 통수" className="w-20 rounded-lg border border-slate-200 px-2 py-1.5" />
                <ConfirmButton message={`${a.name}: 카톡을 충전할까요? (정말 할까요?)`} className="rounded-lg bg-brand-soft px-3 py-1.5 font-semibold text-brand">
                  카톡 충전
                </ConfirmButton>
              </form>
            </section>
          );
        })}
      </div>

      <h2 className="mt-6 mb-2 text-[15px] font-bold">잘 쓰고 있나요 ({usage.length}곳)</h2>
      <div className="card overflow-x-auto rounded-2xl">
        <table className="w-full text-[13px] whitespace-nowrap">
          <thead className="text-left text-slate-500">
            <tr className="border-b border-slate-100">
              <th className="p-2.5 font-semibold">공부방</th>
              <th className="p-2.5 font-semibold">가입일</th>
              <th className="p-2.5 font-semibold">시작 단계</th>
              <th className="p-2.5 text-right font-semibold">학생</th>
              <th className="p-2.5 font-semibold">학부모 동의</th>
              <th className="p-2.5 text-right font-semibold">이번 달 카톡·문자</th>
              <th className="p-2.5 text-right font-semibold">실패</th>
              <th className="p-2.5 font-semibold">마지막 발송</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 tabular-nums">
            {usage.map((u) => (
              <tr key={u.id}>
                <td className="p-2.5 font-semibold">{u.name}</td>
                <td className="p-2.5 text-slate-500">{day(u.joined)}</td>
                <td className="p-2.5">
                  {u.steps.map((st, i) => (
                    <span key={st.label} className={st.done ? "text-brand" : "text-slate-300"}>
                      {i > 0 && <span className="mx-1 text-slate-300">→</span>}
                      {st.done ? "✓" : "○"} {st.label}
                    </span>
                  ))}
                </td>
                <td className="p-2.5 text-right">{u.total}명</td>
                <td className="p-2.5">
                  동의 {u.agreed}명 / 대기 {u.pending}명
                </td>
                <td className="p-2.5 text-right">
                  카톡 {u.kakao} · 문자 {u.sms}
                </td>
                <td className={`p-2.5 text-right ${u.failed > 0 ? "font-bold text-red-600" : "text-slate-400"}`}>{u.failed}</td>
                <td className="p-2.5 text-slate-500">{u.lastSent ? day(u.lastSent) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
