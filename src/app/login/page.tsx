"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { login } from "../actions";

const input =
  "w-full rounded-xl border-0 bg-white px-4 py-3.5 text-base ring-1 ring-black/10 outline-none focus:ring-2 focus:ring-gold";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // 비밀번호가 틀려도 아이디 칸은 지워지지 않게 직접 제출
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      setError(await login(null, fd));
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-gold">
        <ClipboardCheck size={28} />
      </span>
      <h1 className="mt-5 text-[28px] font-bold tracking-tight">출석부</h1>
      <p className="mt-1 text-[15px] text-slate-500">출석만 누르면 학부모님께 카톡이 가요</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-2.5">
        <input name="loginId" autoComplete="username" placeholder="아이디" className={input} />
        <input name="password" type="password" autoComplete="current-password" placeholder="비밀번호" className={input} />
        {error && <p className="px-1 text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="!mt-4 w-full rounded-xl bg-brand py-4 text-base font-semibold text-white disabled:opacity-60"
        >
          {pending ? "확인 중…" : "로그인"}
        </button>
      </form>

      <p className="mt-6 text-center text-[14px] text-slate-500">
        처음이세요?{" "}
        <Link href="/signup" className="font-semibold text-brand underline">
          2주 무료로 시작하기
        </Link>
      </p>
    </main>
  );
}
