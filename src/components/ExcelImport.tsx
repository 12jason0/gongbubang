"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Download, FileSpreadsheet, RotateCcw, Undo2 } from "lucide-react";
import { addStudentsImport, undoStudentsImport, type ImportResult } from "@/app/actions";
import { cellText, excelBirth, guessColumns, hasHeader, type Field } from "@/lib/excel-import";
import { checkImportRow, ROSTER_MAX_LINES, type ImportInput } from "@/lib/roster";
import { formatPhone } from "@/lib/phone";
import { parseDueDay, parseFee } from "@/lib/money";
import { track } from "./PageView";

/**
 * 학생 추가 → 엑셀 올리기. 파일(.xlsx·.xls·.csv)은 브라우저에서 바로 읽고 서버로 보내지 않는다 (SheetJS, cdn.sheetjs.com 판).
 * 칸 이름을 보고 필요한 칸(이름·학부모 번호·학년·반·교습비·납부일)만 찾아 바로 저장 → 결과 + [되돌리기].
 * 학부모 번호(또는 이름) 칸을 정말 못 찾을 때만 한 번 물어봄.
 */

const TEMPLATE = [
  ["이름", "학년", "학부모 번호", "반", "교습비", "납부일"],
  ["김민준", "초5", "010-1234-5678", "초등 영어 A", 250000, "10일"],
  ["이서연", "중2", "010-9876-5432", "중등 수학", 300000, "말일"],
];

type Sheet = { file: string; header: string[]; body: string[][]; map: Record<Field, number> };
type Skipped = { name: string; phone: string; why: string };
type Done = { file: string; saved: { id: string; name: string; grade: string; parentPhone: string }[]; classIds: string[]; dup: number; badPhone: Skipped[]; other: Skipped[] };

/** 칸 맞춘 줄 → 저장할 값. 학년은 원장님이 정하는 값이라 계산하지 않음(학년 칸이 없으면 빈칸). 생년월일은 영수증 원부용으로 저장. 읽을 수 없는 교습비·납부일은 비워서 저장 */
function toInputs(sheet: Sheet): ImportInput[] {
  const cell = (r: string[], f: Field) => (sheet.map[f] >= 0 ? (r[sheet.map[f]] ?? "") : "");
  return sheet.body.map((r) => {
    const fee = cell(r, "fee");
    const due = cell(r, "due");
    return {
      name: cell(r, "name"),
      grade: cell(r, "grade"),
      phone: cell(r, "phone"),
      birth: excelBirth(cell(r, "birth")),
      classes: cell(r, "classes"),
      fee: Number.isNaN(parseFee(fee)) ? "" : fee,
      due: Number.isNaN(parseDueDay(due)) ? "" : due,
    };
  });
}

