"use client";

import { useState, useTransition, type FormEvent } from "react";
import { addStudent, setStudentActive, updateStudent, type StudentFormResult } from "@/app/actions";
import { formatPhone } from "@/lib/phone";
import { GROUPS } from "@/lib/templates";

type S = { id: string; name: string; grade: string; group: string; parentPhone: string; active: boolean };

const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[15px] outline-none focus:border-brand";

function StudentFields({ s }: { s?: S }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <input name="name" defaultValue={s?.name} placeholder="이름" className={input} />
      <input name="grade" defaultValue={s?.grade} placeholder="학년 (예: 초5)" className={input} />
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

function AddForm() {
  const { res, pending, onSubmit } = useStudentForm(addStudent, (form) => form.reset());

  return (
    <form onSubmit={onSubmit} className="mt-3 rounded-2xl bg-white p-3">
      <p className="mb-2 text-sm font-semibold">학생 추가</p>
      <StudentFields />
      <button disabled={pending} className="mt-2 w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "추가 중…" : "추가"}
      </button>
      <Result r={res} />
    </form>
  );
}

function EditForm({ s, onDone }: { s: S; onDone: () => void }) {
  const { res, pending, onSubmit } = useStudentForm(updateStudent, () => onDone());

  return (
    <form onSubmit={onSubmit} className="mt-2">
      <input type="hidden" name="id" value={s.id} />
      <StudentFields s={s} />
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onDone} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm">
          취소
        </button>
        <button disabled={pending} className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-60">
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
    <li className={`rounded-2xl bg-white p-3 ${s.active ? "" : "opacity-60"}`}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {s.name} <span className="text-xs font-normal text-slate-400">{s.grade} · {s.group}</span>
          </p>
          <p className="text-sm text-slate-500">{formatPhone(s.parentPhone)}</p>
        </div>
        {s.active && !editing && (
          <button onClick={() => setEditing(true)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs">
            수정
          </button>
        )}
        <button
          disabled={pending}
          onClick={() => startTransition(() => setStudentActive(s.id, !s.active))}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-500"
        >
          {s.active ? "그만둠" : "다시 등록"}
        </button>
      </div>
      {editing && <EditForm s={s} onDone={() => setEditing(false)} />}
    </li>
  );
}

export function StudentManager({ students }: { students: S[] }) {
  const active = students.filter((s) => s.active);
  const inactive = students.filter((s) => !s.active);

  return (
    <>
      <AddForm />
      <p className="mt-5 px-1 text-sm text-slate-500">다니는 학생 {active.length}명</p>
      <ul className="mt-2 space-y-2">
        {active.map((s) => (
          <StudentItem key={s.id} s={s} />
        ))}
      </ul>
      {inactive.length > 0 && (
        <>
          <p className="mt-5 px-1 text-sm text-slate-400">그만둔 학생 (출결 기록은 남아 있어요)</p>
          <ul className="mt-2 space-y-2">
            {inactive.map((s) => (
              <StudentItem key={s.id} s={s} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}
