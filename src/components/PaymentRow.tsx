"use client";

import { useState, useTransition, type FormEvent } from "react";
import { ChevronDown, Plus, Trash2, X } from "lucide-react";
import { addPayment, deletePayment, type FormResult } from "@/app/actions";
import { shiftMonth } from "@/lib/date";
import { PAYMENT_METHODS, formatWon, parseWon, shortWon } from "@/lib/money";

export type PaymentItem = {
  id: string;
  paidOn: string;
  period: string;
  subject: string;
  tuition: number;
  otherFee: number;
  method: string;
  memo: string;
};

export type StatsStudent = {
  id: string;
  name: string;
  grade: string;
  active: boolean;
  present: number;
  absent: number;
  fee: string; // "25만 원 · 10일" (등록 안 했으면 "")
  beforeDue: boolean; // 이 달 납부일 전 → 기록 없어도 "미납" 대신 "납부일 전"
};

type Defaults = { subject: string; tuition: number; otherFee: number; method: string };

const input =
  "w-full rounded-xl border-0 px-3 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-gold field";

const monthLabel = (m: string) => `${Number(m.slice(0, 4))}년 ${Number(m.slice(5))}월`;
const shortDate = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`;

/** 월별 화면 학생 한 줄: 출석·결석 + 이 달 납부. 누르면 납부 기록과 입력 칸이 열림 */
export function PaymentRow({
  s,
  paid,
  defaults,
  month,
  today,
}: {
  s: StatsStudent;
  paid: PaymentItem[];
  defaults: Defaults;
  month: string;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const total = s.present + s.absent;
  const sum = paid.reduce((n, p) => n + p.tuition + p.otherFee, 0);

  return (
    <li className={open ? "bg-slate-50/60" : ""}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center px-4 py-2.5 text-left">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium">
            {s.name} <span className="text-xs text-slate-400">{s.grade}</span>
            {!s.active && <span className="ml-1 text-xs text-slate-400">(그만둠)</span>}
            {s.fee && <span className="ml-1.5 text-[11.5px] text-[#8a6d35]">{s.fee}</span>}
          </p>
          <div className="mt-1 flex h-1.5 w-24 overflow-hidden rounded-full bg-slate-100" aria-hidden>
            {total > 0 && (
              <>
                <div className="bg-emerald-500" style={{ width: `${(s.present / total) * 100}%` }} />
                <div className="bg-rose-400" style={{ width: `${(s.absent / total) * 100}%` }} />
              </>
            )}
          </div>
        </div>
        <span className="w-10 text-right text-[15px] font-semibold text-emerald-600 tabular-nums">{s.present}</span>
        <span className={`w-10 text-right text-[15px] tabular-nums ${s.absent ? "font-bold text-rose-500" : "text-slate-300"}`}>
          {s.absent}
        </span>
        <span className="flex w-[76px] items-center justify-end gap-0.5">
          {sum > 0 ? (
            <span className="text-[14px] font-semibold text-brand tabular-nums">{shortWon(sum)}</span>
          ) : s.beforeDue ? (
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11.5px] font-medium whitespace-nowrap text-slate-500">납부일 전</span>
          ) : (
            <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[12px] font-semibold text-rose-500">미납</span>
          )}
          <ChevronDown size={15} className={`shrink-0 text-slate-300 transition ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          {paid.length > 0 && (
            <ul className="mb-3 space-y-1.5">
              {paid.map((p) => (
                <PaidItem key={p.id} p={p} />
              ))}
            </ul>
          )}
          {/* 이 달 기록이 있으면 입력 칸은 접어 둠 (선납·추가 납부 때만 펼침) */}
          <AddPaymentForm key={paid.length} studentId={s.id} defaults={defaults} month={month} today={today} folded={paid.length > 0} />
        </div>
      )}
    </li>
  );
}

function PaidItem({ p }: { p: PaymentItem }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  return (
    <li className="card rounded-xl px-3 py-2 text-[13px]">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {formatWon(p.tuition)}
            {p.otherFee > 0 && <span className="font-normal text-slate-500"> + 기타 {formatWon(p.otherFee)}</span>}
          </p>
          <p className="mt-0.5 text-[12px] text-slate-500">
            {shortDate(p.paidOn)} 받음 · {p.subject} · {p.method}
            {p.memo && <span className="text-[#8a6d35]"> · {p.memo}</span>}
          </p>
        </div>
        {confirm ? (
          <div className="flex shrink-0 gap-1">
            <button onClick={() => setConfirm(false)} className="h-9 rounded-lg bg-slate-100 px-2.5 text-[12px] font-medium">
              취소
            </button>
            <button
              disabled={pending}
              onClick={() => start(() => deletePayment(p.id))}
              className="h-9 rounded-lg bg-rose-500 px-2.5 text-[12px] font-semibold text-white disabled:opacity-60"
            >
              지우기
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirm(true)}
            className="flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-[12px] text-slate-400 active:bg-black/5"
          >
            <Trash2 size={14} /> 삭제
          </button>
        )}
      </div>
    </li>
  );
}

