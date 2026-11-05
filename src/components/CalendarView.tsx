"use client";

import { useRef, useState, useTransition, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import { CalendarCog, ChevronLeft, ChevronRight, Megaphone, Pencil, Plus, Trash2, Users, Wallet, X } from "lucide-react";
import {
  addCalendarExtra,
  addCalendarMemo,
  addClass,
  deleteCalendarExtra,
  deleteCalendarMemo,
  deleteClass,
  setCalendarCancel,
  updateCalendarMemo,
  updateClass,
  type FormResult,
} from "@/app/actions";
import { formatDateLabel, shiftDate, shiftMonth } from "@/lib/date";
import { DAY_LABELS, formatDays, parseDays, weekdayOf } from "@/lib/templates";
import { classColorKey, nextColor, toMin } from "@/lib/class-colors";
import { ClassFields, TimeRange } from "./ClassFields";
import { Confirm } from "./Confirm";
import { InfoTip, TipExample } from "./InfoTip";

type Cls = { id: string; name: string; days: string; time: string; endTime: string; color: string; hex: string; count: number };
type Change = { id: string; date: string; kind: string; classId: string | null; name: string; start: string; end: string; status?: string }; // kind CONSULT = 상담 (status: NEW·CONFIRMED·PROPOSED)
type Memo = { id: string; date: string; content: string; at: string; edited: boolean };
type Notice = { id: string; date: string; time: string; target: string; count: number; content: string };
type Due = { date: string; name: string };
type Lesson = { id: string; name: string; start: string; end: string; kind: "SLOT" | "EXTRA" | "CONSULT"; canceled: boolean; hex: string; count: number | null; status?: string };

const EXTRA_HEX = "#b08a3e"; // 보강 (반과 상관없는 그날 수업) — 금색
const CONSULT_HEX = "#1e293b"; // 상담 — 짙은 남색 빗금 (반 색 8가지·보강 금색과 안 겹치게, chip 참고)
const input = "w-full rounded-xl border-0 px-3 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-gold field";
const SMALL_BTN = "shrink-0 rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-slate-500 hover:bg-black/5 disabled:opacity-50";
const NAV = "grid size-10 place-items-center rounded-xl text-slate-500 hover:bg-white/60 active:bg-black/5";

/** 그날 수업: 반의 매주 수업(시각 있는 반만, 휴강이면 canceled) + 보강, 시작 시간 순 */
function lessonsOf(date: string, classes: Cls[], changes: Change[]): Lesson[] {
  const w = weekdayOf(date);
  const today = changes.filter((c) => c.date === date);
  const canceled = new Set(today.filter((c) => c.kind === "CANCEL").map((c) => c.classId));
  return [
    ...classes
      .filter((c) => c.time && parseDays(c.days).includes(w))
      .map((c) => ({ id: c.id, name: c.name, start: c.time, end: c.endTime, kind: "SLOT" as const, canceled: canceled.has(c.id), hex: c.hex, count: c.count })),
    ...today
      .filter((c) => c.kind === "EXTRA")
      .map((c) => ({ id: c.id, name: c.name, start: c.start, end: c.end, kind: "EXTRA" as const, canceled: false, hex: EXTRA_HEX, count: null })),
    ...today
      .filter((c) => c.kind === "CONSULT")
      .map((c) => ({ id: c.id, name: c.name, start: c.start, end: c.end, kind: "CONSULT" as const, canceled: false, hex: CONSULT_HEX, count: null, status: c.status })),
  ].sort((a, b) => a.start.localeCompare(b.start));
}

/** 색 칩 모양: 옅은 반 색 바탕 + 왼쪽 진한 줄. 휴강은 회색 + 줄 긋기 */
const chip = (l: Lesson): CSSProperties =>
  l.kind === "CONSULT"
    ? // 상담: 빗금 무늬 + 짙은 남색 줄 (반 색·휴강 회색과 한눈에 구분)
      { background: `repeating-linear-gradient(135deg, ${CONSULT_HEX}12 0 6px, ${CONSULT_HEX}26 6px 12px)`, borderLeft: `3px solid ${CONSULT_HEX}` }
    : l.canceled
    ? { background: "rgb(148 163 184 / 0.16)", borderLeft: "3px solid rgb(148 163 184 / 0.7)" }
    : { background: `${l.hex}1f`, borderLeft: `3px solid ${l.hex}` };

function useForm(submit: (p: FormResult, fd: FormData) => Promise<FormResult>, onOk: (f: HTMLFormElement) => void) {
  const [res, setRes] = useState<FormResult>(null);
  const [pending, start] = useTransition();
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const r = await submit(null, fd);
      setRes(r);
      if (r?.ok) onOk(form);
    });
  }
  return { res, pending, onSubmit };
}

