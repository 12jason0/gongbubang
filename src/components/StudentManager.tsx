"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { ClipboardList, FileSpreadsheet, Pencil, Plus, Send, UserMinus, UserPlus, X } from "lucide-react";
import { addStudent, addStudentsBulk, sendConsentRequests, setStudentActive, updateStudent, type StudentFormResult } from "@/app/actions";
import { formatPhone } from "@/lib/phone";
import { feeLabel } from "@/lib/money";
import { parseRoster, rosterKey, ROSTER_MAX_LINES } from "@/lib/roster";
import { Confirm } from "./Confirm";
import { ExcelImport } from "./ExcelImport";
import { track } from "./PageView";
import { PageTitle } from "./PageTitle";
import { InfoTip, TipExample } from "./InfoTip";

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
  monthlyFee: number | null;
  dueDay: number | null;
  active: boolean;
  classIds: string[];
  consent: string; // AGREED(동의) / PENDING(대기) / DECLINED(거부)
  requested: boolean; // 이 학부모 번호로 동의 요청 카톡이 나간 적 있음
};
type C = { id: string; name: string; days: string; time: string };

const input =
  "w-full rounded-xl border-0 px-3 py-3 text-[15px] outline-none focus:ring-2 focus:ring-gold field";

const CONSENT_LABEL: Record<string, { label: string; tone: string }> = {
  AGREED: { label: "동의", tone: "bg-emerald-50 text-emerald-700" },
  PENDING: { label: "대기", tone: "bg-gold-soft text-[#8a6d35]" },
  DECLINED: { label: "거부", tone: "bg-rose-50 text-rose-600" },
};

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
        <p className="col-span-2 -mb-1 flex items-center gap-0.5 pt-1 pl-1 text-[13px] text-slate-500">
          교습비·납부일 (선택)
          <InfoTip label="교습비·납부일">
            매달 받는 교습비와 받는 날을 넣어 두세요. 월별 화면의 납부 기록에 금액이 미리 채워지고, 달력의 그 날짜에 &lsquo;납부일&rsquo;이 보여요. 납부일이 지났는데 납부 기록이 없으면 미납으로 보여요.
            <TipExample>250,000원 · 매달 10일 → 10일이 지나도 기록이 없으면 미납</TipExample>
          </InfoTip>
        </p>
        <input
          name="monthlyFee"
          defaultValue={s?.monthlyFee ? s.monthlyFee.toLocaleString("ko-KR") : ""}
          placeholder="월 교습비 (선택)"
          inputMode="numeric"
          className={input}
        />
        <select name="dueDay" defaultValue={s?.dueDay ? String(s.dueDay) : ""} className={input}>
          <option value="">납부일 (선택)</option>
          {Array.from({ length: 30 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              매달 {i + 1}일
            </option>
          ))}
          <option value="31">매달 말일</option>
        </select>
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
        <p className="flex items-center gap-2 text-xs text-slate-400">
          아직 반이 없어요.
          <Link href="/students?tab=classes" className="rounded-lg bg-brand-soft px-2.5 py-1.5 font-semibold text-brand">
            반 만들기
          </Link>
        </p>
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

