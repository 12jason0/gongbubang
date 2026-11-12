"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "인쇄하기" }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      data-track="print"
      className="flex h-11 items-center gap-1.5 rounded-xl bg-brand px-4 text-[14px] font-semibold text-white"
    >
      <Printer size={17} className="text-gold" /> {label}
    </button>
  );
}
