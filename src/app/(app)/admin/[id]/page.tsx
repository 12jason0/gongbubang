import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db, academies, messageLogs, pageViews } from "@/db";
import { agoLabel, thisMonthKST } from "@/lib/date";
import { isAdminLoginId, requireAdmin } from "@/lib/admin";
import { formatUntil, quotaState } from "@/lib/plan";
import { PAID_TIERS, PLANS } from "@/lib/pricing";
import { formatWon } from "@/lib/money";
import { ConfirmButton } from "@/components/ConfirmButton";
import { toVisits } from "@/lib/usage";
import { adminAddMessages, adminExtend } from "../actions";

export const metadata = { title: "관리자 · 공부방", robots: { index: false } };

const day = (d: Date) => d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short" });
const when = (d: Date) => d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" });

/** 공부방 한 곳: 이용권·남은 통수·연장·충전, 이번 달 발송, 이용 기록(접속한 날·최근 화면) */
export default async function AdminAcademyPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const monthStart = new Date(`${thisMonthKST()}-01T00:00:00+09:00`); // 이번 달 1일 0시 (한국)
  const ok = sql`${messageLogs.status} <> 'FAILED'`;
  const [[a], [views], recent, [m]] = await Promise.all([
    db.select().from(academies).where(and(eq(academies.id, id), isNull(academies.deletedAt))),
    db
      .select({
        days: sql<number>`count(distinct (${pageViews.createdAt} at time zone 'Asia/Seoul')::date)`.mapWith(Number),
        lastSeen: sql<Date | null>`max(${pageViews.createdAt})`.mapWith((v) => (v ? new Date(v) : null)),
      })
      .from(pageViews)
      .where(eq(pageViews.academyId, id)),
    // 최근 방문 10번을 묶기에 넉넉한 만큼 (최신부터)
    // ponytail: 최근 2000개로 자름 — 하루에 수천 번 누르는 공부방이 생기면 방문 수를 SQL 에서 세기
    db
      .select({ kind: pageViews.kind, screen: pageViews.screen, detail: pageViews.detail, at: pageViews.createdAt })
      .from(pageViews)
      .where(eq(pageViews.academyId, id))
      .orderBy(desc(pageViews.createdAt))
      .limit(2000),
    db
      .select({
        kakao: sql<number>`count(*) filter (where ${ok} and ${messageLogs.channel} = 'ALIMTALK')`.mapWith(Number),
        sms: sql<number>`count(*) filter (where ${ok} and ${messageLogs.channel} = 'SMS')`.mapWith(Number),
        failed: sql<number>`count(*) filter (where ${messageLogs.status} = 'FAILED')`.mapWith(Number),
      })
      .from(messageLogs)
      .where(and(eq(messageLogs.academyId, id), gte(messageLogs.createdAt, monthStart))),
  ]);
  if (!a || isAdminLoginId(a.loginId)) notFound();
  const q = quotaState(a);
  const failed = m?.failed ?? 0;
  const visits = toVisits(recent.toReversed()).slice(-10); // 최근 방문 10번, 시간순 (아래가 최근)

  return (
    <main className="px-3 pt-4 pb-8">
      <Link href="/admin" className="-ml-1 flex h-10 w-fit items-center gap-0.5 rounded-xl px-1 text-[13px] text-slate-600 active:bg-black/5">
        <ArrowLeft size={18} /> 목록
      </Link>
      <h1 className="mt-1 px-1 text-[22px] font-bold tracking-tight">{a.name}</h1>
      <p className="px-1 text-[13px] text-slate-500">
        {a.loginId} · {a.ownerPhone || "연락처 없음"} · {day(a.createdAt)} 가입 · {a.signupSource || "경로 모름"}
      </p>

      {/* PC: 카드 3개를 옆으로 (좁으면 2줄·1줄) */}
      <div className="mt-3 grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
      <Card title="이용권">
        <p>
          {q.label} · {a.serviceUntil ? `${formatUntil(a.serviceUntil)}까지` : "기한 없음"}
        </p>
        <p className="text-slate-500">
          남은 카톡 <b className="text-slate-800">{q.remaining}</b>/{q.total}통
        </p>
        <form action={adminExtend} className="mt-3 flex items-center gap-2">
          <input type="hidden" name="academyId" value={a.id} />
          <select name="tier" defaultValue={q.tier === "PLUS" ? "PLUS" : "BASIC"} aria-label="요금제" className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-2">
            {PAID_TIERS.map((t) => (
              <option key={t} value={t}>
                {PLANS[t].label} {formatWon(PLANS[t].price)}
              </option>
            ))}
          </select>
          <ConfirmButton message={`${a.name}: 이용권을 1달 연장할까요? (정말 할까요?)`} className="h-11 shrink-0 rounded-xl bg-brand px-4 font-semibold text-white">
            1달 연장
          </ConfirmButton>
        </form>
        <form action={adminAddMessages} className="mt-2 flex items-center gap-2">
          <input type="hidden" name="academyId" value={a.id} />
          <input name="count" type="number" min={1} max={10000} defaultValue={50} required aria-label="충전할 통수" className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3" />
          <ConfirmButton message={`${a.name}: 카톡을 충전할까요? (정말 할까요?)`} className="h-11 shrink-0 rounded-xl bg-brand-soft px-4 font-semibold text-brand">
            카톡 충전
          </ConfirmButton>
        </form>
      </Card>

      <Card title="이번 달 발송">
        <p className="tabular-nums">
          카톡 {m?.kakao ?? 0} · 문자 {m?.sms ?? 0} · <span className={failed > 0 ? "font-bold text-red-600" : "text-slate-400"}>실패 {failed}</span>
        </p>
      </Card>

      <Card title="이용 기록 (최근 90일)" wide>
        <p>
          접속한 날 <b>{views?.days ?? 0}일</b>
          {views?.lastSeen && <span className="text-slate-500"> · 마지막 접속 {agoLabel(views.lastSeen)}</span>}
        </p>
        <p className="mt-3 mb-1 text-[12.5px] text-slate-500">최근 방문 10번 (시간순 · 30분 넘게 쉬면 새 방문 · 굵은 글씨 = 한 일)</p>
        {visits.length === 0 ? (
          <p className="text-slate-400">아직 없어요</p>
        ) : (
          <ol className="divide-y divide-slate-100">
            {visits.map((v) => (
              <li key={v.start.getTime()} className="py-2 leading-relaxed">
                <span className="text-slate-400 tabular-nums">
                  {when(v.start)} · {v.minutes < 1 ? "1분 미만" : `${v.minutes}분`}
                </span>
                <br />
                {v.steps.map((s, i) => (
                  <span key={i}>
                    {i > 0 && <span className="mx-1 text-slate-300">→</span>}
                    <span className={s.action ? "font-semibold text-brand" : ""}>{s.text}</span>
                  </span>
                ))}
                {v.left && (
                  <span className="text-slate-400">
                    <span className="mx-1 text-slate-300">→</span>나감{v.lastStay !== null && ` (마지막 화면 ${v.lastStay < 1 ? "1분 미만" : `${v.lastStay}분`})`}
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>
      </div>
    </main>
  );
}

/** wide: PC 에서도 한 줄 전체 (방문 기록처럼 긴 것) */
function Card({ title, wide = false, children }: { title: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <section className={`card rounded-2xl p-4 text-[14px] ${wide ? "md:col-span-2 xl:col-span-3" : ""}`}>
      <h2 className="mb-2 text-[13px] font-semibold text-slate-500">{title}</h2>
      {children}
    </section>
  );
}
