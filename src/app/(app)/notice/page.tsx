import { and, desc, eq } from "drizzle-orm";
import { db, notices, students } from "@/db";
import { requireAcademy } from "@/lib/session";
import { GROUPS } from "@/lib/templates";
import { NoticeForm } from "@/components/NoticeForm";

export default async function NoticePage() {
  const academy = await requireAcademy();

  const [studentRows, history] = await Promise.all([
    db
      .select({ group: students.group, phone: students.parentPhone })
      .from(students)
      .where(and(eq(students.academyId, academy.id), eq(students.active, true))),
    db.select().from(notices).where(eq(notices.academyId, academy.id)).orderBy(desc(notices.sentAt)).limit(20),
  ]);

  // 반별 실제로 받는 학부모 수 (형제는 한 번만)
  const counts: Record<string, number> = { 전체: new Set(studentRows.map((s) => s.phone)).size };
  for (const g of GROUPS) {
    counts[g] = new Set(studentRows.filter((s) => s.group === g).map((s) => s.phone)).size;
  }

  const fmt = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <main className="px-3 py-4">
      <h1 className="px-1 text-lg font-bold">단체 공지</h1>
      <p className="px-1 text-xs text-slate-400">휴원, 시험 일정처럼 여러 학부모님께 한 번에 보낼 때</p>

      <NoticeForm academyName={academy.name} counts={counts} />

      <h2 className="mt-6 px-1 text-sm font-semibold text-slate-500">보낸 공지</h2>
      {history.length === 0 ? (
        <p className="px-1 py-6 text-sm text-slate-400">아직 보낸 공지가 없어요.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {history.map((n) => (
            <li key={n.id} className="rounded-2xl bg-white p-3">
              <p className="text-xs text-slate-400">
                {fmt.format(n.sentAt)} · {n.target} · {n.recipientCount}명
                {n.failedCount > 0 && <span className="text-rose-500"> · 실패 {n.failedCount}</span>}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{n.content}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
