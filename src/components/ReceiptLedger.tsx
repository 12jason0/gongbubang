// 교습비등 영수증 원부 — 인쇄 모양은 전부 이 파일에서 고친다.
// 원장님이 쓰는 실제 양식에 맞출 때: 제목·머리말(SheetHeader), 칸 순서·이름·너비(COLUMNS),
// 빈 줄 수(MIN_ROWS), 종이 방향·여백(PAGE_CSS) 만 바꾸면 된다.

import { formatWon } from "@/lib/money";

export type LedgerRow = {
  period: string; // "2026-11"
  studentName: string;
  birthDate: string | null; // "2017-03-02"
  subject: string;
  tuition: number;
  otherFee: number;
  paidOn: string; // "2026-10-30"
};

export type LedgerInfo = {
  academyName: string;
  registrationNo: string;
  quarterLabel: string; // "2026년 4분기 (10월~12월)"
};

// ───── 고치기 쉬운 부분 ─────

const TITLE = "교습비등 영수증 원부";
const MIN_ROWS = 15; // 손으로 더 적을 수 있게 빈 줄을 채워 최소 이만큼
const PAGE_CSS = `
  @page { size: A4 landscape; margin: 10mm; }
  @media print { html, body { background: #fff !important; } }
`;

const dot = (s: string | null) => (s ? s.replaceAll("-", ".") : "");
const num = (n: number) => n.toLocaleString("ko-KR");

type Column = { label: string; width: string; align?: "left" | "right" | "center"; cell: (r: LedgerRow, i: number, info: LedgerInfo) => string };

const COLUMNS: Column[] = [
  { label: "일련번호", width: "6%", align: "center", cell: (_, i) => String(i + 1) },
  { label: "연월(분기)", width: "8%", align: "center", cell: (r) => dot(r.period) },
  { label: "등록(신고)번호", width: "12%", align: "center", cell: (_, __, info) => info.registrationNo },
  { label: "학생 성명", width: "9%", align: "center", cell: (r) => r.studentName },
  { label: "생년월일", width: "10%", align: "center", cell: (r) => dot(r.birthDate) },
  { label: "교습과목", width: "13%", cell: (r) => r.subject },
  { label: "교습비", width: "10%", align: "right", cell: (r) => num(r.tuition) },
  { label: "기타경비", width: "9%", align: "right", cell: (r) => (r.otherFee ? num(r.otherFee) : "") },
  { label: "날짜", width: "10%", align: "center", cell: (r) => dot(r.paidOn) },
  { label: "서명", width: "13%", cell: () => "" },
];

// ───── 표 그리기 ─────

const cellBase = "border border-black/70 px-1.5 py-1 text-[11px] leading-tight";
const alignCls = { left: "text-left", right: "text-right tabular-nums", center: "text-center" };

function SheetHeader({ info }: { info: LedgerInfo }) {
  return (
    <div className="mb-3">
      <h1 className="text-center text-[20px] font-bold tracking-[0.3em]">{TITLE}</h1>
      <div className="mt-3 flex items-end justify-between text-[12px]">
        <p>{info.quarterLabel}</p>
        <p>
          교습자(상호): {info.academyName}
          <span className="ml-4">신고번호: {info.registrationNo || "　　　　　　"}</span>
        </p>
      </div>
    </div>
  );
}

export function ReceiptLedger({ rows, info }: { rows: LedgerRow[]; info: LedgerInfo }) {
  const blanks = Math.max(0, MIN_ROWS - rows.length);
  const tuitionSum = rows.reduce((n, r) => n + r.tuition, 0);
  const otherSum = rows.reduce((n, r) => n + r.otherFee, 0);
  const sumAt = COLUMNS.findIndex((c) => c.label === "교습비");

  return (
    <div className="ledger-sheet bg-white text-black">
      <style>{PAGE_CSS}</style>
      <SheetHeader info={info} />
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          {COLUMNS.map((c) => (
            <col key={c.label} style={{ width: c.width }} />
          ))}
        </colgroup>
        <thead>
          <tr className="bg-black/5">
            {COLUMNS.map((c) => (
              <th key={c.label} className={`${cellBase} py-1.5 text-center font-semibold`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="h-[26px] break-inside-avoid">
              {COLUMNS.map((c) => (
                <td key={c.label} className={`${cellBase} ${alignCls[c.align ?? "left"]}`}>
                  {c.cell(r, i, info)}
                </td>
              ))}
            </tr>
          ))}
          {Array.from({ length: blanks }, (_, i) => (
            <tr key={`blank-${i}`} className="h-[26px]">
              {COLUMNS.map((c) => (
                <td key={c.label} className={cellBase} />
              ))}
            </tr>
          ))}
          <tr className="h-[28px] font-semibold">
            <td colSpan={sumAt} className={`${cellBase} text-center`}>
              합계 ({rows.length}건 · {formatWon(tuitionSum + otherSum)})
            </td>
            <td className={`${cellBase} ${alignCls.right}`}>{num(tuitionSum)}</td>
            <td className={`${cellBase} ${alignCls.right}`}>{otherSum ? num(otherSum) : ""}</td>
            <td colSpan={COLUMNS.length - sumAt - 2} className={cellBase} />
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-[10px] text-black/60">※ 이 장부는 5년간 보관합니다.</p>
    </div>
  );
}
