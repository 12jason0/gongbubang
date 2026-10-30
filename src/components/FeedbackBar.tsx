"use client";

import { useState, useTransition } from "react";
import { sendFeedbacks } from "@/app/actions";

/** 화면 아래 "피드백 보내기" — 실수로 누르지 않게 두 번 확인 */
export function FeedbackBar({ date, pending }: { date: string; pending: number }) {
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  if (pending === 0 && !msg) return null;

  function send() {
    startTransition(async () => {
      const res = await sendFeedbacks(date);
      setConfirming(false);
      if (res.failed) setMsg(`${res.sent}명 보냄, ${res.failed}명 실패 (${res.error ?? ""}) — 다시 누르면 실패한 분만 재발송`);
      else setMsg(`${res.sent}명에게 피드백을 보냈어요${res.test ? " (테스트 모드)" : ""}`);
    });
  }

  return (
    <div className="fixed inset-x-0 bottom-[60px] z-10 mx-auto max-w-md px-3 pb-2">
      {msg && pending === 0 ? (
        <button
          onClick={() => setMsg(null)}
          className="w-full rounded-2xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-lg"
        >
          {msg}
        </button>
      ) : confirming ? (
        <div className="rounded-2xl bg-white p-3 shadow-lg ring-1 ring-slate-200">
          <p className="text-center text-sm">
            메모를 쓴 학생 <b>{pending}명</b>의 학부모님께 보낼까요?
          </p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => setConfirming(false)} className="flex-1 rounded-xl bg-slate-100 py-3 text-sm">
              취소
            </button>
            <button
              onClick={send}
              disabled={busy}
              className="flex-1 rounded-xl bg-brand py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "보내는 중…" : "보내기"}
            </button>
          </div>
        </div>
      ) : (
        <>
          {msg && <p className="mb-1 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{msg}</p>}
          <button
            onClick={() => setConfirming(true)}
            className="w-full rounded-2xl bg-brand py-3.5 text-sm font-semibold text-white shadow-lg"
          >
            피드백 보내기 ({pending}명)
          </button>
        </>
      )}
    </div>
  );
}
