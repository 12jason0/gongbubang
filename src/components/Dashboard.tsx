"use client";

import Link from "next/link";
import { ArrowRight, CalendarCheck, ClipboardCheck, Eye, Megaphone, MessageCircle, UserPlus, Wallet, X, type LucideIcon } from "lucide-react";
import { formatWon } from "@/lib/money";
import { exampleDashboard, type DashboardData } from "@/lib/dashboard-example";
import { useExampleMode } from "./ExampleMode";

const PANEL = "glass rounded-[28px] p-5";
const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`;

/** 예시 보기 중에는 눌러도 이동하지 않게 */
function Go({ href, still, className, children }: { href: string; still: boolean; className?: string; children: React.ReactNode }) {
  if (still) return <div className={className}>{children}</div>;
  return (
    <Link href={href} className={`${className} transition hover:-translate-y-0.5 hover:bg-white/80`}>
      {children}
    </Link>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="flex flex-1 items-center justify-center py-8 text-center text-[14px] text-slate-400">{text}</p>;
}

function Kpi({ Icon, label, value, detail, href, still }: { Icon: LucideIcon; label: string; value: React.ReactNode; detail: React.ReactNode; href: string; still: boolean }) {
  return (
    <Go href={href} still={still} className={`${PANEL} flex flex-col gap-3`}>
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

function SectionHead({ title, href, still, linkLabel }: { title: string; href: string; still: boolean; linkLabel: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {!still && (
        <Link href={href} className="surface flex h-8 items-center gap-1 rounded-full px-3 text-[12.5px] font-medium text-brand hover:bg-white">
          {linkLabel} <ArrowRight size={13} aria-hidden />
        </Link>
      )}
    </div>
  );
}

export function Dashboard({ data: real, today }: { data: DashboardData; today: string }) {
  const { on: example, set } = useExampleMode();
  const d = example ? exampleDashboard(today) : real;
  const still = example;
  const fresh = !example && real.studentCount === 0;

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

      <main className="hidden flex-col gap-4 pb-6 md:flex">
        {example && (
          <div className="flex items-center gap-3 rounded-[22px] bg-gold px-5 py-4 text-white shadow-[0_14px_30px_-16px_rgb(120_90_30/0.7)]">
            <Eye size={22} aria-hidden className="shrink-0" />
            <p className="flex-1 text-[17px] font-bold">
              예시 화면이에요 <span className="font-medium text-white/85">· 실제 데이터 아님</span>
            </p>
            <button
              type="button"
              onClick={() => set(false)}
              className="flex items-center gap-1 rounded-full bg-white px-4 py-2 text-[14px] font-semibold text-[#6b5428] hover:bg-white/90"
            >
              <X size={16} aria-hidden /> 닫기
            </button>
          </div>
        )}

        <div className="flex items-end justify-between px-1">
          <div>
            <h1 className="text-[24px] font-bold tracking-tight">대시보드</h1>
            <p className="mt-0.5 text-[13px] text-slate-500">
              {example ? "학생 15명 · 반 3개 예시" : `학생 ${d.studentCount}명`} · {md(today)} 기준
            </p>
          </div>
        </div>

        {fresh && (
          <section className={`${PANEL} flex items-center gap-5 p-6`}>
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
              <ClipboardCheck size={28} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[18px] font-bold">아직 출석 기록이 없어요</p>
              <p className="mt-1 text-[14px] text-slate-500">학생을 추가하고 출석을 체크하면 출석률·미납·카톡 기록이 여기에 모여요.</p>
            </div>
            <Link href="/students" className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 py-2.5 text-[14px] font-semibold text-white">
              <UserPlus size={16} aria-hidden /> 학생 추가하기
            </Link>
            <button
              type="button"
              onClick={() => set(true)}
              className="surface flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-[14px] font-semibold text-brand hover:bg-white"
            >
              <Eye size={16} aria-hidden /> 예시 화면 보기
            </button>
          </section>
        )}

        {/* 숫자 카드 4개 */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi
            Icon={CalendarCheck}
            label="오늘 출석"
            href="/"
            still={still}
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
            still={still}
            value={`${d.unpaid.count}명`}
            detail={
              d.unpaid.count
                ? `약 ${formatWon(d.unpaid.amount)}${d.unpaid.unknown ? ` · ${d.unpaid.unknown}명 금액 모름` : ""}`
                : "미납 학생이 없어요"
            }
          />
          <Kpi
            Icon={MessageCircle}
            label="카톡 충전금"
            href="/billing"
            still={still}
            value={formatWon(d.credit.won)}
            detail={`알림톡 약 ${d.credit.alimtalk.toLocaleString("ko-KR")}통 보낼 수 있어요`}
          />
          <Kpi
            Icon={Megaphone}
            label="이번 주 공지"
            href="/notice"
            still={still}
            value={`${d.noticesThisWeek}건`}
            detail="월요일부터 보낸 단체 공지"
          />
        </div>

        {/* 차트 2개 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section className={`${PANEL} flex flex-col`} aria-label="최근 30일 출석률">
            <SectionHead title="최근 30일 출석률" href="/stats" still={still} linkLabel="월별 보기" />
            {checkedDays.length === 0 ? (
              <Empty text="아직 출석 기록이 없어요" />
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
            <SectionHead title="반별 학생 수" href="/students?tab=classes" still={still} linkLabel="학생·반" />
            {d.classSizes.length === 0 ? (
              <Empty text="아직 만든 반이 없어요" />
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
            <SectionHead title="오늘 수업" href="/" still={still} linkLabel="출석부" />
            {d.todayClasses.length === 0 ? (
              <Empty text={d.classSizes.length ? "오늘은 수업이 없어요" : "아직 만든 반이 없어요"} />
            ) : (
              <ul className="flex flex-col gap-2">
                {d.todayClasses.map((c) => (
                  <li key={c.id}>
                    <Go href={`/?c=${c.id}`} still={still} className="surface flex items-center gap-3 rounded-2xl px-3.5 py-3">
                      <span className="w-12 shrink-0 text-[13px] font-semibold text-gold tabular-nums">{c.time || "—"}</span>
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
            <SectionHead title={`${mm}월 미납 학생`} href="/stats" still={still} linkLabel="월별" />
            {d.unpaidList.length === 0 ? (
              <Empty text={d.studentCount ? "이번 달 미납 학생이 없어요" : "아직 학생이 없어요"} />
            ) : (
              <ul className="flex flex-col gap-2">
                {d.unpaidList.slice(0, 6).map((s) => (
                  <li key={s.id}>
                    <Go href="/stats" still={still} className="surface flex items-center gap-3 rounded-2xl px-3.5 py-3">
                      <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
                        {s.name} <span className="text-[12px] font-normal text-slate-400">{s.grade}</span>
                      </span>
                      <span className="shrink-0 text-[13px] font-semibold text-rose-500 tabular-nums">
                        {s.amount === null ? "금액 모름" : formatWon(s.amount)}
                      </span>
                    </Go>
                  </li>
                ))}
                {d.unpaidList.length > 6 && <li className="px-1 text-[12.5px] text-slate-400">외 {d.unpaidList.length - 6}명</li>}
              </ul>
            )}
          </section>

          <section className={`${PANEL} flex flex-col`} aria-label="최근 보낸 카톡">
            <SectionHead title="최근 보낸 카톡·문자" href="/stats" still={still} linkLabel="월별" />
            {d.recent.length === 0 ? (
              <Empty text="아직 보낸 카톡이 없어요" />
            ) : (
              <ul className="flex flex-col gap-2">
                {d.recent.map((m) => (
                  <li key={m.id}>
                    <Go href="/stats" still={still} className="surface flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5">
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
