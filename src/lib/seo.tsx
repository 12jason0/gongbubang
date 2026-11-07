import { PLANS, TRIAL_DAYS } from "@/lib/pricing";

// 검색·카톡 공유 미리보기에 쓰는 공통 값. 주소는 APP_URL(운영 주소)을 따름
export const SITE_URL = process.env.APP_URL?.trim().replace(/\/+$/, "") || "https://gongbubang-tau.vercel.app";
export const SITE_NAME = "공부방노트";
export const SITE_TITLE = "공부방노트 — 공부방·교습소 출결 관리, 학부모 카톡 공지, 원비 장부 프로그램";
export const TRIAL_TEXT = TRIAL_DAYS === 14 ? "2주" : `${TRIAL_DAYS}일`;
export const SITE_DESCRIPTION = `공부방·교습소 원장님을 위한 출결 관리, 학부모 카톡 공지, 원비 관리, 교습비 영수증 원부 프로그램. 학부모님은 앱 설치 없이 카카오톡으로 받아요. ${TRIAL_TEXT} 무료.`;
export const KEYWORDS = [
  "공부방 프로그램",
  "공부방 학부모 공지",
  "공부방 출결 관리",
  "교습소 원비 관리",
  "교습비 영수증 원부",
  "학부모 카톡 알림",
  "공부방 출석 알림",
  "교습소 관리 프로그램",
];

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

/** 소개 페이지 FAQ — 화면과 구조화 데이터(FAQPage)가 같은 글을 씀 */
export const FAQ: { q: string; a: string }[] = [
  {
    q: "학부모님도 앱을 설치해야 하나요?",
    a: "아니요. 학부모님은 평소 쓰는 카카오톡으로 받아요. 공지·수업 피드백 링크를 누르면 브라우저에서 바로 열려서 앱 설치도, 회원가입도 필요 없어요.",
  },
  {
    q: "요금은 얼마인가요?",
    a: `가입하면 ${TRIAL_TEXT} 무료(카톡·문자 ${PLANS.TRIAL.quota}통)로 써 볼 수 있어요. 그 뒤로는 ${PLANS.BASIC.label} 월 ${won(PLANS.BASIC.price)}(${PLANS.BASIC.quota}통), ${PLANS.PLUS.label} 월 ${won(PLANS.PLUS.price)}(${PLANS.PLUS.quota}통) 중에서 골라요. 자동결제 없이 필요할 때 1개월씩 결제하고, 통수를 다 써도 출석 기록은 계속 할 수 있어요.`,
  },
  {
    q: "학부모님께 카톡은 어떻게 가나요?",
    a: "카카오 알림톡으로 학부모님 카카오톡에 공부방 이름과 함께 가요. 카톡을 쓰지 않는 번호라 알림톡이 실패하면 같은 내용이 문자로 대신 가요.",
  },
  {
    q: "출석 체크하면 학부모님께 바로 알림이 가나요?",
    a: "네. 출석부에서 [출석]을 누르면 학부모님께 등원 카톡이 가요(설정에서 켠 경우). 수업 메모를 써 두면 [피드백 보내기]로 여러 학부모님께 한 번에 보낼 수 있어요.",
  },
  {
    q: "학부모 동의는 꼭 받아야 하나요?",
    a: "네. 개인정보를 쓰기 때문에 동의한 학부모님께만 카톡이 가요. [동의 요청 보내기]를 누르면 학부모님이 카톡 링크에서 한 번 눌러 동의하고, 종이로 받으셨다면 직접 '동의'로 바꿔 두면 돼요.",
  },
  {
    q: "휴대폰과 컴퓨터 둘 다 쓸 수 있나요?",
    a: "네. 설치 없이 휴대폰·컴퓨터 브라우저에서 같은 계정으로 써요. 휴대폰 홈 화면에 추가하면 앱처럼 열리고, PC에서는 대시보드로 출석률·원비를 한눈에 봐요.",
  },
  {
    q: "지금 쓰는 학생 명단을 옮기기 번거롭지 않나요?",
    a: "엑셀 파일(.xlsx·.xls·.csv)을 그대로 올리거나 명단을 복사해 붙여 넣으면 한 번에 등록돼요. 교습비와 납부일도 같이 넣을 수 있어요.",
  },
  {
    q: "교습비 영수증 원부도 만들 수 있나요?",
    a: "네. 원비 납부를 기록해 두면 분기별이나 원하는 기간으로 교습비등 영수증 원부를 A4 양식으로 바로 인쇄할 수 있어요. 미납 학생은 [원비 안내]로 카톡을 보낼 수 있어요.",
  },
];

/** 구조화 데이터 — <script type="application/ld+json"> ( "<" 를 막아 스크립트가 끊기지 않게 ) */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export function homeJsonLd() {
  const org = {
    "@type": "Organization",
    "@id": `${SITE_URL}/#org`,
    name: SITE_NAME,
    ...(process.env.BUSINESS_NAME && { legalName: process.env.BUSINESS_NAME }),
    url: SITE_URL,
    logo: `${SITE_URL}/icons/icon-512.png`,
    ...(process.env.BUSINESS_CONTACT && {
      contactPoint: { "@type": "ContactPoint", telephone: process.env.BUSINESS_CONTACT, contactType: "customer support", availableLanguage: "Korean" },
    }),
  };
  const offer = (name: string, price: number, text: string) => ({ "@type": "Offer", name, price, priceCurrency: "KRW", description: text });
  const app = {
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, Android, iOS",
    inLanguage: "ko",
    publisher: { "@id": org["@id"] },
    offers: [
      offer(PLANS.TRIAL.label, 0, `${TRIAL_TEXT} 무료, 카톡·문자 ${PLANS.TRIAL.quota}통`),
      offer(PLANS.BASIC.label, PLANS.BASIC.price, `1개월 이용권, 카톡·문자 ${PLANS.BASIC.quota}통`),
      offer(PLANS.PLUS.label, PLANS.PLUS.price, `1개월 이용권, 카톡·문자 ${PLANS.PLUS.quota}통`),
    ],
  };
  const faq = {
    "@type": "FAQPage",
    mainEntity: FAQ.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
  return { "@context": "https://schema.org", "@graph": [org, app, faq] };
}
