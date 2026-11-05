"use client";

import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  window.addEventListener("scroll", cb, { passive: true });
  return () => window.removeEventListener("scroll", cb);
};

/** 맨 위 줄: 평소엔 배경 없이 화면에 그냥 얹힘. 스크롤해서 본문이 밑으로 지나갈 때만 흐린 유리 (globals.css .bar-scrolled) */
export function StickyBar({ className, children }: { className: string; children: React.ReactNode }) {
  const scrolled = useSyncExternalStore(subscribe, () => window.scrollY > 4, () => false);
  return <header className={`${className} transition-[background-color,box-shadow,backdrop-filter] duration-200 ${scrolled ? "bar-scrolled" : ""}`}>{children}</header>;
}
