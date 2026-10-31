"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { ClipboardList, Pencil, Plus, UserMinus, UserPlus, X } from "lucide-react";
import { addStudent, addStudentsBulk, setStudentActive, updateStudent, type StudentFormResult } from "@/app/actions";
import { formatPhone } from "@/lib/phone";
import { parseRoster, rosterKey, ROSTER_MAX_LINES } from "@/lib/roster";
import { PageTitle } from "./PageTitle";
import { useToast } from "./Toast";

// 줄 오른쪽 작은 버튼 (아이콘 + 글자). 휴대폰에선 아래 탭처럼 아이콘 위·글자 아래로 좁게
const ROW_BTN =
  "flex h-11 min-w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 text-[11px] text-slate-500 active:bg-black/5 disabled:opacity-50 md:h-9 md:flex-row md:gap-1 md:px-2 md:text-[13px]";
const CLOSE_BTN = "flex h-9 items-center gap-1 rounded-lg px-2 text-[13px] text-slate-500 active:bg-black/5";

type S = {
  id: string;
  name: string;
  grade: string;
  parentPhone: string;
  birthDate: string | null;
  active: boolean;
  classIds: string[];
};
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
        <label className="col-span-2 flex items-center gap-2">
          <span className="w-24 shrink-0 pl-1 text-[13px] text-slate-500">생년월일 (선택)</span>
          <input name="birthDate" type="date" defaultValue={s?.birthDate ?? ""} className={input} />
        </label>
      </div>
      <ClassChips classes={classes} checked={s?.classIds} label="듣는 반 (여러 개 선택 가능)" />
    </>
  );
}

function ClassChips({ classes, checked, label }: { classes: C[]; checked?: string[]; label: string }) {
  return (
    <>
      <p className="mt-3 mb-1.5 text-[12px] font-semibold text-slate-500">{label}</p>
      {classes.length === 0 ? (
        <p className="text-xs text-slate-400">아직 반이 없어요. 위의 &lsquo;반&rsquo; 탭에서 먼저 만들어 주세요.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {classes.map((c) => (
            <label
              key={c.id}
              className="cursor-pointer rounded-full bg-slate-100 px-3 py-1.5 text-[13px] font-medium text-slate-500 has-checked:bg-brand has-checked:text-white"
            >
              <input type="checkbox" name="classIds" value={c.id} defaultChecked={checked?.includes(c.id)} className="sr-only" />
              {c.name}
            </label>
          ))}
        </div>
      )}
    </>
  );
}

