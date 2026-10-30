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
    <main className="px-3 pt-4">
      <StudentManager students={rows} />
    </main>
  );
}
