import crypto from "node:crypto";
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

type Outgoing = { to: string; text: string; studentId?: string | null };

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
    })),
  );

  return results;
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
