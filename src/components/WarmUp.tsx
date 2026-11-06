"use client";

import { useEffect } from "react";

const IDLE_MS = 60_000; // 1분 넘게 다른 앱·탭에 있다가 돌아오면 DB 를 깨운다 (자주 부르지 않게)

/** 화면이 다시 보이면 /api/warm 을 한 번 불러 DB·서버를 미리 깨워 둔다 (아무것도 그리지 않음) */
export function WarmUp() {
  useEffect(() => {
    let hiddenAt = 0;
    const onChange = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > IDLE_MS) {
        hiddenAt = 0;
        fetch("/api/warm", { cache: "no-store" }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return null;
}
