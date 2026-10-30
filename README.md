# 공부방 출석부 (출결 + 학부모 문자 알림)

원장님이 휴대폰 웹 화면에서 **출석**을 누르면 학부모님께 등원 문자가 가고,
수업 메모를 써두면 **피드백 보내기** 한 번으로 학부모님들께 한꺼번에 보내지는 출석부.

- 학생·학부모: 설치할 것 없음 (학부모는 일반 문자로 받음)
- 원장님: 인터넷 주소 하나 (홈 화면에 추가하면 앱처럼 사용)

## 화면

| 화면 | 하는 일 |
|---|---|
| 출석부 | 그날 요일에 수업 있는 반 학생만 자동으로 표시, 출석 시 등원 문자, 수업 메모, 피드백 일괄 발송 |
| 공지 | 전체 또는 반을 골라 단체 문자 (형제는 한 번만), 보낸 공지 기록 |
| 월별 | 학생별 월 출석·결석 횟수, 이번 달 문자 사용량(단문/장문) |
| 학생·반 | 반 만들기(이름·요일·시각), 학생 추가·수정·반 배정(여러 반 가능), 그만둔 학생 숨기기 |
| 설정 | 학원 이름, 등원·피드백 문자 문구 (`{학원}` `{이름}` `{시각}` `{메모}`), 로그아웃 |

원장님마다 반 구성·문구가 달라도 코드는 그대로 — 전부 원장님이 화면에서 설정한다.

## 문자 규칙 (중복·실수 방지)

- 등원 문자는 **오늘 날짜 + 출석**일 때 학생당 하루 **한 번만** 나감. 여러 번 눌러도, 결석→출석으로 바꿔도 다시 안 나감
- 지난 날짜의 출결을 고치면 기록만 바뀌고 문자는 안 나감
- 결석은 문자 없이 기록만
- 피드백은 버튼을 눌러야 나감 (두 번 확인). 이미 보낸 메모는 고칠 수 없음
- 발송 실패하면 화면에 표시되고, 다시 보내기 가능
- 나간 문자는 전부 `message_logs` 테이블에 남음

## 내 컴퓨터에서 실행

준비물: Node.js 20 이상, PostgreSQL 주소 (무료: [Neon](https://neon.tech) 가입 → 프로젝트 만들기 → Connection string 복사)

```bash
npm install
cp .env.example .env      # 윈도우: copy .env.example .env
# .env 열어서 DATABASE_URL, SESSION_SECRET, SEED_PASSWORD 채우기
npm run db:push           # DB 테이블 만들기
npm run seed              # 원장님 계정 만들기 (+ 예시 반 5개·학생 8명)
npm run seed:reset        # 예시 데이터를 지우고 다시 넣기 (테스트용)
npm run dev               # http://localhost:3000
```

솔라피 키를 비워두면 **테스트 모드**: 문자는 안 나가고 화면 위에 노란 띠가 뜨고, 기록만 남음.

## 실제 문자 보내기 (솔라피)

1. [solapi.com](https://solapi.com) 가입 → 충전
2. **발신번호 등록**: 원장님 휴대폰 번호를 등록 (원장님 본인 인증 필요 — 전기통신사업법상 등록된 번호로만 발송 가능)
3. 콘솔에서 API Key / API Secret 발급
4. `.env` 에 `SOLAPI_API_KEY`, `SOLAPI_API_SECRET` 넣고, `SEED_SENDER_PHONE` 에 등록한 번호 넣고 `npm run seed` 다시 실행
5. 본인 번호를 학부모 번호로 넣은 테스트 학생으로 먼저 확인

한글 약 45자(90바이트)를 넘으면 장문(LMS)으로 나가서 건당 요금이 더 비쌈. 피드백은 대부분 장문.

## 배포 (Vercel)

1. GitHub에 올리기 (`.env` 는 자동으로 제외됨)
2. Vercel → New Project → 저장소 선택
3. Environment Variables 에 `.env` 의 값 넣기 (`DATABASE_URL`, `SESSION_SECRET`, `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`)
4. 배포 후 원장님 휴대폰에서 주소 열기 → 공유 → **홈 화면에 추가**

## 원장님 추가 (두 번째 공부방부터)

모든 테이블에 `academy_id` 가 있어서 같은 배포에 계정만 추가하면 됨.
`.env` 의 `SEED_ACADEMY_NAME`, `SEED_LOGIN_ID`, `SEED_PASSWORD`, `SEED_SENDER_PHONE` 을 바꾸고 `SEED_SAMPLE_STUDENTS="false"` 로 `npm run seed`.
(같은 솔라피 계정에 원장님별 발신번호를 각각 등록해야 함)

## 구조

```
src/
  app/
    (app)/page.tsx          출석부
    (app)/notice/page.tsx   단체 공지
    (app)/stats/page.tsx    월별 출결 + 문자 사용량
    (app)/students/page.tsx 학생·반 관리
    (app)/settings/page.tsx 학원 이름·문자 문구
    login/page.tsx          로그인
    actions.ts              모든 저장·발송 로직 (서버)
  components/               화면 조각 (출석 줄, 피드백 버튼, 공지 폼, 학생 관리)
  db/schema.ts              테이블 8개 (반·반 학생 포함)
  lib/sms.ts                솔라피 발송 + 테스트 모드
  lib/templates.ts          기본 문자 문구, 요일·정렬 도우미
  lib/date.ts               한국 시간 계산
  proxy.ts                  로그인 안 했으면 로그인 화면으로
scripts/seed.ts             원장님 계정 만들기
```

기술: Next.js 16 · TypeScript · Tailwind · Drizzle ORM · PostgreSQL · 솔라피 API

## 나중에 붙일 것 (원장님이 써보고 원하면)

- 원비 장부: 월별 결석 횟수 → 교육청 양식 출력
- 결석 시 학부모 안내 문자 (켜고 끄기)
- 카카오 알림톡 (카톡채널 심사 통과 후, 템플릿 승인 필요)
