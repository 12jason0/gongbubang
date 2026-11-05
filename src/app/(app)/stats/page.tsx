import Link from "next/link";
import { ChevronLeft, ChevronRight, MessageSquare, Printer, Wallet } from "lucide-react";
import { and, desc, eq, gte, like, lt, ne } from "drizzle-orm";
import { db, attendance, messageLogs, students, payments, classes, classStudents } from "@/db";
import { currentAcademyId, requireAcademy } from "@/lib/session";
import { isValidMonth, quarterOf, shiftMonth, thisMonthKST, todayKST } from "@/lib/date";
import { isLongMessage, usesAlimtalk } from "@/lib/sms";
import { formatWon } from "@/lib/money";
import { byGradeName, monthLabel } from "@/lib/templates";
import { PaymentRow, type PaymentItem } from "@/components/PaymentRow";
import { UnpaidReminder } from "@/components/UnpaidReminder";

const KIND_LABEL: Record<string, string> = { ATTENDANCE: "등원", FEEDBACK: "피드백", NOTICE: "공지", PAYMENT: "원비 안내", CONSENT: "동의 요청" };
const NAV_BTN = "flex h-11 w-[84px] items-center gap-0.5 rounded-xl px-1.5 text-[13px] text-slate-500 active:bg-black/5";

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const academyId = await currentAcademyId(); // 쿠키만 확인 — 아래 쿼리를 공부방 조회와 동시에
  const sp = await searchParams;
  const current = thisMonthKST();
  const last = shiftMonth(current, 6); // 선납 확인용으로 반년 앞까지
  const month = isValidMonth(sp.month) && sp.month <= last ? sp.month : current;
  const [y, m] = month.split("-").map(Number);

  // 한국 시간 기준 이번 달 1일 0시 ~ 다음 달 1일 0시
  const from = new Date(`${month}-01T00:00:00+09:00`);
  const to = new Date(`${shiftMonth(month, 1)}-01T00:00:00+09:00`);

  const [, studentRows, attRows, logs, monthPayments, lastPayments, classRows, reminders] = await Promise.all([
    requireAcademy(), // 공부방이 없거나 지워졌으면 여기서 로그인 화면으로
    db.select().from(students).where(eq(students.academyId, academyId)),
    db
      .select({ studentId: attendance.studentId, status: attendance.status })
      .from(attendance)
      .where(and(eq(attendance.academyId, academyId), like(attendance.date, `${month}-%`))),
    db
      .select({ kind: messageLogs.kind, channel: messageLogs.channel, text: messageLogs.text, status: messageLogs.status })
      .from(messageLogs)
      .where(and(eq(messageLogs.academyId, academyId), gte(messageLogs.createdAt, from), lt(messageLogs.createdAt, to))),
    db
      .select()
      .from(payments)
      .where(and(eq(payments.academyId, academyId), eq(payments.period, month)))
      .orderBy(payments.paidOn),
    // 학생별 가장 최근 납부 — 입력 칸 기본값 (지난번과 같은 금액·과목·수단)
    db
      .selectDistinctOn([payments.studentId])
      .from(payments)
      .where(eq(payments.academyId, academyId))
      .orderBy(payments.studentId, desc(payments.createdAt)),
    db
      .select({ studentId: classStudents.studentId, name: classes.name })
      .from(classStudents)
      .innerJoin(classes, eq(classes.id, classStudents.classId))
      .where(eq(classes.academyId, academyId)),
    // 이 달 원비 안내를 보낸 기록 (실패 제외) — "10/31 안내함" 표시
    db
      .select({ studentId: messageLogs.studentId, createdAt: messageLogs.createdAt })
      .from(messageLogs)
      .where(
        and(
          eq(messageLogs.academyId, academyId),
          eq(messageLogs.kind, "PAYMENT"),
          eq(messageLogs.refDate, month),
          ne(messageLogs.status, "FAILED"),
        ),
      )
      .orderBy(desc(messageLogs.createdAt)),
  ]);

  const paidBy = new Map<string, PaymentItem[]>();
  for (const p of monthPayments) paidBy.set(p.studentId, [...(paidBy.get(p.studentId) ?? []), p]);
  const lastBy = new Map(lastPayments.map((p) => [p.studentId, p]));
  const defaultsOf = (sid: string) => {
    const lp = lastBy.get(sid);
    if (lp) return { subject: lp.subject, tuition: lp.tuition, otherFee: lp.otherFee, method: lp.method };
    const names = classRows.filter((c) => c.studentId === sid).map((c) => c.name);
    return { subject: names.join(", "), tuition: 0, otherFee: 0, method: "결제선생" };
  };

  const tally = new Map<string, { present: number; absent: number }>();
  for (const a of attRows) {
    const t = tally.get(a.studentId) ?? { present: 0, absent: 0 };
    if (a.status === "PRESENT") t.present++;
    else if (a.status === "ABSENT") t.absent++;
    tally.set(a.studentId, t);
  }

  // 다니는 학생 + 이번 달 기록(출결·납부)이 있는 그만둔 학생
  const rows = studentRows
    .filter((s) => s.active || tally.has(s.id) || paidBy.has(s.id))
    .sort(byGradeName)
    .map((s) => ({ ...s, ...(tally.get(s.id) ?? { present: 0, absent: 0 }) }));

  // 문자 사용량 (월 관리비·문자비 계산 근거)
  const sentLogs = logs.filter((l) => l.status !== "FAILED");
  const usage = { alimtalk: 0, short: 0, long: 0, failed: logs.length - sentLogs.length };
  const byKind: Record<string, number> = {};
  for (const l of sentLogs) {
    if (l.channel === "ALIMTALK") usage.alimtalk++;
    else if (isLongMessage(l.text)) usage.long++;
    else usage.short++;
    byKind[l.kind] = (byKind[l.kind] ?? 0) + 1;
  }

  const totalPresent = rows.reduce((n, r) => n + r.present, 0);
  const totalAbsent = rows.reduce((n, r) => n + r.absent, 0);
  const totalPaid = monthPayments.reduce((n, p) => n + p.tuition + p.otherFee, 0);
  const unpaidRows = rows.filter((r) => r.active && !paidBy.has(r.id));
  const unpaid = unpaidRows.length;
  const remindedOn = new Map<string, string>();
  for (const r of reminders) {
    if (!r.studentId || remindedOn.has(r.studentId)) continue;
    const [, mm, dd] = todayKST(r.createdAt).split("-").map(Number);
    remindedOn.set(r.studentId, `${mm}/${dd}`);
  }

  return (
    <main className="px-3 pt-3">
      <div className="flex items-center justify-between">
        <Link
          href={`/stats?month=${shiftMonth(month, -1)}`}
          className={NAV_BTN}
        >
          <ChevronLeft size={20} /> 이전 달
        </Link>
        <p className="text-[19px] font-bold tracking-tight">
          {y}년 {m}월
        </p>
        {month < last ? (
          <Link href={`/stats?month=${shiftMonth(month, 1)}`} className={`${NAV_BTN} justify-end`}>
            다음 달 <ChevronRight size={20} />
          </Link>
        ) : (
          <span className="h-11 w-[84px]" />
        )}
      </div>

      {/* PC: 왼쪽 학생 표, 오른쪽 합계·문자 사용량 (휴대폰 순서는 그대로) */}
      <div className="lg:mt-2 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[auto_auto_auto_1fr] lg:items-start lg:gap-x-4 lg:gap-y-3">
      <div className="mt-2 grid grid-cols-2 gap-2 lg:col-start-2 lg:row-start-1 lg:mt-0">
        <div className="card rounded-2xl p-4">
          <p className="text-[11px] font-medium text-slate-400">이번 달 출석</p>
          <p className="text-[26px] leading-tight font-bold text-emerald-600 tabular-nums">{totalPresent}</p>
        </div>
        <div className="card rounded-2xl p-4">
          <p className="text-[11px] font-medium text-slate-400">이번 달 결석</p>
          <p className="text-[26px] leading-tight font-bold text-rose-500 tabular-nums">{totalAbsent}</p>
        </div>
      </div>

      {/* 교습비 합계 */}
      <section className="card mt-2 flex items-center gap-3 rounded-2xl p-4 lg:col-start-2 lg:row-start-2 lg:mt-0">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <Wallet size={19} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-slate-400">{m}월분 교습비</p>
          <p className="text-[17px] font-bold tabular-nums">{formatWon(totalPaid)}</p>
          <p className="text-xs text-slate-500">
            납부 {paidBy.size}명{unpaid > 0 && <span className="font-semibold text-rose-500"> · 미납 {unpaid}명</span>}
          </p>
        </div>
        <Link
          href={`/ledger?q=${quarterOf(`${month}-01`)}`}
          className="ml-auto flex shrink-0 items-center gap-1 rounded-xl bg-brand-soft px-3 py-2 text-[13px] font-semibold text-brand"
        >
          <Printer size={15} /> 영수증 원부
        </Link>
      </section>

      {unpaid > 0 && month <= current && (
        <div className="lg:col-start-2 lg:row-start-3">
          <UnpaidReminder
            month={month}
            label={monthLabel(month)}
            via={usesAlimtalk("PAYMENT") ? "카카오 알림톡" : "문자"}
            list={unpaidRows.map((r) => ({ id: r.id, name: r.name, grade: r.grade, remindedOn: remindedOn.get(r.id) ?? null }))}
          />
        </div>
      )}

      <section className="card mt-3 rounded-2xl lg:col-start-1 lg:row-span-4 lg:row-start-1 lg:mt-0">
        <div className="flex px-4 pt-3 pb-2 text-[11px] font-medium text-slate-400">
          <span className="flex-1">학생 · 누르면 납부 기록</span>
          <span className="w-10 text-right">출석</span>
          <span className="w-10 text-right">결석</span>
          <span className="w-[76px] pr-4 text-right">{m}월분</span>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">학생이 없어요</p>
        ) : (
          <ul className="divide-y divide-black/5 border-t border-black/5">
            {rows.map((r) => (
              <PaymentRow key={r.id} s={r} paid={paidBy.get(r.id) ?? []} defaults={defaultsOf(r.id)} month={month} today={todayKST()} />
            ))}
          </ul>
        )}
      </section>

      <section className="card mt-3 flex items-center gap-3 rounded-2xl p-4 lg:col-start-2 lg:row-start-4 lg:mt-0">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-soft text-[#8a6d35]">
          <MessageSquare size={19} />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">
            {usage.alimtalk > 0 && <>알림톡 {usage.alimtalk}건 · </>}
            문자 단문 {usage.short}건 · 장문 {usage.long}건
            {usage.failed > 0 && <span className="text-rose-500"> · 실패 {usage.failed}</span>}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {Object.entries(byKind)
              .map(([k, n]) => `${KIND_LABEL[k] ?? k} ${n}`)
              .join(" · ") || "아직 보낸 문자가 없어요"}
          </p>
        </div>
      </section>
      </div>
    </main>
  );
}
