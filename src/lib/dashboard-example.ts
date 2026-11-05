// 대시보드 화면 데이터 모양 + "?" 예시 보기용 고정 값.
// 예시 값은 화면에서만 쓴다 — DB·서버 액션과 연결하지 말 것.

import { shiftDate } from "./date";

export type DashboardData = {
  studentCount: number;
  today: { present: number; total: number };
  unpaid: { month: string; count: number; amount: number; unknown: number };
  quota: { remaining: number; total: number; note: string }; // 이번 기간 카톡 통수
  noticesThisWeek: number;
  daily: { date: string; present: number; checked: number }[]; // 최근 30일, 오래된 날 → 오늘
  classSizes: { id: string; name: string; count: number }[];
  todayClasses: { id: string; name: string; time: string; present: number; total: number }[];
  unpaidList: { id: string; name: string; grade: string; amount: number | null }[];
  recent: { id: string; kind: string; channel: string; to: string; ok: boolean | null; at: string }[]; // ok null = 테스트 기록
};

// 30일 출석률(%) — 0 은 수업 없는 날
const RATES = [92, 88, 0, 0, 95, 90, 86, 93, 100, 0, 0, 89, 94, 91, 87, 96, 0, 0, 90, 93, 85, 92, 97, 0, 0, 94, 88, 91, 95, 87];

/** 학생 15명 · 반 3개 · 미납 2명 · 카톡 기록 — 오늘 날짜만 받아서 만든다 (고정 값) */
export function exampleDashboard(today: string): DashboardData {
  return {
    studentCount: 15,
    today: { present: 9, total: 11 },
    unpaid: { month: today.slice(0, 7), count: 2, amount: 570000, unknown: 0 },
    quota: { remaining: 112, total: 150, note: "기본 요금제 · 다음 결제일에 다시 채워져요" },
    noticesThisWeek: 2,
    daily: RATES.map((r, i) => ({ date: shiftDate(today, i - 29), present: Math.round((r / 100) * 11), checked: r ? 11 : 0 })),
    classSizes: [
      { id: "ex-c1", name: "초등 영어 A", count: 6 },
      { id: "ex-c2", name: "중1 수학", count: 5 },
      { id: "ex-c3", name: "중2 영어", count: 4 },
    ],
    todayClasses: [
      { id: "ex-c1", name: "초등 영어 A", time: "15:30", present: 5, total: 6 },
      { id: "ex-c2", name: "중1 수학", time: "17:00", present: 4, total: 5 },
    ],
    unpaidList: [
      { id: "ex-s1", name: "박지호", grade: "초6", amount: 250000 },
      { id: "ex-s2", name: "윤서준", grade: "중1", amount: 320000 },
    ],
    recent: [
      { id: "ex-m1", kind: "등원", channel: "카톡", to: "김민준", ok: true, at: "16:02" },
      { id: "ex-m2", kind: "등원", channel: "카톡", to: "이서연", ok: true, at: "15:58" },
      { id: "ex-m3", kind: "피드백", channel: "카톡", to: "최하은", ok: false, at: "어제 19:40" },
      { id: "ex-m4", kind: "원비 안내", channel: "카톡", to: "박지호", ok: true, at: "어제 18:10" },
      { id: "ex-m5", kind: "공지", channel: "문자", to: "전체 15명", ok: true, at: "3일 전 20:05" },
    ],
  };
}
