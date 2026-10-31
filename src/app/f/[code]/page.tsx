import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq, isNotNull } from "drizzle-orm";
import { NotebookPen } from "lucide-react";
import { db, academies, notes, students } from "@/db";
import { readFeedbackCode } from "@/lib/alimtalk";
import { formatDateLabel } from "@/lib/date";
import { DEFAULT_FEEDBACK_TITLE } from "@/lib/templates";

export const metadata: Metadata = { title: "수업 피드백", robots: { index: false, follow: false } };

/**
 * 학부모님이 알림톡 링크로 여는 수업 피드백 — 로그인 없이 열림.
 * 주소의 서명이 맞고, 원장님이 실제로 보낸(sentAt 이 있는) 메모만 보여준다.
 */
export default async function FeedbackPage({ params }: { params: Promise<{ code: string }> }) {
  const noteId = readFeedbackCode(decodeURIComponent((await params).code));
  if (!noteId) notFound();

  const [row] = await db
    .select({
      content: notes.content,
      date: notes.date,
      studentName: students.name,
      academyName: academies.name,
      title: academies.feedbackTitle,
      closing: academies.feedbackClosing,
    })
    .from(notes)
    .innerJoin(students, eq(students.id, notes.studentId))
    .innerJoin(academies, eq(academies.id, notes.academyId))
    .where(and(eq(notes.id, noteId), isNotNull(notes.sentAt)));
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
            <NotebookPen size={19} />
          </span>
          <div>
            <h1 className="text-[19px] leading-snug font-bold tracking-tight">
              {row.studentName} 학생 {row.title.trim() || DEFAULT_FEEDBACK_TITLE}
            </h1>
            <p className="mt-0.5 text-[13px] text-slate-500">{formatDateLabel(row.date)} 수업</p>
          </div>
        </div>

        <p className="mt-5 text-[16px] leading-relaxed whitespace-pre-wrap text-[#1c2230]">{row.content}</p>

        {row.closing.trim() && (
          <p className="mt-5 border-t border-black/5 pt-4 text-[15px] leading-relaxed text-slate-600">{row.closing}</p>
        )}
      </article>

      <p className="mt-4 text-center text-[12px] text-slate-400">이 화면은 학부모님께만 보내드린 주소로 열려요</p>
    </main>
  );
}
