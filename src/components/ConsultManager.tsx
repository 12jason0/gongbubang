"use client";

import { useState, useTransition } from "react";
import { MessageSquareText, Phone } from "lucide-react";
import { proposeConsult, setConsultStatus, type FormResult } from "@/app/actions";
import { CONSULT_STATUS, consultSmsText, consultWhen } from "@/lib/consult";
import { formatPhone } from "@/lib/phone";
import { TimeSelect } from "./ClassFields";
import { Confirm } from "./Confirm";

export type ConsultItem = {
  id: string;
  date: string;
  start: string;
  end: string;
  parentName: string;
  parentPhone: string;
  grade: string;
  message: string;
  status: string;
};

const BADGE: Record<string, string> = {
  NEW: "bg-rose-50 text-rose-600",
  CONFIRMED: "bg-emerald-50 text-emerald-700",
  PROPOSED: "bg-gold-soft text-[#8a6d35]",
  CANCELED: "bg-slate-100 text-slate-500",
};
const BTN = "h-10 flex-1 rounded-xl text-[13.5px] font-semibold disabled:opacity-50";

/** 학부모님 휴대폰 문자 앱을 문구가 채워진 채로 엶 (보내기는 원장님이). 카톡 알림은 나중에 */
const smsHref = (phone: string, body: string) => `sms:${phone}?&body=${encodeURIComponent(body)}`;

export function ConsultManager({
  academyName,
  today,
  newOnes,
  upcoming,
  past,
}: {
  academyName: string;
  today: string;
  newOnes: ConsultItem[];
  upcoming: ConsultItem[];
  past: ConsultItem[];
}) {
  return (
    <div className="space-y-4">
      <Section title={`새 신청 ${newOnes.length}건`} empty="새 신청이 없어요">
        {newOnes.map((c) => (
          <Item key={c.id} c={c} academyName={academyName} today={today} />
        ))}
      </Section>
      <Section title="다가오는 상담" empty="확정한 상담이 없어요">
        {upcoming.map((c) => (
          <Item key={c.id} c={c} academyName={academyName} today={today} />
        ))}
      </Section>
      {past.length > 0 && (
        <details className="card rounded-2xl px-4 py-3">
          <summary className="cursor-pointer text-[13.5px] font-semibold text-slate-500">지난 상담·취소 (최근 30일) {past.length}건</summary>
          <ul className="mt-2 space-y-2">
            {past.map((c) => (
              <Item key={c.id} c={c} academyName={academyName} today={today} done />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section>
      <h2 className="px-1 text-[13px] font-semibold text-slate-500">{title}</h2>
      {children.length === 0 ? (
        <p className="card mt-1.5 rounded-2xl px-4 py-6 text-center text-[14px] text-slate-400">{empty}</p>
      ) : (
        <ul className="mt-1.5 space-y-2">{children}</ul>
      )}
    </section>
  );
}

function Item({ c, academyName, today, done }: { c: ConsultItem; academyName: string; today: string; done?: boolean }) {
  const [pending, run] = useTransition();
  const [res, setRes] = useState<FormResult>(null);
  const [proposing, setProposing] = useState(false);
  const [asking, setAsking] = useState(false);
  const act = (f: () => Promise<FormResult>) => run(async () => setRes(await f()));

  return (
    <li className="card rounded-2xl p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold tabular-nums">{consultWhen(c.date, c.start)}</p>
          <p className="mt-0.5 text-[14px]">
            {c.parentName} 학부모님 <span className="text-slate-500">· {c.grade}</span>
          </p>
          <a href={`tel:${c.parentPhone}`} className="mt-0.5 inline-flex items-center gap-1 text-[13.5px] font-medium text-brand">
            <Phone size={13} /> {formatPhone(c.parentPhone)}
          </a>
        </div>
        <span className={`shrink-0 rounded-md px-2 py-0.5 text-[12px] font-semibold ${BADGE[c.status] ?? BADGE.CANCELED}`}>{CONSULT_STATUS[c.status] ?? c.status}</span>
      </div>
      {c.message && <p className="mt-2 rounded-xl bg-black/[0.03] px-3 py-2 text-[13.5px] whitespace-pre-wrap text-slate-700">{c.message}</p>}

      {!done && c.status !== "CANCELED" && (
        <>
          {proposing ? (
            <ProposeForm
              c={c}
              today={today}
              onDone={(r) => {
                setRes(r);
                if (r?.ok) setProposing(false);
              }}
              onCancel={() => setProposing(false)}
            />
          ) : (
            <div className="mt-3 flex gap-1.5">
              {c.status !== "CONFIRMED" && (
                <button type="button" disabled={pending} onClick={() => act(() => setConsultStatus(c.id, "CONFIRMED"))} className={`${BTN} bg-brand text-white`}>
                  확정
                </button>
              )}
              <button type="button" disabled={pending} onClick={() => setProposing(true)} className={`${BTN} bg-brand-soft text-brand`}>
                다른 시간 제안
              </button>
              <button type="button" disabled={pending} onClick={() => setAsking(true)} className={`${BTN} bg-slate-100 text-slate-600`}>
                취소
              </button>
            </div>
          )}
          <Confirm
            open={asking}
            title="상담을 취소할까요?"
            body={`${consultWhen(c.date, c.start)} ${c.parentName} 학부모님\n취소하면 그 시간은 다시 신청받을 수 있어요.`}
            ok="취소하기"
            danger
            onCancel={() => setAsking(false)}
            onOk={() => {
              setAsking(false);
              act(() => setConsultStatus(c.id, "CANCELED"));
            }}
          />
        </>
      )}

      {/* 확정·제안·취소 뒤 학부모님께 알리기 — 문자 앱에 문구만 채움 (취소해서 아래 목록으로 간 것도, 날짜가 안 지났으면) */}
      {c.status !== "NEW" && c.date >= today && (
        <a
          href={smsHref(c.parentPhone, consultSmsText(academyName, c))}
          className="mt-2 flex items-center justify-center gap-1 rounded-xl border border-black/10 py-2.5 text-[13.5px] font-semibold text-slate-600"
        >
          <MessageSquareText size={15} /> 학부모님께 문자로 알리기
        </a>
      )}
      {res?.message && <p className={`mt-2 text-[13px] ${res.ok ? "text-emerald-600" : "text-rose-600"}`}>{res.message}</p>}
    </li>
  );
}

/** 다른 시간: 날짜 + 시각 (받는 시간 밖도 가능 — 원장님이 정하는 것) */
function ProposeForm({ c, today, onDone, onCancel }: { c: ConsultItem; today: string; onDone: (r: FormResult) => void; onCancel: () => void }) {
  const [date, setDate] = useState(c.date);
  const [start, setStart] = useState(c.start);
  const [pending, run] = useTransition();
  return (
    <div className="mt-3 space-y-2 rounded-xl bg-black/[0.03] p-3">
      <p className="text-[12.5px] font-semibold text-slate-500">제안할 시간</p>
      <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} className="field w-full rounded-xl border-0 px-3 py-2.5 text-[15px]" aria-label="날짜" />
      <TimeSelect label="시각" value={start} onChange={setStart} />
      <div className="flex gap-1.5 pt-1">
        <button type="button" onClick={onCancel} className={`${BTN} bg-white text-slate-600`}>
          닫기
        </button>
        <button type="button" disabled={pending || !date || !start} onClick={() => run(async () => onDone(await proposeConsult(c.id, date, start)))} className={`${BTN} bg-brand text-white`}>
          {pending ? "저장 중…" : "이 시간으로 제안"}
        </button>
      </div>
    </div>
  );
}
