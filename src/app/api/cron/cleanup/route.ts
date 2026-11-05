import { deleteOldConsults } from "@/lib/consult-db";

// 매일 한 번 Vercel Cron 이 부름 (vercel.json). 상담 날짜에서 6개월 지난 상담 신청을 지운다 (개인정보 처리방침의 보관 기간)
// CRON_SECRET 을 넣어 두면 Vercel 이 Authorization 헤더로 보내고 여기서 확인. 없어도 하는 일은 "오래된 것 지우기"뿐
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("unauthorized", { status: 401 });
  const deleted = await deleteOldConsults();
  return Response.json({ deleted });
}
