"use client";

import { useState, useTransition, type FormEvent } from "react";
import { login } from "../actions";

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
      <h1 className="text-2xl font-bold text-brand">출석부</h1>
      <p className="mt-1 text-sm text-slate-500">출석 체크하면 학부모님께 문자가 가요</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-3">
        <input
          name="loginId"
          autoComplete="username"
          placeholder="아이디"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-base outline-none focus:border-brand"
        />
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="비밀번호"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-base outline-none focus:border-brand"
        />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button
          disabled={pending}
          className="w-full rounded-xl bg-brand py-3.5 text-base font-semibold text-white disabled:opacity-60"
        >
          {pending ? "확인 중…" : "로그인"}
        </button>
      </form>
    </main>
  );
}
