import { and, desc, eq } from "drizzle-orm";
import { Inbox } from "lucide-react";
import { db, notices, students, classes, classStudents } from "@/db";
import { currentAcademyId, requireAcademy } from "@/lib/session";
import { byGradeName, byTimeName } from "@/lib/templates";
import { ALIMTALK_TEMPLATES, appUrl } from "@/lib/alimtalk";
import { usesAlimtalk } from "@/lib/sms";
import { quotaState } from "@/lib/plan";
import { NoticeForm } from "@/components/NoticeForm";
import { PageTitle } from "@/components/PageTitle";

export default async function NoticePage() {
  const academyId = await currentAcademyId(); // 쿠키만 확인 — 아래 쿼리를 공부방 조회와 동시에

  const [academy, studentRows, classRows, memberRows, history] = await Promise.all([
    requireAcademy(),
    db
      .select({ id: students.id, name: students.name, grade: students.grade, phone: students.parentPhone, consent: students.consent })
      .from(students)
      .where(and(eq(students.academyId, academyId), eq(students.active, true))),
    db
      .select()
      .from(classes)
      .where(and(eq(classes.academyId, academyId), eq(classes.active, true))),
    db
      .select({ classId: classStudents.classId, studentId: classStudents.studentId })
      .from(classStudents)
      .innerJoin(classes, eq(classes.id, classStudents.classId))
      .where(eq(classes.academyId, academyId)),
    db.select().from(notices).where(eq(notices.academyId, academyId)).orderBy(desc(notices.sentAt)).limit(20),
  ]);

  classRows.sort(byTimeName);
  // 받을 사람은 학부모 동의한 학생만 (보낼 때 서버도 다시 거름)
  const waiting = studentRows.filter((st) => st.consent !== "AGREED").length;
  const roster = studentRows
    .filter((st) => st.consent === "AGREED")
    .sort(byGradeName)
    .map((st) => ({
      id: st.id,
      name: st.name,
      grade: st.grade,
      phone: st.phone,
      classIds: memberRows.filter((m) => m.studentId === st.id).map((m) => m.classId),
    }));

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
      <PageTitle title="단체 공지" sub="학부모님 카톡으로 공지 내용이 바로 가요 · 할인·모집·이벤트 같은 광고는 보낼 수 없어요" />

      {/* PC: 왼쪽 쓰기, 오른쪽 보낸 공지 */}
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-5">
      <div className="lg:sticky lg:top-4">
        <NoticeForm
          academyName={academy.name}
          students={roster}
          waiting={waiting}
          classes={classRows.map((c) => ({ id: c.id, name: c.name }))}
          linkMode={!!appUrl()}
          kakaoBody={usesAlimtalk("NOTICE") ? ALIMTALK_TEMPLATES.NOTICE.body : undefined}
          remaining={quotaState(academy).remaining}
          canUpgrade={quotaState(academy).tier !== "PLUS"}
        />
      </div>

      <section>
      <h2 className="mt-6 px-1 text-[13px] font-semibold text-slate-500 lg:mt-0 lg:pb-0.5">보낸 공지</h2>
      {history.length === 0 ? (
        <div className="card mt-2 flex flex-col items-center rounded-2xl py-10 text-center">
          <Inbox className="text-slate-300" size={28} />
          <p className="mt-2 text-sm text-slate-400">보낸 공지가 여기에 쌓여요</p>
        </div>
      ) : (
        <ul className="card mt-2 divide-y divide-black/5 rounded-2xl">
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
