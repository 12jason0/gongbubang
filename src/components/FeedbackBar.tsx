"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Send } from "lucide-react";
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
    <div className="fixed inset-x-0 bottom-[60px] z-10 mx-auto max-w-md px-3 pb-2 md:bottom-4 md:left-56">
      {msg && pending === 0 ? (
        <button
          onClick={() => setMsg(null)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-sm font-semibold text-white shadow-lg"
        >
          <CheckCircle2 size={18} /> {msg}
        </button>
      ) : confirming ? (
        <div className="rounded-2xl bg-white p-3 shadow-xl ring-1 ring-black/10">
          <p className="text-center text-sm">
            메모를 쓴 학생 <b>{pending}명</b>의 학부모님께 보낼까요?
          </p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => setConfirming(false)} className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-medium">
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
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-brand/20"
          >
            <Send size={17} className="text-gold" />
            피드백 보내기
            <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-brand">{pending}명</span>
          </button>
        </>
      )}
    </div>
  );
}
