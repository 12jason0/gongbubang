import Link from "next/link";
import { cookies } from "next/headers";
import { KAKAO_PENDING_COOKIE, readPendingKakao } from "@/lib/kakao";
import { KakaoSignupForm } from "@/components/KakaoLogin";

export const metadata = { title: "카카오로 시작하기" };

/** 카카오 로그인은 됐고 아직 공부방이 없을 때 — 공부방 이름만 받는다 */
export default async function KakaoSignupPage() {
  const ok = !!(await readPendingKakao((await cookies()).get(KAKAO_PENDING_COOKIE)?.value));
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <div className="glass rounded-[28px] px-5 py-7 sm:px-7">
        {ok ? (
          <KakaoSignupForm />
        ) : (
          <>
            <h1 className="text-[22px] font-bold tracking-tight">카카오 로그인 시간이 지났어요</h1>
            <p className="mt-2 text-[15px] text-slate-500">로그인 화면에서 [카카오로 시작하기]를 다시 눌러 주세요.</p>
            <Link href="/login" className="mt-6 block rounded-xl bg-brand py-4 text-center text-base font-semibold text-white">
              로그인 화면으로
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
