"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { sendNotice, type NoticeResult } from "@/app/actions";

function bytes(text: string) {
  let n = 0;
  for (const ch of text) n += ch.charCodeAt(0) > 127 ? 2 : 1;
  return n;
}

export function NoticeForm({
  academyName,
  targets,
}: {
  academyName: string;
  targets: { id: string; name: string; count: number }[];
}) {
  const [res, setRes] = useState<NoticeResult>(null);
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState("all");
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
  const selected = targets.find((t) => t.id === target) ?? targets[0];
  const recipients = selected.count;

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
      <p className="text-[13px] font-semibold text-slate-500">받는 분</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {targets.map((t) => (
          <button
            type="button"
            key={t.id}
            onClick={() => setTarget(t.id)}
            className={`rounded-full px-3.5 py-2 text-[13px] font-semibold ${
              t.id === target ? "bg-brand text-white" : "bg-slate-100 text-slate-500"
            }`}
          >
            {t.name} <span className={t.id === target ? "text-gold" : "text-slate-400"}>{t.count}명</span>
          </button>
        ))}
      </div>

      <p className="mt-4 text-[13px] font-semibold text-slate-500">내용</p>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        placeholder={"11월 15일(토)은 휴원입니다.\n보강 일정은 따로 안내드리겠습니다."}
        className="mt-2 w-full resize-none rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-[15px] leading-relaxed ring-1 ring-black/5 outline-none focus:bg-white focus:ring-2 focus:ring-gold"
      />
      <p className="text-right text-[11px] text-slate-400">
        <span className={isLong ? "text-[#8a6d35]" : ""}>{isLong ? "장문" : "단문"}</span> · {b}/{isLong ? 2000 : 90}바이트
      </p>

      {content.trim() && (
        <div className="mt-2">
          <p className="mb-1.5 text-[11px] text-slate-400">학부모님 휴대폰에는 이렇게 보여요</p>
          <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-slate-100 px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap">
            {full}
          </div>
        </div>
      )}

      {confirming ? (
        <div className="mt-4 rounded-xl bg-gold-soft p-3">
          <p className="text-center text-sm">
            <b>{selected.name}</b> 학부모님 <b>{recipients}명</b>께 보낼까요?
          </p>
          <div className="mt-2.5 flex gap-2">
            <button type="button" onClick={() => setConfirming(false)} className="flex-1 rounded-xl bg-white py-3 text-sm font-medium">
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
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-[15px] font-semibold text-white disabled:opacity-30"
        >
          <Send size={16} className="text-gold" /> 공지 보내기
        </button>
      )}

      {res && <p className={`mt-2 text-center text-sm ${res.ok ? "text-emerald-600" : "text-rose-600"}`}>{res.message}</p>}
    </div>
  );
}
