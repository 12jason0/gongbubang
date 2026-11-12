// 교습비등 영수증 원부 — 학원법 시행규칙 별지 제24호서식에 맞춘 인쇄 모양. 인쇄 모양은 전부 이 파일에서 고친다.
// A4 가로 한 장 = 납부 한 건: 왼쪽 "교습비등 영수증 원부"(공부방 보관), 오른쪽 "교습비등 영수증"(학부모님께) — 같은 내용 두 번.
// 저장된 값이 없는 칸(생년월일·신고번호·기타경비)은 빈칸으로 인쇄 → 원장님이 손으로 적는다.

import { BirthFill } from "./BirthFill";

export type LedgerRow = {
  serialNo: number | null; // 공부방별 일련번호 (lib/receipt-serial.ts)
  studentId: string;
  period: string; // "2026-11" — 몇 월분인지
  studentName: string;
  birthDate: string | null; // "2017-03-02"
  subject: string;
  tuition: number; // 실제 받은 교습비
  otherFee: number;
  paidOn: string; // "2026-10-30"
  canceled: boolean; // 원비 [삭제] = 취소 표시 → "취소" 도장 (번호는 그대로)
};

export type LedgerInfo = {
  registrationNo: string;
};

// ───── 고치기 쉬운 부분 ─────

const PAGE_CSS = `
  @page { size: A4 landscape; margin: 10mm; }
  @media print { html, body { background: #fff !important; } }
`;

const ymd = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return { y, m, day };
};
const periodText = (p: string) => `${Number(p.slice(0, 4))}년 ${Number(p.slice(5))}월`;
const birthText = (d: string) => {
  const { y, m, day } = ymd(d);
  return `${y}. ${m}. ${day}.`;
};
const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

// ───── 서식 그리기 ─────

const cell = "border border-black px-2 py-2.5 text-[12px] leading-snug";
const head = `${cell} bg-black/[0.04] text-center font-semibold`;

/** 한쪽 (원부 또는 영수증) */
function Half({ title, row, info, screenTools }: { title: string; row: LedgerRow; info: LedgerInfo; screenTools: boolean }) {
  const paid = ymd(row.paidOn);
  return (
    <div className="relative flex h-full flex-col border-2 border-black p-[5mm]">
      {row.canceled && (
        <span className="absolute top-[4mm] right-[5mm] rotate-[-8deg] rounded border-[3px] border-black px-3 py-0.5 text-[22px] font-bold tracking-[0.3em] text-black">
          취소
        </span>
      )}
      <h2 className="mt-1 mb-4 text-center text-[19px] font-bold tracking-[0.15em]">{title}</h2>
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col style={{ width: "16%" }} />
          <col style={{ width: "26%" }} />
          <col style={{ width: "58%" }} />
        </colgroup>
        <tbody>
          <tr>
            <th colSpan={2} className={head}>일련번호</th>
            <td className={`${cell} text-center tabular-nums`}>{row.serialNo ?? ""}</td>
          </tr>
          <tr>
            <th colSpan={2} className={head}>연월(분기)</th>
            <td className={`${cell} text-center`}>{periodText(row.period)}</td>
          </tr>
          <tr>
            <th rowSpan={4} className={head}>납부자</th>
            <th className={head}>등록(신고)번호</th>
            <td className={`${cell} text-center`}>{info.registrationNo}</td>
          </tr>
          <tr>
            <th className={head}>성명</th>
            <td className={`${cell} text-center`}>{row.studentName}</td>
          </tr>
          <tr>
            <th className={head}>생년월일</th>
            <td className={`${cell} text-center ${!row.birthDate && screenTools ? "bg-gold-soft print:bg-transparent" : ""}`}>
              {row.birthDate ? birthText(row.birthDate) : screenTools ? <BirthFill studentId={row.studentId} /> : ""}
            </td>
          </tr>
          <tr>
            <th className={head}>교습과목</th>
            <td className={`${cell} text-center`}>{row.subject}</td>
          </tr>
          <tr>
            <th rowSpan={2} className={head}>
              납부
              <br />
              명세
            </th>
            <th className={head}>교습비</th>
            <td className={`${cell} text-right tabular-nums`}>{won(row.tuition)}</td>
          </tr>
          <tr>
            <th className={head}>기타경비</th>
            <td className={`${cell} text-right tabular-nums`}>{row.otherFee ? won(row.otherFee) : ""}</td>
          </tr>
        </tbody>
      </table>

      <p className="mt-6 text-center text-[13px]">위와 같이 영수하였음을 증명합니다.</p>
      <p className="mt-5 text-center text-[13px] tracking-wide">
        {paid.y}년 <span className="inline-block w-7 text-right">{paid.m}</span>월 <span className="inline-block w-7 text-right">{paid.day}</span>일
      </p>
      <p className="mt-6 text-right text-[12.5px] leading-relaxed">
        학원설립ㆍ운영자, 교습자 또는 개인과외교습자
        <span className="ml-10 text-black/70">(서명 또는 인)</span>
      </p>
      <p className="mt-auto pt-4 text-[10.5px] text-black/70">※ 본 서식 외 교육감이 지정한 영수증을 사용할 수 있습니다.</p>
    </div>
  );
}

/** 납부 한 건 = A4 가로 한 장 (왼쪽 원부 · 오른쪽 영수증) */
export function ReceiptLedger({ rows, info }: { rows: LedgerRow[]; info: LedgerInfo }) {
  return (
    <div className="ledger-sheets space-y-6 print:space-y-0">
      <style>{PAGE_CSS}</style>
      {rows.map((r, i) => (
        <section
          key={`${r.serialNo}-${i}`}
          className="mx-auto grid h-[190mm] w-[277mm] grid-cols-2 gap-[8mm] bg-white p-[6mm] text-black shadow-sm ring-1 ring-black/5 break-inside-avoid print:h-[189mm] print:w-auto print:p-0 print:shadow-none print:ring-0 [&:not(:last-child)]:break-after-page"
        >
          <Half title="교습비등 영수증 원부" row={r} info={info} screenTools />
          <Half title="교습비등 영수증" row={r} info={info} screenTools={false} />
        </section>
      ))}
    </div>
  );
}
