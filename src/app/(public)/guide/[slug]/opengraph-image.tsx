import { ogImage, OG_SIZE } from "@/lib/og";
import { GUIDES } from "../guides";

export const alt = "공부방노트 원장님 안내";
export const size = OG_SIZE;
export const contentType = "image/png";
export const generateStaticParams = () => GUIDES.map((g) => ({ slug: g.slug }));

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = GUIDES.find((x) => x.slug === slug);
  return ogImage(g?.title ?? "공부방노트 원장님 안내", "공부방노트 · 원장님 안내");
}
