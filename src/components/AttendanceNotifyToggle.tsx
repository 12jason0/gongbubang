"use client";

import { useOptimistic, useTransition } from "react";
import { BellRing } from "lucide-react";
import { setAttendanceNotify } from "@/app/actions";
import { InfoTip, TipExample } from "./InfoTip";


/** 설정: "출석 체크하면 학부모님께 카톡 보내기" 켜기/끄기 — 누르면 바로 저장 */
export function AttendanceNotifyToggle({ on }: { on: boolean }) {
  const [shown, setShown] = useOptimistic(on);
  const [pending, start] = useTransition();

  function toggle() {
    start(async () => {
      setShown(!shown);
      await setAttendanceNotify(!shown);
    });
  }

  return (
    <div className="card mb-3 flex items-center gap-3 rounded-2xl p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
        <BellRing size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-0.5 text-[15px] font-semibold">
          출석 체크하면 학부모님께 카톡 보내기
          <InfoTip label="등원 카톡 켜기·끄기">
            켜 두면 출석부에서 [출석]을 누를 때마다 학부모님께 등원 카톡이 가요. 학생 1명에 1통씩 쓰여요. 끄면 출석 기록만 남고 카톡은 가지 않아요.
            <TipExample>켜짐 + 김민수 [출석] → 학부모님께 등원 카톡 1통</TipExample>
          </InfoTip>
        </span>
        <span className="block text-[13px] text-slate-500">
          {shown ? "출석을 누르면 등원 카톡이 가요 (1통씩 쓰여요)" : "꺼져 있어요 · 출석은 기록만 남아요"}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={shown}
        aria-label="출석 체크하면 학부모님께 카톡 보내기"
        onClick={toggle}
        disabled={pending}
        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${shown ? "bg-brand" : "bg-slate-300"}`}
      >
        <span className={`absolute top-1 left-1 size-6 rounded-full bg-white shadow transition-transform ${shown ? "translate-x-6" : ""}`} />
      </button>
    </div>
  );
}
