import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq, gte, inArray, isNull } from "drizzle-orm";
import { CalendarClock } from "lucide-react";
import { db, academies, consultations } from "@/db";
import { readConsultCode } from "@/lib/alimtalk";
import { ACTIVE_STATUS, freeDays, parseHours } from "@/lib/consult";
import { isActive } from "@/lib/plan";
import { timeKST, todayKST } from "@/lib/date";
import { ConsultBooking } from "@/components/ConsultBooking";

export const metadata: Metadata = { title: "상담 신청", robots: { index: false, follow: false } };

/**
 * 학부모님 상담 신청 — 원장님이 문자로 보낸 링크로 로그인 없이. 주소의 서명이 맞아야 열림.
 * 공부방 이름 + 2주 안의 빈 시간만 (찬 시간·지난 시간은 아예 안 보임). 저장할 때 서버가 한 번 더 확인
 */
export default async function ConsultRequestPage({ params }: { params: Promise<{ code: string }> }) {
  const code = decodeURIComponent((await params).code);
  const academyId = readConsultCode(code);
  if (!academyId) notFound();

  const [academy] = await db.select().from(academies).where(and(eq(academies.id, academyId), isNull(academies.deletedAt)));
  if (!academy) notFound();

  const today = todayKST();
  const booked = await db
    .select({ date: consultations.date, start: consultations.start, end: consultations.end })
    .from(consultations)
    .where(and(eq(consultations.academyId, academy.id), gte(consultations.date, today), inArray(consultations.status, ACTIVE_STATUS)));
  const open = isActive(academy);
  const days = open ? freeDays(parseHours(academy.consultHours), academy.consultMinutes, booked, today, timeKST()) : [];

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-slate-500">
        <span className="h-4 w-1 rounded-full bg-gold" />
        {academy.name}
      </p>
      <div className="mt-3 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-gold">
          <CalendarClock size={19} />
        </span>
        <div>
          <h1 className="text-[20px] leading-snug font-bold tracking-tight text-[#1c2230]">상담 신청</h1>
          <p className="mt-0.5 text-[13.5px] text-slate-500">편한 날짜와 시간을 골라 주세요 · 상담 {academy.consultMinutes}분</p>
        </div>
      </div>

      {days.length === 0 ? (
        <p className="card mt-5 rounded-2xl p-5 text-center text-[15px] leading-relaxed text-slate-600">
          지금은 고를 수 있는 시간이 없어요.
          <br />
          공부방에 직접 연락해 주세요.
        </p>
      ) : (
        <ConsultBooking code={code} days={days} privacyHref={`/privacy?a=${academy.id}#consult`} />
      )}
    </main>
  );
}
