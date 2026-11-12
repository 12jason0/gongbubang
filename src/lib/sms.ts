import crypto from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, messageLogs, academies } from "@/db";
import { quotaState } from "./plan";
import { PLANS, SMS_UNITS } from "./pricing";
import { textBytes } from "./templates";
import { alimtalkConfig, renderAlimtalk, solapiVariables, type AlimtalkKey, type AlimtalkVars } from "./alimtalk";

/**
 * 솔라피(https://solapi.com) 문자 발송
 * - SOLAPI_API_KEY / SOLAPI_API_SECRET 이 비어 있으면 "테스트 모드":
 *   실제 문자는 안 나가고 MessageLog 에 TEST 로만 남는다.
 * - 짧으면 단문(SMS), 90바이트(한글 약 45자)를 넘으면 솔라피가 자동으로 장문(LMS)으로 보낸다.
 * - 메시지에 alimtalk 가 붙어 있고 그 종류의 템플릿 ID 가 설정돼 있으면 카카오 알림톡으로 보낸다 (lib/alimtalk.ts).
 *   알림톡이 실패하면(카톡 없음 등) 솔라피가 같은 내용을 발신번호로 문자 대체 발송한다.
 */

// NOTICE: 기타 공지(문자만), SCHEDULE: 수업 일정 안내(알림톡)
export type MessageKind = "ATTENDANCE" | "FEEDBACK" | "NOTICE" | "SCHEDULE" | "PAYMENT" | "CONSENT";
export type Channel = "SMS" | "ALIMTALK";

export type SendResult = { ok: boolean; test: boolean; error?: string };

const SOLAPI_URL = "https://api.solapi.com/messages/v4/send-many/detail";

export function isTestMode() {
  return !process.env.SOLAPI_API_KEY || !process.env.SOLAPI_API_SECRET;
}

/** 문자 바이트 수 (한글 2바이트, 영문·숫자 1바이트) — SMS/LMS 구분 표시용 */
export function smsBytes(text: string): number {
  return textBytes(text);
}

export function isLongMessage(text: string) {
  return smsBytes(text) > 90;
}

/** 문자로만 보내는 글 한 통이 쓰는 통수 (기타 공지) */
export function smsUnits(text: string) {
  return isLongMessage(text) ? SMS_UNITS.long : SMS_UNITS.short;
}