function AddPaymentForm({
  studentId,
  defaults,
  month,
  today,
  folded,
}: {
  studentId: string;
  defaults: Defaults;
  month: string;
  today: string;
  folded: boolean;
}) {
  const [show, setShow] = useState(!folded);
  const [res, setRes] = useState<FormResult>(null);
  const [pending, start] = useTransition();
  const [method, setMethod] = useState(defaults.method);
  const [tuition, setTuition] = useState(defaults.tuition ? defaults.tuition.toLocaleString("ko-KR") : "");
  const [otherFee, setOtherFee] = useState(defaults.otherFee ? defaults.otherFee.toLocaleString("ko-KR") : "");
  const [period, setPeriod] = useState(month);

  // 교습기간: 이 달 기준 앞뒤 (선납은 앞으로의 달)
  const periods = [-2, -1, 0, 1, 2, 3, 4, 5, 6].map((n) => shiftMonth(month, n));
  const amount = parseWon(tuition) + parseWon(otherFee);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("method", method);
    start(async () => {
      const r = await addPayment(null, fd);
      setRes(r?.ok && period > month ? { ok: true, message: `${monthLabel(period)}분 선납으로 저장했어요.` } : r);
    });
  }

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="card flex w-full items-center justify-center gap-1 rounded-xl py-2.5 text-[13px] font-semibold text-slate-500"
      >
        <Plus size={15} className="text-gold" /> 납부 기록 더 넣기 (선납·추가 납부)
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card rounded-xl p-3">
      <p className="mb-2 text-[13px] font-semibold text-slate-600">납부 기록 넣기</p>
      <input type="hidden" name="studentId" value={studentId} />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[12px] text-slate-500">
          받은 날
          <input name="paidOn" type="date" defaultValue={today} max={today} className={`${input} mt-1`} />
        </label>
        <label className="text-[12px] text-slate-500">
          교습기간(월)
          <select name="period" value={period} onChange={(e) => setPeriod(e.target.value)} className={`${input} mt-1`}>
            {periods.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
                {m > month ? " (선납)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 text-[12px] text-slate-500">
          교습과목
          <input name="subject" defaultValue={defaults.subject} placeholder="예: 영어, 수학" className={`${input} mt-1`} />
        </label>
        <label className="text-[12px] text-slate-500">
          교습비 (원)
          <input
            name="tuition"
            value={tuition}
            onChange={(e) => setTuition(e.target.value)}
            inputMode="numeric"
            placeholder="350,000"
            className={`${input} mt-1 tabular-nums`}
          />
        </label>
        <label className="text-[12px] text-slate-500">
          기타경비 (원, 교재비 등)
          <input
            name="otherFee"
            value={otherFee}
            onChange={(e) => setOtherFee(e.target.value)}
            inputMode="numeric"
            placeholder="0"
            className={`${input} mt-1 tabular-nums`}
          />
        </label>
      </div>

      <p className="mt-3 mb-1.5 text-[12px] text-slate-500">결제수단</p>
      <div className="flex flex-wrap gap-1.5">
        {PAYMENT_METHODS.map((m) => (
          <button
            type="button"
            key={m}
            onClick={() => setMethod(m)}
            className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${
              m === method ? "bg-brand text-white" : "bg-slate-100 text-slate-500"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <label className="mt-3 block text-[12px] text-slate-500">
        메모 (안 써도 돼요)
        <input name="memo" maxLength={100} placeholder="예: 결석 2회 차감" className={`${input} mt-1`} />
      </label>

      <button
        disabled={pending}
        className="mt-3 w-full rounded-xl bg-brand py-3 text-[15px] font-semibold text-white disabled:opacity-60"
      >
        {pending ? "저장 중…" : Number.isFinite(amount) && amount > 0 ? `${formatWon(amount)} 저장` : "저장"}
      </button>
      {res && (
        <p className={`mt-2 flex items-center justify-between text-sm ${res.ok ? "text-emerald-600" : "text-rose-600"}`}>
          {res.message}
          <button type="button" onClick={() => setRes(null)} className="flex items-center gap-0.5 text-xs text-slate-400">
            <X size={12} /> 닫기
          </button>
        </p>
      )}
    </form>
  );
}
