"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { CalendarCog, ChevronLeft, ChevronRight, Megaphone, Pencil, Plus, Trash2, Wallet, X } from "lucide-react";
import {
  addCalendarExtra,
  addCalendarMemo,
  deleteCalendarExtra,
  deleteCalendarMemo,
  deleteClass,
  addClass,
  setCalendarCancel,
  updateClass,
  updateCalendarMemo,
  type FormResult,
} from "@/app/actions";
import { formatDateLabel, shiftMonth } from "@/lib/date";
import { DAY_LABELS, WEEK_ORDER, formatDays, parseDays } from "@/lib/templates";
import { Confirm } from "./Confirm";

type Cls = { id: string; name: string; days: string; time: string; endTime: string };
type Change = { id: string; date: string; kind: string; classId: string | null; name: string; start: string; end: string };
type Memo = { id: string; date: string; content: string; at: string; edited: boolean };
type Notice = { id: string; date: string; time: string; target: string; count: number; content: string };
type Due = { date: string; name: string };

const input = "w-full rounded-xl border-0 px-3 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-gold field";
const SMALL_BTN = "shrink-0 rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-slate-500 hover:bg-black/5 disabled:opacity-50";

/** 그날 수업: 반의 매주 수업(시각 있는 반만, 휴강이면 canceled) + 보강, 시작 시간 순 */
function lessonsOf(date: string, classes: Cls[], changes: Change[]) {
  const [y, m, d] = date.split("-").map(Number);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const today = changes.filter((c) => c.date === date);
  const canceled = new Set(today.filter((c) => c.kind === "CANCEL").map((c) => c.classId));
  return [
    ...classes
      .filter((c) => c.time && parseDays(c.days).includes(w))
      .map((c) => ({ id: c.id, name: c.name, start: c.time, end: c.endTime, kind: "SLOT" as const, canceled: canceled.has(c.id) })),
    ...today.filter((c) => c.kind === "EXTRA").map((c) => ({ ...c, kind: "EXTRA" as const, canceled: false })),
  ].sort((a, b) => a.start.localeCompare(b.start));
}

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

function TimeFields({ s }: { s?: { name: string; start: string; end: string } }) {
  return (
    <>
      <input name="name" defaultValue={s?.name} placeholder="수업 이름 (예: 초등반)" maxLength={30} className={input} />
      <div className="mt-2 flex items-center gap-2">
        <input name="time" type="time" required defaultValue={s?.start} aria-label="시작 시간" className={input} />
        <span className="text-slate-400">~</span>
        <input name="end" type="time" defaultValue={s?.end} aria-label="끝 시간" className={input} />
      </div>
    </>
  );
}