// 학생 추가 공통: 종이·문자로 이미 동의를 받았으면 체크 (안 하면 '대기' → [동의 요청 보내기]로 카톡 요청)
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
        <b>{many ? "명단의 학부모님 모두에게 " : "학부모님께 "}종이·문자로 이미 동의를 받았어요</b>
        <span className="mt-0.5 block text-[12px] text-[#8a6d35]">
          체크하지 않으면 &lsquo;대기&rsquo;로 들어가고, 목록 위 [동의 요청 보내기]로 카톡 동의를 받아요 ·{" "}
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
function AddPanel({ onClose, classes, students, excel }: { onClose?: () => void; classes: C[]; students: S[]; excel?: boolean }) {
  const [mode, setMode] = useState<"one" | "paste" | "excel">(excel ? "excel" : "one");
  const tab = (on: boolean) =>
    `flex-1 rounded-lg py-1.5 text-center text-[12.5px] font-semibold whitespace-nowrap ${on ? "bg-white text-brand shadow-sm" : "text-slate-500"}`;

  return (
    <div className="card mb-3 rounded-2xl p-4 outline-2 outline-gold/60">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex flex-1 rounded-xl bg-black/5 p-1">
          <button type="button" onClick={() => setMode("one")} className={tab(mode === "one")}>
            <Plus size={14} className="mr-0.5 inline align-[-2px]" />
            한 명씩
          </button>
          <button type="button" onClick={() => setMode("paste")} className={tab(mode === "paste")}>
            <ClipboardList size={14} className="mr-0.5 inline align-[-2px]" />
            명단 붙여넣기
          </button>
          <button type="button" onClick={() => { if (mode !== "excel") track("excel"); setMode("excel"); }} className={tab(mode === "excel")}>
            <FileSpreadsheet size={14} className="mr-0.5 inline align-[-2px]" />
            엑셀 올리기
          </button>
        </div>
        {mode === "excel" ? (
          <InfoTip label="엑셀 올리기">
            갖고 있는 엑셀 파일을 그대로 올리면 바로 저장돼요. 첫 줄 칸 이름을 보고 필요한 칸만 알아서 찾아요. 잘못 올렸으면 [되돌리기]로 한 번에 지울 수 있어요.
              <span className="mt-2 grid grid-cols-[auto_auto_1fr_auto_auto] gap-x-2 rounded-lg bg-white px-2 py-1.5 text-[11.5px] ring-1 ring-black/5">
                {["이름", "학년", "학부모 번호", "교습비", "납부일"].map((h) => (
                  <span key={h} className="font-semibold text-brand">
                    {h}
                  </span>
                ))}
                {["김민수", "초5", "010-1234-5678", "250000", "10"].map((v) => (
                  <span key={v} className="text-slate-600">
                    {v}
                  </span>
                ))}
              </span>
              <span className="mt-1.5 block text-[12px] text-slate-500">이름·학부모 번호는 꼭 있어야 해요. 학년·반·교습비·납부일은 있으면 같이 들어가요. 주소·생년월일 같은 다른 칸은 저장하지 않아요.</span>
          </InfoTip>
        ) : mode === "paste" ? (
          <InfoTip label="명단 붙여넣기">
            한 줄에 한 명씩 이름·학년·학부모 번호를 적어 주세요. 메모장이나 카톡에 적어 둔 명단을 그대로 붙여 넣어도 돼요.
            <TipExample>김민수 초5 010-1234-5678</TipExample>
          </InfoTip>
        ) : (
          <InfoTip label="학생 추가">
            이름·학년·학부모 휴대폰 번호만 있으면 돼요. 교습비·납부일·반은 나중에 수정에서 넣어도 돼요.
            <TipExample>김민수 · 초5 · 010-1234-5678</TipExample>
          </InfoTip>
        )}
        {onClose && (
          <button type="button" onClick={onClose} className={CLOSE_BTN}>
            <X size={15} /> 닫기
          </button>
        )}
      </div>
      {mode === "paste" ? (
        <BulkForm classes={classes} students={students} />
      ) : mode === "excel" ? (
        <ExcelImport />
      ) : (
        <AddForm classes={classes} />
      )}
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
        disabled={pending}
        className="mt-3 w-full rounded-xl bg-brand py-3 text-[15px] font-semibold text-white disabled:opacity-40"
      >
        {pending ? "추가 중…" : "추가"}
      </button>
      <Result r={res} />
    </form>
  );
}

const ROSTER_PLACEHOLDER = `한 줄에 한 명씩: 이름 학년 학부모 번호
김민준 초5 010-1234-5678
이서연 중2 010-9876-5432 2012-03-02 25만원 10일

엑셀에서 칸째로 복사해 붙여도 돼요.
생년월일·교습비·납부일은 있으면 넣고, 없으면 빼도 돼요.`;

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
                  {feeLabel(r.monthlyFee, r.dueDay) && <span className="text-[#8a6d35]">{feeLabel(r.monthlyFee, r.dueDay)}</span>}
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
        disabled={pending || ready.length === 0 || tooMany}
        className="mt-3 w-full rounded-xl bg-brand py-3 text-[15px] font-semibold text-white disabled:opacity-40"
      >
        {pending
          ? "추가 중…"
          : ready.length === 0
            ? "명단을 붙여넣어 주세요"
            : `${ready.length}명 추가`}
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
      <label className="mt-3 flex items-center gap-2">
        <span className="w-24 shrink-0 pl-1 text-[13px] text-slate-500">학부모 동의</span>
        <select name="consentState" defaultValue={s.consent} className={input}>
          <option value="AGREED">동의 (종이·문자로 받음)</option>
          <option value="PENDING">대기</option>
          <option value="DECLINED">거부 (안내를 받지 않음)</option>
        </select>
      </label>
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

