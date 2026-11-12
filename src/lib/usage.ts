import { after } from "next/server";
import { db, pageViews } from "@/db";

/**
 * 주요 행동 기록 (서버 액션에서 성공·실패가 정해진 뒤). 행동 이름과 결과 종류·숫자만 — 입력 내용·학생 정보는 넣지 말 것.
 * 응답 뒤에 저장해서 화면을 늦추지 않고, 저장 못 해도 그만.
 */
export function track(academyId: string, action: string, detail = "") {
  after(() => db.insert(pageViews).values({ academyId, kind: "ACTION", screen: action, detail }).then(() => {}, () => {}));
}

export type UsageEvent = { kind: string; screen: string; detail: string; at: Date };
export type Visit = { start: Date; minutes: number; steps: { text: string; action: boolean }[]; left: boolean; lastStay: number | null };

const VISIT_GAP = 30 * 60_000; // 30분 넘게 아무 기록이 없으면 새 방문

/** 이용 기록(오래된 → 최근) → 방문 단위. 같은 화면이 연달아 찍힌 것(다시 돌아옴 등)은 한 번만 */
export function toVisits(events: UsageEvent[]): Visit[] {
  const visits: (Visit & { end: Date; viewAt: Date | null })[] = [];
  for (const e of events) {
    let v = visits.at(-1);
    if (!v || e.at.getTime() - v.end.getTime() > VISIT_GAP) {
      v = { start: e.at, end: e.at, minutes: 0, steps: [], left: false, lastStay: null, viewAt: null };
      visits.push(v);
    }
    v.end = e.at;
    if (e.kind === "LEAVE") {
      v.left = true;
      v.lastStay = v.viewAt ? Math.round((e.at.getTime() - v.viewAt.getTime()) / 60_000) : null;
      continue;
    }
    v.left = false;
    if (e.kind === "VIEW") {
      const last = v.steps.at(-1);
      if (!last || last.action || last.text !== e.screen) v.steps.push({ text: e.screen, action: false });
      v.viewAt = e.at;
    } else {
      v.steps.push({ text: e.detail ? `${e.screen}(${e.detail})` : e.screen, action: true });
    }
  }
  return visits.map(({ start, end, steps, left, lastStay }) => ({ start, minutes: Math.round((end.getTime() - start.getTime()) / 60_000), steps, left, lastStay }));
}
