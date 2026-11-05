"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { Download, FileSpreadsheet, RotateCcw } from "lucide-react";
import { addStudentsImport, type FormResult } from "@/app/actions";
import { FIELD_LABEL, cellText, gradeFromAge, gradeFromBirthYear, guessColumns, hasHeader, type Field } from "@/lib/excel-import";
import { checkImportRow, phoneDigits, rosterKey, ROSTER_MAX_LINES, type ImportInput } from "@/lib/roster";
import { formatPhone } from "@/lib/phone";
import { feeLabel } from "@/lib/money";
import { todayKST } from "@/lib/date";

/**
 * 학생 추가 → 엑셀 올리기. 파일(.xlsx·.xls·.csv)은 브라우저에서 바로 읽고 서버로 보내지 않는다 (SheetJS, cdn.sheetjs.com 판).
 * 1) 칸 고르기 (첫 줄 제목으로 자동, 번호 칸이 여러 개면 원장님이 학부모 번호 칸을 고름)
 * 2) 미리보기 (들어갈 학생·중복·잘못된 줄) → 고른 칸의 글만 서버로
 */

const FIELDS: Field[] = ["name", "phone", "grade", "birth", "classes", "fee", "due"];
const TEMPLATE = [
  ["이름", "학년", "학부모 번호", "생년월일", "반", "교습비", "납부일"],
  ["김민준", "초5", "010-1234-5678", "2015-03-02", "초등 영어 A", 250000, "10일"],
  ["이서연", "중2", "010-9876-5432", "", "중등 수학", 300000, "말일"],
];

type Sheet = { file: string; header: string[]; body: string[][] };

const sel = "field w-full rounded-xl border-0 px-3 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-gold";

/** 엑셀 날짜 일련번호(예: 41000) → "2012-03-02". 생년월일 칸에만 씀 */
function excelDate(v: string, XLSX: typeof import("xlsx")) {
  const n = Number(v);
  if (!/^\d{5}(\.\d+)?$/.test(v) || n < 10000 || n > 80000) return v;
  const d = XLSX.SSF.parse_date_code(n);
  return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
}

