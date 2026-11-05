"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, CalendarCheck, CheckCircle2, Circle, Megaphone, MessageCircle, Wallet, X, type LucideIcon } from "lucide-react";
import { formatWon } from "@/lib/money";
import type { DashboardData } from "@/lib/dashboard-example";
import { useSyncExternalStore } from "react";
import { useOpenGuide } from "./Help";

const PANEL = "glass rounded-[28px] p-5";
const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`;

function Go({ href, className, style, children }: { href: string; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <Link href={href} style={style} className={`${className} transition hover:-translate-y-0.5 hover:bg-white/80`}>
      {children}
    </Link>
  );
}

/** 빈 칸: 안내 글 + 다음 할 일 버튼 */
function Empty({ text, href, action }: { text: string; href?: string; action?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center text-[14px] text-slate-400">
      {text}
      {href && action && (
        <Link href={href} className="flex items-center gap-1 rounded-full bg-brand px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-brand/90">
          {action} <ArrowRight size={14} aria-hidden />
        </Link>
      )}
    </div>
  );
}

const START_KEY = "gb_start_closed"; // "처음 시작하기"를 닫았으면 "1" (이 브라우저에만)
const startListeners = new Set<() => void>();

/** 대시보드 맨 위 "처음 시작하기" — 3가지를 다 하면 저절로 사라지고, [닫기]로 숨길 수도 있음 */
function StartChecklist({ setup }: { setup: DashboardData["setup"] }) {
  const openGuide = useOpenGuide();
  const closed = useSyncExternalStore(
    (cb) => {
      startListeners.add(cb);
      return () => startListeners.delete(cb);
    },
    () => localStorage.getItem(START_KEY) === "1",
    () => true, // 서버에선 숨김 (깜빡임 방지)
  );
  const steps = [
    { done: setup.students, title: "학생 등록", text: "이름·학년·학부모 번호. 엑셀 파일도 그대로 올릴 수 있어요", href: "/students", go: "학생 추가" },
    { done: setup.classes, title: "반 만들기", text: "요일·시각을 적으면 출석부와 달력에 매주 나와요", href: "/students?tab=classes", go: "반 만들기" },
    { done: setup.consent, title: "학부모 동의 요청", text: "동의한 학부모님께만 카톡이 가요. 첫 요청은 무료예요", href: "/students", go: "동의 요청" },
  ];
  const left = steps.filter((s) => !s.done).length;
  if (closed || left === 0) return null;

  return (
    <section className={`${PANEL} p-6`} aria-label="처음 시작하기">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[18px] font-bold">처음 시작하기</p>
          <p className="mt-0.5 text-[13.5px] text-slate-500">
            3가지 중 {3 - left}가지 했어요 · 다 하면 이 칸은 저절로 사라져요
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={openGuide}
            className="surface flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold text-brand hover:bg-white"
          >
            <BookOpen size={15} aria-hidden /> 사용법 보기
          </button>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(START_KEY, "1");
              startListeners.forEach((f) => f());
            }}
            className="surface flex items-center gap-1 rounded-full px-3.5 py-2 text-[13px] font-semibold text-slate-500 hover:bg-white"
          >
            <X size={14} aria-hidden /> 닫기
          </button>
        </div>
      </div>
      <ol className="mt-4 grid grid-cols-3 gap-3">
        {steps.map((s, i) => (
          <li key={s.title} className={`surface flex flex-col gap-2 rounded-2xl p-4 ${s.done ? "opacity-70" : ""}`}>
            <p className="flex items-center gap-2 text-[15px] font-semibold">
              {s.done ? <CheckCircle2 size={20} className="shrink-0 text-emerald-600" aria-label="완료" /> : <Circle size={20} className="shrink-0 text-slate-300" aria-hidden />}
              <span className={s.done ? "text-slate-500 line-through" : ""}>
                {i + 1}. {s.title}
              </span>
            </p>
            <p className="text-[12.5px] leading-snug text-slate-500">{s.text}</p>
            {!s.done && (
              <Link href={s.href} className="mt-auto flex w-fit items-center gap-1 rounded-full bg-brand px-3.5 py-1.5 text-[13px] font-semibold text-white">
                {s.go} <ArrowRight size={13} aria-hidden />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Kpi({ Icon, label, value, detail, href }: { Icon: LucideIcon; label: string; value: React.ReactNode; detail: React.ReactNode; href: string }) {
  return (
    <Go href={href} className={`${PANEL} flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-slate-500">{label}</span>
        <span className="grid size-9 place-items-center rounded-full bg-brand-soft text-brand">
          <Icon size={18} aria-hidden />
        </span>
      </div>
      <p className="text-[28px] leading-none font-bold tracking-tight text-brand tabular-nums">{value}</p>
      <p className="text-[12.5px] text-slate-500">{detail}</p>
    </Go>
  );
}