function authHeader(apiKey: string, apiSecret: string) {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString("hex");
  const signature = crypto.createHmac("sha256", apiSecret).update(date + salt).digest("hex");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

type Outgoing = {
  to: string;
  text: string; // 문자로 보낼 때의 글
  alimtalk?: { key: AlimtalkKey; vars: AlimtalkVars }; // 알림톡으로 보낼 수 있으면 이걸로
  studentId?: string | null;
  refDate?: string | null;
  free?: boolean; // 통수에서 안 뺌 (학부모당 첫 동의 요청)
  units?: number; // 이 한 통이 쓰는 통수 (기본 1, 문자로만 가는 기타 공지는 smsUnits)
};

/** 실제로 나갈 모양: 알림톡 설정이 있으면 알림톡, 없으면 문자 */
type Prepared =
  | { channel: "SMS"; to: string; text: string }
  | { channel: "ALIMTALK"; to: string; text: string; pfId: string; templateId: string; vars: AlimtalkVars };

function prepare(m: Outgoing): Prepared {
  const cfg = m.alimtalk ? alimtalkConfig(m.alimtalk.key) : null;
  if (m.alimtalk && cfg) {
    return { channel: "ALIMTALK", to: m.to, text: renderAlimtalk(m.alimtalk.key, m.alimtalk.vars), vars: m.alimtalk.vars, ...cfg };
  }
  return { channel: "SMS", to: m.to, text: m.text };
}

// ───── 카톡 통수 (요금제) ─────
// 알림톡(과 알림톡 대신 나가는 문자)은 1건 = 1통, 문자로만 가는 기타 공지는 SMS_UNITS. 보내기 직전에 한 번에 확보하고, 실패·접수 거절된 만큼 돌려놓는다.

/** 이번 기간 통수에서 n통 확보. 모자라면 아무것도 안 빼고 ok:false */
export async function reserveQuota(academyId: string, n: number) {
  const [a] = await db
    .select({ plan: academies.plan, periodStart: academies.periodStart, createdAt: academies.createdAt, msgPeriod: academies.msgPeriod, msgUsed: academies.msgUsed })
    .from(academies)
    .where(eq(academies.id, academyId));
  if (!a) return { ok: false, key: "", remaining: 0, tier: "TRIAL" as const };
  const q = quotaState(a);
  // 기간이 바뀌었으면 0부터 (같은 줄을 동시에 고쳐도 조건부 UPDATE 한 번이라 넘치지 않음)
  const used = sql`(case when ${academies.msgPeriod} = ${q.key} then ${academies.msgUsed} else 0 end)`;
  const [row] = await db
    .update(academies)
    .set({ msgUsed: sql`${used} + ${n}`, msgPeriod: q.key })
    .where(and(eq(academies.id, academyId), sql`${used} + ${n} <= ${q.total}`))
    .returning({ id: academies.id });
  return { ok: !!row, key: q.key, remaining: row ? q.remaining - n : q.remaining, tier: q.tier };
}

/** 실패한 만큼 돌려놓기 (그사이 기간이 바뀌었으면 그대로 둠) */
export async function releaseQuota(academyId: string, key: string, n: number) {
  if (n <= 0) return;
  await db
    .update(academies)
    .set({ msgUsed: sql`${academies.msgUsed} - ${n}` }) // 음수 가능: 관리자 카톡 충전(app/(app)/admin)이 msgUsed 를 0 아래로 둔다
    .where(and(eq(academies.id, academyId), eq(academies.msgPeriod, key)));
}

export const QUOTA_USED_UP = "이번 달 카톡을 다 썼어요";

/** 이 종류가 지금 알림톡으로 나가는지 (화면 표시용) */
export function usesAlimtalk(key: AlimtalkKey) {
  return alimtalkConfig(key) !== null;
}

/**
 * 여러 통을 한 번에 보내고, 받는 사람별 성공/실패를 돌려준다.
 * 결과는 모두 MessageLog 에 남긴다.
 */
export async function sendMessages(
  academy: { id: string; senderPhone: string },
  kind: MessageKind,
  messages: Outgoing[],
): Promise<SendResult[]> {
  if (messages.length === 0) return [];

  const prepared = messages.map(prepare);
  let results: SendResult[];

  const unitsOf = (m: Outgoing) => (m.free ? 0 : (m.units ?? 1));
  const charged = messages.reduce((n, m) => n + unitsOf(m), 0);
  const quota = charged ? await reserveQuota(academy.id, charged) : { ok: true, key: "", remaining: 0, tier: "TRIAL" as const };
  if (!quota.ok) {
    // 통수가 모자라면 한 통도 안 보냄 (실패로 남아서 요금제를 올린 뒤 "다시 보내기" 가능)
    const up = quota.tier === "PLUS" ? "다음 이용 기간에 다시 채워져요" : `${PLANS.PLUS.price.toLocaleString("ko-KR")}원 요금제로 올리면 바로 보낼 수 있어요`;
    const error = `${QUOTA_USED_UP} (남은 ${quota.remaining}통, 필요 ${charged}통) — ${up}`;
    results = messages.map(() => ({ ok: false, test: false, error }));
  } else if (isTestMode()) {
    results = messages.map(() => ({ ok: true, test: true }));
  } else {
    // 발신번호가 빈 공부방(공용 번호 env 가 없을 때 가입한 계정)은 공용 번호로
    const from = academy.senderPhone || (process.env.DEFAULT_SENDER_PHONE ?? "").replace(/\D/g, "");
    results = await callSolapi(from, prepared);
    // 접수 단계에서 실패한 건은 통수에서 돌려놓음
    if (charged) await releaseQuota(academy.id, quota.key, messages.reduce((n, m, i) => n + (results[i].ok ? 0 : unitsOf(m)), 0));
  }

  await db.insert(messageLogs).values(
    messages.map((m, i) => ({
      academyId: academy.id,
      studentId: m.studentId ?? null,
      to: m.to,
      kind,
      channel: prepared[i].channel,
      text: prepared[i].text,
      status: results[i].test ? "TEST" : results[i].ok ? "SENT" : "FAILED",
      error: results[i].error ?? null,
      refDate: m.refDate ?? null,
    })),
  );

  // 같은 학생·같은 날짜 문자가 이번에 나갔으면, 전에 실패했던 기록은 "해결됨"
  for (const [i, m] of messages.entries()) {
    if (!results[i].ok || !m.studentId || !m.refDate) continue;
    await db
      .update(messageLogs)
      .set({ resolvedAt: new Date() })
      .where(
        and(
          eq(messageLogs.academyId, academy.id),
          eq(messageLogs.studentId, m.studentId),
          eq(messageLogs.kind, kind),
          eq(messageLogs.refDate, m.refDate),
          eq(messageLogs.status, "FAILED"),
          isNull(messageLogs.resolvedAt),
        ),
      );
  }

  return results;
}

// ───── 잔액 ─────

const BALANCE_URL = "https://api.solapi.com/cash/v1/balance";
const BALANCE_TTL = 5 * 60 * 1000; // 출석부 열 때마다 묻지 않게 5분 기억
let balanceCache: { at: number; won: number | null } | null = null;

/** 이 금액(원) 밑으로 내려가면 출석부 위에 경고. 장문 45원 기준 약 100통 */
export const LOW_BALANCE_WON = Number(process.env.SOLAPI_LOW_BALANCE ?? 5000);

/**
 * 솔라피 남은 금액(원). 잔액 + 포인트 (둘 다 문자 보내는 데 쓰임).
 * 테스트 모드이거나 조회에 실패하면 null — 그때는 경고를 띄우지 않는다.
 * GET /cash/v1/balance → { balance, point, ... } (솔라피 공식 Node SDK cashService.getBalance 기준)
 */
export async function getBalanceWon(): Promise<number | null> {
  if (isTestMode()) return null;
  if (balanceCache && Date.now() - balanceCache.at < BALANCE_TTL) return balanceCache.won;
  let won: number | null = null;
  try {
    const res = await fetch(BALANCE_URL, {
      headers: { Authorization: authHeader(process.env.SOLAPI_API_KEY!, process.env.SOLAPI_API_SECRET!) },
      signal: AbortSignal.timeout(3000), // 솔라피가 느려도 출석부는 바로 열리게
    });
    const body = (await res.json().catch(() => null)) as { balance?: unknown; point?: unknown } | null;
    if (res.ok && typeof body?.balance === "number") {
      won = body.balance + (typeof body.point === "number" ? body.point : 0);
    } else {
      console.error("솔라피 잔액 조회 실패", res.status, body);
    }
  } catch (e) {
    console.error("솔라피 잔액 조회 실패", e);
  }
  balanceCache = { at: Date.now(), won };
  return won;
}

/** 솔라피 요청 본문의 메시지 한 통 (알림톡은 text 를 넣으면 안 됨 — variables 와 함께 못 씀) */
export function solapiMessage(from: string, m: Prepared) {
  if (m.channel === "ALIMTALK") {
    return {
      to: m.to,
      from, // 알림톡 실패 시 이 번호로 문자 대체 발송 (솔라피에 등록된 번호여야 함)
      kakaoOptions: { pfId: m.pfId, templateId: m.templateId, variables: solapiVariables(m.vars), disableSms: false },
    };
  }
  return { to: m.to, from, text: m.text };
}

async function callSolapi(from: string, messages: Prepared[]): Promise<SendResult[]> {
  const apiKey = process.env.SOLAPI_API_KEY!;
  const apiSecret = process.env.SOLAPI_API_SECRET!;

  try {
    const res = await fetch(SOLAPI_URL, {
      method: "POST",
      headers: {
        Authorization: authHeader(apiKey, apiSecret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: messages.map((m) => solapiMessage(from, m)),
      }),
    });

    const body = (await res.json().catch(() => null)) as {
      failedMessageList?: { to?: string; statusMessage?: string; statusCode?: string }[];
      errorMessage?: string;
      errorCode?: string;
    } | null;

    if (!res.ok) {
      const error = body?.errorMessage ?? `솔라피 오류 (HTTP ${res.status})`;
      return messages.map(() => ({ ok: false, test: false, error }));
    }

    // 접수 단계에서 실패한 번호들 (잘못된 번호, 잔액 부족 등)
    const failed = new Map<string, string>();
    for (const f of body?.failedMessageList ?? []) {
      if (f.to) failed.set(f.to, f.statusMessage ?? f.statusCode ?? "발송 실패");
    }
    return messages.map((m) =>
      failed.has(m.to) ? { ok: false, test: false, error: failed.get(m.to) } : { ok: true, test: false },
    );
  } catch (e) {
    console.error("솔라피 호출 실패", e);
    const error = "인터넷 연결 문제로 문자를 보내지 못했어요";
    return messages.map(() => ({ ok: false, test: false, error }));
  }
}

// ───── 운영자 알림 ─────

/** 새 가입 알림을 받을 운영자 번호 (env ADMIN_NOTIFY_PHONE 로 바꿀 수 있음) */
const ADMIN_NOTIFY_PHONE = (process.env.ADMIN_NOTIFY_PHONE ?? "01022719824").replace(/\D/g, "");

/**
 * 운영자에게 문자 한 통 (공용 발신번호). 공부방 통수·발송 기록과 상관없음.
 * 실패해도 던지지 않고 로그만 남긴다 — 가입 같은 본 작업을 막지 않으려고.
 */
export async function notifyAdmin(text: string): Promise<void> {
  try {
    const from = (process.env.DEFAULT_SENDER_PHONE ?? "").replace(/\D/g, "");
    if (isTestMode() || !from || !ADMIN_NOTIFY_PHONE) {
      console.log("[운영자 알림 · 안 보냄]", text);
      return;
    }
    const [r] = await callSolapi(from, [{ channel: "SMS", to: ADMIN_NOTIFY_PHONE, text }]);
    if (!r.ok) console.error("운영자 알림 문자 실패", r.error);
  } catch (e) {
    console.error("운영자 알림 문자 실패", e);
  }
}
