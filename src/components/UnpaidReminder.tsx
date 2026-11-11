"use client";

import { useState, useTransition } from "react";
import { BellRing, CheckCircle2, ChevronDown } from "lucide-react";
import { sendPaymentReminders } from "@/app/actions";

type U = { id: string; name: string; grade: string; remindedOn: string | null; noFee: boolean }; // noFee: 교습비·납부일이 비어 있어 안내 못 보냄

/**
 * 월별 화면 — 이 달 교습비를 아직 안 낸 학생 + 원비 안내 보내기.
 * 이미 안내한 학생은 기본으로 체크 해제 (같은 안내가 두 번 가지 않게). 보내기 전에 한 번 더 확인.
 */
export function UnpaidReminder({ month, label, list, via }: { month: string; label: string; list: U[]; via: string }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(() => new Set(list.filter((u) => !u.remindedOn && !u.noFee).map((u) => u.id)));
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, start] = useTransition();

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function send() {
    start(async () => {
      const res = await sendPaymentReminders(month, [...picked]);
      setConfirming(false);
      if (res.failed) setMsg({ ok: false, text: `${res.sent}명 보냄, ${res.failed}명 실패 (${res.error ?? ""}) — 출석부 위 '다시 보내기'로 재발송돼요` });
      else if (res.error) setMsg({ ok: false, text: res.error });
      else {
        setMsg({ ok: true, text: `${res.sent}명에게 원비 안내를 보냈어요${res.waiting ? ` · 동의 안 한 ${res.waiting}명은 빠졌어요` : ""}${res.noFee ? ` · 교습비가 비어 있는 ${res.noFee}명은 빠졌어요` : ""}${res.test ? " (테스트 모드)" : ""}` });
        setPicked(new Set());
      }
    });
  }

  return (
    <section className="card mt-2 rounded-2xl lg:mt-0">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 p-4 text-left">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
          <BellRing size={19} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">
            {label} 미납 <span className="text-rose-500">{list.length}명</span>
          </span>
          <span className="block text-xs text-slate-500">눌러서 학부모님께 원비 안내 보내기</span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-black/5 px-4 pt-2 pb-4">
          <ul className="divide-y divide-black/5">
            {list.map((u) => (
              <li key={u.id}>
                <label className="flex cursor-pointer items-center gap-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={picked.has(u.id)}
                    disabled={u.noFee}
                    onChange={() => toggle(u.id)}
                    className="h-5 w-5 shrink-0 accent-brand"
                  />
                  <span className="flex-1 text-[15px] font-semibold">
                    {u.name} <span className="text-xs font-medium text-slate-400">{u.grade}</span>
                  </span>
                  {u.noFee ? (
                    <span className="text-[12px] font-medium text-amber-700">교습비를 먼저 입력해 주세요</span>
                  ) : (
                    u.remindedOn && <span className="text-[12px] text-slate-400">{u.remindedOn} 안내함</span>
                  )}
                </label>
              </li>
            ))}
          </ul>

          {list.some((u) => u.noFee) && (
            <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[12.5px] leading-relaxed text-amber-800 ring-1 ring-amber-200">
              교습비나 납부일이 비어 있는 학생은 안내를 보낼 수 없어요. 학생 화면에서 <b>교습비를 먼저 입력해 주세요.</b>
            </p>
          )}
          <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-[12px] leading-relaxed text-slate-500">
            {via}로 &ldquo;○○ 학생의 {label} 교습비 납부 안내&rdquo;와 등록한 교습비·납부일이 가요. 동의 안 한 학부모님은 빠져요.
            결제는 지금처럼 받으시고, 받으면 학생을 눌러 납부 기록을 남겨 주세요.
          </p>

          {confirming ? (
            <div className="mt-3 flex gap-2">
              <button onClick={() => setConfirming(false)} className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-medium">
                취소
              </button>
              <button
                onClick={send}
                disabled={busy}
                className="flex-1 rounded-xl bg-brand py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? "보내는 중…" : `${picked.size}명에게 보내기`}
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setMsg(null);
                setConfirming(true);
              }}
              disabled={picked.size === 0}
              className="mt-3 w-full rounded-xl bg-brand py-3 text-[15px] font-semibold text-white disabled:opacity-40"
            >
              {picked.size === 0 ? "안내할 학생을 골라 주세요" : `원비 안내 보내기 · ${picked.size}명`}
            </button>
          )}
          {msg && (
            <p className={`mt-2 flex items-center gap-1.5 text-sm ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>
              {msg.ok && <CheckCircle2 size={15} />} {msg.text}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
