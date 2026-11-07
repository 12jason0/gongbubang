import { ogImage, OG_SIZE } from "@/lib/og";
import { TRIAL_TEXT } from "@/lib/seo";

export const alt = "공부방노트 — 출결·학부모 카톡 공지·원비 장부";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogImage("출결·학부모 카톡 공지·원비 장부를 한 곳에서", `공부방·교습소 원장님용 · 학부모님은 앱 설치 없이 · ${TRIAL_TEXT} 무료`);
}
