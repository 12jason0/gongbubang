"use client";

import { useRef, useSyncExternalStore } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { useToast } from "./Toast";

/** 설정 화면: 학부모님께 보낼 개인정보 동의 안내 문구 (복사해서 문자·카톡으로 보냄) */
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
    `[${academyName}] 안녕하세요. 출결·수업 안내 문자를 보내드리기 위해 학생 이름·학년·생년월일과 ` +
    `학부모님 휴대폰 번호를 받아 보관합니다. (문자 발송은 솔라피에 맡깁니다)\n` +
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
    <section className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
      <h2 className="text-[15px] font-bold">학부모님 동의 안내 문구</h2>
      <p className="mt-0.5 text-[12px] text-slate-500">학생을 추가하기 전에 이 문구를 보내고 동의를 받아 주세요</p>
      <textarea
        ref={ref}
        readOnly
        value={text}
        rows={6}
        className="mt-3 w-full resize-none rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-[14px] leading-relaxed ring-1 ring-black/5 outline-none"
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
    </section>
  );
}
