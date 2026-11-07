import { GUIDES } from "../(public)/guide/guides";
import { FAQ, SITE_DESCRIPTION, SITE_URL } from "@/lib/seo";

// AI 검색(ChatGPT·Perplexity 등)용 사이트 요약 — https://llmstxt.org
export const dynamic = "force-static";

export function GET() {
  const text = `# 공부방노트

> ${SITE_DESCRIPTION}

공부방노트는 공부방·교습소·소규모 학원 원장님이 휴대폰과 PC 브라우저에서 쓰는 관리 프로그램입니다. 학부모님은 앱 설치 없이 카카오톡 알림톡(실패 시 문자)으로 받습니다.

## 주요 기능
- 출결 관리: 그날 수업 있는 반 학생만 모아 출석·결석 체크, 출석 시 학부모님께 등원 카톡
- 학부모 공지: 전체·반·고른 학생 학부모님께 카톡으로 한 번에 (형제는 한 통)
- 수업 피드백: 학생별 수업 메모를 학부모님께 카톡으로
- 원비 관리: 월별 납부 기록, 미납 표시와 미납 안내 카톡
- 교습비등 영수증 원부: 분기·기간별 A4 양식 인쇄
- 학생 등록: 엑셀(.xlsx·.xls·.csv) 올리기, 명단 붙여넣기

## 자주 묻는 질문
${FAQ.map((f) => `### ${f.q}\n${f.a}`).join("\n\n")}

## 페이지
- [소개·요금](${SITE_URL}/)
${GUIDES.map((g) => `- [${g.title}](${SITE_URL}/guide/${g.slug}): ${g.description}`).join("\n")}
- [이용약관·환불 규정](${SITE_URL}/terms)
- [개인정보 처리방침](${SITE_URL}/privacy)
`;
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
