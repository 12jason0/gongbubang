"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { answerConsent } from "@/app/actions";

/** 학부모 동의 화면의 두 버튼. 이미 답했으면 결과와 "바꾸기" */
export function ConsentAnswer({ code, state, at }: { code: string; state: "PENDING" | "AGREED" | "DECLINED"; at: string | null }) {
  const [busy, start] = useTransition();
  const router = useRouter();
  const answer = (agree: boolean) =>
    start(async () => {
      await answerConsent(code, agree);
      router.refresh();
    });
  const when = at ? new Date(at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

  if (state !== "PENDING") {
    const yes = state === "AGREED";
    return (
      <div className={`mt-6 rounded-xl p-4 text-center ${yes ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
        <p className="flex items-center justify-center gap-1.5 text-[16px] font-bold">
          {yes ? <CheckCircle2 size={19} /> : <XCircle size={19} />}
          {yes ? "동의하셨어요. 감사합니다" : "동의하지 않으셨어요"}
        </p>
        {when && <p className="mt-0.5 text-[12px] opacity-80">{when}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={() => answer(!yes)}
          className="mt-3 text-[13px] font-semibold underline disabled:opacity-50"
        >
          {yes ? "동의를 거두기 (카톡 안내 그만 받기)" : "다시 동의하기"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 flex gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => answer(false)}
        className="surface flex-1 rounded-xl py-3.5 text-[15px] font-semibold text-slate-600 disabled:opacity-50"
      >
        동의하지 않아요
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => answer(true)}
        className="flex-[1.4] rounded-xl bg-brand py-3.5 text-[15px] font-semibold text-white disabled:opacity-50"
      >
        {busy ? "저장 중…" : "동의합니다"}
      </button>
    </div>
  );
}