export function ExcelImport({
  classes,
  students,
  Consent,
}: {
  classes: { id: string; name: string }[];
  students: { name: string; parentPhone: string }[];
  Consent: (p: { checked: boolean; onChange: (v: boolean) => void; many?: boolean }) => ReactNode;
}) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [map, setMap] = useState<Record<Field, number>>({ name: -1, phone: -1, grade: -1, birth: -1, classes: -1, fee: -1, due: -1, age: -1 });
  const [phoneChoices, setPhoneChoices] = useState<number[]>([]);
  const [gradeEdit, setGradeEdit] = useState<Record<number, string>>({});
  const [noCreate, setNoCreate] = useState<Set<string>>(new Set()); // 새 반으로 만들지 않을 이름
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<FormResult>(null);
  const [drag, setDrag] = useState(false);
  const [pending, start] = useTransition();
  const [birthFix, setBirthFix] = useState<((v: string) => string) | null>(null);

  async function read(file: File) {
    setError(null);
    setRes(null);
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return setError("엑셀(.xlsx·.xls)이나 .csv 파일을 올려 주세요.");
    if (file.size > 5_000_000) return setError("파일이 너무 커요 (5MB까지).");
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
      if (rows.length === 0) return setError("파일에 내용이 없어요.");
      const width = Math.max(...rows.map((r) => r.length));
      const titled = hasHeader(rows[0]);
      const header = titled
        ? Array.from({ length: width }, (_, i) => rows[0][i] || `${i + 1}번째 칸`)
        : Array.from({ length: width }, (_, i) => `${i + 1}번째 칸`);
      const body = (titled ? rows.slice(1) : rows).map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ""));
      const g = guessColumns(header, body);
      setSheet({ file: file.name, header, body });
      setMap(g.map);
      setPhoneChoices(g.phoneChoices);
      setGradeEdit({});
      setNoCreate(new Set());
      setBirthFix(() => (v: string) => excelDate(v, XLSX));
    } catch {
      setError("파일을 읽지 못했어요. 엑셀에서 다시 저장한 뒤 올려 주세요.");
    }
  }

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(TEMPLATE), "학생 명단");
    XLSX.writeFile(wb, "공부방노트_학생명단_양식.xlsx");
  }

  const today = todayKST();
  const cell = (r: string[], f: Field) => (map[f] >= 0 ? (r[map[f]] ?? "") : "");
  const computedGrade = map.grade < 0 && (map.birth >= 0 || map.age >= 0); // 학년 칸이 없으면 생년월일·나이로 계산

  const inputs: ImportInput[] = useMemo(
    () =>
      (sheet?.body ?? []).map((r, i) => {
        const birth = birthFix ? birthFix(cell(r, "birth")) : cell(r, "birth");
        const guess =
          map.grade >= 0
            ? cell(r, "grade")
            : /^\d{4}/.test(birth)
              ? gradeFromBirthYear(Number(birth.slice(0, 4)), today)
              : gradeFromAge(cell(r, "age"), today);
        return {
          name: cell(r, "name"),
          grade: gradeEdit[i] ?? guess,
          phone: cell(r, "phone"),
          birth,
          classes: cell(r, "classes"),
          fee: cell(r, "fee"),
          due: cell(r, "due"),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sheet, map, gradeEdit, birthFix, today],
  );

  // 미리보기: 들어갈 학생 / 중복(이미 있음·파일 안) / 잘못된 줄
  const have = new Set(students.map((s) => rosterKey(s.name, s.parentPhone)));
  const seen = new Set<string>();
  const preview = inputs.map((inp, i) => {
    const r = checkImportRow(inp, i + 1);
    if (!r.ok) return { r, kind: "err" as const, why: r.error };
    const key = rosterKey(r.name, r.parentPhone);
    if (have.has(key)) return { r, kind: "dup" as const, why: "이미 등록된 학생이에요" };
    if (seen.has(key)) return { r, kind: "dup" as const, why: "위에 같은 학생이 있어요" };
    seen.add(key);
    return { r, kind: "ok" as const, why: "" };
  });
  const okRows = preview.filter((p) => p.kind === "ok");
  const count = { ok: okRows.length, dup: preview.filter((p) => p.kind === "dup").length, err: preview.filter((p) => p.kind === "err").length };
  const known = new Set(classes.map((c) => c.name.trim()));
  const newClasses = [...new Set(okRows.flatMap((p) => (p.r.ok ? p.r.classNames : [])))].filter((n) => !known.has(n));
  const tooMany = inputs.length > ROSTER_MAX_LINES;
  const unused = sheet ? sheet.header.filter((_, i) => !Object.values(map).includes(i) && sheet.body.some((r) => r[i])) : [];
  const ready = map.name >= 0 && map.phone >= 0;
  // 칸 고르기 예시: 앞 0 빠진 번호·엑셀 날짜 숫자는 저장될 모양으로 보여 줌
  const example = (i: number) => {
    const v = sheet?.body[0]?.[i] ?? "";
    if (i === map.birth && birthFix) return birthFix(v);
    return /^1\d{9}$/.test(v) ? formatPhone(phoneDigits(v)) : v;
  };

  function submit() {
    const fd = new FormData();
    fd.set("rows", JSON.stringify(okRows.map((p) => inputs[p.r.line - 1])));
    fd.set("createClasses", JSON.stringify(newClasses.filter((n) => !noCreate.has(n))));
    if (consent) fd.set("consent", "on");
    start(async () => {
      const r = await addStudentsImport(null, fd);
      setRes(r);
      if (r?.ok) setSheet(null);
    });
  }

  if (!sheet) {
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
          }`}
        >
          <FileSpreadsheet size={30} className="text-brand" />
          <span className="mt-2 text-[15px] font-semibold">엑셀 파일 고르기</span>
          <span className="mt-0.5 text-[12.5px] text-slate-500">.xlsx · .xls · .csv · 여기로 끌어다 놓아도 돼요</span>
          <span className="mt-1 text-[11.5px] text-slate-400">파일은 이 기기에서만 읽고 서버에 저장하지 않아요</span>
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
        {res && <p className={`mt-2 text-sm ${res.ok ? "text-emerald-600" : "text-rose-600"}`}>{res.message}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <FileSpreadsheet size={16} className="shrink-0 text-brand" />
        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold">
          {sheet.file} <span className="font-normal text-slate-500">· {sheet.body.length}줄</span>
        </p>
        <button type="button" onClick={() => setSheet(null)} className="flex items-center gap-1 text-[12px] text-slate-500">
          <RotateCcw size={13} /> 다른 파일
        </button>
      </div>

      {/* 1) 칸 고르기 */}
      <p className="mt-3 text-[13px] font-semibold text-slate-600">칸 고르기</p>
      {phoneChoices.length > 1 && map.phone < 0 && (
        <p className="mt-1 rounded-lg bg-gold-soft px-2.5 py-2 text-[12.5px] text-[#6b5428]">
          번호 칸이 {phoneChoices.length}개예요 ({phoneChoices.map((i) => sheet.header[i]).join(", ")}). 학부모 번호 칸을 골라 주세요.
        </p>
      )}
      <div className="mt-2 grid grid-cols-[72px_1fr] items-center gap-x-2 gap-y-1.5">
        {[...FIELDS, ...(map.grade < 0 ? (["age"] as Field[]) : [])].map((f) => (
          <label key={f} className="contents">
            <span className="text-[12.5px] text-slate-500">
              {FIELD_LABEL[f]}
              {(f === "name" || f === "phone") && <span className="text-rose-500">*</span>}
            </span>
            <select
              value={map[f]}
              onChange={(e) => {
                setMap({ ...map, [f]: Number(e.target.value) });
                setGradeEdit({});
              }}
              className={`${sel} ${f === "phone" && map.phone < 0 ? "ring-2 ring-gold" : ""}`}
            >
              <option value={-1}>{f === "name" || f === "phone" ? "골라 주세요" : "없음"}</option>
              {sheet.header.map((h, i) => (
                <option key={i} value={i}>
                  {h} {sheet.body[0]?.[i] ? `(예: ${example(i).slice(0, 14)})` : ""}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {unused.length > 0 && <p className="mt-2 text-[12px] text-slate-400">이 칸들은 저장하지 않아요: {unused.join(", ")}</p>}
      {computedGrade && <p className="mt-1 text-[12px] text-[#8a6d35]">학년 칸이 없어서 {map.birth >= 0 ? "생년월일" : "나이"}로 계산했어요. 아래에서 고칠 수 있어요.</p>}

      {/* 2) 미리보기 */}
      {ready && (
        <div className="mt-3 overflow-hidden rounded-xl bg-white/60 ring-1 ring-black/5">
          <p className="border-b border-black/5 px-3 py-2 text-[13px]">
            <b className="text-emerald-600">들어갈 학생 {count.ok}명</b>
            {count.dup > 0 && <span className="text-slate-500"> · 중복 {count.dup}</span>}
            {count.err > 0 && <span className="text-rose-500"> · 잘못된 줄 {count.err}</span>}
          </p>
          <ul className="max-h-72 overflow-y-auto px-2 py-1 text-[13px]">
            {preview.map(({ r, kind, why }, i) => (
              <li
                key={i}
                className={`my-0.5 flex items-center gap-2 rounded-lg px-1.5 py-1 ${
                  kind === "ok" ? "bg-emerald-50/70" : kind === "dup" ? "bg-slate-100 text-slate-500" : "bg-rose-50 text-rose-700"
                }`}
              >
                <span className="w-5 shrink-0 text-right text-[11px] opacity-50 tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-1.5">
                    <b>{inputs[i].name || "(이름 없음)"}</b>
                    {computedGrade ? (
                      <input
                        value={inputs[i].grade}
                        onChange={(e) => setGradeEdit({ ...gradeEdit, [i]: e.target.value })}
                        placeholder="학년"
                        className="w-14 rounded-md bg-white px-1.5 py-0.5 text-[12.5px] ring-1 ring-black/10"
                      />
                    ) : (
                      <span className="opacity-70">{inputs[i].grade}</span>
                    )}
                    {r.ok && feeLabel(r.monthlyFee, r.dueDay) && <span className="text-[#8a6d35]">{feeLabel(r.monthlyFee, r.dueDay)}</span>}
                    {r.ok && r.classNames.length > 0 && <span className="text-slate-500">· {r.classNames.join(", ")}</span>}
                  </span>
                  {why && <span className="block text-[12px]">{why}</span>}
                </span>
                <span className="shrink-0 text-[12px] tabular-nums opacity-70">{r.ok ? formatPhone(r.parentPhone) : inputs[i].phone}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {tooMany && <p className="mt-2 text-sm text-rose-600">한 번에 {ROSTER_MAX_LINES}명까지 올릴 수 있어요. 파일을 나눠 주세요.</p>}

      {ready && newClasses.length > 0 && (
        <div className="mt-3 rounded-xl bg-gold-soft px-3 py-2.5 text-[13px] text-[#6b5428]">
          <p className="font-semibold">없는 반이에요. 새 반으로 만들까요?</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {newClasses.map((n) => (
              <label key={n} className="flex cursor-pointer items-center gap-1 rounded-full bg-white/80 px-2.5 py-1">
                <input
                  type="checkbox"
                  checked={!noCreate.has(n)}
                  onChange={(e) => {
                    const next = new Set(noCreate);
                    if (e.target.checked) next.delete(n);
                    else next.add(n);
                    setNoCreate(next);
                  }}
                  className="accent-brand"
                />
                {n}
              </label>
            ))}
          </div>
          <p className="mt-1 text-[11.5px]">체크를 끄면 그 반은 만들지 않고 학생만 넣어요. 요일·시각은 반 탭에서 정해요.</p>
        </div>
      )}

      {ready && <Consent checked={consent} onChange={setConsent} many />}
      <button
        type="button"
        onClick={submit}
        disabled={pending || !ready || count.ok === 0 || tooMany}
        className="mt-3 w-full rounded-xl bg-brand py-3 text-[15px] font-semibold text-white disabled:opacity-40"
      >
        {pending ? "추가 중…" : !ready ? "이름·학부모 번호 칸을 골라 주세요" : count.ok === 0 ? "넣을 학생이 없어요" : `${count.ok}명 추가`}
      </button>
      {res && <p className={`mt-2 text-sm ${res.ok ? "text-emerald-600" : "text-rose-600"}`}>{res.message}</p>}
    </div>
  );
}