// 학생 추가 공통: 학부모 동의 체크 (체크해야 저장 버튼이 켜짐)
function ConsentCheck({ checked, onChange, many }: { checked: boolean; onChange: (v: boolean) => void; many?: boolean }) {
  return (
    <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl bg-gold-soft px-3 py-2.5 text-[13px] text-[#6b5428]">
      <input
        type="checkbox"
        name="consent"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
      />
      <span>
        <b>{many ? "명단의 학부모님 모두에게 " : "학부모님께 "}개인정보 수집·문자 수신 동의를 받았어요</b>
        <span className="mt-0.5 block text-[12px] text-[#8a6d35]">
          동의 안내 문구는 설정 화면에서 복사해 보낼 수 있어요 ·{" "}
          <a href="/privacy" target="_blank" className="underline">
            처리방침 보기
          </a>
        </span>
      </span>
    </label>
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

// 추가 패널: 한 명씩 / 명단 붙여넣기. onClose 없으면 닫기 버튼 없음 (PC 오른쪽에 늘 떠 있는 폼)
function AddPanel({ onClose, classes, students }: { onClose?: () => void; classes: C[]; students: S[] }) {
  const [bulk, setBulk] = useState(false);
  const tab = (on: boolean) =>
    `flex-1 rounded-lg py-1.5 text-center text-[13px] font-semibold ${on ? "bg-white text-brand shadow-sm" : "text-slate-500"}`;

  return (
    <div className="mb-3 rounded-2xl bg-white p-4 ring-2 ring-gold/60">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex flex-1 rounded-xl bg-black/5 p-1">
          <button type="button" onClick={() => setBulk(false)} className={tab(!bulk)}>
            <Plus size={14} className="mr-0.5 inline align-[-2px]" />
            한 명씩
          </button>
          <button type="button" onClick={() => setBulk(true)} className={tab(bulk)}>
            <ClipboardList size={14} className="mr-0.5 inline align-[-2px]" />
            명단 붙여넣기
          </button>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className={CLOSE_BTN}>
            <X size={15} /> 닫기
          </button>
        )}
      </div>
      {bulk ? <BulkForm classes={classes} students={students} /> : <AddForm classes={classes} />}
    </div>
  );
}

function AddForm({ classes }: { classes: C[] }) {
  const [consent, setConsent] = useState(false);
  const { res, pending, onSubmit } = useStudentForm(addStudent, (form) => {
    form.reset();
    setConsent(false); // 다음 학생도 동의를 따로 받았는지 확인
  });

  return (
    <form onSubmit={onSubmit}>
      <StudentFields classes={classes} />
      <ConsentCheck checked={consent} onChange={setConsent} />
      <button
        disabled={pending || !consent}
        className="mt-3 w-full rounded-xl bg-brand py-3 text-[15px] font-semibold text-white disabled:opacity-40"
      >
        {pending ? "추가 중…" : consent ? "추가" : "동의를 받았으면 위에 체크해 주세요"}
      </button>
      <Result r={res} />
    </form>
  );
}

const ROSTER_PLACEHOLDER = `한 줄에 한 명씩: 이름 학년 학부모 번호
김민준 초5 010-1234-5678
이서연 중2 010-9876-5432 2012-03-02

엑셀에서 칸째로 복사해 붙여도 돼요.
생년월일은 있으면 넣고, 없으면 빼도 돼요.`;

function BulkForm({ classes, students }: { classes: C[]; students: S[] }) {
  const [text, setText] = useState("");
  const [consent, setConsent] = useState(false);
  const have = useMemo(() => new Set(students.map((s) => rosterKey(s.name, s.parentPhone))), [students]);
  const rows = useMemo(() => parseRoster(text), [text]);
  const isDup = (r: (typeof rows)[number]) => r.ok && have.has(rosterKey(r.name, r.parentPhone));
  const ready = rows.filter((r) => r.ok && !isDup(r));
  const problems = rows.length - ready.length;
  const tooMany = rows.length > ROSTER_MAX_LINES;

  const { res, pending, onSubmit } = useStudentForm(addStudentsBulk, () => {
    setText("");
    setConsent(false);
  });

  return (
    <form onSubmit={onSubmit}>
      <textarea
        name="roster"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder={ROSTER_PLACEHOLDER}
        className={`${input} resize-y font-medium leading-relaxed placeholder:font-normal placeholder:text-slate-400`}
      />

      {rows.length > 0 && (
        <div className="mt-2 rounded-xl bg-slate-50 ring-1 ring-black/5">
          <p className="border-b border-black/5 px-3 py-2 text-[13px]">
            <b className="text-emerald-600">{ready.length}명 추가</b>
            {problems > 0 && <span className="text-rose-500"> · {problems}줄 건너뜀</span>}
          </p>
          <ul className="max-h-60 overflow-y-auto px-3 py-1.5 text-[13px]">
            {rows.map((r) =>
              r.ok && !isDup(r) ? (
                <li key={r.line} className="flex gap-2 py-1">
                  <span className="w-5 shrink-0 text-right text-slate-300 tabular-nums">{r.line}</span>
                  <span className="font-semibold">{r.name}</span>
                  <span className="text-slate-500">{r.grade}</span>
                  <span className="ml-auto text-slate-500 tabular-nums">{formatPhone(r.parentPhone)}</span>
                </li>
              ) : (
                <li key={r.line} className="flex gap-2 py-1 text-rose-600">
                  <span className="w-5 shrink-0 text-right text-rose-300 tabular-nums">{r.line}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{r.ok ? `${r.name} ${r.grade}` : r.text}</span>
                    <span className="block text-[12px] text-rose-500">
                      {r.ok ? "이미 등록된 학생이에요" : r.error}
                    </span>
                  </span>
                </li>
              ),
            )}
          </ul>
        </div>
      )}
      {tooMany && <p className="mt-2 text-sm text-rose-600">한 번에 {ROSTER_MAX_LINES}명까지 넣을 수 있어요. 나눠서 넣어 주세요.</p>}

      <ClassChips classes={classes} label="모두 같은 반이면 골라 주세요 (선택)" />
      <ConsentCheck checked={consent} onChange={setConsent} many />
      <button
        disabled={pending || !consent || ready.length === 0 || tooMany}
        className="mt-3 w-full rounded-xl bg-brand py-3 text-[15px] font-semibold text-white disabled:opacity-40"
      >
        {pending
          ? "추가 중…"
          : ready.length === 0
            ? "명단을 붙여넣어 주세요"
            : consent
              ? `${ready.length}명 추가`
              : "동의를 받았으면 위에 체크해 주세요"}
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
  const toast = useToast();

  function toggleActive(active: boolean) {
    startTransition(async () => {
      await setStudentActive(s.id, active);
      toast({
        text: `${s.name} ${active ? "다시 등록했어요" : "그만둔 학생으로 옮겼어요"}`,
        sub: active ? undefined : "출결 기록은 남아 있어요",
        undo: async () => {
          await setStudentActive(s.id, !active);
          toast({ text: `${s.name} 되돌렸어요` });
        },
      });
    });
  }

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
          <button onClick={() => setEditing(true)} className={ROW_BTN}>
            <Pencil size={15} /> 수정
          </button>
        )}
        <button disabled={pending} onClick={() => toggleActive(!s.active)} className={ROW_BTN}>
          {s.active ? <><UserMinus size={15} /> 그만둠</> : <><UserPlus size={15} /> 다시 등록</>}
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
              className="flex items-center gap-1 shrink-0 rounded-xl bg-brand px-3 py-2 text-[13px] font-semibold whitespace-nowrap text-white lg:hidden"
            >
              <Plus size={16} className="text-gold" /> 추가
            </button>
          )
        }
      />
      {adding && (
        <div className="lg:hidden">
          <AddPanel classes={classes} students={students} onClose={() => setAdding(false)} />
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
        <AddPanel classes={classes} students={students} />
      </aside>
    </div>
  );
}
