"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * 이용 기록 보내기 (api/view 가 정해 둔 이름으로만 저장 — 목록에 없는 값은 버림). 화면 이동을 막지 않게 sendBeacon.
 * k: 화면 주소("/students") · "leave"(나감) · 행동("excel-try" 등). d: 행동 결과 (명 수·실패 종류)
 */
export function track(k: string, d?: string | number) {
  navigator.sendBeacon?.("/api/view", JSON.stringify({ k, d }));
}

/**
 * 원장님 화면을 열 때마다 한 번 (주소 + 학생·반 탭만, 다른 주소 값은 안 보냄).
 * 화면을 닫거나 다른 앱·탭으로 가면 "나감", 돌아오면 그 화면을 다시 남긴다. data-track 달린 버튼·링크를 누르면 그 행동도.
 */
export function PageView() {
  const path = usePathname();
  const tab = useSearchParams().get("tab");
  const key = tab ? `${path}?tab=${tab}` : path;
  useEffect(() => {
    track(key);
    const onVisible = () => track(document.visibilityState === "hidden" ? "leave" : key);
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [key]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const k = (e.target as Element | null)?.closest?.("[data-track]")?.getAttribute("data-track");
      if (k) track(k);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
