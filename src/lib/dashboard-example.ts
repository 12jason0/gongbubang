// 대시보드 화면 데이터 모양

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
