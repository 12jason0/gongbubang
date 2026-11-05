"use client";

import { createContext, useContext, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * 대시보드 "예시 보기" 켜짐 상태. 화면에서만 쓰는 값이라 서버·DB 와 무관하다.
 * 켠 화면(경로)을 같이 기억해서, 다른 화면으로 가면 저절로 꺼진 것으로 본다.
 */
const Ctx = createContext<{ on: boolean; set: (on: boolean) => void }>({ on: false, set: () => {} });
export const useExampleMode = () => useContext(Ctx);

export function ExampleModeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [onAt, setOnAt] = useState<string | null>(null);
  const value = { on: onAt === pathname, set: (on: boolean) => setOnAt(on ? pathname : null) };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** 위쪽 바 오른쪽 동그란 "?" — 대시보드에서만 보인다 */
export function ExampleToggle() {
  const pathname = usePathname();
  const { on, set } = useExampleMode();
  if (pathname !== "/dashboard") return null;
  return (
    <button
      type="button"
      onClick={() => set(!on)}
      aria-pressed={on}
      aria-label={on ? "예시 화면 닫기" : "예시 화면 보기"}
      title={on ? "예시 화면 닫기" : "예시 데이터로 채운 화면 보기"}
      className={`grid size-10 place-items-center rounded-full text-[17px] font-bold transition active:scale-95 ${
        on ? "bg-brand text-white shadow-[0_6px_16px_-6px_rgb(12_86_59/0.6)]" : "glass text-brand hover:bg-white/80"
      }`}
    >
      ?
    </button>
  );
}