function StudentItem({ s, classes, open }: { s: S; classes: C[]; open?: boolean }) {
  const [editing, setEditing] = useState(!!open);
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
    <li id={`s-${s.id}`} className={`scroll-mt-20 ${s.active ? "" : "opacity-60"}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[12px] font-bold text-brand">
          {s.name.slice(-2)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">
            {s.name} <span className="text-xs font-medium text-slate-400">{s.grade}</span>
            {s.active && <ConsentBadge s={s} />}
          </p>
          <p className="truncate text-[12px] text-slate-500">
            <span className="tabular-nums">{formatPhone(s.parentPhone)}</span>
            {feeLabel(s.monthlyFee, s.dueDay) && <span className="text-[#8a6d35]"> · {feeLabel(s.monthlyFee, s.dueDay)}</span>}
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

function ConsentBadge({ s }: { s: S }) {
  const c = CONSENT_LABEL[s.consent] ?? CONSENT_LABEL.PENDING;
  return (
    <span className={`ml-1.5 rounded-full px-1.5 py-0.5 align-[1px] text-[11px] font-semibold ${c.tone}`}>
      {c.label}
      {s.consent === "PENDING" && s.requested && <span className="font-medium"> · 요청함</span>}
    </span>
  );
}

/** 목록 위: "동의 12명 · 대기 3명" + [동의 요청 보내기] (대기인 학부모만, 형제는 한 통) */
function ConsentBar({ active }: { active: S[] }) {
  const [ask, setAsk] = useState(false);
  const [busy, start] = useTransition();
  const toast = useToast();
  const n = (c: string) => active.filter((s) => s.consent === c).length;
  const pending = active.filter((s) => s.consent === "PENDING");
  const phones = new Map<string, boolean>(); // 학부모 번호 → 요청한 적 있음
  for (const s of pending) phones.set(s.parentPhone, (phones.get(s.parentPhone) ?? false) || s.requested);
  const again = [...phones.values()].filter(Boolean).length;
  if (active.length === 0) return null;

  function send() {
    setAsk(false);
    start(async () => {
      const r = await sendConsentRequests();
      toast({ text: r?.message ?? "보내지 못했어요", tone: r?.ok ? undefined : "err" });
    });
  }

  return (
    <div className="card mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-4 py-3">
      <p className="text-[14px] font-semibold">
        <span className="text-emerald-700">동의 {n("AGREED")}명</span>
        <span className="text-slate-300"> · </span>
        <span className="text-[#8a6d35]">대기 {n("PENDING")}명</span>
        {n("DECLINED") > 0 && (
          <>
            <span className="text-slate-300"> · </span>
            <span className="text-rose-600">거부 {n("DECLINED")}명</span>
          </>
        )}
        <span className="block text-[12px] font-normal text-slate-500">동의한 학부모님께만 등원·피드백·공지 카톡이 가요</span>
      </p>
      <InfoTip label="동의 요청 보내기">
        학부모님이 카톡 안내를 받겠다고 동의하셔야 출석·공지·원비 카톡을 보낼 수 있어요. 버튼을 누르면 대기 중인 학부모님께 동의 링크가 가고, 학부모님이 누르시면 &lsquo;동의&rsquo;로 바뀌어요. 처음 보내는 요청은 카톡 통수에서 빠지지 않아요.
        <TipExample>대기 3명 → [동의 요청 보내기] → 학부모님이 링크에서 동의 → 동의 3명</TipExample>
      </InfoTip>
      <button
        type="button"
        disabled={busy || phones.size === 0}
        onClick={() => setAsk(true)}
        className="ml-auto flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40"
      >
        <Send size={15} className="text-gold" /> {busy ? "보내는 중…" : "동의 요청 보내기"}
      </button>
      <Confirm
        open={ask}
        title={`학부모님 ${phones.size}명께 동의 요청을 보낼까요?`}
        body={
          `대기 중인 학부모님께 카톡으로 동의 링크가 가요. 형제는 한 통이에요.\n` +
          (again
            ? `처음 받는 ${phones.size - again}명은 무료, 다시 받는 ${again}명은 카톡 ${again}통이 빠져요.`
            : "처음 보내는 요청이라 카톡 통수에서 빠지지 않아요.")
        }
        ok="보내기"
        onCancel={() => setAsk(false)}
        onOk={send}
      />
    </div>
  );
}

export function StudentManager({ students, classes, editId, excel }: { students: S[]; classes: C[]; editId?: string; excel?: boolean }) {
  const [adding, setAdding] = useState(students.length === 0 || !!excel);
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
          <AddPanel classes={classes} students={students} excel={excel} onClose={() => setAdding(false)} />
        </div>
      )}

      <ConsentBar active={active} />
      <ul className="card divide-y divide-black/5 rounded-2xl">
        {active.map((s) => (
          <StudentItem key={s.id} s={s} classes={classes} open={s.id === editId} />
        ))}
      </ul>

      {inactive.length > 0 && (
        <>
          <p className="mt-5 px-1 text-[13px] font-semibold text-slate-400">그만둔 학생 · 출결 기록은 남아 있어요</p>
          <ul className="card mt-2 divide-y divide-black/5 rounded-2xl">
            {inactive.map((s) => (
              <StudentItem key={s.id} s={s} classes={classes} />
            ))}
          </ul>
        </>
      )}
      </div>

      <aside className="hidden lg:sticky lg:top-4 lg:block">
        <AddPanel classes={classes} students={students} excel={excel} />
      </aside>
    </div>
  );
}
