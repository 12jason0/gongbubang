"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Pencil, Plus, UserMinus, UserPlus, X } from "lucide-react";
import { addStudent, setStudentActive, updateStudent, type StudentFormResult } from "@/app/actions";
import { formatPhone } from "@/lib/phone";
import { GROUPS } from "@/lib/templates";
import { PageTitle } from "./PageTitle";

type S = { id: string; name: string; grade: string; group: string; parentPhone: string; active: boolean };

const input =
  "w-full rounded-xl border-0 bg-slate-50 px-3 py-3 text-[15px] ring-1 ring-black/5 outline-none focus:bg-white focus:ring-2 focus:ring-gold";

function StudentFields({ s }: { s?: S }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <input name="name" defaultValue={s?.name} placeholder="이름" className={input} />
      <input name="grade" defaultValue={s?.grade} placeholder="학년 (초5)" className={input} />
      <select name="group" defaultValue={s?.group ?? ""} className={input}>
        <option value="" disabled>
          반 선택
        </option>
        {GROUPS.map((g) => (
          <option key={g}>{g}</option>
        ))}
      </select>
      <input
        name="parentPhone"
        defaultValue={s ? formatPhone(s.parentPhone) : ""}
        placeholder="학부모 번호"
        inputMode="tel"
        className={input}
      />
    </div>
  );
}

function Result({ r }: { r: StudentFormResult }) {
  if (!r) return null;
  return <p className={`mt-2 text-sm ${r.ok ? "text-emerald-600" : "text-rose-600"}`}>{r.message}</p>;
}

// 폼 제출 공통: 실패하면 입력값 그대로 두고, 성공하면 onOk 실행
function useStudentForm(
  submit: (prev: StudentFormResult, fd: FormData) => Promise<StudentFormResult>,
  onOk: (form: HTMLFormElement) => void,
) {
  const [res, setRes] = useState<StudentFormResult>(null);
  const [pending, startTransition] = useTransition();
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const r = await submit(null, fd);
      setRes(r);
      if (r?.ok) onOk(form);
    });
  }
  return { res, pending, onSubmit };
}

function AddForm({ onClose }: { onClose: () => void }) {
  const { res, pending, onSubmit } = useStudentForm(addStudent, (form) => form.reset());

  return (
    <form onSubmit={onSubmit} className="mb-3 rounded-2xl bg-white p-4 ring-2 ring-gold/60">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[15px] font-semibold">새 학생</p>
        <button type="button" onClick={onClose} aria-label="닫기" className="text-slate-400">
          <X size={20} />
        </button>
      </div>
      <StudentFields />
      <button
        disabled={pending}
        className="mt-3 w-full rounded-xl bg-brand py-3 text-[15px] font-semibold text-white disabled:opacity-60"
      >
        {pending ? "추가 중…" : "추가"}
      </button>
      <Result r={res} />
    </form>
  );
}

function EditForm({ s, onDone }: { s: S; onDone: () => void }) {
  const { res, pending, onSubmit } = useStudentForm(updateStudent, () => onDone());

  return (
    <form onSubmit={onSubmit} className="px-4 pb-4">
      <input type="hidden" name="id" value={s.id} />
      <StudentFields s={s} />
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onDone} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-medium">
          취소
        </button>
        <button
          disabled={pending}
          className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          저장
        </button>
      </div>
      <Result r={res} />
    </form>
  );
}

function StudentItem({ s }: { s: S }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <li className={s.active ? "" : "opacity-60"}>
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[12px] font-bold text-brand">
          {s.name.slice(-2)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">
            {s.name} <span className="text-xs font-medium text-slate-400">{s.grade} · {s.group}</span>
          </p>
          <p className="text-[13px] text-slate-500 tabular-nums">{formatPhone(s.parentPhone)}</p>
        </div>
        {s.active && !editing && (
          <button
            onClick={() => setEditing(true)}
            aria-label="수정"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 active:bg-black/5"
          >
            <Pencil size={17} />
          </button>
        )}
        <button
          disabled={pending}
          onClick={() => startTransition(() => setStudentActive(s.id, !s.active))}
          aria-label={s.active ? "그만둠" : "다시 등록"}
          className="flex h-9 items-center gap-1 rounded-lg px-2 text-xs text-slate-400 active:bg-black/5"
        >
          {s.active ? <UserMinus size={17} /> : <><UserPlus size={15} /> 다시 등록</>}
        </button>
      </div>
      {editing && <EditForm s={s} onDone={() => setEditing(false)} />}
    </li>
  );
}

export function StudentManager({ students }: { students: S[] }) {
  const [adding, setAdding] = useState(students.length === 0);
  const active = students.filter((s) => s.active);
  const inactive = students.filter((s) => !s.active);

  return (
    <>
      <PageTitle
        title="학생"
        sub={`다니는 학생 ${active.length}명 · 학부모 번호로 문자가 가요`}
        right={
          !adding && (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1 rounded-xl bg-brand px-3 py-2 text-[13px] font-semibold text-white"
            >
              <Plus size={16} className="text-gold" /> 추가
            </button>
          )
        }
      />
      {adding && <AddForm onClose={() => setAdding(false)} />}

      <ul className="divide-y divide-black/5 rounded-2xl bg-white ring-1 ring-black/5">
        {active.map((s) => (
          <StudentItem key={s.id} s={s} />
        ))}
      </ul>

      {inactive.length > 0 && (
        <>
          <p className="mt-5 px-1 text-[13px] font-semibold text-slate-400">그만둔 학생 · 출결 기록은 남아 있어요</p>
          <ul className="mt-2 divide-y divide-black/5 rounded-2xl bg-white ring-1 ring-black/5">
            {inactive.map((s) => (
              <StudentItem key={s.id} s={s} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}
