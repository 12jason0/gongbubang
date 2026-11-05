import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { ShieldCheck } from "lucide-react";
import { db, academies, students } from "@/db";
import { readConsentCode } from "@/lib/alimtalk";
import { byGradeName } from "@/lib/templates";
import { ConsentAnswer } from "@/components/ConsentAnswer";

export const metadata: Metadata = { title: "학부모 동의", robots: { index: false, follow: false } };

/**
 * 학부모님이 동의 요청 카톡의 링크로 여는 화면 — 로그인 없이. 주소의 서명이 맞아야 열림.
 * 처리방침 요약 + [동의합니다] [동의하지 않아요]. 누르면 같은 학부모 번호의 형제 모두에게 적용.
 */
export default async function ConsentPage({ params }: { params: Promise<{ code: string }> }) {
  const code = decodeURIComponent((await params).code);
  const studentId = readConsentCode(code);
  if (!studentId) notFound();

  const [me] = await db
    .select({ academyId: students.academyId, parentPhone: students.parentPhone, academyName: academies.name })
    .from(students)
    .innerJoin(academies, eq(academies.id, students.academyId))
    .where(and(eq(students.id, studentId), isNull(academies.deletedAt)));
  if (!me) notFound();

  const kids = (
    await db
      .select({ name: students.name, grade: students.grade, consent: students.consent, consentAt: students.consentAt })
      .from(students)
      .where(and(eq(students.academyId, me.academyId), eq(students.parentPhone, me.parentPhone), eq(students.active, true)))
  ).sort(byGradeName);
  const names = kids.map((k) => k.name).join("·") || "학생";
  // 형제 중 하나라도 대기면 아직 답하지 않은 것으로
  const state = kids.some((k) => k.consent === "PENDING") ? "PENDING" : kids.every((k) => k.consent === "AGREED") ? "AGREED" : "DECLINED";
  const at = kids.map((k) => k.consentAt).find(Boolean);

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-slate-500">
        <span className="h-4 w-1 rounded-full bg-gold" />
        {me.academyName}
      </p>

      <article className="card mt-3 rounded-2xl p-5 text-[15px] leading-relaxed text-slate-700">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-gold">
            <ShieldCheck size={19} />
          </span>
          <div>
            <h1 className="text-[19px] leading-snug font-bold tracking-tight text-[#1c2230]">{names} 학부모님, 안녕하세요</h1>
            <p className="mt-0.5 text-[13px] text-slate-500">출결·공지 안내를 카카오톡으로 보내드리려고 해요</p>
          </div>
        </div>

        <dl className="mt-5 space-y-3 text-[14px]">
          <Item t="받는 정보">학생 이름·학년·생년월일(선택), 학부모님 휴대폰 번호, 출결·수업 메모·교습비 납부 기록</Item>
          <Item t="쓰는 곳">등원 알림, 수업 피드백, 공지, 교습비 안내를 카카오톡(알림톡)·문자로 보내기, 교습비 영수증 원부 작성</Item>
          <Item t="보관 기간">다니는 동안 보관하고, 그만둔 뒤 1년 안에 지워요. 교습비 영수증 원부는 법에 따라 5년 보관해요</Item>
          <Item t="맡기는 곳">카카오톡·문자 발송은 (주)솔라피, 서버·데이터 보관은 Neon·Vercel에 맡겨요</Item>
          <Item t="거부할 권리">동의하지 않으셔도 수업은 그대로예요. 카카오톡 안내만 가지 않아요. 언제든 바꾸실 수 있어요</Item>
        </dl>
        <Link href={`/privacy?a=${me.academyId}`} className="mt-3 inline-block text-[13px] font-semibold text-brand underline">
          개인정보 처리방침 전체 보기
        </Link>

        <ConsentAnswer code={code} state={state} at={at ? at.toISOString() : null} />
      </article>

      <p className="mt-4 text-center text-[12px] text-slate-400">이 화면은 학부모님께만 보내드린 주소로 열려요</p>
    </main>
  );
}

function Item({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[76px_1fr] gap-2">
      <dt className="font-semibold text-slate-500">{t}</dt>
      <dd>{children}</dd>
    </div>
  );
}
