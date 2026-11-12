"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** 화면 이동 기록 보내기 (api/view 가 화면 이름으로 바꿔 저장). 화면 이동을 막지 않게 sendBeacon */
export function logView(key: string) {
  navigator.sendBeacon?.("/api/view", key);
}

/** 원장님 화면을 열 때마다 한 번 (주소 + 학생·반 탭만, 다른 주소 값은 안 보냄) */
export function PageView() {
  const path = usePathname();
  const tab = useSearchParams().get("tab");
  const key = tab ? `${path}?tab=${tab}` : path;
  useEffect(() => logView(key), [key]);
  return null;
}
