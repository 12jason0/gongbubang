"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Undo2 } from "lucide-react";

/** 화면 아래 5초 알림. undo 가 있으면 "되돌리기" 버튼이 같이 뜬다 */
export type ToastInput = {
  text: string;
  sub?: string; // 둘째 줄 안내 (예: 문자는 취소되지 않아요)
  tone?: "ok" | "err";
  undo?: () => void | Promise<void>;
};

const ToastContext = createContext<(t: ToastInput) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<(ToastInput & { id: number }) | null>(null);
  const [busy, setBusy] = useState(false);

  const show = useCallback((t: ToastInput) => setToast({ ...t, id: Date.now() }), []);

  // 새 알림이 오면 5초 다시 셈
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function undo() {
    const fn = toast?.undo;
    if (!fn || busy) return;
    setBusy(true);
    setToast(null);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[136px] z-30 mx-auto max-w-md px-3 md:bottom-24 md:left-56"
      >
        {toast && (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-[#1c2230] py-2.5 pr-2 pl-4 text-white shadow-xl"
          >
            {toast.tone === "err" ? (
              <CircleAlert size={18} className="shrink-0 text-rose-300" />
            ) : (
              <CheckCircle2 size={18} className="shrink-0 text-emerald-300" />
            )}
            <div className="min-w-0 flex-1 py-0.5">
              <p className="text-[14px] font-semibold">{toast.text}</p>
              {toast.sub && <p className="mt-0.5 text-[12px] text-white/60">{toast.sub}</p>}
            </div>
            {toast.undo && (
              <button
                onClick={undo}
                className="flex h-10 shrink-0 items-center gap-1 rounded-xl bg-white/10 px-3 text-[13px] font-semibold text-gold active:bg-white/20"
              >
                <Undo2 size={15} /> 되돌리기
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
