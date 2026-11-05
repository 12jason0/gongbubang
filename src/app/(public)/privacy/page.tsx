import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { ShieldCheck } from "lucide-react";
import { db, academies } from "@/db";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "개인정보 처리방침" };

const EFFECTIVE = "2026년 11월 6일";

/**
 * 개인정보 처리방침 — 로그인 없이 열림 (학부모님이 동의 안내 문자의 링크로 들어옴)
 * /privacy?a=공부방id 로 열면 그 공부방 이름·연락처가 들어간다.
 */
export default async function PrivacyPage({ searchParams }: { searchParams: Promise<{ a?: string }> }) {
  const { a } = await searchParams;
  const [academy] =
    a && /^[\w-]{1,64}$/.test(a)
      ? await db
          .select({ name: academies.name, phone: academies.senderPhone })
          .from(academies)
          .where(eq(academies.id, a))
      : [];
  const who = academy ? `${academy.name}` : "이 공부방노트를 쓰는 공부방";

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 text-[15px] leading-relaxed text-slate-700">
      <div className="flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-gold">
          <ShieldCheck size={20} />
        </span>
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-[#1c2230]">개인정보 처리방침</h1>
          <p className="text-[13px] text-slate-500">{who}</p>
        </div>
      </div>

      <p className="mt-6">
        {who}(이하 &lsquo;공부방&rsquo;)은 출결 안내와 교습비 장부 작성을 위해 꼭 필요한 정보만 받고, 아래와 같이 다룹니다.
      </p>

      <Section title="1. 받는 정보">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>학생</b>: 이름, 학년, 생년월일(선택)
          </li>
          <li>
            <b>학부모님</b>: 휴대폰 번호
          </li>
          <li>
            <b>다니면서 생기는 기록</b>: 출석·결석, 수업 메모, 교습비 납부 기록, 보낸 카카오톡·문자 기록
          </li>
          <li id="consult">
            <b>상담 신청</b>(상담 신청 링크로 직접 적어 주신 것): 학부모님 성함, 연락처, 학생 학년, 문의 내용(선택)
          </li>
        </ul>
      </Section>

      <Section title="2. 쓰는 곳">
        <ul className="list-disc space-y-1 pl-5">
          <li>출결·수업·공지 안내를 카카오톡(알림톡)·문자로 보내기</li>
          <li>교습비 영수증 원부 등 개인과외교습자가 법에 따라 갖춰야 하는 장부 작성</li>
          <li>상담 신청: 상담 시간을 정하고 연락드리기 (상담 연락에만 씀)</li>
        </ul>
        <p className="mt-2">이 밖의 목적(광고 등)으로 쓰거나 다른 곳에 팔지 않습니다.</p>
      </Section>

      <Section title="3. 보관 기간">
        <ul className="list-disc space-y-1 pl-5">
          <li>학생이 다니는 동안 보관하고, 그만둔 뒤 1년 안에 지웁니다.</li>
          <li>
            단, 교습비 영수증 원부에 들어가는 정보(학생 이름·생년월일·교습비 납부 기록)는 관련 법령에 따라 <b>5년</b> 보관한 뒤
            지웁니다.
          </li>
          <li>
            상담 신청 정보는 <b>상담 날짜에서 6개월이 지나면 자동으로 지웁니다</b>. 상담 뒤 등록하시면 그때부터는 위 학생 정보로 다룹니다.
          </li>
          <li>
            공부방이 공부방노트를 그만 쓰면(탈퇴) 학생·학부모님 정보와 출결·수업 메모·교습비·문자·상담 신청 기록을 공부방노트에서{" "}
            <b>바로 지웁니다</b>. 5년 보관해야 하는 교습비 영수증 원부는 공부방이 탈퇴 전에 인쇄·저장해서 따로 보관합니다. 다만 같은 명단으로 무료 체험을
            반복하는지 확인하려고 학부모님 휴대폰 번호를 원래 번호로 되돌릴 수 없는 값으로만 바꿔 5년 보관하며, 이 확인 외에는 쓰지
            않습니다.
          </li>
        </ul>
      </Section>

      <Section title="4. 맡기는 일 (처리 위탁)">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr className="bg-slate-100 text-left">
              <th className="border border-slate-200 px-2 py-1.5">받는 곳</th>
              <th className="border border-slate-200 px-2 py-1.5">맡기는 일</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-200 px-2 py-1.5">(주)솔라피 (SOLAPI)</td>
              <td className="border border-slate-200 px-2 py-1.5">
                카카오톡(알림톡)·문자 발송 (학부모님 휴대폰 번호·보내는 내용). 알림톡은 솔라피를 거쳐 카카오톡으로 전달됩니다
              </td>
            </tr>
            <tr>
              <td className="border border-slate-200 px-2 py-1.5">Neon, Vercel</td>
              <td className="border border-slate-200 px-2 py-1.5">공부방노트 서버·데이터 보관</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-[14px]">
          서버·데이터 보관 업체(Neon, Vercel)는 해외(싱가포르 등) 클라우드에 데이터를 암호화된 연결로 저장합니다(국외 이전). 공부방노트를
          쓰는 동안 위 1번 정보가 저장되며, 보관 기간은 3번과 같습니다.
        </p>
      </Section>

      <Section title="5. 학부모님의 권리">
        <p>
          언제든 정보를 보여 달라고 하거나, 고치거나 지워 달라고 하실 수 있고, 카카오톡·문자를 그만 받겠다고 하실 수 있습니다. 아래 연락처로
          말씀해 주시면 바로 처리합니다.
        </p>
      </Section>

      <Section title="6. 개인정보 담당">
        <p>
          {academy ? (
            <>
              {academy.name} 원장 · <span className="tabular-nums">{formatPhone(academy.phone)}</span>
            </>
          ) : (
            "공부방 원장님 (문자를 보낸 번호로 연락해 주세요)"
          )}
        </p>
      </Section>

      <p className="mt-8 text-[13px] text-slate-400">시행일: {EFFECTIVE}</p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-[16px] font-bold text-[#1c2230]">{title}</h2>
      {children}
    </section>
  );
}