function Result({ r }: { r: FormResult }) {
  if (!r?.message) return null;
  return <p className={`mt-2 text-sm ${r.ok ? "text-emerald-600" : "text-rose-600"}`}>{r.message}</p>;
}

const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일`;

export function CalendarView({
  view,
  from,
  to,
  today,
  initialDate,
  classes,
  changes,
  memos,
  notices,
  dues,
}: {
  view: "month" | "week";
  from: string;
  to: string;
  today: string;
  initialDate?: string;
  classes: Cls[];
  changes: Change[];
  memos: Memo[];
  notices: Notice[];
  dues: Due[];
}) {
  const inRange = today >= from && today <= to;
  const [selected, setSelected] = useState(initialDate ?? (inRange ? today : from));
  const [focus, setFocus] = useState<string | null>(null); // 주간에서 누른 수업
  const [sheet, setSheet] = useState(!!initialDate); // 휴대폰: 날짜·수업 누르면 아래에서 올라오는 창
  const slotDialog = useRef<HTMLDialogElement>(null);
  const month = from.slice(0, 7);
  const [y, m] = month.split("-").map(Number);

  const pick = (date: string, lessonId: string | null = null) => {
    setSelected(date);
    setFocus(lessonId);
    setSheet(true);
  };

  const prev = view === "week" ? `/calendar?view=week&date=${shiftDate(from, -7)}` : `/calendar?month=${shiftMonth(month, -1)}`;
  const next = view === "week" ? `/calendar?view=week&date=${shiftDate(from, 7)}` : `/calendar?month=${shiftMonth(month, 1)}`;
  const title =
    view === "week"
      ? `${md(from)} – ${to.slice(5, 7) === from.slice(5, 7) ? `${Number(to.slice(8))}일` : md(to)}`
      : `${y}년 ${m}월`;
  const seg = (on: boolean) => `rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${on ? "bg-white text-brand shadow-sm" : "text-slate-500 hover:text-brand"}`;

  return (
    <main className="px-3 pt-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        <div className="flex items-center">
          <Link href={prev} aria-label={view === "week" ? "이전 주" : "이전 달"} className={NAV}>
            <ChevronLeft size={20} />
          </Link>
          <p className="min-w-[7.5rem] text-center text-[18px] font-bold tracking-tight tabular-nums md:text-[19px]">{title}</p>
          <Link href={next} aria-label={view === "week" ? "다음 주" : "다음 달"} className={NAV}>
            <ChevronRight size={20} />
          </Link>
          {!inRange && (
            <Link href={view === "week" ? "/calendar?view=week" : "/calendar"} className="surface ml-1 rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-brand">
              오늘
            </Link>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-full bg-black/5 p-1" role="tablist" aria-label="보기">
            <Link href={`/calendar?month=${selected.slice(0, 7)}&date=${selected}`} role="tab" aria-selected={view === "month"} className={seg(view === "month")}>
              월
            </Link>
            <Link href={`/calendar?view=week&date=${selected}`} role="tab" aria-selected={view === "week"} className={seg(view === "week")}>
              주
            </Link>
          </div>
          <button
            type="button"
            onClick={() => slotDialog.current?.showModal()}
            className="flex items-center gap-1 rounded-full bg-brand-soft px-3 py-2 text-[13px] font-semibold text-brand"
          >
            <CalendarCog size={15} /> 시간표 설정
          </button>
        </div>
      </div>

      <div className="mt-2 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-4">
        {view === "week" ? (
          <WeekGrid from={from} today={today} selected={selected} focus={focus} classes={classes} changes={changes} memos={memos} dues={dues} onPick={pick} />
        ) : (
          <MonthGrid month={month} today={today} selected={selected} classes={classes} changes={changes} memos={memos} notices={notices} dues={dues} onPick={pick} />
        )}

        {/* 휴대폰: 아래에서 올라오는 창 / PC: 오른쪽 패널 */}
        {sheet && <div className="fixed inset-0 z-30 bg-[#0c281e]/30 lg:hidden" onClick={() => setSheet(false)} aria-hidden />}
        <aside
          className={`glass fixed inset-x-0 bottom-0 z-40 mx-auto max-h-[78dvh] max-w-md overflow-y-auto rounded-t-[24px] pb-[env(safe-area-inset-bottom)] lg:sticky lg:top-20 lg:z-auto lg:mx-0 lg:block lg:max-h-[calc(100dvh-6rem)] lg:max-w-none lg:rounded-2xl ${
            sheet ? "" : "hidden"
          }`}
        >
          <DayPanel
            key={selected}
            date={selected}
            focus={focus}
            lessons={lessonsOf(selected, classes, changes)}
            memos={memos.filter((x) => x.date === selected)}
            notices={notices.filter((x) => x.date === selected)}
            dues={dues.filter((x) => x.date === selected)}
            onClose={() => setSheet(false)}
          />
        </aside>
      </div>

      <SlotDialog dialog={slotDialog} classes={classes} />
    </main>
  );
}

const MAX_BARS = 3;

/** 월 달력: 칸마다 "15:00 초등반" 색 막대(3개까지, 넘으면 "+2개 더"), 납부, 메모 점 */
function MonthGrid({
  month,
  today,
  selected,
  classes,
  changes,
  memos,
  notices,
  dues,
  onPick,
}: {
  month: string;
  today: string;
  selected: string;
  classes: Cls[];
  changes: Change[];
  memos: Memo[];
  notices: Notice[];
  dues: Due[];
  onPick: (date: string) => void;
}) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);

  return (
    <section className="card overflow-hidden rounded-2xl">
      <div className="grid grid-cols-7 border-b border-black/5 py-1.5 text-center text-[11.5px] font-semibold">
        {DAY_LABELS.map((d, i) => (
          <span key={d} className={i === 0 ? "text-rose-500" : i === 6 ? "text-sky-600" : "text-slate-500"}>
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((date, i) => {
          const edge = `${i % 7 ? "border-l" : ""} ${i >= 7 ? "border-t" : ""} border-black/5`;
          if (!date) return <span key={`b${i}`} className={`${edge} bg-black/[0.015]`} />;
          const lessons = lessonsOf(date, classes, changes);
          const due = dues.filter((x) => x.date === date);
          const memo = memos.some((x) => x.date === date);
          const sent = notices.some((x) => x.date === date);
          const w = i % 7;
          return (
            <button
              key={date}
              type="button"
              onClick={() => onPick(date)}
              aria-label={`${Number(date.slice(8))}일${lessons.length ? ` 수업 ${lessons.filter((l) => !l.canceled).length}` : ""}`}
              className={`relative flex min-h-[86px] min-w-0 flex-col gap-[3px] p-1 text-left transition md:min-h-[116px] md:p-1.5 ${edge} ${
                date === selected ? "bg-white/75 shadow-[inset_0_0_0_2px_var(--color-gold)]" : "hover:bg-white/50"
              }`}
            >
              <span className="flex items-center gap-1">
                <span
                  className={`grid size-6 shrink-0 place-items-center rounded-full text-[12.5px] font-semibold tabular-nums ${
                    date === today ? "bg-brand text-white" : w === 0 ? "text-rose-500" : w === 6 ? "text-sky-600" : "text-slate-700"
                  }`}
                >
                  {Number(date.slice(8))}
                </span>
                {sent && <Megaphone size={11} className="text-brand/70" aria-label="공지 보냄" />}
              </span>
              {memo && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-gold" aria-label="메모" />}
              {lessons.slice(0, MAX_BARS).map((l) => (
                <span
                  key={l.id}
                  style={chip(l)}
                  className={`block truncate rounded-[5px] px-1 py-px text-[10px] leading-[15px] md:text-[11.5px] md:leading-[17px] ${
                    l.canceled ? "text-slate-400 line-through" : "font-medium text-slate-800"
                  }`}
                >
                  <span className="hidden tabular-nums md:inline">{l.start} </span>
                  {l.name}
                </span>
              ))}
              {lessons.length > MAX_BARS && <span className="px-1 text-[10px] font-medium text-slate-500 md:text-[11px]">+{lessons.length - MAX_BARS}개 더</span>}
              {due.length > 0 && (
                <span className="truncate px-0.5 text-[10px] font-medium text-rose-500 md:text-[11px]">
                  납부 {due.length === 1 ? due[0].name : `${due.length}명`}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** 겹치는 수업끼리만 옆으로 나란히: 수업마다 [몇 번째 줄, 그 묶음의 줄 수]. 안 겹치는 수업은 칸 전체 폭 */
function lanes(list: Lesson[]) {
  const span = (l: Lesson) => [toMin(l.start), l.end ? toMin(l.end) : toMin(l.start) + 60];
  const out: { lane: number; n: number }[] = [];
  let group: number[] = []; // 지금 겹치는 묶음 (list 번호)
  let ends: number[] = [];
  let groupEnd = -1;
  const close = () => group.forEach((i) => (out[i].n = ends.length));
  list.forEach((l, i) => {
    const [s, e] = span(l);
    if (s >= groupEnd) {
      close();
      group = [];
      ends = [];
    }
    let lane = ends.findIndex((x) => x <= s);
    if (lane < 0) lane = ends.push(0) - 1;
    ends[lane] = e;
    out[i] = { lane, n: 1 };
    group.push(i);
    groupEnd = Math.max(groupEnd, e);
  });
  close();
  return out;
}

/** 주간: 왼쪽 시간 줄(오후 1시~밤 10시, 수업 따라 늘어남) + 요일별 색 블록 (반 이름·시간·학생 수) */
function WeekGrid({
  from,
  today,
  selected,
  focus,
  classes,
  changes,
  memos,
  dues,
  onPick,
}: {
  from: string;
  today: string;
  selected: string;
  focus: string | null;
  classes: Cls[];
  changes: Change[];
  memos: Memo[];
  dues: Due[];
  onPick: (date: string, lessonId?: string | null) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(from, i));
  const byDay = days.map((d) => lessonsOf(d, classes, changes));
  const all = byDay.flat();
  const startH = Math.min(13, ...all.map((l) => Math.floor(toMin(l.start) / 60)));
  const endH = Math.max(22, ...all.map((l) => Math.ceil((l.end ? toMin(l.end) : toMin(l.start) + 60) / 60)));
  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i);
  const PPH = 52; // 1시간 높이(px)
  const hourLabel = (h: number) => `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}시`;

  return (
    <section className="card overflow-hidden rounded-2xl">
      {/* 요일 머리 */}
      <div className="grid grid-cols-[34px_repeat(7,minmax(0,1fr))] border-b border-black/5 md:grid-cols-[56px_repeat(7,minmax(0,1fr))]">
        <span />
        {days.map((d, i) => {
          const due = dues.filter((x) => x.date === d).length;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onPick(d)}
              className={`relative flex flex-col items-center gap-0.5 border-l border-black/5 py-1.5 transition hover:bg-white/50 ${d === selected ? "bg-white/70" : ""}`}
            >
              <span className={`text-[11px] font-semibold ${i === 0 ? "text-rose-500" : i === 6 ? "text-sky-600" : "text-slate-500"}`}>{DAY_LABELS[i]}</span>
              <span className={`grid size-7 place-items-center rounded-full text-[14px] font-bold tabular-nums ${d === today ? "bg-brand text-white" : "text-slate-700"}`}>
                {Number(d.slice(8))}
              </span>
              {memos.some((x) => x.date === d) && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-gold" aria-label="메모" />}
              {due > 0 && <span className="text-[9.5px] leading-none font-medium text-rose-500 md:text-[10.5px]">납부 {due}</span>}
            </button>
          );
        })}
      </div>

      {/* 시간 줄 + 블록 */}
      <div className="grid max-h-[calc(100dvh-15rem)] grid-cols-[34px_repeat(7,minmax(0,1fr))] overflow-y-auto md:max-h-[calc(100dvh-13rem)] md:grid-cols-[56px_repeat(7,minmax(0,1fr))]">
        <div className="relative" style={{ height: hours.length * PPH }}>
          {hours.map((h, i) => (
            <span key={h} className="absolute right-1 -translate-y-1/2 text-[9.5px] text-slate-400 tabular-nums md:right-2 md:text-[11px]" style={{ top: i * PPH }}>
              {i > 0 && (
                <>
                  <span className="hidden md:inline">{hourLabel(h)}</span>
                  <span className="md:hidden">{h % 12 || 12}시</span>
                </>
              )}
            </span>
          ))}
        </div>
        {days.map((d, di) => {
          const list = byDay[di];
          const lane = lanes(list);
          return (
            <div
              key={d}
              onClick={(e) => e.target === e.currentTarget && onPick(d)}
              className={`relative border-l border-black/5 ${d === today ? "bg-brand/[0.035]" : ""}`}
              style={{
                height: hours.length * PPH,
                backgroundImage: "linear-gradient(to bottom, rgb(12 40 30 / 0.07) 1px, transparent 1px)",
                backgroundSize: `100% ${PPH}px`,
              }}
            >
              {list.map((l, i) => {
                const s = toMin(l.start);
                const e = l.end ? toMin(l.end) : s + 60;
                const top = ((s - startH * 60) / 60) * PPH;
                const height = Math.max(((e - s) / 60) * PPH - 2, 20);
                const on = focus === l.id && d === selected;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => onPick(d, l.id)}
                    className={`absolute overflow-hidden rounded-md px-1 py-0.5 text-left text-[10px] leading-tight transition hover:brightness-95 md:rounded-lg md:px-1.5 md:py-1 md:text-[11.5px] ${
                      l.canceled ? "text-slate-400" : "text-slate-800"
                    } ${on ? "z-10 shadow-[0_0_0_2px_var(--color-gold)]" : ""}`}
                    style={{
                      top: top + 1,
                      height,
                      left: `calc(${(lane[i].lane / lane[i].n) * 100}% + 2px)`,
                      width: `calc(${100 / lane[i].n}% - 4px)`,
                      ...chip(l),
                      ...(l.canceled || l.kind === "CONSULT" ? {} : { background: `${l.hex}2e` }),
                    }}
                  >
                    <span className={`block truncate font-semibold ${l.canceled ? "line-through" : ""}`}>{l.name}</span>
                    <span className="block truncate tabular-nums opacity-80">
                      {l.start}
                      {l.end && <span className="hidden md:inline">–{l.end}</span>}
                    </span>
                    {l.canceled ? (
                      <span className="block truncate font-semibold">휴강</span>
                    ) : l.kind === "EXTRA" ? (
                      <span className="block truncate opacity-80">보강</span>
                    ) : l.kind === "CONSULT" ? (
                      <span className="block truncate opacity-80">{l.status === "NEW" ? "새 신청" : l.status === "PROPOSED" ? "제안함" : "확정"}</span>
                    ) : (
                      <span className="hidden truncate opacity-80 md:block">학생 {l.count}명</span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DayPanel({
  date,
  focus,
  lessons,
  memos,
  notices,
  dues,
  onClose,
}: {
  date: string;
  focus: string | null;
  lessons: Lesson[];
  memos: Memo[];
  notices: Notice[];
  dues: Due[];
  onClose: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const extra = useForm(addCalendarExtra, () => setAdding(false));

  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-[17px] font-bold tracking-tight">{formatDateLabel(date)}</p>
        <button type="button" onClick={onClose} aria-label="닫기" className="grid size-9 place-items-center rounded-full text-slate-500 hover:bg-white/70 lg:hidden">
          <X size={18} />
        </button>
      </div>

      <h3 className="mt-3 text-[12px] font-semibold text-slate-500">수업</h3>
      {lessons.length === 0 ? (
        <p className="mt-1 text-[13.5px] text-slate-400">수업 없음</p>
      ) : (
        <ul className="mt-1 space-y-1.5">
          {lessons.map((l) => (
            <li
              key={l.id}
              style={chip(l)}
              className={`flex items-center gap-2 rounded-xl py-2 pr-2 pl-3 ${focus === l.id ? "shadow-[0_0_0_2px_var(--color-gold)]" : ""}`}
            >
              <span className={`min-w-0 flex-1 ${l.canceled ? "text-slate-400 line-through" : ""}`}>
                <span className="block truncate text-[14.5px] font-semibold">{l.name}</span>
                <span className="flex items-center gap-1.5 text-[12px] text-slate-500 tabular-nums">
                  {l.start}
                  {l.end && `~${l.end}`}
                  {l.count !== null && (
                    <span className="flex items-center gap-0.5">
                      · <Users size={11} /> {l.count}명
                    </span>
                  )}
                </span>
              </span>
              {l.kind === "EXTRA" && <span className="rounded-md bg-gold-soft px-1.5 py-0.5 text-[11px] font-semibold text-[#8a6d35]">보강</span>}
              {l.kind === "CONSULT" && l.status === "NEW" && <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-600">새 신청</span>}
              {l.kind === "CONSULT" && l.status === "PROPOSED" && <span className="rounded-md bg-white/70 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">제안함</span>}
              {l.canceled && <span className="rounded-md bg-white/70 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">휴강</span>}
              {l.kind === "CONSULT" ? (
                <Link href="/consult" className="shrink-0 rounded-lg bg-white/70 px-2.5 py-1.5 text-[12.5px] font-semibold text-slate-600 hover:bg-white">
                  보기
                </Link>
              ) : l.kind === "SLOT" ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => start(() => setCalendarCancel(l.id, date, !l.canceled))}
                  className="shrink-0 rounded-lg bg-white/70 px-2.5 py-1.5 text-[12.5px] font-semibold text-slate-600 hover:bg-white disabled:opacity-50"
                >
                  {l.canceled ? "휴강 취소" : "휴강"}
                </button>
              ) : (
                <button type="button" disabled={pending} onClick={() => start(() => deleteCalendarExtra(l.id))} className={SMALL_BTN} aria-label="보강 지우기">
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form onSubmit={extra.onSubmit} className="mt-2 space-y-2 rounded-xl bg-white/50 p-3">
          <input type="hidden" name="date" value={date} />
          <input name="name" placeholder="수업 이름 (예: 중등 보강)" maxLength={30} className={input} />
          <TimeRange />
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setAdding(false)} className="surface flex-1 rounded-xl py-2.5 text-[14px] font-medium text-slate-600">
              취소
            </button>
            <button disabled={extra.pending} className="flex-1 rounded-xl bg-brand py-2.5 text-[14px] font-semibold text-white disabled:opacity-60">
              보강 넣기
            </button>
          </div>
          <Result r={extra.res} />
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="surface mt-2 flex w-full items-center justify-center gap-1 rounded-xl py-2.5 text-[13.5px] font-semibold text-brand">
          <Plus size={15} /> 보강 추가
        </button>
      )}

      {dues.length > 0 && (
        <>
          <h3 className="mt-4 text-[12px] font-semibold text-slate-500">납부일</h3>
          <ul className="mt-1 space-y-0.5 text-[14px]">
            {dues.map((d, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <Wallet size={13} className="text-rose-500" /> 납부일 · {d.name}
              </li>
            ))}
          </ul>
        </>
      )}

      {notices.length > 0 && (
        <>
          <h3 className="mt-4 text-[12px] font-semibold text-slate-500">보낸 공지</h3>
          <ul className="mt-1 space-y-1">
            {notices.map((n) => (
              <li key={n.id}>
                <details className="surface rounded-xl px-3 py-2">
                  <summary className="cursor-pointer text-[13.5px]">
                    <span className="font-semibold text-brand">{n.target}</span> · {n.time} · {n.count}명
                  </summary>
                  <p className="mt-1.5 text-[13.5px] whitespace-pre-wrap text-slate-700">{n.content}</p>
                </details>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="mt-4 flex items-center gap-0.5 text-[12px] font-semibold text-slate-500">
        메모
        <InfoTip label="달력 메모">
          그날 할 일을 적어 두세요. 쓰고 엔터를 누르면 차례로 쌓이고, 메모가 있는 날은 달력 칸 오른쪽 위에 작은 점이 찍혀요. [공지 쓰기]를 누르면 메모 내용이 공지 칸에 들어가요.
          <TipExample>&lsquo;다음 주 휴원 공지 보내기&rsquo; → [공지 쓰기]로 바로 공지 화면</TipExample>
        </InfoTip>
      </h3>
      <ul className="mt-1 space-y-1">
        {memos.map((x) => (
          <MemoItem key={x.id} memo={x} />
        ))}
      </ul>
      <MemoInput date={date} />
    </div>
  );
}

function MemoInput({ date }: { date: string }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || pending) return;
    start(async () => {
      const r = await addCalendarMemo(date, text);
      if (r?.ok) setText("");
      setErr(r?.ok ? "" : (r?.message ?? ""));
    });
  }
  return (
    <form onSubmit={submit} className="mt-2">
      <div className="flex gap-1.5">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="메모 쓰고 엔터 (예: 공지 보내는 날)" className={input} />
        <button disabled={pending || !text.trim()} className="shrink-0 rounded-xl bg-brand px-3.5 text-[14px] font-semibold text-white disabled:opacity-50">
          등록
        </button>
      </div>
      {err && <p className="mt-1 text-sm text-rose-600">{err}</p>}
    </form>
  );
}

function MemoItem({ memo }: { memo: Memo }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(memo.content);
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();

  function save(e: FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await updateCalendarMemo(memo.id, text);
      if (r?.ok) setEditing(false);
    });
  }

  return (
    <li className="surface rounded-xl px-3 py-2">
      {editing ? (
        <form onSubmit={save} className="flex gap-1.5">
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
            maxLength={500}
            className={input}
          />
          <button disabled={pending || !text.trim()} className="shrink-0 rounded-xl bg-brand px-3 text-[13.5px] font-semibold text-white disabled:opacity-50">
            저장
          </button>
        </form>
      ) : (
        <p className="text-[14px] break-words whitespace-pre-wrap">{memo.content}</p>
      )}
      <div className="mt-1 flex items-center gap-0.5 text-[11.5px] text-slate-400">
        <span className="mr-auto tabular-nums">
          {memo.at}
          {memo.edited && " · 수정됨"}
        </span>
        <Link href={`/notice?memo=${memo.id}`} className={`${SMALL_BTN} flex items-center gap-0.5 text-brand`}>
          <Megaphone size={13} /> 공지 쓰기
        </Link>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className={SMALL_BTN} aria-label="메모 수정">
            <Pencil size={13} />
          </button>
        )}
        <button type="button" onClick={() => setAsking(true)} className={SMALL_BTN} aria-label="메모 삭제">
          <Trash2 size={13} />
        </button>
      </div>
      <Confirm
        open={asking}
        title="메모를 지울까요?"
        ok="지우기"
        danger
        onCancel={() => setAsking(false)}
        onOk={() => {
          setAsking(false);
          start(() => deleteCalendarMemo(memo.id));
        }}
      />
    </li>
  );
}

/** 시간표 설정 = 반 목록. 여기서 넣거나 고치면 반으로 저장된다 (학생·반 화면과 같은 데이터) */
function SlotDialog({ dialog, classes }: { dialog: React.RefObject<HTMLDialogElement | null>; classes: Cls[] }) {
  const [editing, setEditing] = useState<Cls | null>(null);
  const [removing, setRemoving] = useState<Cls | null>(null);
  const [n, setN] = useState(0); // 넣고 나면 칸을 새로
  const [, start] = useTransition();
  const form = useForm(
    (p, fd) => (fd.get("id") ? updateClass(p, fd) : addClass(p, fd)),
    () => {
      setEditing(null);
      setN((x) => x + 1);
    },
  );
  const close = () => dialog.current?.close();
  const autoColor = nextColor(classes.map(classColorKey));

  return (
    <dialog
      ref={dialog}
      onClick={(e) => e.target === e.currentTarget && close()}
      className="glass m-auto w-[min(94vw,480px)] rounded-[24px] p-0 text-[#1c2230] backdrop:bg-[#0c281e]/35 backdrop:backdrop-blur-[3px]"
    >
      <div className="max-h-[88dvh] overflow-y-auto p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="flex items-center gap-0.5 text-[18px] font-bold tracking-tight">
              시간표 설정
              <InfoTip label="시간표">
                시간표는 반 목록과 같아요. 요일과 시각을 적은 반은 달력의 그 요일에 반 색으로 매주 나와요. 그날만 쉬거나 더 하는 날은 달력에서 날짜를 눌러 [휴강]·[보강 추가]를 쓰세요.
                <TipExample>월·수·금 15:00~17:00 초등반 → 매주 월·수·금 칸에 &lsquo;15:00 초등반&rsquo;</TipExample>
              </InfoTip>
            </p>
            <p className="mt-0.5 text-[12.5px] text-slate-500">반 목록과 같아요. 요일·시각이 있는 반은 달력에 매주 보여요</p>
          </div>
          <button type="button" onClick={close} aria-label="닫기" className="-mt-1 -mr-1 grid size-9 place-items-center rounded-full text-slate-500 hover:bg-white/70">
            <X size={18} />
          </button>
        </div>

        {classes.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {classes.map((c) => (
              <li
                key={c.id}
                style={{ background: `${c.hex}14`, borderLeft: `3px solid ${c.hex}` }}
                className={`flex items-center gap-2 rounded-xl py-2 pr-2 pl-3 ${editing?.id === c.id ? "shadow-[0_0_0_2px_var(--color-gold)]" : ""}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold">{c.name}</span>
                  <span className="block text-[12px] text-slate-500 tabular-nums">
                    {formatDays(c.days)} {c.time ? `${c.time}${c.endTime ? `~${c.endTime}` : ""}` : "· 시각 없음 (달력에 안 나와요)"}
                  </span>
                </span>
                <button type="button" onClick={() => setEditing(c)} className={SMALL_BTN}>
                  수정
                </button>
                <button type="button" onClick={() => setRemoving(c)} className={SMALL_BTN}>
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}

        <form key={editing?.id ?? `new${n}`} onSubmit={form.onSubmit} className="mt-3 rounded-2xl bg-white/50 p-3.5">
          <p className="mb-3 text-[14px] font-semibold">{editing ? `${editing.name} 수정` : "수업 넣기 (반으로 저장돼요)"}</p>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <ClassFields c={editing ? { ...editing, color: classColorKey(editing) } : undefined} autoColor={editing ? classColorKey(editing) : autoColor} />
          <div className="mt-3 flex gap-2">
            {editing && (
              <button type="button" onClick={() => setEditing(null)} className="surface flex-1 rounded-xl py-2.5 text-[14px] font-medium text-slate-600">
                취소
              </button>
            )}
            <button disabled={form.pending} className="flex-1 rounded-xl bg-brand py-2.5 text-[14px] font-semibold text-white disabled:opacity-60">
              {editing ? "저장" : "넣기"}
            </button>
          </div>
          <Result r={form.res} />
        </form>
      </div>
      <Confirm
        open={!!removing}
        title={`${removing?.name ?? ""} 반을 지울까요?`}
        body="학생과 출결 기록은 그대로 남고, 반 배정과 달력의 매주 표시가 사라져요."
        ok="지우기"
        danger
        onCancel={() => setRemoving(null)}
        onOk={() => {
          const c = removing!;
          setRemoving(null);
          if (editing?.id === c.id) setEditing(null);
          start(() => deleteClass(c.id));
        }}
      />
    </dialog>
  );
}
