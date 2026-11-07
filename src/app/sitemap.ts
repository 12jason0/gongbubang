import type { MetadataRoute } from "next";
import { GUIDES } from "./(public)/guide/guides";
import { SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    ...GUIDES.map((g) => ({ url: `${SITE_URL}/guide/${g.slug}`, lastModified: g.date, changeFrequency: "monthly" as const, priority: 0.8 })),
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
