import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, students, classes, classStudents } from "@/db";
import { requireAcademy } from "@/lib/session";
import { StudentManager } from "@/components/StudentManager";
import { ClassManager } from "@/components/ClassManager";
import { byGradeName, byTimeName } from "@/lib/templates";

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const academy = await requireAcademy();
  const tab = (await searchParams).tab === "classes" ? "classes" : "students";

  const [studentRows, classRows, memberRows] = await Promise.all([
    db
      .select({
        id: students.id,
        name: students.name,
        grade: students.grade,
        parentPhone: students.parentPhone,
        active: students.active,
      })
      .from(students)
      .where(eq(students.academyId, academy.id)),
    db
      .select({ id: classes.id, name: classes.name, days: classes.days, time: classes.time })
      .from(classes)
      .where(eq(classes.academyId, academy.id)),
    db
      .select({ classId: classStudents.classId, studentId: classStudents.studentId })
      .from(classStudents)
      .innerJoin(classes, eq(classes.id, classStudents.classId))
      .where(eq(classes.academyId, academy.id)),
  ]);

  classRows.sort(byTimeName);
  const activeIds = new Set(studentRows.filter((s) => s.active).map((s) => s.id));
  const studentsWithClasses = studentRows
    .sort(byGradeName)
    .map((s) => ({ ...s, classIds: memberRows.filter((m) => m.studentId === s.id).map((m) => m.classId) }));
  const classesWithCount = classRows.map((c) => ({
    ...c,
    count: memberRows.filter((m) => m.classId === c.id && activeIds.has(m.studentId)).length,
  }));

  const tabCls = (on: boolean) =>
    `flex-1 rounded-lg py-2 text-center text-[14px] font-semibold ${on ? "bg-white text-brand shadow-sm" : "text-slate-500"}`;

  return (
    <main className="px-3 pt-3">
      <div className="mb-3 flex rounded-xl bg-black/5 p-1 md:max-w-xs">
        <Link href="/students" className={tabCls(tab === "students")}>
          학생 <span className="text-slate-400">{activeIds.size}</span>
        </Link>
        <Link href="/students?tab=classes" className={tabCls(tab === "classes")}>
          반 <span className="text-slate-400">{classRows.length}</span>
        </Link>
      </div>

      {tab === "students" ? (
        <StudentManager students={studentsWithClasses} classes={classRows} />
      ) : (
        <ClassManager classes={classesWithCount} />
      )}
    </main>
  );
}
