"use client";

import { useEffect, useRef } from "react";

/** 한 번 더 묻는 화면 안 팝업 (브라우저 alert 대신). 네이티브 <dialog> 라 Esc·포커스 가두기는 브라우저가 해 줌 */
export function Confirm({
  open,
  title,
  body,
  ok,
  danger,
  onCancel,
  onOk,
}: {
  open: boolean;
  title: string;
  body?: string;
  ok: string;
  danger?: boolean;
  onCancel: () => void;
  onOk?: () => void; // 없으면 확인 버튼이 바깥 <form> 을 제출
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={onCancel}
      onClick={(e) => e.target === e.currentTarget && onCancel()} // 바깥(어두운 곳) 누르면 닫기
      className="glass m-auto w-[min(88vw,360px)] rounded-[24px] p-0 text-[#1c2230] backdrop:bg-[#0c281e]/35 backdrop:backdrop-blur-[3px]"
    >
      <div className="px-5 pt-6 pb-5">
        <p className="text-[17px] font-bold">{title}</p>
        {body && <p className="mt-2 text-[14px] leading-relaxed break-keep whitespace-pre-line text-slate-600">{body}</p>}
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onCancel} autoFocus className="surface flex-1 rounded-xl py-3 text-[14px] font-semibold text-slate-600">
            취소
          </button>
          <button
            type={onOk ? "button" : "submit"}
            onClick={onOk}
            className={`flex-1 rounded-xl py-3 text-[14px] font-semibold text-white ${danger ? "bg-rose-600" : "bg-brand"}`}
          >
            {ok}
          </button>
        </div>
      </div>
    </dialog>
  );
}

