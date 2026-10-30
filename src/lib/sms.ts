import crypto from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db, messageLogs } from "@/db";

/**
 * 솔라피(https://solapi.com) 문자 발송
 * - SOLAPI_API_KEY / SOLAPI_API_SECRET 이 비어 있으면 "테스트 모드":
 *   실제 문자는 안 나가고 MessageLog 에 TEST 로만 남는다.
 * - 짧으면 단문(SMS), 90바이트(한글 약 45자)를 넘으면 솔라피가 자동으로 장문(LMS)으로 보낸다.
 */

export type MessageKind = "ATTENDANCE" | "FEEDBACK" | "NOTICE";

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

type Outgoing = { to: string; text: string; studentId?: string | null; refDate?: string | null };

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

  let results: SendResult[];

  if (isTestMode()) {
    results = messages.map(() => ({ ok: true, test: true }));
  } else {
    results = await callSolapi(academy.senderPhone, messages);
  }

  await db.insert(messageLogs).values(
    messages.map((m, i) => ({
      academyId: academy.id,
      studentId: m.studentId ?? null,
      to: m.to,
      kind,
      text: m.text,
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

async function callSolapi(from: string, messages: Outgoing[]): Promise<SendResult[]> {
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
        messages: messages.map((m) => ({ to: m.to, from, text: m.text })),
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
