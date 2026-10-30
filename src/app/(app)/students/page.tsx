import { eq } from "drizzle-orm";
import { db, students } from "@/db";
import { requireAcademy } from "@/lib/session";
import { StudentManager } from "@/components/StudentManager";
import { byGroupGradeName } from "@/lib/templates";

export default async function StudentsPage() {
  const academy = await requireAcademy();
  const rows = await db
    .select({
      id: students.id,
      name: students.name,
      grade: students.grade,
      group: students.group,
      parentPhone: students.parentPhone,
      active: students.active,
    })
    .from(students)
    .where(eq(students.academyId, academy.id));
  rows.sort(byGroupGradeName);

  return (
    <main className="px-3 py-4">
      <h1 className="px-1 text-lg font-bold">학생 관리</h1>
      <p className="px-1 text-xs text-slate-400">학부모 번호로 등원 문자·피드백·공지가 가요</p>
      <StudentManager students={rows} />
    </main>
  );
}