export function ExcelImport() {
  const [ask, setAsk] = useState<{ sheet: Sheet; field: "phone" | "name" } | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [undone, setUndone] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [pending, start] = useTransition();

  async function read(file: File) {
    setError(null);
    setDone(null);
    setUndone(null);
    track("excel-try");
    // 실패하면 이유 종류만 기록 (파일 이름·내용은 안 보냄)
    const fail = (why: string, message: string) => {
      track("excel-fail", why);
      setError(message);
    };
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return fail("파일 형식", "엑셀(.xlsx·.xls)이나 .csv 파일을 올려 주세요.");
    if (file.size > 5_000_000) return fail("파일 큼", "파일이 너무 커요 (5MB까지).");
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      let wb;
      if (/\.csv$/i.test(file.name)) {
        // 한글 엑셀이 저장한 CSV 는 EUC-KR 인 경우가 많음
        let text: string;
        try {
          text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
        } catch {
          text = new TextDecoder("euc-kr").decode(buf);
        }
        wb = XLSX.read(text.replace(/^﻿/, ""), { type: "string", raw: true });
      } else {
        wb = XLSX.read(buf, { type: "array" });
      }
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" });
      const rows = aoa.map((r) => r.map(cellText)).filter((r) => r.some(Boolean));
      if (rows.length === 0) return fail("빈 파일", "파일에 내용이 없어요.");
      const width = Math.max(...rows.map((r) => r.length));
      const titled = hasHeader(rows[0]);
      const header = Array.from({ length: width }, (_, i) => (titled && rows[0][i]) || `${i + 1}번째 칸`);
      const body = (titled ? rows.slice(1) : rows).map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ""));
      if (body.length > ROSTER_MAX_LINES) return fail("인원 초과", `한 번에 ${ROSTER_MAX_LINES}명까지 올릴 수 있어요. 파일을 나눠 주세요.`);
      const sheet: Sheet = { file: file.name, header, body, map: guessColumns(header, body) };
      next(sheet);
    } catch {
      fail("파일 못 읽음", "파일을 읽지 못했어요. 엑셀에서 다시 저장한 뒤 올려 주세요.");
    }
  }

  /** 학부모 번호·이름 칸을 찾았으면 바로 저장, 못 찾았으면 그것만 물어봄 */
  function next(sheet: Sheet) {
    // 칸을 못 찾아 물어볼 때도 기록 (원장님이 고르면 이어서 성공·실패가 남음)
    const missing = sheet.map.phone < 0 ? "phone" : sheet.map.name < 0 ? "name" : null;
    if (missing) {
      if (!ask) track("excel-fail", "칸 못 찾음");
      return setAsk({ sheet, field: missing });
    }
    setAsk(null);
    save(sheet);
  }

  function save(sheet: Sheet) {
    const inputs = toInputs(sheet);
    // 저장 전에 나눔: 저장할 줄 / 번호 확인 필요 / 그 밖에 건너뛸 줄. 이미 있는 학생(파일 안 중복 포함)은 서버가 거름
    const send: ImportInput[] = [];
    const badPhone: Skipped[] = [];
    const other: Skipped[] = [];
    inputs.forEach((inp, i) => {
      if (!inp.name.trim() && !inp.phone.trim()) return; // 빈 줄
      const r = checkImportRow(inp, i + 1);
      if (!r.ok) {
        const item = { name: inp.name.trim() || `${i + 1}번째 줄`, phone: inp.phone, why: r.error };
        if (/번호/.test(r.error)) badPhone.push(item);
        else other.push(item);
        return;
      }
      send.push(inp);
    });
    start(async () => {
      const res: ImportResult = send.length ? await addStudentsImport(send) : { ok: true, saved: [], classIds: [], dup: 0 };
      if (!res?.ok) {
        track("excel-fail", "저장 오류");
        return setError(res?.message ?? "저장하지 못했어요. 다시 올려 주세요.");
      }
      track("excel-ok", res.saved.length);
      setDone({ file: sheet.file, saved: res.saved, classIds: res.classIds, dup: res.dup, badPhone, other });
    });
  }

  function undo() {
    if (!done) return;
    track("excel-undo");
    start(async () => {
      const r = await undoStudentsImport(
        done.saved.map((s) => s.id),
        done.classIds,
      );
      setDone(null);
      setUndone(r?.message ?? null);
    });
  }

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(TEMPLATE), "학생 명단");
    XLSX.writeFile(wb, "공부방노트_학생명단_양식.xlsx");
  }

  // ── 학부모 번호(또는 이름) 칸을 못 찾았을 때만: 한 문장 + 엑셀 칸 이름 버튼
  if (ask) {
    const { sheet, field } = ask;
    return (
      <div>
        <p className="text-[15px] font-semibold">{field === "phone" ? "학부모 번호가 어느 칸이에요?" : "학생 이름이 어느 칸이에요?"}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {sheet.header.map((h, i) => (
            <button
              key={i}
              type="button"
              disabled={pending}
              onClick={() => next({ ...sheet, map: { ...sheet.map, [field]: i } })}
              className="surface rounded-full px-3.5 py-2 text-[13.5px] font-semibold text-brand hover:bg-white disabled:opacity-50"
            >
              {h}
              {sheet.body[0]?.[i] && <span className="ml-1 font-normal text-slate-400">{sheet.body[0][i].slice(0, 13)}</span>}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setAsk(null)} className="mt-3 flex items-center gap-1 text-[12.5px] text-slate-500">
          <RotateCcw size={13} /> 다른 파일
        </button>
      </div>
    );
  }

  // ── 저장 결과
  if (done) {
    const n = done.saved.length;
    return (
      <div>
        <p className="flex items-center gap-1.5 text-[16px] font-bold">
          <CheckCircle2 size={19} className={n ? "text-emerald-600" : "text-slate-300"} />
          {n ? `${n}명 저장했어요` : "새로 저장한 학생이 없어요"}
        </p>
        <p className="mt-0.5 text-[12.5px] text-slate-500">
          {done.file}
          {done.dup > 0 && ` · 이미 있는 학생 ${done.dup}명은 건너뛰었어요`}
          {done.classIds.length > 0 && ` · 새 반 ${done.classIds.length}개를 만들었어요`}
        </p>

        {n > 0 && (
          <ul className="mt-2 max-h-60 overflow-y-auto rounded-xl bg-white/60 px-2 py-1 text-[13.5px] ring-1 ring-black/5">
            {done.saved.map((s) => (
              <li key={s.id} className="flex items-center gap-2 border-b border-black/5 px-1.5 py-1.5 last:border-0">
                <b>{s.name}</b>
                <span className={s.grade ? "text-slate-500" : "text-[12px] text-amber-600"}>{s.grade || "학년 비어 있음"}</span>
                <span className="ml-auto text-[12.5px] text-slate-500 tabular-nums">{formatPhone(s.parentPhone)}</span>
              </li>
            ))}
          </ul>
        )}

        {done.badPhone.length > 0 && (
          <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2.5 text-[13px] text-rose-700">
            <p className="font-semibold">{done.badPhone.length}명은 번호 확인 필요 (저장 안 함)</p>
            <ul className="mt-1 space-y-0.5">
              {done.badPhone.map((s, i) => (
                <li key={i}>
                  {s.name} <span className="tabular-nums opacity-70">{s.phone || "번호 없음"}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[12px] opacity-80">번호를 고쳐서 [한 명씩]으로 넣거나, 엑셀을 고쳐 다시 올려 주세요.</p>
          </div>
        )}
        {done.other.length > 0 && (
          <div className="mt-2 rounded-xl bg-slate-100 px-3 py-2.5 text-[13px] text-slate-600">
            <p className="font-semibold">{done.other.length}명은 건너뛰었어요</p>
            <ul className="mt-1 space-y-0.5">
              {done.other.map((s, i) => (
                <li key={i}>
                  {s.name} · {s.why}
                </li>
              ))}
            </ul>
          </div>
        )}

        {n > 0 && <p className="mt-2 text-[12px] text-slate-500">학부모 동의는 &lsquo;대기&rsquo;예요. 목록 위 [동의 요청 보내기]로 받아 주세요.</p>}
        <div className="mt-3 flex gap-2">
          {n > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={undo}
              className="surface flex flex-1 items-center justify-center gap-1 rounded-xl py-2.5 text-[14px] font-semibold text-slate-600 disabled:opacity-50"
            >
              <Undo2 size={15} /> {pending ? "되돌리는 중…" : "되돌리기"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setDone(null)}
            className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-brand py-2.5 text-[14px] font-semibold text-white"
          >
            <FileSpreadsheet size={15} /> 다른 파일 올리기
          </button>
        </div>
      </div>
    );
  }

  // ── 파일 고르기
  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f) read(f);
        }}
        className={`flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
          drag ? "border-gold bg-gold-soft" : "border-brand/20 bg-white/40 hover:bg-white/70"
        } ${pending ? "pointer-events-none opacity-60" : ""}`}
      >
        <FileSpreadsheet size={30} className="text-brand" />
        <span className="mt-2 text-[15px] font-semibold">{pending ? "저장하는 중…" : "엑셀 파일 고르기"}</span>
        <span className="mt-0.5 text-[12.5px] text-slate-500">올리면 바로 저장돼요 · 여기로 끌어다 놓아도 돼요</span>
        <span className="mt-1 text-[11.5px] text-slate-400">이름·학부모 번호·학년·반·교습비·납부일만 저장하고, 파일은 서버에 남기지 않아요</span>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) read(f);
            e.target.value = "";
          }}
        />
      </label>
      <button type="button" onClick={downloadTemplate} className="mt-2 flex items-center gap-1 px-1 text-[13px] font-semibold text-brand underline">
        <Download size={14} /> 예시 양식 받기
      </button>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      {undone && <p className="mt-2 text-sm text-emerald-600">{undone}</p>}
    </div>
  );
}
