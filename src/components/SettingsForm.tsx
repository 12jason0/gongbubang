"use client";

import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { saveSettings, type FormResult } from "@/app/actions";
import {
  DEFAULT_ATTENDANCE_ENDING,
  DEFAULT_FEEDBACK_TITLE,
  attendanceText,
  feedbackText,
  type MessageWording,
} from "@/lib/templates";

// 미리보기에 넣는 예시 학생
const SAMPLE = { name: "김하늘", time: "4시 5분", memo: "분수 나눗셈 개념 잘 이해했어요. 숙제는 교재 24~25쪽입니다." };

const input =
  "mt-1.5 w-full rounded-xl border-0 bg-slate-50 px-3 py-3 text-[15px] ring-1 ring-black/5 outline-none focus:bg-white focus:ring-2 focus:ring-gold";

function bytes(text: string) {
  let n = 0;
  for (const ch of text) n += ch.charCodeAt(0) > 127 ? 2 : 1;
  return n;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  max,
  fallback,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  max: number;
  fallback?: string; // 있으면 "기본으로" 버튼
}) {
  return (
    <label className="mt-3 block">
      <span className="flex items-center justify-between text-[13px] font-semibold text-slate-600">
        {label}
        {fallback !== undefined && value !== fallback && (
          <button
            type="button"
            onClick={() => onChange(fallback)}
            className="flex items-center gap-1 text-xs font-normal text-slate-400"
          >
            <RotateCcw size={12} /> 기본으로
          </button>
        )}
      </span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={max} className={input} />
    </label>
  );
}

function Preview({ text, auto }: { text: string; auto: string }) {
  return (
    <div className="mt-4">
      <p className="mb-1.5 text-[11px] text-slate-400">
        학부모님 휴대폰에는 이렇게 보여요 · {bytes(text) > 90 ? "장문" : "단문"}
      </p>
      <div className="max-w-[92%] rounded-2xl rounded-tl-md bg-slate-100 px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap">
        {text}
      </div>
      <p className="mt-1.5 text-[12px] text-[#8a6d35]">{auto}</p>
    </div>
  );
}

export function SettingsForm({ initial }: { initial: MessageWording }) {
  const [w, setW] = useState(initial);
  const [res, setRes] = useState<FormResult>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof MessageWording) => (v: string) => setW((prev) => ({ ...prev, [k]: v }));

  const dirty = (Object.keys(initial) as (keyof MessageWording)[]).some((k) => w[k] !== initial[k]);
  const shown = { ...w, name: w.name.trim() || "학원 이름" };

  function save() {
    const fd = new FormData();
    for (const [k, v] of Object.entries(w)) fd.set(k, v);
    start(async () => setRes(await saveSettings(null, fd)));
  }

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
        <Field label="학원 이름 (문자 맨 앞 이름)" value={w.name} onChange={set("name")} max={20} />
        <p className="mt-1 text-[11px] text-slate-400">모든 문자 맨 앞 [ ] 안에 들어가요</p>
      </section>

      <section className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
        <h2 className="text-[15px] font-bold">등원 문자</h2>
        <p className="mt-0.5 text-[12px] text-slate-500">출석을 누르면 학부모님께 바로 가요</p>
        <Field
          label="끝 문장"
          value={w.attendanceEnding}
          onChange={set("attendanceEnding")}
          placeholder={DEFAULT_ATTENDANCE_ENDING}
          max={30}
          fallback={DEFAULT_ATTENDANCE_ENDING}
        />
        <Field
          label="덧붙일 말 (안 써도 돼요)"
          value={w.attendanceExtra}
          onChange={set("attendanceExtra")}
          placeholder="예: 오늘도 열심히 할게요!"
          max={60}
        />
        <Preview text={attendanceText(shown, SAMPLE.name, SAMPLE.time)} auto="학생 이름과 시각은 자동으로 들어가요" />
      </section>

      <section className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
        <h2 className="text-[15px] font-bold">수업 피드백 문자</h2>
        <p className="mt-0.5 text-[12px] text-slate-500">출석부에서 &lsquo;피드백 보내기&rsquo;를 누르면 가요</p>
        <Field
          label="첫 줄"
          value={w.feedbackTitle}
          onChange={set("feedbackTitle")}
          placeholder={DEFAULT_FEEDBACK_TITLE}
          max={30}
          fallback={DEFAULT_FEEDBACK_TITLE}
        />
        <Field
          label="마지막 인사 (안 써도 돼요)"
          value={w.feedbackClosing}
          onChange={set("feedbackClosing")}
          placeholder="예: 궁금하신 점은 언제든 연락 주세요."
          max={60}
        />
        <Preview text={feedbackText(shown, SAMPLE.name, SAMPLE.memo)} auto="학생 이름과 그날 수업 메모는 자동으로 들어가요" />
      </section>

      <button
        type="button"
        onClick={save}
        disabled={pending || !dirty}
        className="w-full rounded-xl bg-brand py-3.5 text-[15px] font-semibold text-white disabled:opacity-30"
      >
        {pending ? "저장 중…" : dirty ? "저장" : "저장됨"}
      </button>
      {res && <p className={`text-center text-sm ${res.ok ? "text-emerald-600" : "text-rose-600"}`}>{res.message}</p>}
    </div>
  );
}
