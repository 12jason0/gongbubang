"use client";

import { useId, type CSSProperties } from "react";
import { Info } from "lucide-react";

/** 카드·창 제목 옆 작은 ⓘ — 누르면 그 기능만 짧게 설명하는 말풍선. 바깥을 누르거나 Esc 로 닫힘 (브라우저 popover) */
export function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  const id = `tip${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        aria-label={`${label} 설명 보기`}
        title={`${label} 설명`}
        style={{ anchorName: `--${id}` } as CSSProperties}
        className="inline-grid size-7 shrink-0 place-items-center rounded-full align-middle font-normal text-slate-400 transition hover:bg-white/70 hover:text-brand"
      >
        <Info size={15} aria-hidden />
      </button>
      {/* 제목(<p>·<h1>) 안에도 넣을 수 있게 span 만 씀. 열렸을 때 보이는 건 브라우저 popover 가 처리 */}
      <span
        id={id}
        popover="auto"
        style={{ positionAnchor: `--${id}` } as CSSProperties}
        className="tip p-3.5 text-left text-[13.5px] leading-relaxed font-normal break-keep"
      >
        <span className="mb-1 block text-[14px] font-bold text-brand">{label}</span>
        {children}
      </span>
    </>
  );
}

/** 말풍선 안 "예시" 한 줄 */
export function TipExample({ children }: { children: React.ReactNode }) {
  return <span className="mt-2 block rounded-xl bg-brand-soft/70 px-2.5 py-1.5 text-[12.5px] text-slate-600">예) {children}</span>;
}
