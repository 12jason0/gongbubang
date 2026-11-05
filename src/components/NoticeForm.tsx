"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Link2, Send } from "lucide-react";
import { sendNotice, type NoticeResult } from "@/app/actions";
import { fillTemplate, fitKakao, NOTICE_MAX_CHARS } from "@/lib/templates";
import { PLANS } from "@/lib/pricing";
import { formatDateLabel, shiftDate, todayKST } from "@/lib/date";
import { useToast } from "./Toast";

// 자주 쓰는 공지 — 누르면 내일 날짜로 채우고 날짜 부분을 골라 둬서 바로 고쳐 쓰면 된다
const PRESETS = [
  { label: "휴원 안내", text: (d: string) => `${d}은 휴원입니다.\n보강 일정은 따로 안내드리겠습니다.` },
  { label: "보강 안내", text: (d: string) => `${d} 오후 4시에 보강 수업이 있습니다.\n참석이 어려우시면 미리 연락 부탁드립니다.` },
  { label: "시험 일정", text: (d: string) => `${d}부터 학교 시험 기간입니다.\n시험 대비 수업은 평소 시간에 진행합니다.` },
];

function bytes(text: string) {
  let n = 0;
  for (const ch of text) n += ch.charCodeAt(0) > 127 ? 2 : 1;
  return n;
}

type Student = { id: string; name: string; grade: string; phone: string; classIds: string[] };

/** 학부모 번호별로 묶기 (형제는 한 명으로) */
function groupByPhone(list: Student[]) {
  const m = new Map<string, Student[]>();
  for (const s of list) m.set(s.phone, [...(m.get(s.phone) ?? []), s]);
  return [...m.values()];
}

const PLUS_PRICE = `${PLANS.PLUS.price.toLocaleString("ko-KR")}원`;