export function CalendarView({
  month,
  today,
  initialDate,
  classes,
  changes,
  memos,
  notices,
  dues,
}: {
  month: string;
  today: string;
  initialDate?: string;
  classes: Cls[];
  changes: Change[];
  memos: Memo[];
  notices: Notice[];
  dues: Due[];
}) {
  const [y, m] = month.split("-").map(Number);
  const [selected, setSelected] = useState(initialDate ?? (today.startsWith(month) ? today : `${month}-01`));
  const [sheet, setSheet] = useState(!!initialDate); // 휴대폰: 날짜 누르면 아래에서 올라오는 창
  const slotDialog = useRef<HTMLDialogElement>(null);

  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];

  return (
    <main className="px-3 pt-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center">
          <Link href={`/calendar?month=${shiftMonth(month, -1)}`} aria-label="이전 달" className="grid size-11 place-items-center rounded-xl text-slate-500 active:bg-black/5">
            <ChevronLeft size={20} />
          </Link>
          <p className="text-[19px] font-bold tracking-tight">
            {y}년 {m}월
          </p>
          <Link href={`/calendar?month=${shiftMonth(month, 1)}`} aria-label="다음 달" className="grid size-11 place-items-center rounded-xl text-slate-500 active:bg-black/5">
            <ChevronRight size={20} />
          </Link>
          {!today.startsWith(month) && (
            <Link href="/calendar" className="surface ml-1 rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-brand">
              오늘
            </Link>
          )}
        </div>
        <button
          type="button"
          onClick={() => slotDialog.current?.showModal()}
          className="flex items-center gap-1 rounded-xl bg-brand-soft px-3 py-2 text-[13px] font-semibold text-brand"
        >
          <CalendarCog size={15} /> 시간표 설정
        </button>
      </div>

      <div className="mt-2 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-4">
        <section className="card rounded-2xl p-2">
          <div className="grid grid-cols-7 pb-1 text-center text-[11px] font-semibold">
            {DAY_LABELS.map((d, i) => (
              <span key={d} className={i === 0 ? "text-rose-400" : i === 6 ? "text-sky-500" : "text-slate-400"}>
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((date, i) => {
              if (!date) return <span key={`b${i}`} />;
              const lessons = lessonsOf(date, classes, changes).filter((l) => !l.canceled).length;
              const memo = memos.some((x) => x.date === date);
              const sentN = notices.filter((x) => x.date === date).length;
              const dueN = dues.filter((x) => x.date === date).length;
              const w = i % 7;
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => {
                    setSelected(date);
                    setSheet(true);
                  }}
                  className={`flex min-h-[68px] flex-col items-start gap-0.5 rounded-xl p-1 text-left transition md:min-h-[92px] md:p-1.5 ${
                    date === selected ? "bg-white/80 ring-2 ring-gold" : "hover:bg-white/60"
                  }`}
                >
                  <span
                    className={`grid size-6 place-items-center rounded-full text-[13px] font-semibold tabular-nums ${
                      date === today ? "bg-brand text-white" : w === 0 ? "text-rose-400" : w === 6 ? "text-sky-500" : "text-slate-700"
                    }`}
                  >
                    {Number(date.slice(8))}
                  </span>
                  {lessons > 0 && (
                    <span className="rounded-md bg-brand-soft px-1 text-[10.5px] font-semibold text-brand md:text-[11.5px]">
                      <span className="hidden md:inline">수업 </span>
                      {lessons}
                    </span>
                  )}
                  <span className="flex flex-wrap items-center gap-x-1 text-[10.5px] text-slate-500 md:text-[11.5px]">
                    {memo && <span className="size-1.5 rounded-full bg-gold" aria-label="메모" />}
                    {sentN > 0 && (
                      <span className="flex items-center gap-0.5 text-brand">
                        <Megaphone size={11} />
                        <span className="hidden md:inline">공지 {sentN}건</span>
                      </span>
                    )}
                    {dueN > 0 && (
                      <span className="flex items-center gap-0.5 text-rose-500">
                        <Wallet size={11} />
                        <span className="hidden md:inline">납부 {dueN}</span>
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

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

function DayPanel({
  date,
  lessons,
  memos,
  notices,
  dues,
  onClose,
}: {
  date: string;
  lessons: ReturnType<typeof lessonsOf>;
  memos: Memo[];
  notices: Notice[];
  dues: Due[];
  onClose: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const extra = useForm(addCalendarExtra, (f) => {
    f.reset();
    setAdding(false);
  });

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
        <ul className="mt-1 space-y-1">
          {lessons.map((l) => (
            <li key={l.id} className="surface flex items-center gap-2 rounded-xl px-3 py-2">
              <span className={`min-w-0 flex-1 ${l.canceled ? "text-slate-400 line-through" : ""}`}>
                <span className="block truncate text-[14.5px] font-semibold">{l.name}</span>
                <span className="block text-[12px] text-slate-500 tabular-nums">
                  {l.start}
                  {l.end && `~${l.end}`}
                </span>
              </span>
              {l.kind === "EXTRA" && <span className="rounded-md bg-gold-soft px-1.5 py-0.5 text-[11px] font-semibold text-[#8a6d35]">보강</span>}
              {l.canceled && <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-500">휴강</span>}
              {l.kind === "SLOT" ? (
                <button type="button" disabled={pending} onClick={() => start(() => setCalendarCancel(l.id, date, !l.canceled))} className={SMALL_BTN}>
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
        <form onSubmit={extra.onSubmit} className="mt-2 rounded-xl bg-white/50 p-3">
          <input type="hidden" name="date" value={date} />
          <TimeFields />
          <div className="mt-2 flex gap-2">
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

      <h3 className="mt-4 text-[12px] font-semibold text-slate-500">메모</h3>
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
  const [, start] = useTransition();
  const form = useForm(
    (p, fd) => (fd.get("id") ? updateClass(p, fd) : addClass(p, fd)),
    (f) => {
      f.reset();
      setEditing(null);
    },
  );
  const close = () => dialog.current?.close();

  return (
    <dialog
      ref={dialog}
      onClick={(e) => e.target === e.currentTarget && close()}
      className="glass m-auto w-[min(92vw,460px)] rounded-[24px] p-0 text-[#1c2230] backdrop:bg-[#0c281e]/35 backdrop:backdrop-blur-[3px]"
    >
      <div className="max-h-[85dvh] overflow-y-auto p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[18px] font-bold tracking-tight">시간표 설정</p>
            <p className="mt-0.5 text-[12.5px] text-slate-500">반 목록과 같아요. 요일·시각이 있는 반은 달력에 매주 보여요</p>
          </div>
          <button type="button" onClick={close} aria-label="닫기" className="-mt-1 -mr-1 grid size-9 place-items-center rounded-full text-slate-500 hover:bg-white/70">
            <X size={18} />
          </button>
        </div>

        {classes.length > 0 && (
          <ul className="mt-3 space-y-1">
            {classes.map((c) => (
              <li key={c.id} className={`surface flex items-center gap-2 rounded-xl px-3 py-2 ${editing?.id === c.id ? "ring-2 ring-gold" : ""}`}>
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

        <form key={editing?.id ?? "new"} onSubmit={form.onSubmit} className="mt-3 rounded-2xl bg-white/50 p-3">
          <p className="mb-2 text-[14px] font-semibold">{editing ? `${editing.name} 수정` : "수업 넣기 (반으로 저장돼요)"}</p>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <TimeFields s={editing ? { name: editing.name, start: editing.time, end: editing.endTime } : undefined} />
          <div className="mt-2 grid grid-cols-7 gap-1">
            {WEEK_ORDER.map((d) => (
              <label
                key={d}
                className={`cursor-pointer rounded-lg py-2 text-center text-[14px] font-semibold has-checked:bg-brand has-checked:text-white ${
                  d === 0 ? "bg-rose-50 text-rose-400" : d === 6 ? "bg-sky-50 text-sky-500" : "bg-slate-100 text-slate-500"
                }`}
              >
                <input type="checkbox" name="days" value={d} defaultChecked={editing ? parseDays(editing.days).includes(d) : false} className="sr-only" />
                {DAY_LABELS[d]}
              </label>
            ))}
          </div>
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
