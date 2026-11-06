"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { login } from "@/app/actions";
import { KakaoStartButton } from "@/components/KakaoLogin";

const input =
  "w-full rounded-xl border-0 px-4 py-3.5 text-base outline-none focus:ring-2 focus:ring-gold field";
// 카카오 버튼이 있을 때 아이디 로그인은 아래에 작게
const smallInput =
  "w-full rounded-xl border-0 px-3.5 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-gold field";

export function LoginForm({ kakao, notice }: { kakao: boolean; notice: string | null }) {
  const [error, setError] = useState<string | null>(notice);
  const [pending, startTransition] = useTransition();

  // 비밀번호가 틀려도 아이디 칸은 지워지지 않게 직접 제출
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (window.matchMedia("(min-width: 48rem)").matches) fd.set("pc", "1");
    startTransition(async () => {
      setError(await login(null, fd));
    });
  }

  const idForm = (
    <form onSubmit={onSubmit} className={kakao ? "space-y-2" : "mt-8 space-y-2.5"}>
      <input name="loginId" autoComplete="username" placeholder="아이디" className={kakao ? smallInput : input} />
      <input name="password" type="password" autoComplete="current-password" placeholder="비밀번호" className={kakao ? smallInput : input} />
      {error && <p className="px-1 text-sm text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className={
          kakao
            ? "!mt-3 w-full rounded-xl bg-white/70 py-2.5 text-[15px] font-semibold text-brand ring-1 ring-brand/20 disabled:opacity-60"
            : "!mt-4 w-full rounded-xl bg-brand py-4 text-base font-semibold text-white disabled:opacity-60"
        }
      >
        {pending ? "확인 중…" : kakao ? "아이디로 로그인" : "로그인"}
      </button>
    </form>
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <div className="glass rounded-[28px] px-5 py-7 sm:px-7">
      <Image src="/icons/icon-192.png" alt="공부방노트" width={56} height={56} preload className="rounded-2xl" />
      <h1 className="mt-5 text-[28px] font-bold tracking-tight">공부방노트</h1>
      <p className="mt-1 text-[15px] text-slate-500">출석, 학부모 공지, 원비 장부를 한 곳에서</p>

      {kakao ? (
        <>
          <div className="mt-8">
            <KakaoStartButton />
            <p className="mt-2 text-center text-[13px] text-slate-500">처음이면 공부방 이름만 넣고 바로 2주 무료로 시작해요</p>
          </div>
          <div className="my-6 flex items-center gap-3 text-[12.5px] text-slate-400">
            <span className="h-px flex-1 bg-black/10" />
            아이디로 로그인
            <span className="h-px flex-1 bg-black/10" />
          </div>
          {idForm}
        </>
      ) : (
        idForm
      )}

      <p className="mt-6 text-center text-[14px] text-slate-500">
        {kakao ? "아이디로 가입하려면 " : "처음이세요? "}
        <Link href="/signup" className="font-semibold text-brand underline">
          {kakao ? "아이디로 가입하기" : "2주 무료로 시작하기"}
        </Link>
      </p>
      </div>
    </main>
  );
}
