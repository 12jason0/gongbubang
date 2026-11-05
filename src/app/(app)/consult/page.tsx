import { and, desc, eq, gte } from "drizzle-orm";
import { db, consultations } from "@/db";
import { requireAcademy } from "@/lib/session";
import { consultLink } from "@/lib/alimtalk";
import { parseHours } from "@/lib/consult";
import { shiftDate, todayKST } from "@/lib/date";
import { PageTitle } from "@/components/PageTitle";
import { ConsultManager } from "@/components/ConsultManager";
import { ConsultLinkShare } from "@/components/ConsultSettings";

/** 상담 신청 목록 — 새 신청 / 다가오는 상담 / 지난·취소 (최근 30일) */
export default async function ConsultPage() {
  const academy = await requireAcademy();
  const today = todayKST();
  const rows = await db
    .select()
    .from(consultations)
    .where(and(eq(consultations.academyId, academy.id), gte(consultations.date, shiftDate(today, -30))))
    .orderBy(consultations.date, consultations.start, desc(consultations.createdAt));

  const items = rows.map((r) => ({
    id: r.id,
    date: r.date,
    start: r.start,
    end: r.end,
    parentName: r.parentName,
    parentPhone: r.parentPhone,
    grade: r.grade,
    message: r.message,
    status: r.status,
  }));

  return (
    <main className="px-3 pt-4 pb-6">
      <PageTitle title="상담 신청" sub="학부모님이 링크로 고른 시간 · 확정하거나 다른 시간을 제안하세요" />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-4">
        <ConsultManager
          academyName={academy.name}
          today={today}
          newOnes={items.filter((c) => c.status === "NEW" && c.date >= today)}
          upcoming={items.filter((c) => (c.status === "CONFIRMED" || c.status === "PROPOSED") && c.date >= today)}
          past={items.filter((c) => c.status === "CANCELED" || c.date < today).reverse().slice(0, 20)}
        />
        <div className="mt-3 lg:mt-0">
          <ConsultLinkShare link={consultLink(academy.id)} academyName={academy.name} ready={parseHours(academy.consultHours).length > 0} />
        </div>
      </div>
    </main>
  );
}
