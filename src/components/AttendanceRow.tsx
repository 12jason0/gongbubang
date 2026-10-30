"use client";

import { useState, useTransition } from "react";
import { Check, MessageSquareText, NotebookPen, RotateCw, X } from "lucide-react";
import { saveNote, setAttendance } from "@/app/actions";

export type RowData = {
  id: string;
  name: string;
  grade: string;
  classLabel: string; // 이 학생의 반 이름들
  status: "PRESENT" | "ABSENT" | null;
  notifiedTime: string | null; // 등원 문자 보낸 시각
  note: string;
  noteSentTime: string | null; // 피드백 보낸 시각
};

type Msg = { text: string; tone: "ok" | "warn" | "err"; retry?: boolean };

export function AttendanceRow({ row, date }: { row: RowData; date: string }) {
  const [status, setStatus] = useState(row.status);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [pending, startTransition] = useTransition();

  const [note, setNote] = useState(row.note);
  const [savedNote, setSavedNote] = useState(row.note);
  const [noteState, setNoteState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [open, setOpen] = useState(false);

  function press(next: "PRESENT" | "ABSENT", retry = false) {
    const target = status === next && !retry ? null : next; // 같은 버튼 다시 누르면 체크 해제
    const before = status;
    setStatus(target); // 바로 반영 (느린 인터넷에서도 답답하지 않게)
    setMsg(null);
    startTransition(async () => {
      const res = await setAttendance(row.id, date, target);
      if (!res.ok) {
        setStatus(before);
        setMsg({ text: res.error ?? "저장하지 못했어요.", tone: "err" });
        return;
      }
      if (res.sms === "sent") setMsg({ text: "학부모님께 등원 문자를 보냈어요", tone: "ok" });
      if (res.sms === "test") setMsg({ text: "등원 문자 기록됨 (테스트 모드)", tone: "warn" });
      if (res.sms === "failed") setMsg({ text: `등원 문자 실패: ${res.error ?? ""}`, tone: "err", retry: true });
    });
  }

  async function persistNote() {
    if (note.trim() === savedNote.trim()) return;
    setNoteState("saving");
    const res = await saveNote(row.id, date, note);
    if (res.ok) {
      setSavedNote(note);
      setNoteState("saved");
    } else {
      setNoteState("error");
    }
  }

  const hasNote = !!savedNote.trim() || !!row.noteSentTime;
  const tint = status === "PRESENT" ? "bg-emerald-50/70" : status === "ABSENT" ? "bg-rose-50/70" : "";

  return (
    // PC(lg) 2열: 첫 줄(두 칸) 빼고 위 선, 왼쪽 칸은 오른쪽 선
    <li
      className={`transition-colors ${tint} lg:border-black/5 lg:odd:border-r lg:[&:nth-child(n+3)]:border-t`}
    >
      <div className="flex items-center gap-2.5 px-3 py-2">
        {/* 상태 동그라미 */}
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${
            status === "PRESENT"
              ? "bg-emerald-500 text-white"
              : status === "ABSENT"
                ? "bg-rose-500 text-white"
                : "bg-slate-100 text-slate-400"
          }`}
          aria-hidden
        >
          {status === "PRESENT" ? <Check size={16} strokeWidth={3} /> : status === "ABSENT" ? <X size={16} strokeWidth={3} /> : <span className="text-[11px]">{row.name.slice(-2)}</span>}
        </span>

        {/* 이름 — 누르면 메모 */}
        <button onClick={() => setOpen((o) => !o)} className="min-w-0 flex-1 text-left">
          <p className="truncate text-[16px] font-semibold leading-tight">
            {row.name}
            <span className="ml-1.5 text-xs font-medium text-slate-400">{row.grade}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-2 text-[11px] leading-tight text-slate-400">
            {row.notifiedTime ? (
              <span className="text-emerald-600">문자 {row.notifiedTime}</span>
            ) : status === "ABSENT" ? (
              <span className="text-rose-500">결석</span>
            ) : (
              <span className="truncate">{row.classLabel}</span>
            )}
            {row.noteSentTime ? (
              <span className="text-brand">· 피드백 보냄</span>
            ) : hasNote ? (
              <span className="text-[#8a6d35]">· 메모 있음</span>
            ) : null}
          </p>
        </button>

        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="수업 메모"
          className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            open ? "bg-brand text-white" : "text-slate-400 active:bg-black/5"
          }`}
        >
          <NotebookPen size={19} />
          {hasNote && !open && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-gold" />}
        </button>

        {/* 출석 / 결석 */}
        <div className="flex shrink-0 rounded-xl bg-slate-100 p-1">
          <button
            onClick={() => press("PRESENT")}
            disabled={pending}
            className={`h-9 w-[52px] rounded-lg text-[13px] font-semibold transition ${
              status === "PRESENT" ? "bg-emerald-500 text-white shadow-sm" : "text-slate-500"
            }`}
          >
            출석
          </button>
          <button
            onClick={() => press("ABSENT")}
            disabled={pending}
            className={`h-9 w-[52px] rounded-lg text-[13px] font-semibold transition ${
              status === "ABSENT" ? "bg-rose-500 text-white shadow-sm" : "text-slate-500"
            }`}
          >
            결석
          </button>
        </div>
      </div>

      {msg && (
        <p
          className={`-mt-1 flex items-center gap-2 px-3 pb-2 pl-[54px] text-xs ${
            msg.tone === "ok" ? "text-emerald-700" : msg.tone === "warn" ? "text-amber-700" : "text-rose-600"
          }`}
        >
          {msg.text}
          {msg.retry && (
            <button
              onClick={() => press("PRESENT", true)}
              disabled={pending}
              className="flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 font-semibold"
            >
              <RotateCw size={12} /> 다시 보내기
            </button>
          )}
        </p>
      )}

      {/* 수업 메모 */}
      {open && (
        <div className="px-3 pb-3 pl-[54px]">
          {row.noteSentTime ? (
            <div className="rounded-xl bg-white px-3 py-2.5 text-sm text-slate-600 ring-1 ring-black/5">
              <p className="whitespace-pre-wrap">{row.note}</p>
              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-brand">
                <MessageSquareText size={12} /> 학부모님께 보냄 {row.noteSentTime}
              </p>
            </div>
          ) : (
            <>
              <textarea
                autoFocus={!note}
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  setNoteState("idle");
                }}
                onBlur={persistNote}
                rows={3}
                maxLength={900}
                placeholder="오늘 수업 메모 (예: 분수 나눗셈 이해함, 숙제 24~25쪽)"
                className="w-full resize-none rounded-xl border-0 bg-white px-3 py-2.5 text-[15px] leading-relaxed ring-1 ring-black/10 outline-none focus:ring-2 focus:ring-gold"
              />
              <p className="mt-1 text-right text-[11px] text-slate-400">
                {noteState === "saving" && "저장 중…"}
                {noteState === "saved" && "저장됨 · 아래 버튼으로 학부모님께 보내요"}
                {noteState === "error" && <span className="text-rose-600">저장 실패 — 다시 시도해 주세요</span>}
                {noteState === "idle" && `${note.length}/900`}
              </p>
            </>
          )}
        </div>
      )}
    </li>
  );
}
