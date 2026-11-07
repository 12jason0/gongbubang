import type { Metadata, Viewport } from "next";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";
import { KEYWORDS, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  keywords: KEYWORDS,
  applicationName: SITE_NAME,
  // 카톡·페이스북 공유 미리보기 (이미지는 opengraph-image.tsx)
  openGraph: { type: "website", locale: "ko_KR", siteName: SITE_NAME, title: SITE_TITLE, description: SITE_DESCRIPTION },
  twitter: { card: "summary_large_image" },
  // 네이버 서치어드바이저·구글 서치콘솔 소유 확인 (구글·빙 값은 GOOGLE_SITE_VERIFICATION·BING_SITE_VERIFICATION 환경변수, 비우면 태그 안 나감)
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: {
      "naver-site-verification": "a1bb104b488324671286ec8fdae8f0220643cbf7",
      ...(process.env.BING_SITE_VERIFICATION && { "msvalidate.01": process.env.BING_SITE_VERIFICATION }),
    },
  },
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0c563b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
