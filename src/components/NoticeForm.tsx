"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarClock, MessageSquareText, Send } from "lucide-react";
import { sendNotice, type NoticeResult } from "@/app/actions";
import { fillTemplate, LMS_MAX_BYTES, SCHEDULE_DATE_MAX, SCHEDULE_TEXT_MAX, textBytes } from "@/lib/templates";
import { PLANS, SMS_UNITS } from "@/lib/pricing";
import { formatDateLabel, shiftDate, todayKST } from "@/lib/date";

// 공지 종류: 수업 일정 안내(알림톡) / 기타 공지(문자 장문)
type NoticeType = "schedule" | "other";

// 수업 일정 안내의 #{종류} (lib/alimtalk.ts SCHEDULE_KINDS 와 같게 — 그 파일은 서버 전용이라 여기 따로 둠)
const KINDS = [
  { label: "휴원", hint: "하루 쉽니다. 보강 일정은 따로 안내드리겠습니다." },
  { label: "보강", hint: "오후 4시에 보강 수업이 있습니다." },
  { label: "수업 시간 변경", hint: "오후 5시 수업이 오후 6시로 바뀝니다." },
] as const;

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
  draft,
  students,
  waiting,
  classes,
  scheduleBody,
  scheduleKakao,
  remaining,
  canUpgrade,
}: {
  academyName: string;
  draft?: string; // 달력 메모에서 [공지 쓰기]로 왔을 때 미리 넣을 내용
  students: Student[];
  waiting: number; // 학부모 동의 대기·거부 학생 수 (공지를 안 받음)
  classes: { id: string; name: string }[];
  scheduleBody: string; // 수업 일정 안내 알림톡 본문 (lib/alimtalk.ts SCHEDULE)
  scheduleKakao: boolean; // 수업 일정 안내 템플릿 ID 가 있어서 알림톡으로 나가는지 (없으면 같은 글이 문자로)
  remaining: number; // 이번 달 남은 카톡 통수
  canUpgrade: boolean; // 넉넉(9,900원)보다 아래 요금제면 true
}) {
  const [res, setRes] = useState<NoticeResult>(null);
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<NoticeType>("schedule");
  const [kind, setKind] = useState<string>("");
  const [date, setDate] = useState("");
  const [content, setContent] = useState(draft ?? "");
  // target: "all" | 반 id | "pick"(직접 고르기)
  const [target, setTarget] = useState("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);

  const tomorrow = formatDateLabel(shiftDate(todayKST(), 1)).replace(" (", "("); // "11월 15일(토)"

  function changeType(t: NoticeType) {
    setType(t);
    setConfirming(false);
    setRes(null);
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
    fd.set("type", type);
    fd.set("content", content);
    if (type === "schedule") {
      fd.set("scheduleKind", kind);
      fd.set("scheduleDate", date);
    }
    startTransition(async () => {
      const r = await sendNotice(null, fd);
      setRes(r);
      setConfirming(false);
      if (r?.ok) {
        setContent("");
        setDate("");
        setKind("");
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

  // 미리보기는 첫 번째 학부모님 기준 (없으면 예시 이름)
  const sampleNames = (groups[0] ?? [{ name: "김하늘" }]).map((s) => s.name).join("·");
  const text = content.trim();

  // ── 종류별 글·한도·통수 ──
  const smsText = `[${academyName}] ${text}`;
  const smsB = textBytes(smsText);
  const isLong = smsB > 90;
  const scheduleText = fillTemplate(scheduleBody, {
    학원: academyName,
    호칭: `${sampleNames} 학생 학부모님`,
    이름: sampleNames,
    종류: kind || "○○",
    날짜: date.trim() || "○월 ○일",
    내용: text || "○○",
  });
  const ready = type === "schedule" ? !!kind && !!date.trim() && !!text : !!text;
  const tooLong =
    type === "schedule" ? date.trim().length > SCHEDULE_DATE_MAX || text.length > SCHEDULE_TEXT_MAX : smsB > LMS_MAX_BYTES;
  const perOne = type === "schedule" ? 1 : isLong ? SMS_UNITS.long : SMS_UNITS.short; // 한 분께 쓰는 통수
  const need = recipients * perOne;
  // 통수가 모자라면 보내기 전에 막는다 (서버도 한 번 더 막음)
  const short = need > remaining;
  const viaKakao = type === "schedule" && scheduleKakao;

  const label = "text-[13px] font-semibold text-slate-500";
  const field = "w-full rounded-xl border-0 px-3 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-gold field";

  return (
    <div className="card rounded-2xl p-4">
      {/* 1. 종류 고르기 */}
      <p className={label}>공지 종류</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {(
          [
            { id: "schedule", icon: CalendarClock, name: "수업 일정 안내", sub: "휴원 · 보강 · 수업 시간 변경" },
            { id: "other", icon: MessageSquareText, name: "기타 공지", sub: "자유롭게 써서 문자로" },
          ] as const
        ).map((t) => (
          <button
            type="button"
            key={t.id}
            onClick={() => changeType(t.id)}
            aria-pressed={type === t.id}
            className={`flex items-start gap-2.5 rounded-xl p-3 text-left ring-1 ${
              type === t.id ? "bg-brand text-white ring-brand" : "bg-white text-slate-700 ring-black/10"
            }`}
          >
            <t.icon size={18} className={`mt-0.5 shrink-0 ${type === t.id ? "text-gold" : "text-slate-400"}`} />
            <span>
              <span className="block text-[14px] font-semibold">{t.name}</span>
              <span className={`mt-0.5 block text-[12px] ${type === t.id ? "text-white/70" : "text-slate-400"}`}>{t.sub}</span>
            </span>
          </button>
        ))}
      </div>
      {type === "other" && (
        <p className="mt-2 rounded-xl bg-gold-soft px-3 py-2 text-[13px] text-[#8a6d35]">문자로 보내져요. 알림톡보다 발송비가 비싸요</p>
      )}

      {/* 2. 입력칸 */}
      {type === "schedule" ? (
        <>
          <p className={`mt-4 ${label}`}>안내 종류</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <button
                type="button"
                key={k.label}
                onClick={() => setKind(k.label)}
                aria-pressed={kind === k.label}
                className={`rounded-full px-3.5 py-2 text-[13px] font-semibold ${
                  kind === k.label ? "bg-brand text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <label htmlFor="notice-date" className={label}>
              해당 날짜
            </label>
            <button type="button" onClick={() => setDate(tomorrow)} className="rounded-lg px-2 py-1 text-[12px] font-semibold text-brand">
              내일 {tomorrow}
            </button>
          </div>
          <input
            id="notice-date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            maxLength={SCHEDULE_DATE_MAX}
            placeholder={`예: ${tomorrow}`}
            className={`mt-1.5 ${field}`}
          />

          <label htmlFor="notice-content" className={`mt-4 block ${label}`}>
            변경 내용
          </label>
          <textarea
            id="notice-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            maxLength={SCHEDULE_TEXT_MAX}
            placeholder={KINDS.find((k) => k.label === kind)?.hint ?? "예: 하루 쉽니다. 보강 일정은 따로 안내드리겠습니다."}
            className={`mt-1.5 resize-none leading-relaxed ${field}`}
          />
          <p className={`text-right text-[11px] ${text.length > SCHEDULE_TEXT_MAX ? "text-rose-500" : "text-slate-400"}`}>
            {text.length}/{SCHEDULE_TEXT_MAX}자
          </p>
        </>
      ) : (
        <>
          <label htmlFor="notice-content" className={`mt-4 block ${label}`}>
            내용
          </label>
          <textarea
            id="notice-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            placeholder={"다음 주부터 학교 시험 기간입니다.\n시험 대비 수업은 평소 시간에 진행합니다."}
            className={`mt-1.5 resize-none leading-relaxed ${field}`}
          />
          <p className={`text-right text-[11px] ${tooLong ? "text-rose-500" : "text-slate-400"}`}>
            <span className={isLong ? "text-[#8a6d35]" : ""}>{isLong ? "장문" : "단문"}</span> · {smsB.toLocaleString("ko-KR")}/
            {(isLong ? LMS_MAX_BYTES : 90).toLocaleString("ko-KR")}바이트
          </p>
        </>
      )}

      {/* 3. 학부모님이 받는 모양 */}
      {(type === "schedule" || text) && (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] text-slate-400">
            학부모님 휴대폰에는 이렇게 보여요 · {viaKakao ? "카카오 알림톡" : type === "schedule" ? "문자 (알림톡 승인 전)" : "문자"}
          </p>
          <div
            className={`max-w-[92%] rounded-2xl rounded-tl-md px-3.5 py-2.5 text-[14px] leading-relaxed break-words whitespace-pre-wrap ${
              viaKakao ? "bg-[#fef01b]/25 ring-1 ring-[#fef01b]/60" : "bg-slate-100"
            }`}
          >
            {type === "schedule" ? scheduleText : smsText}
          </div>
          {type === "schedule" && groups.length > 1 && <p className="mt-1.5 text-[11px] text-slate-400">학부모님마다 학생 이름이 바뀌어 들어가요</p>}
        </div>
      )}

      {/* 받는 분 */}
      <p className={`mt-5 ${label}`}>받는 분</p>
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
            남은 카톡 <b>{remaining}통</b>이라 <b>{recipients}명</b>에게 보낼 수 없어요
            {perOne > 1 && ` (문자라 한 분께 ${perOne}통씩, 모두 ${need}통)`}.{" "}
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
            <span className={`mt-0.5 block text-[12px] ${short ? "font-semibold text-rose-600" : "text-slate-500"}`}>
              {perOne > 1 ? `문자 ${recipients}건 · 한 분께 ${perOne}통씩 ${need}통` : `카톡 ${need}통`} · 이번 달 남은 {remaining}통
              {short && " — 모자라서 안 나가요"}
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
          disabled={!ready || recipients === 0 || tooLong || short}
          onClick={() => setConfirming(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-[15px] font-semibold text-white disabled:opacity-30"
        >
          <Send size={16} className="text-gold" /> {type === "schedule" ? "수업 일정 안내 보내기" : "문자로 공지 보내기"}
        </button>
      )}

      {res && <p className={`mt-2 text-center text-sm ${res.ok ? "text-emerald-600" : "text-rose-600"}`}>{res.message}</p>}
    </div>
  );
}
