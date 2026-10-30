"use client";

import { useState, useTransition } from "react";
import { saveNote, setAttendance } from "@/app/actions";

export type RowData = {
  id: string;
  name: string;
  grade: string;
  group: string;
  status: "PRESENT" | "ABSENT" | null;
  notifiedTime: string | null; // 등원 문자 보낸 시각
  note: string;
  noteSentTime: string | null; // 피드백 보낸 시각
};

export function AttendanceRow({ row, date, isToday }: { row: RowData; date: string; isToday: boolean }) {
  const [status, setStatus] = useState(row.status);
  const [smsMsg, setSmsMsg] = useState<{ text: string; tone: "ok" | "warn" | "err"; retry?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const [note, setNote] = useState(row.note);
  const [savedNote, setSavedNote] = useState(row.note);
  const [noteState, setNoteState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [noteOpen, setNoteOpen] = useState(!!row.note);

  function press(next: "PRESENT" | "ABSENT", retry = false) {
    const target = status === next && !retry ? null : next; // 같은 버튼 다시 누르면 체크 해제
    const before = status;
    setStatus(target); // 바로 반영 (느린 인터넷에서도 답답하지 않게)
    setSmsMsg(null);
    startTransition(async () => {
      const res = await setAttendance(row.id, date, target);
      if (!res.ok) {
        setStatus(before);
        setSmsMsg({ text: res.error ?? "저장하지 못했어요.", tone: "err" });
        return;
      }
      if (res.sms === "sent") setSmsMsg({ text: "학부모님께 등원 문자를 보냈어요", tone: "ok" });
      if (res.sms === "test") setSmsMsg({ text: "등원 문자 (테스트 모드 — 실제 발송 안 됨)", tone: "warn" });
      if (res.sms === "failed") setSmsMsg({ text: `등원 문자 실패: ${res.error ?? ""}`, tone: "err", retry: true });
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

  const notified = row.notifiedTime;

  return (
    <li className="rounded-2xl bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{row.name}</p>
          <p className="text-xs text-slate-400">
            {row.grade} · {row.group}
            {notified && <span className="ml-1 text-emerald-600">· 등원 문자 {notified}</span>}
          </p>
        </div>
        <button
          onClick={() => press("PRESENT")}
          disabled={pending}
          className={`h-11 w-16 rounded-xl text-sm font-semibold transition ${
            status === "PRESENT" ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"
          }`}
        >
          출석
        </button>
        <button
          onClick={() => press("ABSENT")}
          disabled={pending}
          className={`h-11 w-16 rounded-xl text-sm font-semibold transition ${
            status === "ABSENT" ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-500"
          }`}
        >
          결석
        </button>
      </div>

      {smsMsg && (
        <p
          className={`mt-2 text-xs ${
            smsMsg.tone === "ok" ? "text-emerald-600" : smsMsg.tone === "warn" ? "text-amber-600" : "text-rose-600"
          }`}
        >
          {smsMsg.text}
          {smsMsg.retry && (
            <button onClick={() => press("PRESENT", true)} disabled={pending} className="ml-2 underline">
              다시 보내기
            </button>
          )}
        </p>
      )}

      {/* 수업 메모 */}
      {row.noteSentTime ? (
        <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <p className="whitespace-pre-wrap">{row.note}</p>
          <p className="mt-1 text-xs text-emerald-600">✓ 학부모님께 보냄 {row.noteSentTime}</p>
        </div>
      ) : noteOpen ? (
        <div className="mt-2">
          <textarea
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setNoteState("idle");
            }}
            onBlur={persistNote}
            rows={2}
            maxLength={900}
            placeholder={`오늘 수업 메모 (예: 분수 나눗셈 이해함, 숙제 2쪽)`}
            className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-[15px] outline-none focus:border-brand"
          />
          <p className="text-right text-xs text-slate-400">
            {noteState === "saving" && "저장 중…"}
            {noteState === "saved" && "저장됨 · 아래 버튼으로 보내요"}
            {noteState === "error" && <span className="text-rose-600">저장 실패 — 다시 시도해 주세요</span>}
          </p>
        </div>
      ) : (
        <button onClick={() => setNoteOpen(true)} className="mt-2 text-xs text-slate-400">
          + 수업 메모{isToday ? "" : " (지난 날짜)"}
        </button>
      )}
    </li>
  );
}
