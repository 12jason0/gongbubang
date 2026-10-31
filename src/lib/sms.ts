import crypto from "node:crypto";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { db, messageLogs, academies, creditLedger } from "@/db";
import { MESSAGE_PRICE } from "./pricing";
import { alimtalkConfig, renderAlimtalk, solapiVariables, type AlimtalkKey, type AlimtalkVars } from "./alimtalk";

/**
 * 솔라피(https://solapi.com) 문자 발송
 * - SOLAPI_API_KEY / SOLAPI_API_SECRET 이 비어 있으면 "테스트 모드":
 *   실제 문자는 안 나가고 MessageLog 에 TEST 로만 남는다.
 * - 짧으면 단문(SMS), 90바이트(한글 약 45자)를 넘으면 솔라피가 자동으로 장문(LMS)으로 보낸다.
 * - 메시지에 alimtalk 가 붙어 있고 그 종류의 템플릿 ID 가 설정돼 있으면 카카오 알림톡으로 보낸다 (lib/alimtalk.ts).
 *   알림톡이 실패하면(카톡 없음 등) 솔라피가 같은 내용을 발신번호로 문자 대체 발송한다.
 */

export type MessageKind = "ATTENDANCE" | "FEEDBACK" | "NOTICE" | "PAYMENT";
export type Channel = "SMS" | "ALIMTALK";

export type SendResult = { ok: boolean; test: boolean; error?: string };

const SOLAPI_URL = "https://api.solapi.com/messages/v4/send-many/detail";

export function isTestMode() {
  return !process.env.SOLAPI_API_KEY || !process.env.SOLAPI_API_SECRET;
}

/** 문자 바이트 수 (한글 2바이트, 영문·숫자 1바이트) — SMS/LMS 구분 표시용 */
export function smsBytes(text: string): number {
  let n = 0;
  for (const ch of text) n += ch.charCodeAt(0) > 127 ? 2 : 1;
  return n;
}

export function isLongMessage(text: string) {
  return smsBytes(text) > 90;
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

// ───── 충전금 ─────

const KIND_LABEL: Record<MessageKind, string> = { ATTENDANCE: "등원", FEEDBACK: "피드백", NOTICE: "공지", PAYMENT: "원비 안내" };

/** 한 통에 차감할 금액(원) */
export function priceOf(m: { channel: Channel; text: string }) {
  if (m.channel === "ALIMTALK") return MESSAGE_PRICE.ALIMTALK;
  return isLongMessage(m.text) ? MESSAGE_PRICE.LMS : MESSAGE_PRICE.SMS;
}

/** 테스트 모드(솔라피 키 없음)에서는 실제로 안 나가니 차감도 안 함. 로컬 시험용으로 CHARGE_IN_TEST_MODE=true 면 차감 */
export function shouldCharge() {
  return !isTestMode() || process.env.CHARGE_IN_TEST_MODE === "true";
}

/** 잔액이 충분할 때만 한 번에 빼고 내역을 남긴다. 모자라면 false (아무것도 안 뺌) */
export async function takeCredit(academyId: string, won: number, memo: string): Promise<boolean> {
  if (won <= 0) return true;
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(academies)
      .set({ creditWon: sql`${academies.creditWon} - ${won}` })
      .where(and(eq(academies.id, academyId), gte(academies.creditWon, won)))
      .returning({ balance: academies.creditWon });
    if (!row) return false;
    await tx.insert(creditLedger).values({ academyId, amount: -won, balanceAfter: row.balance, kind: "USE", memo });
    return true;
  });
}

/** 충전금 넣기 (충전·환불·관리자 조정) */
export async function addCredit(academyId: string, won: number, kind: "CHARGE" | "REFUND" | "ADMIN", memo: string) {
  if (won === 0) return;
  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(academies)
      .set({ creditWon: sql`${academies.creditWon} + ${won}` })
      .where(eq(academies.id, academyId))
      .returning({ balance: academies.creditWon });
    if (row) await tx.insert(creditLedger).values({ academyId, amount: won, balanceAfter: row.balance, kind, memo });
  });
}

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
  const prices = prepared.map(priceOf);
  const charge = shouldCharge();
  const total = prices.reduce((a, b) => a + b, 0);
  let results: SendResult[];

  if (charge && !(await takeCredit(academy.id, total, `${KIND_LABEL[kind]} ${messages.length}건`))) {
    // 충전금이 모자라면 한 통도 안 보냄 (실패로 남아서 충전 후 "다시 보내기" 가능)
    const error = `충전금이 부족해요 (필요 ${total.toLocaleString("ko-KR")}원) — 설정 › 이용권·충전에서 충전해 주세요`;
    results = messages.map(() => ({ ok: false, test: false, error }));
  } else if (isTestMode()) {
    results = messages.map(() => ({ ok: true, test: true }));
  } else {
    results = await callSolapi(academy.senderPhone, prepared);
    // 접수 단계에서 실패한 건은 돌려줌
    const refund = prices.filter((_, i) => !results[i].ok).reduce((a, b) => a + b, 0);
    const failedN = results.filter((r) => !r.ok).length;
    if (charge && refund > 0) await addCredit(academy.id, refund, "REFUND", `${KIND_LABEL[kind]} 실패 ${failedN}건`);
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
