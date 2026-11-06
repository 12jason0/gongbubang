"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { Gift } from "lucide-react";
import { kakaoSignup, unlinkKakao } from "@/app/actions";
import { PLANS } from "@/lib/pricing";

// 카카오 로그인 버튼 디자인 가이드: 노란 배경(#FEE500), 말풍선 심볼, 검정 85% 글자
function KakaoSymbol() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#000"
        d="M12 3C6.48 3 2 6.54 2 10.9c0 2.83 1.88 5.3 4.7 6.7l-.98 3.6c-.09.32.27.58.55.4l4.3-2.85c.47.05.95.08 1.43.08 5.52 0 10-3.54 10-7.93S17.52 3 12 3Z"
      />
    </svg>
  );
}

const yellow = "flex w-full items-center justify-center gap-2 rounded-xl bg-[#FEE500] py-4 text-base font-semibold text-black/85 active:brightness-95 disabled:opacity-60";

/** 로그인 화면 [카카오로 시작하기] — 넓은 화면이면 로그인 뒤 대시보드로 (아이디 로그인과 같게) */
export function KakaoStartButton() {
  const [going, setGoing] = useState(false);
  return (
    <button
      type="button"
      disabled={going}
      onClick={() => {
        setGoing(true);
        const pc = window.matchMedia("(min-width: 48rem)").matches ? "1" : "0";
        // 카카오 로그인 화면(다른 사이트)으로 넘어가는 API 경로라 전체 페이지 이동이 맞음 (router.push 는 화면 이동용)
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = `/api/auth/kakao/start?pc=${pc}`;
      }}
      className={yellow}
    >
      <KakaoSymbol />
      {going ? "카카오로 가는 중…" : "카카오로 시작하기"}
    </button>
  );
}

/** 카카오 로그인 뒤 처음 온 원장님: 공부방 이름만 받고 바로 가입 */
export function KakaoSignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => setError(await kakaoSignup(null, fd)));
  }

  return (
    <>
      <Image src="/icons/icon-192.png" alt="공부방노트" width={56} height={56} className="rounded-2xl" />
      <h1 className="mt-5 text-[26px] font-bold tracking-tight">공부방 이름만 알려 주세요</h1>
      <p className="mt-1 text-[15px] text-slate-500">카카오로 확인됐어요. 이름을 넣으면 바로 시작해요.</p>
      <p className="mt-4 flex items-start gap-2 rounded-xl bg-gold-soft px-3.5 py-3 text-[14px] leading-relaxed text-[#6b5428]">
        <Gift size={18} className="mt-0.5 shrink-0" />
        <span>
          처음이면 <b>2주 동안 무료</b>로 모든 기능을 쓸 수 있어요. 무료 기간에는 카톡·문자 <b>{PLANS.TRIAL.quota}통</b>까지.
        </span>
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-2.5">
        <input
          name="name"
          placeholder="공부방 이름 (학부모님 카톡에 보이는 이름)"
          maxLength={20}
          autoFocus
          className="field w-full rounded-xl border-0 px-4 py-3.5 text-base outline-none focus:ring-2 focus:ring-gold"
        />
        <label className="flex cursor-pointer items-start gap-2.5 px-1 pt-1 text-[14px] text-slate-600">
          <input type="checkbox" name="agree" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-brand" />
          <span>
            <Link href="/terms" target="_blank" className="underline">
              이용약관·환불 규정
            </Link>
            과{" "}
            <Link href="/privacy" target="_blank" className="underline">
              개인정보 처리방침
            </Link>
            에 동의해요
          </span>
        </label>
        {error && <p className="px-1 text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={pending || !agree} className="!mt-4 w-full rounded-xl bg-brand py-4 text-base font-semibold text-white disabled:opacity-40">
          {pending ? "만드는 중…" : "시작하기"}
        </button>
      </form>
    </>
  );
}

const KAKAO_MSG: Record<string, { ok: boolean; text: string }> = {
  linked: { ok: true, text: "카카오가 연결됐어요. 다음부터 [카카오로 시작하기]로 로그인할 수 있어요." },
  taken: { ok: false, text: "이 카카오는 다른 공부방에 연결돼 있어요." },
  already: { ok: false, text: "이미 다른 카카오가 연결돼 있어요. 먼저 연결을 끊어 주세요." },
  fail: { ok: false, text: "카카오 연결에 실패했어요. 잠시 뒤 다시 해 주세요." },
  cancel: { ok: false, text: "카카오 연결을 취소했어요." },
};

/** 마이페이지 계정 칸: 카카오 연결 / 연결됨 + 끊기 */
export function KakaoLinkRow({ linked, kakaoOnly, status }: { linked: boolean; kakaoOnly: boolean; status?: string }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(status ? KAKAO_MSG[status] ?? null : null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-[#FEE500]">
          <KakaoSymbol />
        </span>
        <span className="text-[14.5px] font-medium">카카오 로그인</span>
        {linked ? (
          <span className="ml-auto flex items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[12px] font-semibold text-emerald-700">연결됨</span>
            {!kakaoOnly && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await unlinkKakao();
                    setMsg(r && { ok: r.ok, text: r.message });
                  })
                }
                className="text-[13px] text-slate-500 underline"
              >
                끊기
              </button>
            )}
          </span>
        ) : (
          <a href="/api/auth/kakao/start?mode=link" className="ml-auto rounded-lg bg-[#FEE500] px-3 py-1.5 text-[13px] font-semibold text-black/85">
            카카오 연결하기
          </a>
        )}
      </div>
      {msg && <p className={`text-[13px] ${msg.ok ? "text-emerald-700" : "text-rose-600"}`}>{msg.text}</p>}
    </div>
  );
}
