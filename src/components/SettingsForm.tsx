"use client";

import { useRef, useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { saveSettings, type FormResult } from "@/app/actions";
import { DEFAULT_ATTENDANCE_TEMPLATE, DEFAULT_FEEDBACK_TEMPLATE, renderTemplate } from "@/lib/templates";

const SAMPLE = { 이름: "김하늘", 시각: "16:05", 메모: "분수 나눗셈 개념 잘 이해했어요. 숙제는 교재 24~25쪽입니다." };

function bytes(text: string) {
  let n = 0;
  for (const ch of text) n += ch.charCodeAt(0) > 127 ? 2 : 1;
  return n;
}

function TemplateField({
  label,
  value,
  onChange,
  vars,
  fallback,
  academyName,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  vars: string[];
  fallback: string;
  academyName: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const preview = renderTemplate(value, { 학원: academyName || "학원", ...SAMPLE });

  // 커서 위치에 {변수} 넣기
  function insert(v: string) {
    const el = ref.current;
    const token = `{${v}}`;
    if (!el) return onChange(value + token);
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-slate-500">{label}</p>
        {value !== fallback && (
          <button type="button" onClick={() => onChange(fallback)} className="flex items-center gap-1 text-xs text-slate-400">
            <RotateCcw size={12} /> 기본 문구로
          </button>
        )}
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        maxLength={300}
        className="mt-2 w-full resize-none rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-[15px] leading-relaxed ring-1 ring-black/5 outline-none focus:bg-white focus:ring-2 focus:ring-gold"
      />
      <div className="mt-1 flex flex-wrap gap-1.5">
        {vars.map((v) => (
          <button
            type="button"
            key={v}
            onClick={() => insert(v)}
            className="rounded-md bg-gold-soft px-2 py-1 text-xs font-semibold text-[#8a6d35]"
          >
            + {`{${v}}`}
          </button>
        ))}
      </div>
      <p className="mt-3 mb-1.5 text-[11px] text-slate-400">
        학부모님 휴대폰에는 이렇게 보여요 · {bytes(preview) > 90 ? "장문" : "단문"}
      </p>
      <div className="max-w-[88%] rounded-2xl rounded-tl-md bg-slate-100 px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap">
        {preview}
      </div>
    </div>
  );
}

export function SettingsForm(props: { name: string; attendanceTemplate: string; feedbackTemplate: string }) {
  const [name, setName] = useState(props.name);
  const [att, setAtt] = useState(props.attendanceTemplate);
  const [fb, setFb] = useState(props.feedbackTemplate);
  const [res, setRes] = useState<FormResult>(null);
  const [pending, start] = useTransition();

  const dirty = name !== props.name || att !== props.attendanceTemplate || fb !== props.feedbackTemplate;

  function save() {
    const fd = new FormData();
    fd.set("name", name);
    fd.set("attendanceTemplate", att);
    fd.set("feedbackTemplate", fb);
    start(async () => setRes(await saveSettings(null, fd)));
  }

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
      <p className="text-[13px] font-semibold text-slate-500">학원 이름</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={20}
        className="mt-2 w-full rounded-xl border-0 bg-slate-50 px-3 py-3 text-[15px] ring-1 ring-black/5 outline-none focus:bg-white focus:ring-2 focus:ring-gold"
      />
      <p className="mt-1 text-[11px] text-slate-400">문자 맨 앞 [ ] 안에 들어가요</p>

      <TemplateField
        label="등원 문자"
        value={att}
        onChange={setAtt}
        vars={["학원", "이름", "시각"]}
        fallback={DEFAULT_ATTENDANCE_TEMPLATE}
        academyName={name}
      />
      <TemplateField
        label="수업 피드백 문자"
        value={fb}
        onChange={setFb}
        vars={["학원", "이름", "메모"]}
        fallback={DEFAULT_FEEDBACK_TEMPLATE}
        academyName={name}
      />

      <button
        type="button"
        onClick={save}
        disabled={pending || !dirty}
        className="mt-5 w-full rounded-xl bg-brand py-3.5 text-[15px] font-semibold text-white disabled:opacity-30"
      >
        {pending ? "저장 중…" : "저장"}
      </button>
      {res && <p className={`mt-2 text-center text-sm ${res.ok ? "text-emerald-600" : "text-rose-600"}`}>{res.message}</p>}
    </div>
  );
}
