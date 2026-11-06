import { kakaoEnabled } from "@/lib/kakao";
import { LoginForm } from "./LoginForm";

const KAKAO_ERROR: Record<string, string> = {
  fail: "카카오 로그인에 실패했어요. 잠시 뒤 다시 해 주세요.",
  cancel: "카카오 로그인을 취소했어요.",
};

/** 로그인 — 카카오 키(KAKAO_REST_API_KEY)가 있을 때만 [카카오로 시작하기]가 보임 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ kakao?: string }> }) {
  const { kakao } = await searchParams;
  return <LoginForm kakao={kakaoEnabled()} notice={kakao ? KAKAO_ERROR[kakao] ?? null : null} />;
}
