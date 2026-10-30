import { and, desc, eq } from "drizzle-orm";
import { Inbox } from "lucide-react";
import { db, notices, students, classes, classStudents } from "@/db";
import { requireAcademy } from "@/lib/session";
import { byTimeName } from "@/lib/templates";
import { NoticeForm } from "@/components/NoticeForm";
import { PageTitle } from "@/components/PageTitle";

export default async function NoticePage() {
  const academy = await requireAcademy();

  const [studentRows, classRows, memberRows, history] = await Promise.all([
    db
      .select({ id: students.id, phone: students.parentPhone })
      .from(students)
      .where(and(eq(students.academyId, academy.id), eq(students.active, true))),
    db
      .select()
      .from(classes)
      .where(and(eq(classes.academyId, academy.id), eq(classes.active, true))),
    db
      .select({ classId: classStudents.classId, studentId: classStudents.studentId })
      .from(classStudents)
      .innerJoin(classes, eq(classes.id, classStudents.classId))
      .where(eq(classes.academyId, academy.id)),
    db.select().from(notices).where(eq(notices.academyId, academy.id)).orderBy(desc(notices.sentAt)).limit(20),
  ]);

  // 반별 실제로 받는 학부모 수 (형제는 한 번만, 그만둔 학생 제외)
  const phoneOf = new Map(studentRows.map((s) => [s.id, s.phone]));
  const targets = [
    { id: "all", name: "전체", count: new Set(studentRows.map((s) => s.phone)).size },
    ...classRows.sort(byTimeName).map((c) => ({
      id: c.id,
      name: c.name,
      count: new Set(
        memberRows.filter((m) => m.classId === c.id && phoneOf.has(m.studentId)).map((m) => phoneOf.get(m.studentId)),
      ).size,
    })),
  ];

  const fmt = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <main className="px-3 pt-4">
      <PageTitle title="단체 공지" sub="휴원·시험 일정처럼 여러 학부모님께 한 번에" />

      {/* PC: 왼쪽 쓰기, 오른쪽 보낸 공지 */}
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-5">
      <div className="lg:sticky lg:top-4">
        <NoticeForm academyName={academy.name} targets={targets} />
      </div>

      <section>
      <h2 className="mt-6 px-1 text-[13px] font-semibold text-slate-500 lg:mt-0 lg:pb-0.5">보낸 공지</h2>
      {history.length === 0 ? (
        <div className="mt-2 flex flex-col items-center rounded-2xl bg-white py-10 text-center ring-1 ring-black/5">
          <Inbox className="text-slate-300" size={28} />
          <p className="mt-2 text-sm text-slate-400">보낸 공지가 여기에 쌓여요</p>
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-black/5 rounded-2xl bg-white ring-1 ring-black/5">
          {history.map((n) => (
            <li key={n.id} className="px-4 py-3">
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="rounded-md bg-brand-soft px-1.5 py-0.5 font-semibold text-brand">{n.target}</span>
                <span>{fmt.format(n.sentAt)}</span>
                <span>· {n.recipientCount}명</span>
                {n.failedCount > 0 && <span className="text-rose-500">· 실패 {n.failedCount}</span>}
              </div>
              <p className="mt-1.5 line-clamp-3 text-sm whitespace-pre-wrap text-slate-700">{n.content}</p>
            </li>
          ))}
        </ul>
      )}
      </section>
      </div>
    </main>
  );
}
