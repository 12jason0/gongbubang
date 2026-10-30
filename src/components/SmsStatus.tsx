"use client";

import { useTransition } from "react";
import { FlaskConical, RotateCw, TriangleAlert, Wallet } from "lucide-react";
import { resendFailedMessages } from "@/app/actions";
import { formatWon } from "@/lib/money";
import { useToast } from "./Toast";

/**
 * 출석부 맨 위 문자 상태 — 문자가 끊기지 않게 미리 알림
 * - 테스트 모드: "테스트 모드" 표시만
 * - 잔액이 얼마 안 남음: 경고 + 충전 링크
 * - 보내지 못한 문자: N건 · 다시 보내기
 */
export function SmsStatus({ testMode, balance, low, failed }: { testMode: boolean; balance: number | null; low: boolean; failed: number }) {
  const [pending, start] = useTransition();
  const toast = useToast();

  function resend() {
    start(async () => {
      const r = await resendFailedMessages();
      if (r.failed > 0) {
        toast({ text: `${r.sent}건 보냄, ${r.failed}건 또 실패했어요`, sub: "잔액·번호를 확인하고 잠시 뒤 다시 눌러 주세요", tone: "err" });
      } else {
        toast({
          text: r.sent ? `보내지 못한 문자 ${r.sent}건을 보냈어요` : "다시 보낼 문자가 없어요",
          sub: r.skipped ? `${r.skipped}건은 이미 나갔거나 보낼 필요가 없어서 건너뛰었어요` : undefined,
        });
      }
    });
  }

  if (!testMode && !low && failed === 0) return null;

  return (
    <div className="mb-2 space-y-2">
      {testMode && (
        <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2 text-[13px] text-amber-800 ring-1 ring-amber-200/70">
          <FlaskConical size={16} className="shrink-0" /> 테스트 모드 · 문자는 실제로 나가지 않고 기록만 남아요
        </p>
      )}

      {!testMode && low && balance !== null && (
        <a
          href="https://console.solapi.com"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[14px] text-amber-900 ring-1 ring-amber-300"
        >
          <Wallet size={18} className="shrink-0 text-amber-600" />
          <span className="flex-1">
            <b>문자 잔액이 얼마 안 남았어요</b> · 남은 금액 {formatWon(balance)}
          </span>
          <span className="shrink-0 rounded-lg bg-amber-500 px-2.5 py-1.5 text-[12px] font-semibold text-white">충전하기</span>
        </a>
      )}

      {failed > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 py-2 pr-2 pl-3.5 text-[14px] text-rose-800 ring-1 ring-rose-200">
          <TriangleAlert size={18} className="shrink-0 text-rose-500" />
          <span className="flex-1">
            보내지 못한 문자 <b>{failed}건</b>
          </span>
          <button
            onClick={resend}
            disabled={pending}
            className="flex h-10 shrink-0 items-center gap-1 rounded-lg bg-rose-500 px-3 text-[13px] font-semibold text-white disabled:opacity-60"
          >
            <RotateCw size={14} className={pending ? "animate-spin" : ""} /> {pending ? "보내는 중…" : "다시 보내기"}
          </button>
        </div>
      )}
    </div>
  );
}
