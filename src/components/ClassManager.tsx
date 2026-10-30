"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Clock, Pencil, Plus, Trash2, X } from "lucide-react";
import { addClass, deleteClass, updateClass, type FormResult } from "@/app/actions";
import { DAY_LABELS, WEEK_ORDER, formatDays, parseDays } from "@/lib/templates";
import { PageTitle } from "./PageTitle";

type C = { id: string; name: string; days: string; time: string; count: number };

const input =
  "w-full rounded-xl border-0 bg-slate-50 px-3 py-3 text-[15px] ring-1 ring-black/5 outline-none focus:bg-white focus:ring-2 focus:ring-gold";

function ClassFields({ c }: { c?: C }) {
  const days = new Set(c ? parseDays(c.days) : []);
  return (
    <>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input name="name" defaultValue={c?.name} placeholder="반 이름 (예: 초등 영어 A)" className={input} />
        <input name="time" type="time" defaultValue={c?.time} aria-label="시작 시각" className={`${input} w-[120px]`} />
      </div>
      <p className="mt-3 mb-1.5 text-[12px] font-semibold text-slate-500">수업 요일</p>
      <div className="grid grid-cols-7 gap-1">
        {WEEK_ORDER.map((d) => (
          <label
            key={d}
            className={`cursor-pointer rounded-lg py-2 text-center text-[14px] font-semibold has-checked:bg-brand has-checked:text-white ${
              d === 0 ? "bg-rose-50 text-rose-400" : d === 6 ? "bg-sky-50 text-sky-500" : "bg-slate-100 text-slate-500"
            }`}
          >
            <input type="checkbox" name="days" value={d} defaultChecked={days.has(d)} className="sr-only" />
            {DAY_LABELS[d]}
          </label>
        ))}
      </div>
    </>
  );
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
  if (!r) return null;
  return <p className={`mt-2 text-sm ${r.ok ? "text-emerald-600" : "text-rose-600"}`}>{r.message}</p>;
}

// onClose 없으면 닫기 버튼 없음 (PC 오른쪽에 늘 떠 있는 폼)
function AddClassForm({ onClose }: { onClose?: () => void }) {
  const { res, pending, onSubmit } = useForm(addClass, (f) => f.reset());
  return (
    <form onSubmit={onSubmit} className="mb-3 rounded-2xl bg-white p-4 ring-2 ring-gold/60">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[15px] font-semibold">새 반</p>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="닫기" className="text-slate-400">
            <X size={20} />
          </button>
        )}
      </div>
      <ClassFields />
      <button disabled={pending} className="mt-3 w-full rounded-xl bg-brand py-3 text-[15px] font-semibold text-white disabled:opacity-60">
        {pending ? "만드는 중…" : "반 만들기"}
      </button>
      <Result r={res} />
    </form>
  );
}

function ClassItem({ c }: { c: C }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const { res, pending: saving, onSubmit } = useForm(updateClass, () => setEditing(false));

  return (
    <li>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{c.name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-slate-500">
            <span className="rounded-md bg-brand-soft px-1.5 py-0.5 font-semibold text-brand">{formatDays(c.days)}</span>
            {c.time && (
              <span className="flex items-center gap-0.5">
                <Clock size={12} /> {c.time}
              </span>
            )}
            <span className="text-slate-400">· 학생 {c.count}명</span>
          </p>
        </div>
        {!editing && (
          <>
            <button
              onClick={() => setEditing(true)}
              aria-label="수정"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 active:bg-black/5"
            >
              <Pencil size={17} />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              aria-label="삭제"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 active:bg-black/5"
            >
              <Trash2 size={17} />
            </button>
          </>
        )}
      </div>

      {confirmDelete && (
        <div className="mx-4 mb-3 rounded-xl bg-rose-50 p-3 text-sm">
          <p>
            <b>{c.name}</b> 반을 지울까요? 학생과 출결 기록은 그대로 남고, 반 배정만 사라져요.
          </p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => setConfirmDelete(false)} className="flex-1 rounded-lg bg-white py-2 font-medium">
              취소
            </button>
            <button
              disabled={pending}
              onClick={() => start(() => deleteClass(c.id))}
              className="flex-1 rounded-lg bg-rose-500 py-2 font-semibold text-white"
            >
              지우기
            </button>
          </div>
        </div>
      )}

      {editing && (
        <form onSubmit={onSubmit} className="px-4 pb-4">
          <input type="hidden" name="id" value={c.id} />
          <ClassFields c={c} />
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setEditing(false)} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-medium">
              취소
            </button>
            <button disabled={saving} className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              저장
            </button>
          </div>
          <Result r={res} />
        </form>
      )}
    </li>
  );
}

export function ClassManager({ classes }: { classes: C[] }) {
  const [adding, setAdding] = useState(classes.length === 0);
  return (
    // PC: 왼쪽 목록, 오른쪽 추가 폼
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-5">
      <div>
      <PageTitle
        title="반"
        sub="요일을 정해 두면 그날 출석부에 그 반 학생만 보여요"
        right={
          !adding && (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1 rounded-xl bg-brand px-3 py-2 text-[13px] font-semibold text-white lg:hidden"
            >
              <Plus size={16} className="text-gold" /> 반 추가
            </button>
          )
        }
      />
      {adding && (
        <div className="lg:hidden">
          <AddClassForm onClose={() => setAdding(false)} />
        </div>
      )}
      {classes.length > 0 && (
        <ul className="divide-y divide-black/5 rounded-2xl bg-white ring-1 ring-black/5">
          {classes.map((c) => (
            <ClassItem key={c.id} c={c} />
          ))}
        </ul>
      )}
      <p className="mt-3 px-1 text-xs text-slate-400">학생을 반에 넣으려면 &lsquo;학생&rsquo; 탭에서 학생을 수정하세요.</p>
      </div>

      <aside className="hidden lg:sticky lg:top-4 lg:block">
        <AddClassForm />
      </aside>
    </div>
  );
}
