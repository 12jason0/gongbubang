"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { Gift } from "lucide-react";
import { signup } from "@/app/actions";
import { PLANS } from "@/lib/pricing";
import { PHONE_VERIFY } from "@/lib/phone-verify";

const input =
  "w-full rounded-xl border-0 px-4 py-3.5 text-base outline-none focus:ring-2 focus:ring-gold field";

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => setError(await signup(null, fd)));
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <div className="glass rounded-[28px] px-5 py-7 sm:px-7">
      <Image src="/icons/icon-192.png" alt="공부방노트" width={56} height={56} preload className="rounded-2xl" />
      <h1 className="mt-5 text-[26px] font-bold tracking-tight">공부방노트 시작하기</h1>
      <p className="mt-2 flex items-start gap-2 rounded-xl bg-gold-soft px-3.5 py-3 text-[14px] leading-relaxed text-[#6b5428]">
        <Gift size={18} className="mt-0.5 shrink-0" />
        <span>
          가입하면 <b>2주 동안 무료</b>로 모든 기능을 쓸 수 있어요.
          <br />
          무료 기간에는 학부모님께 카톡·문자를 <b>{PLANS.TRIAL.quota}통</b>까지 보낼 수 있어요.
        </span>
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-2.5">
        <input name="name" placeholder="공부방 이름 (학부모님 카톡에 보이는 이름)" maxLength={20} className={input} />
        <input name="loginId" autoComplete="username" placeholder="아이디 (영문 소문자·숫자 4~20자)" className={input} />
        <input name="password" type="password" autoComplete="new-password" placeholder="비밀번호 (8자 이상)" className={input} />
        <input name="ownerPhone" inputMode="tel" placeholder="원장님 휴대폰 번호 (연락용)" className={input} />
        {/* 문자 인증 (lib/phone-verify.ts) — 지금은 꺼 둠. 켤 때 "인증번호 받기" 버튼을 옆에 붙인다 */}
        {PHONE_VERIFY && <input name="phoneCode" inputMode="numeric" autoComplete="one-time-code" placeholder="인증번호 6자리" className={input} />}

        <label className="flex cursor-pointer items-start gap-2.5 px-1 pt-1 text-[14px] text-slate-600">
          <input
            type="checkbox"
            name="agree"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
          />
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
        <button
          type="submit"
          disabled={pending || !agree}
          className="!mt-4 w-full rounded-xl bg-brand py-4 text-base font-semibold text-white disabled:opacity-40"
        >
          {pending ? "만드는 중…" : "2주 무료로 시작하기"}
        </button>
      </form>

      <p className="mt-6 text-center text-[14px] text-slate-500">
        이미 계정이 있으세요?{" "}
        <Link href="/login" className="font-semibold text-brand underline">
          로그인
        </Link>
      </p>
      </div>
    </main>
  );
}
