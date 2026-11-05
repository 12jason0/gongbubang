import Link from "next/link";

// 로그인 없이 보는 화면(소개·로그인·가입·약관·처리방침) 공통 — 맨 아래 사업자 정보 (카카오 채널·결제 심사용)
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const env = (k: string) => process.env[k] || "—";
  return (
    <>
      {children}
      <footer className="mx-auto max-w-3xl px-6 pt-6 pb-10 text-[12px] leading-relaxed text-slate-500">
        <div className="border-t border-slate-300/60 pt-5">
          <p className="font-semibold text-slate-600">공부방노트</p>
          <p className="mt-1">
            상호 {env("BUSINESS_NAME")} <Bar /> 대표 {env("BUSINESS_OWNER")} <Bar /> 사업자등록번호 {env("BUSINESS_NO")}
          </p>
          <p>
            주소 {env("BUSINESS_ADDRESS")} <Bar /> 연락처 {env("BUSINESS_CONTACT")}
          </p>
          <p>통신판매업 신고 면제(간이과세자)</p>
          <p className="mt-2 flex gap-3">
            <Link href="/terms" className="underline">이용약관</Link>
            <Link href="/privacy" className="font-semibold underline">개인정보 처리방침</Link>
          </p>
          <p className="mt-2 text-slate-400">© 2026 {env("BUSINESS_NAME")} · 공부방노트</p>
        </div>
      </footer>
    </>
  );
}

const Bar = () => <span className="mx-1 text-slate-300">|</span>;
