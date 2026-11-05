"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { requestConsult } from "@/app/actions";
import { consultWhen, type Slot } from "@/lib/consult";
import { DAY_LABELS, weekdayOf } from "@/lib/templates";

const GRADES = ["예비 초1", "초1", "초2", "초3", "초4", "초5", "초6", "중1", "중2", "중3", "고1", "고2", "고3"];
const input = "w-full rounded-xl border-0 px-3.5 py-3 text-[16px] outline-none focus:ring-2 focus:ring-gold field"; // 16px: 아이폰이 확대하지 않게
const label = "block text-[13px] font-semibold text-slate-600";

/** 학부모님 상담 신청: 날짜 → 시간 → 성함·연락처·학년·문의 → [신청하기] → "원장님이 확인 후 연락드려요" */
export function ConsultBooking({ code, days, privacyHref }: { code: string; days: { date: string; slots: Slot[] }[]; privacyHref: string }) {
  const router = useRouter();
  const [date, setDate] = useState(days[0].date);
  const [start, setStart] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [pending, run] = useTransition();
  const slots = days.find((d) => d.date === date)?.slots ?? [];

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!start) return setError("시간을 골라 주세요.");
    const fd = new FormData(e.currentTarget);
    if (!fd.get("agree")) return setError("개인정보 수집·이용에 동의해 주세요.");
    const get = (k: string) => String(fd.get(k) ?? "");
    run(async () => {
      const r = await requestConsult(code, {
        date,
        start,
        parentName: get("parentName"),
        parentPhone: get("parentPhone"),
        grade: get("grade"),
        message: get("message"),
        agree: true,
      });
      if (r?.ok) return setDone(consultWhen(date, start));
      setError(r?.message ?? "다시 해 주세요.");
      if (r?.message.includes("찼")) {
        setStart("");
        router.refresh(); // 빈 시간 다시 받아오기
      }
    });
  }

  if (done) {
    return (
      <div className="card mt-5 rounded-2xl p-6 text-center">
        <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
        <p className="mt-3 text-[19px] font-bold">신청했어요</p>
        <p className="mt-1 text-[15px] text-slate-600">{done}</p>
        <p className="mt-4 rounded-xl bg-gold-soft px-4 py-3 text-[15px] leading-relaxed text-[#8a6d35]">
          원장님이 확인 후 연락드려요.
          <br />
          시간이 바뀌면 문자로 알려 드릴게요.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-5">
      <section>
        <p className={label}>날짜</p>
        <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
          {days.map((d) => {
            const w = weekdayOf(d.date);
            const on = d.date === date;
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => {
                  setDate(d.date);
                  setStart("");
                  setError("");
                }}
                aria-pressed={on}
                className={`flex w-[62px] shrink-0 flex-col items-center rounded-2xl py-2.5 ${on ? "bg-brand text-white" : "card text-slate-700"}`}
              >
                <span className={`text-[12px] font-semibold ${on ? "text-gold" : w === 0 ? "text-rose-500" : w === 6 ? "text-sky-600" : "text-slate-500"}`}>
                  {DAY_LABELS[w]}
                </span>
                <span className="text-[19px] font-bold tabular-nums">{Number(d.date.slice(8))}</span>
                <span className={`text-[11px] ${on ? "text-white/70" : "text-slate-400"}`}>{Number(d.date.slice(5, 7))}월</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <p className={label}>시간</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {slots.map((s) => (
            <button
              key={s.start}
              type="button"
              onClick={() => {
                setStart(s.start);
                setError("");
              }}
              aria-pressed={start === s.start}
              className={`rounded-xl py-3 text-[16px] font-semibold tabular-nums ${start === s.start ? "bg-brand text-white" : "card text-slate-700"}`}
            >
              {s.start}
            </button>
          ))}
        </div>
      </section>

      <section className="card space-y-3 rounded-2xl p-4">
        <label className={label}>
          학부모님 성함
          <input name="parentName" required maxLength={20} autoComplete="name" placeholder="예: 김민지" className={`${input} mt-1.5 font-normal`} />
        </label>
        <label className={label}>
          연락처
          <input name="parentPhone" required type="tel" inputMode="tel" autoComplete="tel" placeholder="010-1234-5678" className={`${input} mt-1.5 font-normal`} />
        </label>
        <label className={label}>
          학생 학년
          <select name="grade" required defaultValue="" className={`${input} mt-1.5 font-normal`}>
            <option value="" disabled>
              골라 주세요
            </option>
            {GRADES.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          문의 내용 <span className="font-normal text-slate-400">(안 써도 돼요)</span>
          <textarea name="message" maxLength={300} rows={3} placeholder="예: 중등 수학 진도가 궁금해요" className={`${input} mt-1.5 resize-none font-normal`} />
        </label>
      </section>

      {/* 개인정보 수집·이용 동의 (필수) — 받는 것·목적·보관 기간·거부 권리 */}
      <section className="card rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2.5 text-[15px] font-semibold">
            <input type="checkbox" name="agree" required className="size-5 shrink-0 accent-[var(--color-brand)]" />
            개인정보 수집·이용 동의 <span className="text-rose-500">(필수)</span>
          </label>
          <a href={privacyHref} target="_blank" rel="noopener" className="shrink-0 text-[13px] font-semibold text-brand underline">
            자세히
          </a>
        </div>
        <p className="mt-2 pl-[30px] text-[12.5px] leading-relaxed text-slate-500">
          받는 것: 학부모 성함·연락처·학생 학년·문의 내용 · 목적: 상담 연락 · 보관: 상담 날짜 6개월 뒤 자동 삭제. 동의하지 않으시면 신청할 수 없어요.
        </p>
      </section>

      {error && <p className="text-center text-[14px] font-medium text-rose-600">{error}</p>}
      <button disabled={pending} className="w-full rounded-2xl bg-brand py-4 text-[17px] font-bold text-white disabled:opacity-60">
        {pending ? "신청 중…" : start ? `${consultWhen(date, start)} 신청하기` : "신청하기"}
      </button>
    </form>
  );
}
