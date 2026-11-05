import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db, payments, students } from "@/db";
import { requireAcademy } from "@/lib/session";
import { isValidMonth, isValidQuarter, quarterOf, quarterRange, shiftMonth, shiftQuarter, thisMonthKST, todayKST } from "@/lib/date";
import { ReceiptLedger, type LedgerRow } from "@/components/ReceiptLedger";
import { PrintButton } from "@/components/PrintButton";

export const metadata = { title: "교습비등 영수증 원부" };

const NAV_BTN = "flex h-11 items-center gap-0.5 rounded-xl px-2 text-[13px] text-slate-600 active:bg-black/5";

const monthText = (m: string, withYear: boolean) => `${withYear ? `${Number(m.slice(0, 4))}년 ` : ""}${Number(m.slice(5))}월`;

/**
 * 교습비등 영수증 원부 — 그 기간에 받은 교습비를 A4 양식으로 (월별 화면에서 들어옴)
 * ?q=2026-4 분기 / ?from=2026-09&to=2026-12 원하는 달부터 달까지 (받은 날 기준)
 */
export default async function LedgerPage({ searchParams }: { searchParams: Promise<{ q?: string; from?: string; to?: string }> }) {
  const academy = await requireAcademy();
  const sp = await searchParams;
  const current = quarterOf(todayKST());
  const thisMonth = thisMonthKST();
  const custom = isValidMonth(sp.from) && isValidMonth(sp.to);
  const q = isValidQuarter(sp.q) && sp.q <= current ? sp.q : current;
  let from: string, to: string, periodLabel: string, startMonth: string, endMonth: string;
  if (custom) {
    // 앞뒤가 바뀌어 오면 바로잡음. 끝 달이 아직 안 왔어도 그대로 (분기처럼 "9월~12월" 제목, 받은 날이 미래인 기록은 없음)
    [startMonth, endMonth] = [sp.from!, sp.to!].sort();
    from = `${startMonth}-01`;
    to = `${shiftMonth(endMonth, 1)}-01`;
    const sameYear = startMonth.slice(0, 4) === endMonth.slice(0, 4);
    periodLabel =
      startMonth === endMonth ? monthText(startMonth, true) : `${monthText(startMonth, true)}~${monthText(endMonth, !sameYear)}`;
  } else {
    const r = quarterRange(q);
    ({ from, to } = r);
    [startMonth, endMonth] = [r.months[0], r.months[2]];
    const [y, n] = q.split("-").map(Number);
    periodLabel = `${y}년 ${n}분기 (${monthText(startMonth, false)}~${monthText(endMonth, false)})`;
  }

  // 이 기간에 받은 교습비 (받은 날 기준, 그만둔 학생 포함)
  const rows: LedgerRow[] = await db
    .select({
      studentId: students.id,
      period: payments.period,
      studentName: students.name,
      birthDate: students.birthDate,
      subject: payments.subject,
      tuition: payments.tuition,
      otherFee: payments.otherFee,
      paidOn: payments.paidOn,
      memo: payments.memo,
    })
    .from(payments)
    .innerJoin(students, eq(students.id, payments.studentId))
    .where(and(eq(payments.academyId, academy.id), gte(payments.paidOn, from), lt(payments.paidOn, to)))
    .orderBy(asc(payments.paidOn), asc(payments.createdAt));

  const missingBirth = new Set(rows.filter((r) => !r.birthDate).map((r) => r.studentName));

  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      {/* 화면에서만 보이는 도구 (인쇄 안 됨) */}
      <div className="mx-auto max-w-[1120px] px-3 pt-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/stats" className={NAV_BTN}>
            <ArrowLeft size={18} /> 월별로
          </Link>
          <div className="flex items-center rounded-xl bg-white ring-1 ring-black/5">
            <Link href={`/ledger?q=${custom ? quarterOf(from) : shiftQuarter(q, -1)}`} className={NAV_BTN}>
              <ChevronLeft size={18} /> {custom ? "분기로" : "이전 분기"}
            </Link>
            <span className="px-2 text-[15px] font-bold">{periodLabel}</span>
            {!custom && q < current ? (
              <Link href={`/ledger?q=${shiftQuarter(q, 1)}`} className={NAV_BTN}>
                다음 분기 <ChevronRight size={18} />
              </Link>
            ) : (
              <span className="w-2" />
            )}
          </div>
          {/* 원하는 기간: 달부터 달까지 (주소창 GET — 새로고침·뒤로가기 그대로) */}
          <form action="/ledger" className="flex items-center gap-1 rounded-xl bg-white px-2 py-1 text-[13px] ring-1 ring-black/5">
            <input type="month" name="from" defaultValue={startMonth} max={thisMonth} required className="rounded-lg bg-transparent px-1 py-1.5" aria-label="시작 달" />
            ~
            <input type="month" name="to" defaultValue={endMonth} required className="rounded-lg bg-transparent px-1 py-1.5" aria-label="끝 달" />
            <button className="rounded-lg bg-brand-soft px-2.5 py-1.5 font-semibold text-brand">기간 보기</button>
          </form>
          <div className="ml-auto">
            <PrintButton />
          </div>
        </div>

        <div className="mt-2 space-y-1.5 text-[13px]">
          <p className="text-slate-500">
            이 기간에 받은 교습비 {rows.length}건 · 종이를 <b>가로</b>로 놓고 인쇄돼요. 5년간 보관하세요.
            <span className="md:hidden"> 표는 옆으로 밀어서 보세요.</span>
          </p>
          {!academy.registrationNo && (
            <p className="flex items-center gap-1.5 rounded-xl bg-gold-soft px-3 py-2 text-[#8a6d35]">
              <TriangleAlert size={15} /> 신고번호가 비어 있어요 →
              <Link href="/settings" className="font-semibold underline">
                설정에서 넣기
              </Link>
            </p>
          )}
          {missingBirth.size > 0 && (
            <p className="flex items-center gap-1.5 rounded-xl bg-gold-soft px-3 py-2 text-[#8a6d35]">
              <TriangleAlert size={15} /> 생년월일이 없는 학생: {[...missingBirth].join(", ")} → 표의 노란 칸에서 [생년월일 넣기] (인쇄에는 안 나와요)
            </p>
          )}
        </div>
      </div>

      {/* A4 종이 — 화면에서는 가로로 밀어 볼 수 있게 */}
      <div className="mt-3 overflow-x-auto pb-8 print:mt-0 print:overflow-visible print:pb-0">
        <div className="mx-auto w-[277mm] bg-white p-[8mm] shadow-sm ring-1 ring-black/5 print:w-auto print:p-0 print:shadow-none print:ring-0">
          <ReceiptLedger
            rows={rows}
            info={{ academyName: academy.name, registrationNo: academy.registrationNo, periodLabel }}
          />
        </div>
      </div>
    </div>
  );
}
