"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { CalendarClock, Check, ChevronRight, Copy, MessageSquareText, Plus, Trash2 } from "lucide-react";
import { saveConsultHours, type FormResult } from "@/app/actions";
import { CONSULT_LENGTHS, type ConsultRule } from "@/lib/consult";
import { DAY_LABELS, WEEK_ORDER } from "@/lib/templates";
import { TimeSelect } from "./ClassFields";

const NEW_RULE: ConsultRule = { days: [1, 2, 3, 4, 5], start: "14:00", end: "16:00" };

/** 설정 → 상담 예약: 받는 시간(요일 + 시간대, 여러 줄) · 상담 길이 · 신청 링크 */
export function ConsultSettings({
  rules: initial,
  minutes: initialMinutes,
  link,
  academyName,
}: {
  rules: ConsultRule[];
  minutes: number;
  link: string;
  academyName: string;
}) {
  const [rules, setRules] = useState<ConsultRule[]>(initial);
  const [minutes, setMinutes] = useState(initialMinutes);
  const [res, setRes] = useState<FormResult>(null);
  const [pending, run] = useTransition();
  const edit = (i: number, p: Partial<ConsultRule>) => {
    setRes(null);
    setRules((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));
  };

  return (
    <section className="card mb-3 rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-gold">
          <CalendarClock size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">상담 예약</p>
          <p className="text-[13px] text-slate-500">학부모님이 링크에서 이 시간 중 빈 시간만 골라요</p>
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {rules.map((r, i) => (
          <li key={i} className="space-y-2 rounded-xl bg-black/[0.03] p-3">
            <div className="flex items-center gap-1">
              {WEEK_ORDER.map((d) => {
                const on = r.days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => edit(i, { days: on ? r.days.filter((x) => x !== d) : [...r.days, d] })}
                    className={`size-9 rounded-full text-[13px] font-semibold ${on ? "bg-brand text-white" : "bg-white text-slate-500"}`}
                  >
                    {DAY_LABELS[d]}
                  </button>
                );
              })}
              <button type="button" onClick={() => setRules((rs) => rs.filter((_, j) => j !== i))} aria-label="이 시간대 지우기" className="ml-auto grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-black/5">
                <Trash2 size={15} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-[12.5px] text-slate-500">부터</span>
              <TimeSelect label="시작" value={r.start} onChange={(v) => edit(i, { start: v })} />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-[12.5px] text-slate-500">까지</span>
              <TimeSelect label="끝" value={r.end} onChange={(v) => edit(i, { end: v })} />
            </div>
          </li>
        ))}
      </ul>
      {rules.length < 7 && (
        <button
          type="button"
          onClick={() => setRules((rs) => [...rs, { ...NEW_RULE, days: rs.length ? [6] : NEW_RULE.days, start: rs.length ? "10:00" : NEW_RULE.start, end: rs.length ? "12:00" : NEW_RULE.end }])}
          className="surface mt-2 flex w-full items-center justify-center gap-1 rounded-xl py-2.5 text-[13.5px] font-semibold text-brand"
        >
          <Plus size={15} /> {rules.length ? "시간대 더 넣기 (예: 토요일 오전)" : "상담 받는 시간 넣기"}
        </button>
      )}

      <div className="mt-3 flex items-center gap-2">
        <span className="text-[13px] text-slate-500">상담 길이</span>
        {CONSULT_LENGTHS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMinutes(m)}
            className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${m === minutes ? "bg-brand text-white" : "bg-slate-100 text-slate-500"}`}
          >
            {m}분
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={() => run(async () => setRes(await saveConsultHours(rules, minutes)))}
        className="mt-3 w-full rounded-xl bg-brand py-3 text-[15px] font-semibold text-white disabled:opacity-60"
      >
        {pending ? "저장 중…" : "상담 시간 저장"}
      </button>
      {res?.message && <p className={`mt-2 text-[13px] ${res.ok ? "text-emerald-600" : "text-rose-600"}`}>{res.message}</p>}

      <div className="mt-4 border-t border-black/5 pt-4">
        <ConsultLinkShare link={link} ready={initial.length > 0} academyName={academyName} bare />
      </div>
    </section>
  );
}

/** 상담 신청 링크: 복사 / 문자로 보내기(휴대폰 문자 앱에 문구 채움) / 신청 목록 */
export function ConsultLinkShare({ link: path, ready, academyName, bare }: { link: string; ready: boolean; academyName?: string; bare?: boolean }) {
  const [copied, setCopied] = useState(false);
  // APP_URL 이 없으면(로컬 등) 서버가 "/r/…" 만 줌 → 지금 주소를 앞에 붙임
  const origin = useSyncExternalStore(
    () => () => {},
    () => location.origin,
    () => "",
  );
  const link = path.startsWith("/") ? `${origin}${path}` : path;
  const text = `${academyName ? `[${academyName}] ` : ""}상담을 원하시면 아래 링크에서 편한 시간을 골라 주세요.\n${link}`;
  const box = bare ? "" : "card rounded-2xl p-4";
  return (
    <div className={box}>
      <p className="text-[13px] font-semibold text-slate-600">상담 신청 링크</p>
      {!ready && <p className="mt-1 text-[12.5px] text-rose-500">상담 받는 시간을 저장해야 링크에서 시간을 고를 수 있어요.</p>}
      <p className="mt-1.5 rounded-xl bg-black/[0.04] px-3 py-2 text-[12.5px] break-all text-slate-600">{link}</p>
      <div className="mt-2 flex gap-1.5">
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="flex h-10 flex-1 items-center justify-center gap-1 rounded-xl bg-brand-soft text-[13.5px] font-semibold text-brand"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "복사했어요" : "복사"}
        </button>
        <a href={`sms:?&body=${encodeURIComponent(text)}`} className="flex h-10 flex-1 items-center justify-center gap-1 rounded-xl bg-brand text-[13.5px] font-semibold text-white">
          <MessageSquareText size={15} /> 문자로 보내기
        </a>
      </div>
      <Link href="/consult" className="mt-2 flex items-center justify-center gap-0.5 py-1.5 text-[13px] font-semibold text-slate-500">
        신청 목록 보기 <ChevronRight size={14} />
      </Link>
    </div>
  );
}
