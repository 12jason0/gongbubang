"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Pencil, Plus, UserMinus, UserPlus, X } from "lucide-react";
import { addStudent, setStudentActive, updateStudent, type StudentFormResult } from "@/app/actions";
import { formatPhone } from "@/lib/phone";
import { PageTitle } from "./PageTitle";

type S = { id: string; name: string; grade: string; parentPhone: string; active: boolean; classIds: string[] };
type C = { id: string; name: string; days: string; time: string };

const input =
  "w-full rounded-xl border-0 bg-slate-50 px-3 py-3 text-[15px] ring-1 ring-black/5 outline-none focus:bg-white focus:ring-2 focus:ring-gold";

function StudentFields({ s, classes }: { s?: S; classes: C[] }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <input name="name" defaultValue={s?.name} placeholder="이름" className={input} />
        <input name="grade" defaultValue={s?.grade} placeholder="학년 (초5)" className={input} />
        <input
          name="parentPhone"
          defaultValue={s ? formatPhone(s.parentPhone) : ""}
          placeholder="학부모 휴대폰 번호"
          inputMode="tel"
          className={`${input} col-span-2`}
        />
      </div>
      <p className="mt-3 mb-1.5 text-[12px] font-semibold text-slate-500">듣는 반 (여러 개 선택 가능)</p>
      {classes.length === 0 ? (
        <p className="text-xs text-slate-400">아직 반이 없어요. 위의 &lsquo;반&rsquo; 탭에서 먼저 만들어 주세요.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {classes.map((c) => (
            <label
              key={c.id}
              className="cursor-pointer rounded-full bg-slate-100 px-3 py-1.5 text-[13px] font-medium text-slate-500 has-checked:bg-brand has-checked:text-white"
            >
              <input type="checkbox" name="classIds" value={c.id} defaultChecked={s?.classIds.includes(c.id)} className="sr-only" />
              {c.name}
            </label>
          ))}
        </div>
      )}
    </>
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

// onClose 없으면 닫기 버튼 없음 (PC 오른쪽에 늘 떠 있는 폼)
function AddForm({ onClose, classes }: { onClose?: () => void; classes: C[] }) {
  const { res, pending, onSubmit } = useStudentForm(addStudent, (form) => form.reset());

  return (
    <form onSubmit={onSubmit} className="mb-3 rounded-2xl bg-white p-4 ring-2 ring-gold/60">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[15px] font-semibold">새 학생</p>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="닫기" className="text-slate-400">
            <X size={20} />
          </button>
        )}
      </div>
      <StudentFields classes={classes} />
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

function EditForm({ s, onDone, classes }: { s: S; onDone: () => void; classes: C[] }) {
  const { res, pending, onSubmit } = useStudentForm(updateStudent, () => onDone());

  return (
    <form onSubmit={onSubmit} className="px-4 pb-4">
      <input type="hidden" name="id" value={s.id} />
      <StudentFields s={s} classes={classes} />
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

function StudentItem({ s, classes }: { s: S; classes: C[] }) {
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
            {s.name} <span className="text-xs font-medium text-slate-400">{s.grade}</span>
          </p>
          <p className="truncate text-[12px] text-slate-500">
            <span className="tabular-nums">{formatPhone(s.parentPhone)}</span>
            <span className="text-slate-400">
              {" · "}
              {classes
                .filter((c) => s.classIds.includes(c.id))
                .map((c) => c.name)
                .join(", ") || "반 없음"}
            </span>
          </p>
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
      {editing && <EditForm s={s} classes={classes} onDone={() => setEditing(false)} />}
    </li>
  );
}

export function StudentManager({ students, classes }: { students: S[]; classes: C[] }) {
  const [adding, setAdding] = useState(students.length === 0);
  const active = students.filter((s) => s.active);
  const inactive = students.filter((s) => !s.active);

  return (
    // PC: 왼쪽 목록, 오른쪽 추가 폼
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-5">
      <div>
      <PageTitle
        title="학생"
        sub="학부모 번호로 등원 문자·피드백·공지가 가요"
        right={
          !adding && (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1 rounded-xl bg-brand px-3 py-2 text-[13px] font-semibold text-white lg:hidden"
            >
              <Plus size={16} className="text-gold" /> 추가
            </button>
          )
        }
      />
      {adding && (
        <div className="lg:hidden">
          <AddForm classes={classes} onClose={() => setAdding(false)} />
        </div>
      )}

      <ul className="divide-y divide-black/5 rounded-2xl bg-white ring-1 ring-black/5">
        {active.map((s) => (
          <StudentItem key={s.id} s={s} classes={classes} />
        ))}
      </ul>

      {inactive.length > 0 && (
        <>
          <p className="mt-5 px-1 text-[13px] font-semibold text-slate-400">그만둔 학생 · 출결 기록은 남아 있어요</p>
          <ul className="mt-2 divide-y divide-black/5 rounded-2xl bg-white ring-1 ring-black/5">
            {inactive.map((s) => (
              <StudentItem key={s.id} s={s} classes={classes} />
            ))}
          </ul>
        </>
      )}
      </div>

      <aside className="hidden lg:sticky lg:top-4 lg:block">
        <AddForm classes={classes} />
      </aside>
    </div>
  );
}
