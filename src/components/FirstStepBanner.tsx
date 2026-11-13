"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileSpreadsheet } from "lucide-react";

// 학생이 0명일 때 원장님 화면 맨 위 안내 (layout 에서 0명일 때만 그림). 학생 화면에선 이미 등록 칸이 열려 있어 안 보임
export function FirstStepBanner() {
  if (usePathname().startsWith("/students")) return null;
  return (
    <div className="px-3 pt-3 md:px-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-gold-soft px-3.5 py-3 text-[14px] text-[#6b5428] ring-1 ring-gold/40">
        <FileSpreadsheet size={18} className="shrink-0" />
        <span className="min-w-0 flex-1">
          <b>먼저 학생을 등록해 주세요.</b> 쓰고 계신 엑셀 명단을 그대로 올리면 한 번에 들어가요.
        </span>
        <Link
          href="/students?add=excel"
          data-track="first-step"
          className="ml-auto shrink-0 rounded-lg bg-brand px-3 py-1.5 text-[13px] font-semibold text-white"
        >
          학생 등록하기
        </Link>
      </div>
    </div>
  );
}
