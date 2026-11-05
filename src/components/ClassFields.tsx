"use client";

import { useState, type CSSProperties } from "react";
import { CLASS_COLORS, fromMin, hexOfKey, toMin } from "@/lib/class-colors";
import { DAY_LABELS, WEEK_ORDER, parseDays } from "@/lib/templates";

const SEL = "field min-w-0 flex-1 appearance-none rounded-xl border-0 py-2.5 pr-6 pl-2.5 text-[15px] outline-none focus:ring-2 focus:ring-gold";
// 화살표: field 의 background 줄임말이 크기·반복을 덮어써서 전부 style 로
const ARROW: CSSProperties = {
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 8px center",
  backgroundSize: "12px",
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5l3 3 3-3' fill='none' stroke='%2364748b' stroke-width='1.5'/%3E%3C/svg%3E\")",
};
const MINUTES = [0, 10, 20, 30, 40, 50];

/** 시각 고르기: [오전/오후] [시] [분(10분 단위)]. 값은 "15:30", 비면 "" (브라우저 기본 시간 창은 안 씀) */
export function TimeSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const cur = value ? { pm: toMin(value) >= 720, h: Math.floor(toMin(value) / 60) % 12 || 12, m: toMin(value) % 60 } : null;
  // 하나만 골라도 나머지는 흔한 값으로 채움 (오후 3시 00분)
  const set = (p: Partial<{ pm: boolean; h: number; m: number }>) => {
    const n = { pm: true, h: 3, m: 0, ...cur, ...p };
    onChange(fromMin(((n.h % 12) + (n.pm ? 12 : 0)) * 60 + n.m));
  };
  const minutes = cur && !MINUTES.includes(cur.m) ? [...MINUTES, cur.m].sort((a, b) => a - b) : MINUTES; // 예전에 넣은 16:05 같은 값
  return (
    <span className="flex min-w-0 flex-1 gap-1.5">
      <select aria-label={`${label} 오전/오후`} value={cur ? (cur.pm ? "pm" : "am") : ""} onChange={(e) => (e.target.value ? set({ pm: e.target.value === "pm" }) : onChange(""))} className={SEL} style={ARROW}>
        <option value="">--</option>
        <option value="am">오전</option>
        <option value="pm">오후</option>
      </select>
      <select aria-label={`${label} 시`} value={cur?.h ?? ""} onChange={(e) => e.target.value && set({ h: Number(e.target.value) })} className={SEL} style={ARROW}>
        <option value="">시</option>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
          <option key={h} value={h}>
            {h}시
          </option>
        ))}
      </select>
      <select aria-label={`${label} 분`} value={cur?.m ?? ""} onChange={(e) => e.target.value && set({ m: Number(e.target.value) })} className={SEL} style={ARROW}>
        <option value="">분</option>
        {minutes.map((m) => (
          <option key={m} value={m}>
            {String(m).padStart(2, "0")}분
          </option>
        ))}
      </select>
    </span>
  );
}

/** 시작~끝. 시작을 고르면 끝은 1시간 뒤로 저절로 (고칠 수 있음). 폼에는 hidden time·end 로 들어감 */
export function TimeRange({ start = "", end = "" }: { start?: string; end?: string }) {
  const [s, setS] = useState(start);
  const [e, setE] = useState(end);
  return (
    <span className="flex flex-col gap-1.5">
      <input type="hidden" name="time" value={s} />
      <input type="hidden" name="end" value={e} />
      <span className="flex items-center gap-2">
        <span className="w-6 shrink-0 text-[12.5px] text-slate-500">시작</span>
        <TimeSelect
          label="시작"
          value={s}
          onChange={(v) => {
            setS(v);
            setE(v ? fromMin(Math.min(toMin(v) + 60, 23 * 60 + 50)) : "");
          }}
        />
      </span>
      <span className="flex items-center gap-2">
        <span className="w-6 shrink-0 text-[12.5px] text-slate-500">끝</span>
        <TimeSelect label="끝" value={e} onChange={setE} />
      </span>
    </span>
  );
}

const input = "field w-full rounded-xl border-0 px-3 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-gold";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-t border-black/5 py-2.5 first:border-0 first:pt-0">
      <span className="w-9 shrink-0 pt-2.5 text-[13px] font-semibold text-slate-500">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/**
 * 반 입력 칸: 이름 / 요일 / 시간 / 색 — 학생·반 화면과 달력 시간표 설정에서 같이 씀.
 * 요일: 안 고른 날은 테두리만, 고른 날은 이 반 색으로 채움. 색을 안 고르면 autoColor(안 겹치는 색)
 */
export function ClassFields({
  c,
  autoColor,
}: {
  c?: { name: string; days: string; time: string; endTime: string; color: string };
  autoColor: string;
}) {
  const [color, setColor] = useState(c?.color ?? "");
  const [days, setDays] = useState(() => new Set(c ? parseDays(c.days) : []));
  const hex = hexOfKey(color || autoColor);
  const toggle = (d: number) => setDays((prev) => {
    const next = new Set(prev);
    if (next.has(d)) next.delete(d);
    else next.add(d);
    return next;
  });
  return (
    <div>
      <Row label="이름">
        <input name="name" defaultValue={c?.name} placeholder="예: 초등 영어 A" maxLength={30} className={input} />
      </Row>
      <Row label="요일">
        <span className="grid grid-cols-7 gap-1">
          {WEEK_ORDER.map((d) => {
            const on = days.has(d);
            return (
              <label
                key={d}
                style={on ? { background: hex, borderColor: hex, color: "#fff" } : undefined}
                className={`grid h-10 cursor-pointer place-items-center rounded-xl border-[1.5px] text-[14px] font-semibold ${
                  on ? "shadow-sm" : `border-black/12 bg-white/40 hover:bg-white/80 ${d === 0 ? "text-rose-500" : d === 6 ? "text-sky-600" : "text-slate-600"}`
                }`}
              >
                <input type="checkbox" name="days" value={d} checked={on} onChange={() => toggle(d)} className="sr-only" />
                {DAY_LABELS[d]}
              </label>
            );
          })}
        </span>
      </Row>
      <Row label="시간">
        <TimeRange start={c?.time} end={c?.endTime} />
      </Row>
      <Row label="색">
        <span className="flex flex-wrap items-center gap-1.5 pt-1.5">
          {CLASS_COLORS.map((x) => {
            const on = (color || autoColor) === x.key;
            return (
              <label
                key={x.key}
                title={x.label}
                className={`grid size-7 cursor-pointer place-items-center rounded-full transition ${on ? "ring-2 ring-offset-2 ring-offset-white" : "hover:scale-110"}`}
                style={{ background: x.hex, ...(on ? ({ "--tw-ring-color": x.hex } as CSSProperties) : {}) }}
              >
                <input type="radio" name="color" value={x.key} checked={color === x.key} onChange={() => setColor(x.key)} className="sr-only" aria-label={x.label} />
                {on && <span className="size-2.5 rounded-full bg-white" aria-hidden />}
              </label>
            );
          })}
        </span>
        {!color && <span className="mt-1.5 block text-[11.5px] text-slate-400">안 고르면 다른 반과 안 겹치는 색으로 정해져요</span>}
      </Row>
    </div>
  );
}
