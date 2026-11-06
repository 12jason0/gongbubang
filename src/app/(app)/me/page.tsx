import Link from "next/link";
import { and, desc, eq, ne } from "drizzle-orm";
import { ChevronRight, MessageCircle, Receipt, UserRound } from "lucide-react";
import { db, orders } from "@/db";
import { currentAcademyId, requireAcademy } from "@/lib/session";
import { formatUntil, planState, quotaNote, quotaState } from "@/lib/plan";
import { formatWon } from "@/lib/money";
import { todayKST } from "@/lib/date";
import { formatPhone } from "@/lib/phone";
import { PLANS } from "@/lib/pricing";
import { PageTitle } from "@/components/PageTitle";
import { OwnerPhoneForm, PasswordForm } from "@/components/MeForms";
import { KakaoLinkRow } from "@/components/KakaoLogin";
import { isKakaoAccount, kakaoEnabled } from "@/lib/kakao";

export const metadata = { title: "마이페이지" };

// 주문 종류 → 화면 이름 (예전 이용권 주문 SUBSCRIPTION = 기본, CREDIT = 충전금)
const KIND: Record<string, string> = {
  BASIC: `${PLANS.BASIC.label} 1개월`,
  PLUS: `${PLANS.PLUS.label} 1개월`,
  SUBSCRIPTION: `${PLANS.BASIC.label} 1개월`,
  CREDIT: "충전금",
};
const STATUS: Record<string, { label: string; tone: string }> = {
  DONE: { label: "결제 완료", tone: "bg-emerald-50 text-emerald-700" },
  CONFIRMING: { label: "확인 중", tone: "bg-amber-50 text-amber-700" },
  FAILED: { label: "실패", tone: "bg-rose-50 text-rose-600" },
};

/** 원장님 마이페이지 — 계정·요금제·결제 내역. 로그아웃·탈퇴는 한 단계 안쪽(/me/account) */
export default async function MePage({ searchParams }: { searchParams: Promise<{ kakao?: string }> }) {
  const academyId = await currentAcademyId();
  const kakaoStatus = (await searchParams).kakao; // 카카오 연결하고 돌아왔을 때 결과 (api/auth/kakao/callback)
  const [academy, history] = await Promise.all([
    requireAcademy(),
    // 결제창만 열고 닫은 주문(READY)은 빼고
    db
      .select()
      .from(orders)
      .where(and(eq(orders.academyId, academyId), ne(orders.status, "READY")))
      .orderBy(desc(orders.createdAt))
      .limit(24),
  ]);
  const kakaoOnly = isKakaoAccount(academy.loginId);
  const state = planState(academy);
  const quota = quotaState(academy);
  const period =
    state.kind === "UNLIMITED" ? "기한 없음" : state.kind === "EXPIRED" ? `${formatUntil(state.until)}에 끝남` : `${formatUntil(state.until)}까지`;
  const day = (d: Date) => todayKST(d).replaceAll("-", "."); // "2026.10.26" (한 줄에)

  return (
    <main className="px-3 pt-4 md:max-w-3xl">
      <PageTitle title="마이페이지" sub="계정·요금제·결제 내역" />

      <div className="grid gap-3 lg:grid-cols-2">
        {/* 계정 */}
        <section className="card space-y-4 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-gold">
              <UserRound size={21} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[17px] font-bold">{academy.name}</p>
              <p className="text-[13px] text-slate-500">
                {kakaoOnly ? "카카오로 로그인하는 계정" : <>아이디 <b className="text-[#1c2230]">{academy.loginId}</b></>}
              </p>
            </div>
            <Link href="/settings" className="ml-auto shrink-0 text-[12.5px] font-semibold text-brand underline">
              이름 바꾸기
            </Link>
          </div>
          <OwnerPhoneForm phone={academy.ownerPhone ? formatPhone(academy.ownerPhone) : ""} />
          {/* 카카오로 가입한 계정은 비밀번호가 없어서 바꾸기 칸을 숨김 */}
          {!kakaoOnly && <PasswordForm />}
          {(kakaoEnabled() || academy.kakaoId) && <KakaoLinkRow linked={!!academy.kakaoId} kakaoOnly={kakaoOnly} status={kakaoStatus} />}
        </section>

        {/* 이용 중인 요금제 */}
        <section className="card flex flex-col rounded-2xl p-4">
          <h2 className="text-[13px] font-semibold text-slate-500">이용 중인 요금제</h2>
          <p className="mt-1 text-[20px] font-bold">
            {quota.tier === "TRIAL" ? quota.label : `${quota.label} 요금제`}
            {quota.tier !== "TRIAL" && (
              <span className="ml-1.5 text-[14px] font-medium text-slate-500">{formatWon(PLANS[quota.tier].price)} / 1개월</span>
            )}
          </p>
          <p className={`text-[13px] ${state.kind === "EXPIRED" ? "font-semibold text-rose-600" : "text-slate-500"}`}>이용 기간 · {period}</p>
          {state.kind !== "EXPIRED" && (
            <div className="mt-4">
              <p className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-1.5 font-semibold">
                  <MessageCircle size={15} className="text-gold" /> 이번 달 카톡
                </span>
                <span className="text-slate-500">
                  <b className={`text-[18px] tabular-nums ${quota.remaining === 0 ? "text-rose-600" : "text-brand"}`}>{quota.remaining}</b> /{" "}
                  {quota.total}통 남음
                </span>
              </p>
              <div className="mt-1.5 h-2 rounded-full bg-brand-soft">
                <div className="h-full rounded-full bg-brand" style={{ width: `${(quota.remaining / quota.total) * 100}%` }} />
              </div>
              <p className="mt-1.5 text-[12px] text-slate-500">{quotaNote(quota, academy.serviceUntil)}</p>
            </div>
          )}
          <Link
            href="/billing"
            className="mt-auto flex items-center justify-center gap-1 rounded-xl bg-brand py-3 text-[14px] font-semibold text-white max-lg:mt-4"
          >
            요금제 바꾸기 <ChevronRight size={16} className="text-gold" />
          </Link>
        </section>
      </div>

      {/* 결제 내역 */}
      <section className="card mt-3 rounded-2xl">
        <h2 className="flex items-center gap-1.5 px-4 pt-3 pb-2 text-[13px] font-semibold text-slate-500">
          <Receipt size={15} /> 결제 내역
        </h2>
        {history.length === 0 ? (
          <p className="px-4 pb-4 text-[13px] text-slate-500">아직 결제한 내역이 없어요</p>
        ) : (
          <ul className="divide-y divide-black/5 border-t border-black/5">
            {history.map((o) => {
              const st = STATUS[o.status] ?? { label: o.status, tone: "bg-slate-100 text-slate-600" };
              return (
                <li key={o.id} className="flex items-center gap-3 px-4 py-2.5 text-[14px]">
                  <span className="w-[84px] shrink-0 text-slate-500 tabular-nums">{day(o.doneAt ?? o.createdAt)}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{KIND[o.kind] ?? o.kind}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{formatWon(o.amount)}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${st.tone}`}>{st.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Link href="/me/account" className="mt-6 mb-4 flex items-center justify-end gap-0.5 px-1 text-[13px] text-slate-500">
        계정 관리 <ChevronRight size={15} />
      </Link>
    </main>
  );
}
