"use client";

/** 누르면 브라우저 확인창을 띄우고, [확인]일 때만 폼을 보낸다 (관리자 화면) */
export function ConfirmButton({ message, className, children }: { message: string; className?: string; children: React.ReactNode }) {
  return (
    <button className={className} onClick={(e) => !confirm(message) && e.preventDefault()}>
      {children}
    </button>
  );
}
