import { notFound } from "next/navigation";
import { requireAcademy } from "./session";

/** env ADMIN_LOGIN_IDS 에 든 아이디인지 — 관리자(개발자) 계정은 공부방으로 안 쓰고 관리자 화면만 본다 */
export function isAdminLoginId(loginId: string) {
  return (process.env.ADMIN_LOGIN_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean).includes(loginId);
}

/** 관리자 = env ADMIN_LOGIN_IDS(쉼표로 여러 개)에 든 아이디로 로그인한 계정. 아니면 404 (화면이 있는 줄도 모르게) */
export async function requireAdmin() {
  const academy = await requireAcademy();
  if (!isAdminLoginId(academy.loginId)) notFound();
  return academy;
}
