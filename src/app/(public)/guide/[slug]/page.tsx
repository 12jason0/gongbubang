import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GUIDES } from "../guides";
import { JsonLd, SITE_NAME, SITE_URL, TRIAL_TEXT } from "@/lib/seo";

export const dynamicParams = false;
export const generateStaticParams = () => GUIDES.map((g) => ({ slug: g.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const g = GUIDES.find((x) => x.slug === slug);
  if (!g) return {};
  return {
    title: g.title,
    description: g.description,
    alternates: { canonical: `/guide/${g.slug}` },
    openGraph: { type: "article", locale: "ko_KR", siteName: SITE_NAME, title: g.title, description: g.description, url: `/guide/${g.slug}` },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = GUIDES.find((x) => x.slug === slug);
  if (!g) notFound();

  return (
    <main className="mx-auto max-w-3xl px-5 pt-10 md:pt-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: g.title,
          description: g.description,
          datePublished: g.date,
          inLanguage: "ko",
          mainEntityOfPage: `${SITE_URL}/guide/${g.slug}`,
          author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
          publisher: { "@id": `${SITE_URL}/#org` },
        }}
      />
      <Link href="/" className="text-[13px] font-semibold text-brand">← 공부방노트</Link>
      <article className="card mt-3 rounded-[24px] px-6 py-8 text-[16px] leading-[1.8] break-keep text-slate-700 md:px-10">
        <p className="text-[13px] font-semibold text-gold">원장님 안내</p>
        <h1 className="mt-1 text-[26px] leading-snug font-bold tracking-tight text-[#1c2230] md:text-[30px]">{g.title}</h1>
        <p className="mt-3 text-[15px] text-slate-500">{g.description}</p>
        {g.body}
        <div className="mt-10 rounded-2xl bg-brand-soft px-5 py-5 text-center">
          <p className="font-semibold text-brand">출결·학부모 공지·원비 장부를 한 곳에서</p>
          <Link href="/signup" className="mt-3 inline-block rounded-xl bg-brand px-5 py-3 text-[15px] font-semibold text-white">
            공부방노트 {TRIAL_TEXT} 무료로 써 보기
          </Link>
        </div>
      </article>
      <nav className="mt-6 px-1">
        <p className="text-[14px] font-bold">다른 안내 글</p>
        <ul className="mt-2 space-y-1.5 text-[14px]">
          {GUIDES.filter((x) => x.slug !== g.slug).map((x) => (
            <li key={x.slug}>
              <Link href={`/guide/${x.slug}`} className="text-brand underline">{x.title}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
