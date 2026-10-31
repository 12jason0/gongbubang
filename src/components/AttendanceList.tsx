"use client";

import { useState } from "react";
import { AttendanceRow, type RowData } from "./AttendanceRow";

/**
 * 출석부 학생 목록.
 * 순서(체크 안 한 학생 먼저)는 서버가 화면을 열 때 정하고, 여기서는 그 순서를 붙잡아 둔다.
 * 출석을 누를 때마다 줄이 움직이면 다음 손가락이 엉뚱한 학생을 누르기 때문.
 * 날짜·반을 바꾸거나 화면에 다시 들어오면 (부모가 key 를 바꿔서) 새로 정렬된다.
 */
export function AttendanceList({ rows, date }: { rows: RowData[]; date: string }) {
  const [order] = useState(() => rows.map((r) => r.id));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const known = new Set(order);
  const ids = [
    ...order.filter((id) => byId.has(id)),
    ...rows.filter((r) => !known.has(r.id)).map((r) => r.id), // 그사이 새로 보이게 된 학생은 맨 아래
  ];

  return (
    <ul className="mt-2.5 divide-y divide-black/5 overflow-hidden rounded-2xl bg-white ring-1 ring-black/5 lg:grid lg:grid-cols-2 lg:divide-y-0">
      {ids.map((id) => {
        const r = byId.get(id)!;
        return <AttendanceRow key={`${r.id}-${date}-${r.noteSentTime ?? ""}`} row={r} date={date} />;
      })}
    </ul>
  );
}
