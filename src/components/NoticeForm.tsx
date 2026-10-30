"use client";

import { useState, useTransition } from "react";
import { sendNotice, type NoticeResult } from "@/app/actions";
import { GROUPS } from "@/lib/templates";

function bytes(text: string) {
  let n = 0;
  for (const ch of text) n += ch.charCodeAt(0) > 127 ? 2 : 1;
  return n;
}

export function NoticeForm({ academyName, counts }: { academyName: string; counts: Record<string, number> }) {
  const [res, setRes] = useState<NoticeResult>(null);
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState("전체");
  const [content, setContent] = useState("");
  const [confirming, setConfirming] = useState(false);

  function send() {
    const fd = new FormData();
    fd.set("target", target);
    fd.set("content", content);
    startTransition(async () => {
      const r = await sendNotice(null, fd);
      setRes(r);
      setConfirming(false);
      if (r?.ok) setContent("");
    });
  }

  const full = `[${academyName}] ${content.trim()}`;
  const b = bytes(full);
  const isLong = b > 90;
  const recipients = counts[target] ?? 0;

  return (
    <div className="mt-3 rounded-2xl bg-white p-3">
      <p className="text-sm font-semibold">받는 분</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {["전체", ...GROUPS].map((g) => (
          <button
            type="button"
            key={g}
            onClick={() => setTarget(g)}
            className={`rounded-full px-3.5 py-1.5 text-sm ${
              g === target ? "bg-brand text-white" : "bg-slate-100 text-slate-500"
            }`}
          >
            {g} {counts[g] ?? 0}
          </button>
        ))}
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={5}
        placeholder={"예) 11월 15일(토)은 휴원입니다. 보강 일정은 따로 안내드리겠습니다."}
        className="mt-3 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-[15px] outline-none focus:border-brand"
      />
      <p className="text-right text-xs text-slate-400">
        {isLong ? "장문" : "단문"} · {b}/{isLong ? 2000 : 90}바이트
      </p>

      {content.trim() && (
        <div className="mt-2 rounded-xl bg-slate-50 p-3 text-sm">
          <p className="mb-1 text-xs text-slate-400">학부모님이 받는 문자</p>
          <p className="whitespace-pre-wrap">{full}</p>
        </div>
      )}

      {confirming ? (
        <div className="mt-3 rounded-xl bg-brand-soft p-3">
          <p className="text-center text-sm">
            <b>{target}</b> 학부모님 <b>{recipients}명</b>께 보낼까요?
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => setConfirming(false)} className="flex-1 rounded-xl bg-white py-3 text-sm">
              취소
            </button>
            <button
              type="button"
              onClick={send}
              disabled={pending}
              className="flex-1 rounded-xl bg-brand py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? "보내는 중…" : "보내기"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={!content.trim() || recipients === 0 || b > 2000}
          onClick={() => setConfirming(true)}
          className="mt-3 w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          공지 보내기
        </button>
      )}

      {res && <p className={`mt-2 text-sm ${res.ok ? "text-emerald-600" : "text-rose-600"}`}>{res.message}</p>}
    </div>
  );
}
