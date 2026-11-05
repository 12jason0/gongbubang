"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { KeyRound, Phone, TriangleAlert } from "lucide-react";
import { changePassword, deleteAccount, updateOwnerPhone, type FormResult } from "@/app/actions";

const input = "field w-full rounded-xl border-0 px-3 py-3 text-[15px] outline-none focus:ring-2 focus:ring-gold";
const btn = "rounded-xl bg-brand px-4 py-3 text-[14px] font-semibold text-white disabled:opacity-50";

function Msg({ r }: { r: FormResult }) {
  if (!r) return null;
  return <p className={`mt-2 text-[13px] ${r.ok ? "text-emerald-700" : "text-rose-600"}`}>{r.message}</p>;
}

/** 원장님 연락처 수정 */
export function OwnerPhoneForm({ phone }: { phone: string }) {
  const [r, action, pending] = useActionState(updateOwnerPhone, null);
  return (
    <form action={action}>
      <label className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-500">
        <Phone size={14} /> 원장님 연락처
      </label>
      <div className="mt-1.5 flex gap-2">
        <input name="ownerPhone" defaultValue={phone} inputMode="tel" placeholder="010-1234-5678" className={input} />
        <button disabled={pending} className={`${btn} shrink-0`}>
          {pending ? "저장 중…" : "저장"}
        </button>
      </div>
      <Msg r={r} />
    </form>
  );
}

/** 비밀번호 변경 — 지금 비밀번호 확인 */
export function PasswordForm() {
  const [r, action, pending] = useActionState(changePassword, null);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="surface flex w-full items-center gap-2 rounded-xl px-3.5 py-3 text-[14px] font-semibold text-brand">
        <KeyRound size={16} /> 비밀번호 바꾸기
      </button>
    );
  }
  return (
    <form action={action} className="space-y-2">
      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-500">
        <KeyRound size={14} /> 비밀번호 바꾸기
      </p>
      <input name="current" type="password" autoComplete="current-password" placeholder="지금 비밀번호" className={input} />
      <input name="next" type="password" autoComplete="new-password" placeholder="새 비밀번호 (8자 이상)" className={input} />
      <input name="again" type="password" autoComplete="new-password" placeholder="새 비밀번호 한 번 더" className={input} />
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="surface flex-1 rounded-xl py-3 text-[14px] font-medium">
          닫기
        </button>
        <button disabled={pending} className={`${btn} flex-1`}>
          {pending ? "바꾸는 중…" : "비밀번호 바꾸기"}
        </button>
      </div>
      <Msg r={r} />
    </form>
  );
}

/** 탈퇴 — 경고 → 체크 → 비밀번호 확인 */
export function DeleteAccount() {
  const [r, action, pending] = useActionState(deleteAccount, null);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-[13px] text-slate-500 underline">
        공부방노트 탈퇴하기
      </button>
    );
  }
  return (
    <form action={action} className="rounded-2xl bg-rose-50 p-4 text-[14px] leading-relaxed text-rose-900 ring-1 ring-rose-200">
      <p className="flex items-center gap-1.5 font-bold">
        <TriangleAlert size={17} className="text-rose-500" /> 탈퇴하면 되돌릴 수 없어요
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>
          <b>바로 지워져요</b>: 학생·학부모 번호, 반, 출결, 수업 메모, 교습비(원비) 기록, 공지, 보낸 카톡·문자 기록
        </li>
        <li>
          교습비 영수증 원부는 원장님이 <b>5년</b> 보관해야 하는 장부예요.{" "}
          <Link href="/ledger" className="font-semibold underline">
            영수증 원부
          </Link>
          를 먼저 인쇄하거나 PDF로 저장해 두세요.
        </li>
        <li>결제 기록은 전자상거래법에 따라 5년 보관하되, 공부방 이름·아이디·연락처와의 연결은 끊어요.</li>
        <li>같은 연락처로 다시 가입해도 무료 체험은 다시 드리지 않아요.</li>
      </ul>
      <label className="mt-3 flex items-start gap-2">
        <input type="checkbox" name="confirm" className="mt-1 size-[18px] accent-rose-600" />
        <span>위 내용을 읽었고, 영수증 원부를 따로 보관했어요</span>
      </label>
      <input
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="비밀번호 확인"
        className={`${input} mt-3`}
      />
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-xl bg-white py-3 font-medium text-slate-700">
          그만두기
        </button>
        <button disabled={pending} className="flex-1 rounded-xl bg-rose-600 py-3 font-semibold text-white disabled:opacity-50">
          {pending ? "지우는 중…" : "탈퇴하기"}
        </button>
      </div>
      <Msg r={r} />
    </form>
  );
}
