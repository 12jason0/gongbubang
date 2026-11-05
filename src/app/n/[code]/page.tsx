import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Megaphone } from "lucide-react";
import { db, academies, notices } from "@/db";
import { readNoticeCode } from "@/lib/alimtalk";
import { formatDateLabel, timeKST, todayKST } from "@/lib/date";

export const metadata: Metadata = { title: "공지", robots: { index: false, follow: false } };

/**
 * 학부모님이 카톡·문자 링크로 여는 단체 공지 — 로그인 없이 열림.
 * 주소의 서명이 맞아야만 보여준다 (/f/ 피드백과 같은 방식).
 */
export default async function NoticeLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const noticeId = readNoticeCode(decodeURIComponent((await params).code));
  if (!noticeId) notFound();

  const [row] = await db
    .select({ content: notices.content, sentAt: notices.sentAt, academyName: academies.name })
    .from(notices)
    .innerJoin(academies, eq(academies.id, notices.academyId))
    .where(eq(notices.id, noticeId));
  if (!row) notFound();

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-slate-500">
        <span className="h-4 w-1 rounded-full bg-gold" />
        {row.academyName}
      </p>

      <article className="mt-3 rounded-2xl bg-white p-5 ring-1 ring-black/5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-gold">
            <Megaphone size={19} />
          </span>
          <div>
            <h1 className="text-[19px] leading-snug font-bold tracking-tight">공지</h1>
            <p className="mt-0.5 text-[13px] text-slate-500">
              {formatDateLabel(todayKST(row.sentAt))} {timeKST(row.sentAt)}
            </p>
          </div>
        </div>

        <p className="mt-5 text-[16px] leading-relaxed whitespace-pre-wrap text-[#1c2230]">{row.content}</p>
      </article>

      <p className="mt-4 text-center text-[12px] text-slate-400">이 화면은 학부모님께만 보내드린 주소로 열려요</p>
    </main>
  );
}
