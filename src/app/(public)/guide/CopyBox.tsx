"use client";

import { useState } from "react";

/** 안내 글의 문구 예시 — 원장님이 [복사]를 눌러 바로 붙여 쓰게 */
export function CopyBox({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="mt-3 rounded-xl bg-slate-100 px-4 py-3 text-[14.5px] leading-relaxed">
      <p className="whitespace-pre-line">{text}</p>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }}
        className="mt-2 rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold text-brand"
      >
        {done ? "복사했어요" : "복사"}
      </button>
    </div>
  );
}
