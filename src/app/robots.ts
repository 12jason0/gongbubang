import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// AI 검색 봇(GPTBot·PerplexityBot 등)도 "*" 로 허용. 학부모 링크(/f /n /c /r)와 API 는 막음
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/f/", "/n/", "/c/", "/r/", "/api/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
