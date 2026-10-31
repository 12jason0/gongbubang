import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { MESSAGE_PRICE, SUBSCRIPTION_PRICE, TRIAL_DAYS } from "@/lib/pricing";

export const metadata: Metadata = { title: "이용약관·환불 규정" };
export const dynamic = "force-dynamic"; // 사업자 정보·요금 env 를 배포 후에도 바로 반영

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

/**
 * 이용약관·환불 규정 — 로그인 없이 열림 (가입 화면, 결제 심사용).
 * ⚠ 초안. 실제 운영 전에 문구를 한 번 검토할 것. 사업자 정보는 env 의 BUSINESS_* 값.
 */
export default function TermsPage() {
  const biz = {
    name: process.env.BUSINESS_NAME ?? "",
    owner: process.env.BUSINESS_OWNER ?? "",
    no: process.env.BUSINESS_NO ?? "",
    address: process.env.BUSINESS_ADDRESS ?? "",
    contact: process.env.BUSINESS_CONTACT ?? "",
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 text-[15px] leading-relaxed text-slate-700">
      <div className="flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-gold">
          <FileText size={20} />
        </span>
        <h1 className="text-[22px] font-bold tracking-tight text-[#1c2230]">이용약관·환불 규정</h1>
      </div>

      <Section title="1. 서비스">
        공부방·학원 원장님이 웹 화면에서 출결, 학부모 안내(카카오 알림톡·문자), 교습비 납부 기록과 영수증 원부를 관리하는
        서비스입니다. 학부모님은 앱 설치 없이 카카오톡·문자로 안내를 받습니다.
      </Section>

      <Section title="2. 요금">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            가입 후 <b>{TRIAL_DAYS}일 무료 체험</b> — 모든 기능을 쓸 수 있습니다.
          </li>
          <li>
            무료 체험 뒤에는 <b>1개월 이용권 {won(SUBSCRIPTION_PRICE)}</b>을 결제해서 씁니다. 자동으로 결제되지 않으며, 원할 때 다시 결제합니다.
          </li>
          <li>
            학부모님께 보내는 메시지는 이용권과 <b>별도</b>로, 미리 충전한 충전금에서 건당 빠집니다 (무료 체험 중에도 같습니다).
            카카오 알림톡 {won(MESSAGE_PRICE.ALIMTALK)} · 문자 단문 {won(MESSAGE_PRICE.SMS)} · 문자 장문 {won(MESSAGE_PRICE.LMS)}.
            보내지 못한 메시지는 다시 충전금으로 돌려드립니다.
          </li>
          <li>이용 기간이 끝나면 기존 기록 보기와 영수증 원부 인쇄는 계속 되고, 출석 체크·발송 등은 이용권 결제 뒤에 다시 됩니다.</li>
        </ul>
      </Section>

      <Section title="3. 환불">
        <ul className="list-disc space-y-1 pl-5">
          <li>이용권: 결제한 날부터 7일 이내에 요청하시면 전액 환불합니다. 그 뒤에는 남은 기간을 환불하지 않습니다.</li>
          <li>충전금: 쓰지 않은 잔액은 요청하시면 환불합니다. 결제수단에 따라 결제 취소 또는 계좌로 돌려드립니다.</li>
          <li>환불 요청은 아래 연락처로 해 주세요.</li>
        </ul>
      </Section>

      <Section title="4. 원장님의 책임">
        학부모님 연락처를 등록할 때는 개인정보 수집·안내 수신 동의를 받아야 합니다. 안내 내용은 교습·출결에 관한 정보성 내용이어야 하며,
        광고를 보내면 안 됩니다.
      </Section>

      <Section title="5. 사업자 정보">
        <dl className="grid grid-cols-[88px_1fr] gap-y-1 text-[14px]">
          <dt className="text-slate-400">상호</dt>
          <dd>{biz.name || "—"}</dd>
          <dt className="text-slate-400">대표자</dt>
          <dd>{biz.owner || "—"}</dd>
          <dt className="text-slate-400">사업자번호</dt>
          <dd>{biz.no || "—"}</dd>
          <dt className="text-slate-400">주소</dt>
          <dd>{biz.address || "—"}</dd>
          <dt className="text-slate-400">연락처</dt>
          <dd>{biz.contact || "—"}</dd>
        </dl>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="text-[16px] font-bold text-[#1c2230]">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
