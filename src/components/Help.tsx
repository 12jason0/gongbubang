"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, X } from "lucide-react";

/**
 * 사용법 안내 — 위쪽 바 "?" 를 누르면 지금 화면 쓰는 법, 거기서 "처음 쓰는 법" 5단계.
 * 새로 가입한 원장님은 첫 화면(/students?guide=1)에서 5단계가 저절로 뜨고, "다시 안 보기" 전까지 로그인할 때마다 한 번 뜬다.
 * (이 브라우저에만 기억 — localStorage. ponytail: 기기를 바꾸면 다시 안 뜸, 필요하면 DB 칸으로)
 */

const STEPS = [
  { title: "학생 등록", text: "한 명씩, 명단 붙여넣기, 엑셀 파일을 그대로 올려도 돼요", href: "/students" },
  { title: "학부모 동의 요청", text: "학생·반 화면 위 [동의 요청 보내기]. 동의한 학부모님께만 카톡이 가요", href: "/students" },
  { title: "출석", text: "출석부에서 [출석]을 누르면 학부모님께 등원 카톡이 가요 (설정에서 켜기)", href: "/" },
  { title: "공지", text: "전체·반·고른 학생의 학부모님께 공지 내용이 카톡으로 바로 가요", href: "/notice" },
  { title: "원비", text: "월별 화면에서 납부 기록, 미납 안내 카톡, 영수증 원부 인쇄까지", href: "/stats" },
];

const PAGES: Record<string, { title: string; lines: string[] }> = {
  "/": {
    title: "출석부 쓰는 법",
    lines: [
      "그날 수업 있는 반 학생이 먼저 나와요. 위 칩으로 반별·전체를 골라 보세요.",
      "[출석]을 누르면 학부모님께 등원 카톡이 가요 (설정에서 켠 경우, 동의한 학부모님만).",
      "학생 이름을 누르면 수업 메모를 쓸 수 있고, 아래 [피드백 보내기]로 한 번에 보내요.",
      "전날·다음날로 지난 기록도 고칠 수 있어요. 지난 날짜는 카톡이 가지 않아요.",
    ],
  },
  "/notice": {
    title: "공지 쓰는 법",
    lines: [
      "받는 분을 전체·반·직접 고르기 중에서 골라요. 형제는 한 통으로 가요.",
      "쓴 내용이 학부모님 카톡에 그대로 보여요. 아주 길면 앞부분과 전체 보기 링크가 가요.",
      "할인·모집·이벤트 같은 광고는 보낼 수 없어요. 수업·휴원·일정 안내만 보내 주세요.",
      "학부모 동의를 안 한 학생은 빠져요.",
    ],
  },
  "/stats": {
    title: "월별 쓰는 법",
    lines: [
      "달마다 학생별 출석과 원비 납부를 한눈에 봐요.",
      "납부 기록을 넣으면 등록한 교습비·반 이름·지난 결제수단이 미리 채워져요.",
      "납부일이 지났는데 기록이 없으면 미납으로 보여요. [원비 안내]로 카톡을 보낼 수 있어요.",
      "교습비 영수증 원부는 여기서 인쇄해요 (5년 보관).",
    ],
  },
  "/calendar": {
    title: "달력 쓰는 법",
    lines: [
      "반에 요일·시각을 적어 두면 달력에 매주 보여요. 위 [시간표 설정]에서 넣어도 반으로 저장돼요 (예: 월·수·금 15:00~17:00 초등반).",
      "날짜를 누르면 그날 수업이 나와요. [보강 추가]는 그날만 수업 추가, [휴강]은 그날만 반복 수업 빼기(줄 그어 표시).",
      "아래 칸에 메모를 쓰고 엔터 — 댓글처럼 쌓이고, 메모 있는 날은 작은 점이 찍혀요. [공지 쓰기]를 누르면 메모 내용이 공지 칸에 들어가요.",
      "보낸 공지와 학생 납부일도 그 날짜에 같이 보여요.",
    ],
  },
  "/students": {
    title: "학생 쓰는 법",
    lines: [
      "학생은 한 명씩, 명단 붙여넣기, 엑셀 올리기로 넣어요. 교습비·납부일도 같이 넣을 수 있어요.",
      "목록 위 [동의 요청 보내기]로 학부모님께 카톡 동의를 받아요. 종이로 받았으면 수정에서 '동의'로.",
      "그만둔 학생은 [그만둠]으로 옮겨요. 출결 기록은 남아요.",
      "반은 위 '반' 탭에서 만들고, 학생 수정에서 듣는 반을 골라요.",
    ],
  },
  "/students?tab=classes": {
    title: "반 쓰는 법",
    lines: [
      "반 이름과 수업 요일·시각을 정해요. 시각까지 넣으면 달력에 매주 보여요.",
      "출석부에는 그날 수업 있는 반 학생이 먼저 나와요.",
      "학생이 듣는 반은 학생 탭 → 수정에서 골라요. 여러 반도 돼요.",
    ],
  },
  "/settings": {
    title: "설정 쓰는 법",
    lines: [
      "학원 이름은 학부모님 카톡 맨 앞 [ ] 에 들어가요.",
      "출석하면 등원 카톡 보내기를 여기서 켜고 꺼요.",
      "학부모님 카톡에 어떻게 가는지 미리보기로 볼 수 있어요.",
      "연락처·비밀번호·이용권은 마이페이지·이용권에서 바꿔요.",
    ],
  },
};

