/** "010-1234-5678" / "010 1234 5678" → "01012345678" */
export function normalizePhone(input: string): string {
  return input.replace(/\D/g, "");
}

/** 휴대폰 번호만 허용 (010, 011, 016~019) */
export function isValidMobile(digits: string): boolean {
  return /^01[016789]\d{7,8}$/.test(digits);
}

/** "01012345678" → "010-1234-5678" */
export function formatPhone(digits: string): string {
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return digits;
}