export function NoticeForm({
  academyName,
  students,
  waiting,
  classes,
  linkMode,
  kakaoBody,
  remaining,
  canUpgrade,
}: {
  academyName: string;
  students: Student[];
  waiting: number; // 학부모 동의 대기·거부 학생 수 (공지를 안 받음)
  classes: { id: string; name: string }[];
  linkMode: boolean; // APP_URL 이 있으면 "새 공지 + 링크", 없으면 문자에 공지 전체
  kakaoBody?: string; // 공지 알림톡 템플릿 (있으면 공지 내용이 카톡에 바로)
  remaining: number; // 이번 달 남은 카톡 통수
  canUpgrade: boolean; // 넉넉(9,900원)보다 아래 요금제면 true
}) {
  const [res, setRes] = useState<NoticeResult>(null);
  const [pending, startTransition] = useTransition();
  // target: "all" | 반 id | "pick"(직접 고르기)
  const [target, setTarget] = useState("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [content, setContent] = useState("");
  const [confirming, setConfirming] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();

  function applyPreset(p: (typeof PRESETS)[number]) {
    const before = content;
    const date = formatDateLabel(shiftDate(todayKST(), 1)).replace(" (", "("); // "11월 1일(토)"
    setContent(p.text(date));
    setConfirming(false);
    setRes(null);
    // 날짜 부분을 선택해 둬서 바로 덮어쓰게
    requestAnimationFrame(() => {
      textRef.current?.focus();
      textRef.current?.setSelectionRange(0, date.length);
    });
    if (before.trim()) {
      toast({ text: `${p.label} 문구를 넣었어요`, sub: "쓰던 내용은 되돌리기로 살릴 수 있어요", undo: () => setContent(before) });
    }
  }

  function send() {
    const fd = new FormData();
    if (target === "all") fd.set("mode", "all");
    else if (target === "pick") {
      fd.set("mode", "pick");
      for (const id of picked) fd.append("studentIds", id);
    } else {
      fd.set("mode", "class");
      fd.set("classId", target);
    }
    fd.set("content", content);
    startTransition(async () => {
      const r = await sendNotice(null, fd);
      setRes(r);
      setConfirming(false);
      if (r?.ok) {
        setContent("");
        setPicked(new Set());
      }
    });
  }

  const pickOf = (t: string) =>
    t === "all" ? students : t === "pick" ? students.filter((s) => picked.has(s.id)) : students.filter((s) => s.classIds.includes(t));
  const groups = groupByPhone(pickOf(target));
  const recipients = groups.length;
  const targetLabel =
    target === "all" ? "전체" : target === "pick" ? `고른 학생 ${picked.size}명의` : (classes.find((c) => c.id === target)?.name ?? "");
  const chips = [
    { id: "all", name: "전체", count: groupByPhone(students).length as number | null },
    ...classes.map((c) => ({ id: c.id, name: c.name, count: groupByPhone(pickOf(c.id)).length as number | null })),
    { id: "pick", name: "직접 고르기", count: target === "pick" ? recipients : null },
  ];
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const full = `[${academyName}] ${content.trim()}`;
  const b = bytes(full);
  const isLong = b > 90;
  const tooLong = linkMode ? content.trim().length > NOTICE_MAX_CHARS : b > 2000;
  // 통수가 모자라면 보내기 전에 막는다 (서버도 한 번 더 막음)
  const short = recipients > remaining;
  const sampleNames = (groups[0] ?? [{ name: "김민수" }]).map((s) => s.name).join("·");

  return (
    <div className="card rounded-2xl p-4">
      <p className="text-[13px] font-semibold text-slate-500">받는 분</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {chips.map((t) => (
          <button
            type="button"
            key={t.id}
            onClick={() => setTarget(t.id)}
            className={`rounded-full px-3.5 py-2 text-[13px] font-semibold ${
              t.id === target ? "bg-brand text-white" : "bg-slate-100 text-slate-500"
            }`}
          >
            {t.name} {t.count !== null && <span className={t.id === target ? "text-gold" : "text-slate-400"}>{t.count}명</span>}
          </button>
        ))}
      </div>

      {target === "pick" && (
        <div className="mt-2 rounded-xl bg-slate-50 ring-1 ring-black/5">
          <div className="flex items-center justify-between px-3 pt-2 pb-1 text-[12px] text-slate-500">
            <span>
              {picked.size}명 고름{recipients !== picked.size && ` · 형제는 한 번만 → 학부모님 ${recipients}명`}
            </span>
            <button
              type="button"
              onClick={() => setPicked(picked.size === students.length ? new Set() : new Set(students.map((s) => s.id)))}
              className="rounded-lg px-2 py-1 font-semibold text-brand"
            >
              {picked.size === students.length ? "모두 해제" : "모두 고르기"}
            </button>
          </div>
          {students.length === 0 ? (
            <p className="px-3 pb-3 text-[13px] text-slate-400">학생이 없어요</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto px-1 pb-1">
              {students.map((s) => (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 active:bg-black/5">
                    <input
                      type="checkbox"
                      checked={picked.has(s.id)}
                      onChange={() => toggle(s.id)}
                      className="size-[18px] accent-[#0c563b]"
                    />
                    <span className="text-[14px] font-medium">{s.name}</span>
                    <span className="text-[12px] text-slate-400">{s.grade}</span>
                    <span className="ml-auto truncate text-[12px] text-slate-400">
                      {s.classIds
                        .map((id) => classes.find((c) => c.id === id)?.name)
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="mt-4 text-[13px] font-semibold text-slate-500">내용</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[12px] text-slate-400">자주 쓰는 문구</span>
        {PRESETS.map((p) => (
          <button
            type="button"
            key={p.label}
            onClick={() => applyPreset(p)}
            className="rounded-lg bg-gold-soft px-3 py-1.5 text-[13px] font-semibold text-[#8a6d35] active:bg-gold/30"
          >
            {p.label}
          </button>
        ))}
      </div>
      <textarea
        ref={textRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        placeholder={"11월 15일(토)은 휴원입니다.\n보강 일정은 따로 안내드리겠습니다."}
        className="mt-2 w-full resize-none rounded-xl border-0 px-3 py-2.5 text-[15px] leading-relaxed outline-none focus:ring-2 focus:ring-gold field"
      />
      {linkMode ? (
        <p className={`text-right text-[11px] ${tooLong ? "text-rose-500" : "text-slate-400"}`}>
          {content.trim().length.toLocaleString("ko-KR")}/{NOTICE_MAX_CHARS.toLocaleString("ko-KR")}자
        </p>
      ) : (
        <p className="text-right text-[11px] text-slate-400">
          <span className={isLong ? "text-[#8a6d35]" : ""}>{isLong ? "장문" : "단문"}</span> · {b}/{isLong ? 2000 : 90}바이트
        </p>
      )}

      {content.trim() && (
        <div className="mt-2">
          <p className="mb-1.5 text-[11px] text-slate-400">학부모님 휴대폰에는 이렇게 보여요{kakaoBody ? " · 카카오 알림톡" : ""}</p>
          <div
            className={`max-w-[85%] rounded-2xl rounded-tl-md px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap ${
              kakaoBody ? "bg-[#fef01b]/25 ring-1 ring-[#fef01b]/60" : "bg-slate-100"
            }`}
          >
            {kakaoBody ? (
              fillTemplate(kakaoBody, fitKakao(kakaoBody, { 학원: academyName, 이름: sampleNames, 공지내용: content }, "공지내용", "https://…/n/…"))
            ) : linkMode ? (
              <>
                [{academyName}] {sampleNames} 학부모님, 새 공지가 있어요. 아래 링크에서 확인해 주세요
                <span className="mt-1 flex items-center gap-1 text-[13px] text-sky-700 underline">
                  <Link2 size={13} /> 공지 보기 링크
                </span>
              </>
            ) : (
              full
            )}
          </div>
          {!kakaoBody && linkMode && <p className="mt-1.5 text-[11px] text-slate-400">링크를 누르면 위에 쓴 공지 전체가 보여요 (로그인 없이)</p>}
        </div>
      )}

      {waiting > 0 && (
        <p className="mt-3 rounded-xl bg-gold-soft px-3 py-2 text-[13px] text-[#8a6d35]">
          동의 안 한 {waiting}명은 빠져요 ·{" "}
          <Link href="/students" className="font-semibold underline">
            동의 요청 보내기
          </Link>
        </p>
      )}

      {short && recipients > 0 && (
        <div className="mt-4 rounded-xl bg-rose-50 p-3 text-[14px] leading-relaxed text-rose-800 ring-1 ring-rose-200">
          <p>
            남은 카톡 <b>{remaining}통</b>이라 <b>{recipients}명</b>에게 보낼 수 없어요.{" "}
            {canUpgrade
              ? `${PLUS_PRICE} 요금제로 올리거나 받는 사람을 줄여 주세요.`
              : "받는 사람을 줄이거나 다음 이용 기간까지 기다려 주세요."}
          </p>
          {canUpgrade && (
            <Link href="/billing#PLUS" className="mt-2 inline-block rounded-lg bg-rose-500 px-3 py-1.5 text-[13px] font-semibold text-white">
              {PLUS_PRICE}으로 올리기
            </Link>
          )}
        </div>
      )}

      {confirming ? (
        <div className="mt-4 rounded-xl bg-gold-soft p-3">
          <p className="text-center text-sm">
            <b>{targetLabel}</b> 학부모님 <b>{recipients}명</b>께 보낼까요?
            <span className={`mt-0.5 block text-[12px] ${recipients > remaining ? "font-semibold text-rose-600" : "text-slate-500"}`}>
              카톡 {recipients}통 · 이번 달 남은 {remaining}통{recipients > remaining && " — 모자라서 안 나가요"}
            </span>
          </p>
          <div className="mt-2.5 flex gap-2">
            <button type="button" onClick={() => setConfirming(false)} className="flex-1 rounded-xl bg-white py-3 text-sm font-medium">
              취소
            </button>
            <button
              type="button"
              onClick={send}
              disabled={pending || short}
              className="flex-1 rounded-xl bg-brand py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? "보내는 중…" : "보내기"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={!content.trim() || recipients === 0 || tooLong || short}
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