const SEEN_KEY = "gb_guide"; // "show" = 로그인할 때마다 5단계 띄움, 없으면 안 띄움

const Ctx = createContext<{ page: () => void; steps: () => void }>({ page: () => {}, steps: () => {} });
/** 어디서든 "처음 쓰는 법" 열기 (예: 대시보드 빈 화면 [사용법 보기]) */
export const useOpenGuide = () => useContext(Ctx).steps;

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDialogElement>(null);
  const [view, setView] = useState<"page" | "steps">("steps");
  // 처음 가입한 원장님 표시 ("다시 안 보기" 전까지) — 서버에선 false
  const auto = useSyncExternalStore(
    () => () => {},
    () => localStorage.getItem(SEEN_KEY) === "show" || location.search.includes("guide=1"),
    () => false,
  );

  // 학생·반 화면은 탭(?tab=classes)에 따라 다른 안내 — 누를 때 주소를 봄
  const pageNow = () => PAGES[pathname === "/students" && location.search.includes("tab=classes") ? "/students?tab=classes" : pathname];
  const [page, setPage] = useState<(typeof PAGES)[string] | undefined>(undefined);

  const open = (v: "page" | "steps") => {
    setPage(pageNow());
    setView(v);
    ref.current?.showModal();
  };
  const close = () => ref.current?.close();

  // 새로 가입한 원장님: ?guide=1 로 들어오면 기억해 두고(주소에선 지움), "다시 안 보기" 전까지 앱에 들어올 때마다 한 번
  useEffect(() => {
    if (location.search.includes("guide=1")) {
      localStorage.setItem(SEEN_KEY, "show");
      history.replaceState(null, "", location.pathname);
    }
    if (localStorage.getItem(SEEN_KEY) === "show") ref.current?.showModal();
  }, []);

  return (
    <Ctx.Provider value={{ page: () => open("page"), steps: () => open("steps") }}>
      {children}
      <dialog
        ref={ref}
        onClick={(e) => e.target === e.currentTarget && close()}
        className="glass m-auto w-[min(92vw,440px)] rounded-[24px] p-0 text-[#1c2230] backdrop:bg-[#0c281e]/35 backdrop:backdrop-blur-[3px]"
      >
        <div className="px-5 pt-5 pb-5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[18px] font-bold tracking-tight">{view === "steps" || !page ? "공부방노트 처음 쓰는 법" : page.title}</p>
            <button type="button" onClick={close} aria-label="닫기" className="-mt-1 -mr-1 grid size-9 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-white/70">
              <X size={18} />
            </button>
          </div>

          {view === "steps" || !page ? (
            <ol className="mt-3 space-y-2">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <Link href={s.href} onClick={close} className="surface flex items-center gap-3 rounded-2xl px-3.5 py-3 hover:bg-white/80">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-[14px] font-bold text-gold">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold">{s.title}</span>
                      <span className="block text-[12.5px] leading-snug text-slate-500">{s.text}</span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-slate-400" />
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <>
              <ul className="mt-3 space-y-2 text-[14.5px] leading-relaxed">
                {page.lines.map((l) => (
                  <li key={l} className="flex gap-2">
                    <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-gold" />
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setView("steps")}
                className="surface mt-4 flex w-full items-center justify-center gap-1 rounded-xl py-3 text-[14px] font-semibold text-brand"
              >
                처음 쓰는 법 5단계 보기 <ChevronRight size={15} />
              </button>
            </>
          )}

          {auto && view === "steps" && (
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem(SEEN_KEY);
                  close();
                }}
                className="surface flex-1 rounded-xl py-3 text-[14px] font-semibold text-slate-600"
              >
                다시 안 보기
              </button>
              <button type="button" onClick={close} className="flex-1 rounded-xl bg-brand py-3 text-[14px] font-semibold text-white">
                닫기
              </button>
            </div>
          )}
        </div>
      </dialog>
    </Ctx.Provider>
  );
}

/** 위쪽 바 오른쪽 동그란 "?" — 지금 화면 쓰는 법 (휴대폰 초록 헤더·PC 위쪽 바에 하나씩) */
export function HelpButton() {
  const { page } = useContext(Ctx);
  return (
    <button
      type="button"
      onClick={page}
      aria-label="사용법 보기"
      title="사용법 보기"
      className="glass grid size-9 shrink-0 place-items-center rounded-full text-[16px] font-bold text-brand transition hover:bg-white/80 active:scale-95 md:size-10 md:text-[17px]"
    >
      ?
    </button>
  );
}