function SectionHead({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <Link href={href} className="surface flex h-8 items-center gap-1 rounded-full px-3 text-[12.5px] font-medium text-brand hover:bg-white">
        {linkLabel} <ArrowRight size={13} aria-hidden />
      </Link>
    </div>
  );
}

export function Dashboard({ data: d, today }: { data: DashboardData; today: string }) {

  const days = d.daily;
  const checkedDays = days.filter((x) => x.checked > 0);
  const avg = checkedDays.length
    ? Math.round((checkedDays.reduce((n, x) => n + x.present, 0) / checkedDays.reduce((n, x) => n + x.checked, 0)) * 100)
    : null;
  const maxClass = Math.max(1, ...d.classSizes.map((c) => c.count));
  const [, mm] = d.unpaid.month.split("-").map(Number);

  return (
    <>
      {/* 휴대폰: 대시보드는 PC 전용 */}
      <main className="px-3 pt-10 text-center md:hidden">
        <p className="text-[15px] text-slate-500">대시보드는 PC 화면에서 볼 수 있어요</p>
        <Link href="/" className="mt-4 inline-block rounded-xl bg-brand px-4 py-3 text-[15px] font-semibold text-white">
          출석부로 가기
        </Link>
      </main>

      <main className="hidden flex-col gap-4 px-3 pb-6 md:flex">
        <div className="flex items-end justify-between px-1">
          <div>
            <h1 className="text-[24px] font-bold tracking-tight">대시보드</h1>
            <p className="mt-0.5 text-[13px] text-slate-500">
              학생 {d.studentCount}명 · {md(today)} 기준
            </p>
          </div>
        </div>

        <StartChecklist setup={d.setup} />

        {/* 숫자 카드 4개 */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi
            Icon={CalendarCheck}
            label="오늘 출석"
            href="/"
            value={
              <>
                {d.today.present}
                <span className="text-[18px] font-semibold text-slate-400"> / {d.today.total}</span>
              </>
            }
            detail={d.today.total ? `오늘 수업 학생 ${d.today.total}명 중 출석` : "오늘은 수업이 없어요"}
          />
          <Kpi
            Icon={Wallet}
            label={`${mm}월 미납`}
            href="/stats"
            value={`${d.unpaid.count}명`}
            detail={
              d.unpaid.count
                ? `약 ${formatWon(d.unpaid.amount)}${d.unpaid.unknown ? ` · ${d.unpaid.unknown}명 금액 모름` : ""}`
                : "미납 학생이 없어요"
            }
          />
          <Kpi
            Icon={MessageCircle}
            label="이번 달 카톡"
            href="/billing"
            value={
              <span className={d.quota.remaining === 0 ? "text-rose-600" : undefined}>
                {d.quota.remaining}
                <span className="text-[18px] font-semibold text-slate-400"> / {d.quota.total}통</span>
              </span>
            }
            detail={d.quota.remaining === 0 ? "다 썼어요 · 요금제를 올리면 바로 보낼 수 있어요" : d.quota.note}
          />
          <Kpi
            Icon={Megaphone}
            label="이번 주 공지"
            href="/notice"
            value={`${d.noticesThisWeek}건`}
            detail="월요일부터 보낸 단체 공지"
          />
        </div>

        {/* 차트 2개 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section className={`${PANEL} flex flex-col`} aria-label="최근 30일 출석률">
            <SectionHead title="최근 30일 출석률" href="/stats" linkLabel="월별 보기" />
            {checkedDays.length === 0 ? (
              <Empty text="아직 출석 기록이 없어요" href="/" action="출석부 가기" />
            ) : (
              <>
                <p className="-mt-1 mb-3 text-[13px] text-slate-500">
                  평균 <b className="text-[18px] text-brand tabular-nums">{avg}%</b> · 체크한 학생 중 출석
                </p>
                <div className="relative h-44">
                  {[100, 50].map((p) => (
                    <div key={p} className="absolute inset-x-0 border-t border-dashed border-brand/10" style={{ bottom: `${p}%` }}>
                      <span className="absolute -top-2.5 -left-0.5 bg-transparent text-[10px] text-slate-400">{p}%</span>
                    </div>
                  ))}
                  <div className="absolute inset-0 left-8 flex items-end gap-[3px]">
                    {days.map((x) => {
                      const rate = x.checked ? Math.round((x.present / x.checked) * 100) : null;
                      return (
                        <div
                          key={x.date}
                          title={rate === null ? `${md(x.date)} 기록 없음` : `${md(x.date)} ${rate}% (${x.present}/${x.checked})`}
                          className={`flex-1 rounded-t-md ${rate === null ? "h-1 bg-slate-200/70" : x.date === today ? "bg-gold" : "bg-brand/85"}`}
                          style={rate === null ? undefined : { height: `${Math.max(rate, 3)}%` }}
                        />
                      );
                    })}
                  </div>
                </div>
                <div className="mt-2 ml-8 flex justify-between text-[11px] text-slate-400">
                  <span>{md(days[0].date)}</span>
                  <span>{md(days[15].date)}</span>
                  <span>오늘</span>
                </div>
              </>
            )}
          </section>

          <section className={`${PANEL} flex flex-col`} aria-label="반별 학생 수">
            <SectionHead title="반별 학생 수" href="/students?tab=classes" linkLabel="학생·반" />
            {d.classSizes.length === 0 ? (
              <Empty text="아직 만든 반이 없어요" href="/students?tab=classes" action="반 만들기" />
            ) : (
              <ul className="flex flex-col gap-3">
                {d.classSizes.map((c) => (
                  <li key={c.id}>
                    <div className="mb-1 flex justify-between text-[13.5px]">
                      <span className="truncate font-medium">{c.name}</span>
                      <span className="shrink-0 text-slate-500 tabular-nums">{c.count}명</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-brand-soft">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${(c.count / maxClass) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* 목록 3개 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <section className={`${PANEL} flex flex-col`} aria-label="오늘 수업">
            <SectionHead title="오늘 수업" href="/" linkLabel="출석부" />
            {d.todayClasses.length === 0 ? (
              d.classSizes.length ? (
                <Empty text="오늘은 수업이 없어요" />
              ) : (
                <Empty text="아직 만든 반이 없어요" href="/students?tab=classes" action="반 만들기" />
              )
            ) : (
              <ul className="flex flex-col gap-2">
                {d.todayClasses.map((c) => (
                  <li key={c.id}>
                    {/* 반 색: 달력·시간표와 같은 색 */}
                    <Go
                      href={`/?c=${c.id}`}
                      className="flex items-center gap-3 rounded-2xl py-3 pr-3.5 pl-3"
                      style={{ background: `${c.hex}17`, borderLeft: `4px solid ${c.hex}` }}
                    >
                      <span className="w-12 shrink-0 text-[13px] font-semibold tabular-nums" style={{ color: c.hex }}>
                        {c.time || "—"}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{c.name}</span>
                      <span className="shrink-0 text-[13px] text-slate-500 tabular-nums">
                        <b className="text-brand">{c.present}</b> / {c.total}명
                      </span>
                    </Go>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`${PANEL} flex flex-col`} aria-label="미납 학생">
            <SectionHead title={`${mm}월 미납 학생`} href="/stats" linkLabel="월별" />
            {d.unpaidList.length === 0 ? (
              d.studentCount ? <Empty text="이번 달 미납 학생이 없어요" /> : <Empty text="아직 학생이 없어요" href="/students" action="학생 추가" />
            ) : (
              <ul className="flex flex-col gap-2">
                {d.unpaidList.slice(0, 6).map((s) => (
                  <li key={s.id}>
                    {s.amount === null ? (
                      // 금액을 모르는 학생: 그 학생 수정 화면으로 바로 (교습비 넣기)
                      <div className="surface flex items-center gap-3 rounded-2xl px-3.5 py-2.5">
                        <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
                          {s.name} <span className="text-[12px] font-normal text-slate-400">{s.grade} · 금액 모름</span>
                        </span>
                        <Link
                          href={`/students?edit=${s.id}#s-${s.id}`}
                          className="shrink-0 rounded-full bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-white"
                        >
                          교습비 넣기
                        </Link>
                      </div>
                    ) : (
                      <Go href="/stats" className="surface flex items-center gap-3 rounded-2xl px-3.5 py-3">
                        <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
                          {s.name} <span className="text-[12px] font-normal text-slate-400">{s.grade}</span>
                        </span>
                        <span className="shrink-0 text-[13px] font-semibold text-rose-500 tabular-nums">{formatWon(s.amount)}</span>
                      </Go>
                    )}
                  </li>
                ))}
                {d.unpaidList.length > 6 && <li className="px-1 text-[12.5px] text-slate-400">외 {d.unpaidList.length - 6}명</li>}
              </ul>
            )}
          </section>

          <section className={`${PANEL} flex flex-col`} aria-label="최근 보낸 카톡">
            <SectionHead title="최근 보낸 카톡·문자" href="/stats" linkLabel="월별" />
            {d.recent.length === 0 ? (
              <Empty text="아직 보낸 카톡이 없어요" href="/notice" action="공지 보내기" />
            ) : (
              <ul className="flex flex-col gap-2">
                {d.recent.map((m) => (
                  <li key={m.id}>
                    <Go href="/stats" className="surface flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5">
                      <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-[11.5px] font-semibold text-brand">{m.kind}</span>
                      <span className="min-w-0 flex-1 truncate text-[13.5px]">
                        {m.to} <span className="text-[11.5px] text-slate-400">· {m.channel} {m.at}</span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${
                          m.ok === null ? "bg-amber-100 text-amber-700" : m.ok ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"
                        }`}
                      >
                        {m.ok === null ? "테스트" : m.ok ? "성공" : "실패"}
                      </span>
                    </Go>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
