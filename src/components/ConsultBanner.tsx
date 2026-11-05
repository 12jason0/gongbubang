import Link from "next/link";
import { ArrowRight, CalendarClock } from "lucide-react";

/** "새 상담 신청 N건 → 확인하기" — 새 신청이 있을 때만 (출석부·대시보드 맨 위) */
export function ConsultBanner({ n, className = "" }: { n: number; className?: string }) {
  if (!n) return null;
  return (
    <Link href="/consult" className={`flex items-center gap-3 rounded-2xl bg-gold-soft px-4 py-3 text-left text-[#8a6d35] ${className}`}>
      <CalendarClock size={20} className="shrink-0" />
      <span className="flex-1 text-[15px] font-bold">새 상담 신청 {n}건</span>
      <span className="flex items-center gap-0.5 text-[13px] font-semibold">
        확인하기 <ArrowRight size={14} aria-hidden />
      </span>
    </Link>
  );
}
