import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ClipboardCheck, LayoutDashboard, MessageCircle, ReceiptText } from "lucide-react";
import { PLANS, TRIAL_DAYS } from "@/lib/pricing";
import { FAQ, homeJsonLd, JsonLd, SITE_TITLE } from "@/lib/seo";
import { GUIDES } from "../guide/guides";

// 로그인 안 한 사람은 "/" 에서 이 화면을 봄 (proxy rewrite) → 대표 주소는 "/"
export const metadata: Metadata = { title: { absolute: SITE_TITLE }, alternates: { canonical: "/" } };

const FEATURES = [
  { Icon: ClipboardCheck, title: "출석부", text: "오늘 수업 있는 학생만 모아 보고, 한 번 눌러 출석·결석. 등원하면 학부모님께 바로 알려요." },
  { Icon: MessageCircle, title: "학부모 공지 (카카오톡)", text: "공지·수업 피드백을 카카오톡 알림톡으로 보내요. 학부모님은 앱 설치가 필요 없어요." },
  { Icon: ReceiptText, title: "원비 장부·영수증 원부", text: "달마다 누가 냈는지 한눈에. 미납 안내와 교습비 영수증 원부 인쇄까지." },
  { Icon: LayoutDashboard, title: "대시보드", text: "PC에서 출석률·원비·보낸 메시지를 한 화면에 모아 봐요." },
];

const won = (n: number) => n.toLocaleString("ko-KR");

export default function AboutPage() {
  const plans = [
    { name: PLANS.TRIAL.label, price: TRIAL_DAYS === 14 ? "2주 무료" : `${TRIAL_DAYS}일 무료`, quota: PLANS.TRIAL.quota },
    { name: PLANS.BASIC.label, price: `월 ${won(PLANS.BASIC.price)}원`, quota: PLANS.BASIC.quota },
    { name: PLANS.PLUS.label, price: `월 ${won(PLANS.PLUS.price)}원`, quota: PLANS.PLUS.quota },
  ];

  return (
    <main className="mx-auto max-w-3xl px-5 pt-10 md:pt-16">
      <JsonLd data={homeJsonLd()} />
      <section className="glass rounded-[28px] px-6 py-8 text-center md:px-10 md:py-12">
        <Image src="/icons/icon-192.png" alt="공부방노트" width={64} height={64} preload className="mx-auto rounded-2xl" />
        <h1 className="mt-4 text-[30px] font-bold tracking-tight text-brand md:text-[38px]">공부방노트</h1>
        <p className="mt-2 text-[16px] break-keep text-slate-600 md:text-[18px]">공부방 원장님을 위한 출결·학부모 공지·원비 장부</p>
        <div className="mx-auto mt-7 flex max-w-sm gap-2.5">
          <Link href="/signup" className="flex-1 rounded-xl bg-brand py-3.5 text-[15px] font-semibold text-white">
            무료로 시작하기
          </Link>
          <Link href="/login" className="surface flex-1 rounded-xl py-3.5 text-[15px] font-semibold text-brand">
            로그인
          </Link>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="px-1 text-[18px] font-bold tracking-tight">이런 걸 해요</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {FEATURES.map(({ Icon, title, text }) => (
            <div key={title} className="card rounded-2xl px-5 py-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-gold">
                <Icon size={20} />
              </span>
              <h3 className="mt-3 text-[16px] font-bold">{title}</h3>
              <p className="mt-1 text-[14px] leading-relaxed text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="px-1 text-[18px] font-bold tracking-tight">요금</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {plans.map((p) => (
            <div key={p.name} className="card rounded-2xl px-5 py-5">
              <p className="text-[14px] font-semibold text-slate-500">{p.name}</p>
              <p className="mt-1 text-[22px] font-bold tracking-tight text-brand">{p.price}</p>
              <p className="mt-1 text-[14px] text-slate-600">카톡·문자 {p.quota}통</p>
            </div>
          ))}
        </div>
        <p className="mt-2 px-1 text-[13px] text-slate-500">자동결제 없이, 필요할 때 1개월씩 결제해요.</p>
      </section>

      <section className="mt-8">
        <h2 className="px-1 text-[18px] font-bold tracking-tight">자주 묻는 질문</h2>
        <div className="mt-3 space-y-2">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="card rounded-2xl px-5 py-4">
              <summary className="cursor-pointer text-[15px] font-semibold">{q}</summary>
              <p className="mt-2 text-[14px] leading-relaxed break-keep text-slate-600">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="px-1 text-[18px] font-bold tracking-tight">원장님 안내</h2>
        <ul className="mt-3 grid gap-2 md:grid-cols-3">
          {GUIDES.map((g) => (
            <li key={g.slug}>
              <Link href={`/guide/${g.slug}`} className="card block h-full rounded-2xl px-5 py-4 text-[15px] font-semibold break-keep text-brand">
                {g.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
