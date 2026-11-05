"use client";

import { useRef, useSyncExternalStore } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { useToast } from "./Toast";

/** 설정 화면 맨 아래(접힘): 학부모 동의를 직접 받고 싶을 때 보낼 안내 문구. 기본은 학생·반 화면 [동의 요청 보내기] */
export function ConsentNotice({ academyId, academyName }: { academyId: string; academyName: string }) {
  const toast = useToast();
  const ref = useRef<HTMLTextAreaElement>(null);
  // 배포 주소 (서버에서 그릴 땐 비워 두고 브라우저에서 채움)
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );

  const link = `${origin}/privacy?a=${academyId}`;
  const text =
    `[${academyName}] 안녕하세요. 출결·수업·공지 안내를 카카오톡(알림톡)·문자로 보내드리기 위해 학생 이름·학년·생년월일과 ` +
    `학부모님 휴대폰 번호를 받아 보관합니다. (발송은 솔라피에 맡깁니다)\n` +
    `자세한 내용: ${link}\n` +
    `동의하시면 "동의"라고 답장 부탁드립니다.`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast({ text: "안내 문구를 복사했어요", sub: "학부모님께 문자나 카톡으로 붙여넣어 보내세요" });
    } catch {
      // 클립보드를 못 쓰는 브라우저: 글자를 선택해 두면 원장님이 직접 복사
      ref.current?.select();
      toast({ text: "글자를 선택해 뒀어요. 길게 눌러 복사해 주세요", tone: "err" });
    }
  }

  return (
    <details className="card group mt-3 rounded-2xl p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between text-[14px] font-semibold text-slate-600">
        학부모 동의 안내 문구 · 직접 보내고 싶을 때
        <span className="text-slate-400 transition-transform group-open:rotate-90">›</span>
      </summary>
      <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
        보통은 학생·반 화면의 [동의 요청 보내기]로 카톡 동의를 받아요. 종이·문자로 직접 받고 싶을 때 이 문구를 보내고, 동의를 받으면
        학생 수정에서 &lsquo;동의&rsquo;로 바꿔 주세요.
      </p>
      <textarea
        ref={ref}
        readOnly
        value={text}
        rows={8}
        className="mt-3 w-full resize-none rounded-xl border-0 px-3 py-2.5 text-[14px] leading-relaxed outline-none field"
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={copy}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand py-3 text-[14px] font-semibold text-white"
        >
          <Copy size={16} className="text-gold" /> 문구 복사하기
        </button>
        <a
          href={`/privacy?a=${academyId}`}
          target="_blank"
          className="flex items-center justify-center gap-1 rounded-xl bg-slate-100 px-4 text-[13px] font-medium text-slate-600"
        >
          <ExternalLink size={15} /> 처리방침 보기
        </a>
      </div>
    </details>
  );
}
