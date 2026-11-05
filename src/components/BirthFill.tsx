"use client";

import { useState, useTransition } from "react";
import { setStudentBirthDate } from "@/app/actions";
import { todayKST } from "@/lib/date";

/** 영수증 원부 화면에서만: 생년월일이 빈 칸에 [생년월일 넣기] (인쇄 안 됨) */
export function BirthFill({ studentId }: { studentId: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-[10.5px] font-semibold text-[#8a6d35] underline print:hidden">
        생년월일 넣기
      </button>
    );
  }
  return (
    <span className="flex flex-col gap-0.5 print:hidden">
      <input
        type="date"
        value={value}
        max={todayKST()}
        min="1900-01-01"
        onChange={(e) => setValue(e.target.value)}
        className="w-full rounded border border-black/20 bg-white px-0.5 text-[10.5px]"
        aria-label="생년월일"
      />
      <span className="flex justify-center gap-1">
        <button type="button" onClick={() => setOpen(false)} className="text-[10.5px] text-slate-500">
          취소
        </button>
        <button
          type="button"
          disabled={pending || !value}
          onClick={() =>
            start(async () => {
              const r = await setStudentBirthDate(studentId, value);
              if (!r?.ok) setError(r?.message ?? "다시 해 주세요.");
            })
          }
          className="text-[10.5px] font-semibold text-brand disabled:opacity-50"
        >
          {pending ? "…" : "저장"}
        </button>
      </span>
      {error && <span className="text-[10px] text-rose-600">{error}</span>}
    </span>
  );
}
