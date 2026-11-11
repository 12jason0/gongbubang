import { notFound } from "next/navigation";
import { requireAcademy } from "./session";

/** 관리자 = env ADMIN_LOGIN_IDS(쉼표로 여러 개)에 든 아이디로 로그인한 계정. 아니면 404 (화면이 있는 줄도 모르게) */
export async function requireAdmin() {
  const academy = await requireAcademy();
  const ids = (process.env.ADMIN_LOGIN_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!ids.includes(academy.loginId)) notFound();
  return academy;
}
