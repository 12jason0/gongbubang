"use client";

import { useState, useTransition } from "react";
import { saveSettings, type FormResult } from "@/app/actions";
import { fillTemplate } from "@/lib/templates";
import { InfoTip, TipExample } from "./InfoTip";


// 미리보기에 넣는 예시 학생
const SAMPLE = { name: "김하늘", time: "4시 5분", date: "10월 30일 (금)", memo: "분수 나눗셈 개념 잘 이해했어요. 숙제는 교재 24~25쪽입니다." };

const input =
  "mt-1.5 w-full rounded-xl border-0 px-3 py-3 text-[15px] outline-none focus:ring-2 focus:ring-gold field";

function Field({
  label,
  value,
  onChange,
  placeholder,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  max: number;
}) {
  return (
    <label className="mt-3 block first:mt-0">
      <span className="text-[13px] font-semibold text-slate-600">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={max} className={input} />
    </label>
  );
}

function Preview({ title, when, text, auto }: { title: string; when: string; text: string; auto: string }) {
  return (
    <section className="card rounded-2xl p-4">
      <h2 className="text-[15px] font-bold">{title}</h2>
      <p className="mt-0.5 text-[12px] text-slate-500">{when}</p>
      <div className="mt-3 max-w-[92%] rounded-2xl rounded-tl-md bg-[#fef01b]/25 px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap ring-1 ring-[#fef01b]/60">
        {text}
      </div>
      <p className="mt-1.5 text-[12px] text-[#8a6d35]">{auto}</p>
    </section>
  );
}

type Settings = { name: string; registrationNo: string };

/** 학부모님께 가는 카톡 문구 (lib/alimtalk.ts) — 카카오가 승인한 고정 문구라 원장님이 고치지 않고 미리보기만 */
type Bodies = { attendance: string; feedback: string };

export function SettingsForm({ initial, bodies }: { initial: Settings; bodies: Bodies }) {
  const [w, setW] = useState(initial);
  const [res, setRes] = useState<FormResult>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof Settings) => (v: string) => setW((prev) => ({ ...prev, [k]: v }));

  const dirty = w.name !== initial.name || w.registrationNo !== initial.registrationNo;
  const name = w.name.trim() || "학원 이름";

  function save() {
    const fd = new FormData();
    for (const [k, v] of Object.entries(w)) fd.set(k, v);
    start(async () => setRes(await saveSettings(null, fd)));
  }

  return (
    <div className="space-y-3">
      <section className="card rounded-2xl p-4">
        <p className="-mt-1 mb-2 flex items-center gap-0.5 text-[15px] font-bold">
          학원 정보
          <InfoTip label="문구 저장">
            여기 적은 학원 이름이 학부모님 카톡 맨 앞 [ ] 안에 들어가요. 카톡 문구는 카카오에서 미리 승인받은 내용이라 바꿀 수 없고, 아래에서 어떻게 가는지 미리 볼 수 있어요. 바꾼 뒤 [저장]을 눌러야 적용돼요.
            <TipExample>학원 이름 &lsquo;현샘영수&rsquo; → 카톡 첫 줄 [현샘영수] 공지사항 안내</TipExample>
          </InfoTip>
        </p>
        <Field label="학원 이름 (카톡 맨 앞 이름)" value={w.name} onChange={set("name")} max={20} />
        <p className="mt-1 text-[11px] text-slate-400">학부모님께 가는 카톡 맨 앞 [ ] 안에 들어가요</p>
        <Field
          label="개인과외교습자 신고번호"
          value={w.registrationNo}
          onChange={set("registrationNo")}
          placeholder="예: 제2026-1234호"
          max={40}
        />
        <p className="mt-1 text-[11px] text-slate-400">교습비 영수증 원부(월별 화면에서 인쇄)에 들어가요</p>
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="mt-4 w-full rounded-xl bg-brand py-3 text-[15px] font-semibold text-white disabled:opacity-30"
        >
          {pending ? "저장 중…" : dirty ? "저장" : "저장됨"}
        </button>
        {res && <p className={`mt-2 text-center text-sm ${res.ok ? "text-emerald-600" : "text-rose-600"}`}>{res.message}</p>}
      </section>

      <p className="px-1 pt-2 text-[13px] font-semibold text-slate-500">학부모님 카톡엔 이렇게 가요</p>
      <Preview
        title="등원 알림"
        when="출석을 누르면 바로 가요 (위 스위치를 켠 경우)"
        text={fillTemplate(bodies.attendance, { 학원: name, 이름: SAMPLE.name, 시각: SAMPLE.time })}
        auto="학원 이름·학생 이름·시각은 자동으로 들어가요"
      />
      <Preview
        title="수업 피드백"
        when="출석부에서 ‘피드백 보내기’를 누르면 가요"
        text={fillTemplate(bodies.feedback, { 학원: name, 호칭: `${SAMPLE.name} 학생 학부모님`, 이름: SAMPLE.name, 날짜: SAMPLE.date, 피드백: SAMPLE.memo })}
        auto="그날 쓴 수업 메모가 그대로 들어가요. [피드백 전체 보기] 버튼도 같이 가요. 카톡이 없는 학부모님께는 같은 글이 문자로 가요"
      />
    </div>
  );
}
