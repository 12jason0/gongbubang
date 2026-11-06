import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { PLANS, TRIAL_DAYS } from "@/lib/pricing";

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
            가입 후 <b>{TRIAL_DAYS}일 무료 체험</b> — 모든 기능을 쓸 수 있고, 학부모님께 카톡·문자를 {PLANS.TRIAL.quota}통까지 보낼 수 있습니다.
          </li>
          <li>
            무료 체험 뒤에는 1개월 요금제를 결제해서 씁니다: <b>기본 {won(PLANS.BASIC.price)} (카톡·문자 {PLANS.BASIC.quota}통)</b> ·{" "}
            <b>넉넉 {won(PLANS.PLUS.price)} (카톡·문자 {PLANS.PLUS.quota}통)</b>. 자동으로 결제되지 않으며, 원할 때 다시 결제합니다.
          </li>
          <li>
            통수는 결제한 날부터 한 달 단위로 새로 셉니다. 카카오 알림톡·문자 모두 1건이 1통이며, 보내지 못한 메시지는 세지 않습니다.
            남은 통수는 다음 달로 넘어가지 않고, 통수를 다 쓰면 그 기간에는 학부모님께 자동 발송이 되지 않습니다(출석 기록은 계속 됩니다).
          </li>
          <li>이용 기간이 끝나면 기존 기록 보기와 영수증 원부 인쇄는 계속 되고, 출석 체크·발송 등은 이용권 결제 뒤에 다시 됩니다.</li>
        </ul>
      </Section>

      <Section title="3. 환불">
        <ul className="list-disc space-y-1 pl-5">
          <li>요금제(이용권): 결제한 날부터 7일 이내에 요청하시면 전액 환불합니다. 그 뒤에는 남은 기간을 환불하지 않습니다.</li>
          <li>요금제가 바뀌기 전에 충전한 충전금이 남아 있다면 요청하시면 환불합니다. 결제수단에 따라 결제 취소 또는 계좌로 돌려드립니다.</li>
          <li>환불 요청은 아래 연락처로 해 주세요.</li>
        </ul>
      </Section>

      <Section title="4. 원장님의 책임">
        학부모님 연락처를 등록할 때는 개인정보 수집·안내 수신 동의를 받아야 합니다. 안내 내용은 교습·출결에 관한 정보성 내용이어야 하며,
        광고를 보내면 안 됩니다.
      </Section>

      <Section title="5. 탈퇴">
        <ul className="list-disc space-y-1 pl-5">
          <li>마이페이지에서 비밀번호를 확인한 뒤(카카오로 가입한 계정은 안내 확인만) 언제든 탈퇴할 수 있습니다.</li>
          <li>
            탈퇴하면 학생·학부모님 연락처, 반, 출결, 수업 메모, 교습비(원비) 기록, 공지, 보낸 카카오톡·문자 기록을 <b>바로 지웁니다</b>.
            교습비 영수증 원부는 원장님이 법에 따라 5년 보관해야 하는 장부이므로, 탈퇴 전에 인쇄하거나 저장해 두셔야 합니다.
          </li>
          <li>
            요금제 결제 기록은 전자상거래법에 따라 <b>5년</b> 보관합니다. 이때 공부방 이름·아이디·원장님 연락처는 지워서 누구의
            기록인지 알 수 없게 합니다.
          </li>
          <li>
            무료 체험을 여러 번 받는 일을 막기 위해 원장님 연락처는 원래 번호로 되돌릴 수 없는 값으로만 바꿔 결제 기록과 같은 기간
            보관합니다. 같은 연락처로 다시 가입하면 무료 체험 없이 요금제를 결제해서 쓰게 됩니다.
          </li>
          <li>
            카카오로 로그인한 계정은 카카오 회원번호(카카오가 정한 번호, 이름·이메일은 받지 않음)를 로그인에만 씁니다. 탈퇴하면 카카오
            연결은 끊고, 같은 이유로 회원번호도 되돌릴 수 없는 값으로만 바꿔 같은 기간 보관합니다. 같은 카카오로 다시 가입하면 무료
            체험 없이 요금제를 결제해서 쓰게 됩니다.
          </li>
          <li>
            같은 학부모 명단으로 무료 체험을 반복하는 일을 막기 위해 학부모님 연락처도 원래 번호로 되돌릴 수 없는 값으로만 바꿔
            같은 기간 보관하며, 이 비교 외에는 쓰지 않습니다.
          </li>
          <li>남은 이용 기간의 환불은 3번 환불 규정을 따릅니다.</li>
        </ul>
      </Section>

      <Section title="6. 사업자 정보">
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
