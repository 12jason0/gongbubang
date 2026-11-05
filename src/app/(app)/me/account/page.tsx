import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireAcademy } from "@/lib/session";
import { PageTitle } from "@/components/PageTitle";
import { DeleteAccount, LogoutButton } from "@/components/MeForms";

export const metadata = { title: "계정 관리" };

/** 계정 관리 — 로그아웃·탈퇴는 여기에만 (잘못 누르지 않게 마이페이지보다 한 단계 안쪽) */
export default async function AccountPage() {
  const academy = await requireAcademy();
  return (
    <main className="px-3 pt-4 md:max-w-xl">
      <Link href="/me" className="mb-1 flex w-fit items-center gap-0.5 text-[13px] text-slate-500">
        <ChevronLeft size={16} /> 마이페이지
      </Link>
      <PageTitle title="계정 관리" sub={`${academy.name} · ${academy.loginId}`} />
      <section className="card divide-y divide-black/5 rounded-2xl">
        <LogoutButton />
        <DeleteAccount />
      </section>
    </main>
  );
}
