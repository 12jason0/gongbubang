// 반 색 — 달력·시간표·대시보드 "오늘 수업"에서 같은 색. DB 에는 키만 저장 (classes.color)

export const CLASS_COLORS = [
  { key: "green", hex: "#16a34a", label: "초록" },
  { key: "blue", hex: "#2563eb", label: "파랑" },
  { key: "violet", hex: "#7c3aed", label: "보라" },
  { key: "rose", hex: "#e11d48", label: "빨강" },
  { key: "amber", hex: "#d97706", label: "노랑" },
  { key: "teal", hex: "#0d9488", label: "청록" },
  { key: "orange", hex: "#ea580c", label: "주황" },
  { key: "pink", hex: "#db2777", label: "분홍" },
] as const;

export const isColorKey = (k: string) => CLASS_COLORS.some((c) => c.key === k);

/** 반 색 키. 색을 안 정한 예전 반은 id 로 늘 같은 색 */
export function classColorKey(c: { id: string; color?: string | null }): string {
  if (c.color && isColorKey(c.color)) return c.color;
  let h = 0;
  for (const ch of c.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CLASS_COLORS[h % CLASS_COLORS.length].key;
}

export const hexOfKey = (k: string) => CLASS_COLORS.find((x) => x.key === k)?.hex ?? CLASS_COLORS[0].hex;
export const classHex = (c: { id: string; color?: string | null }) => hexOfKey(classColorKey(c));

/** 새 반 색: 지금 반들이 가장 적게 쓴 색 (같으면 목록 앞쪽) → 안 겹치게 */
export function nextColor(used: string[]): string {
  const n = (k: string) => used.filter((u) => u === k).length;
  return [...CLASS_COLORS].sort((a, b) => n(a.key) - n(b.key))[0].key;
}

// ── 시각 "HH:MM" ↔ 분
export const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
export const fromMin = (n: number) => `${String(Math.floor(n / 60) % 24).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

