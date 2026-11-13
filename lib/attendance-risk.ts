import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { runInBackground } from '@/lib/api';
import { notifyAttendanceRisk } from '@/lib/mail';
import { getSemaforoLabel, getSemaforoLevel } from '@/lib/utils';

type DbClient = Prisma.TransactionClient | typeof prisma;

/** Mínimo de asistencia para permanecer en "verde" (Semáforo de Permanencia). */
export function getAttendanceRiskThreshold(): number {
  const raw = Number(process.env.ATTENDANCE_RISK_THRESHOLD);
  return Number.isFinite(raw) && raw > 0 && raw <= 100 ? raw : 75;
}

const VALID_ATTENDANCE = new Set(['PRESENTE', 'TARDANZA', 'PRESENTE_MANUAL', 'JUSTIFICADO']);

export interface AttendanceRecalculation {
  studentId: string;
  courseId: string;
  previousPercentage: number | null;
  currentPercentage: number;
  absences: number;
  totalSessions: number;
}

/**
 * Recalcula `Enrollment.finalAttendancePercentage` a partir de los registros persistidos.
 * Debe ejecutarse dentro de la misma transacción que modificó los registros.
 */
export async function recalculateEnrollmentAttendance(
  db: DbClient,
  studentId: string,
  courseId: string,
  options: { createEnrollmentIfMissing?: boolean } = {},
): Promise<AttendanceRecalculation> {
  const createIfMissing = options.createEnrollmentIfMissing ?? true;
  const [enrollment, records] = await Promise.all([
    db.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
      select: { finalAttendancePercentage: true },
    }),
    db.attendanceRecord.findMany({
      where: { studentId, session: { courseId } },
      select: { status: true },
    }),
  ]);

  const totalSessions = records.length;
  const validCount = records.filter((r) => VALID_ATTENDANCE.has(r.status)).length;
  const absences = records.filter((r) => r.status === 'AUSENTE').length;
  const currentPercentage =
    totalSessions > 0 ? Math.round((validCount / totalSessions) * 100) : 100;

  if (enrollment || createIfMissing) {
    await db.enrollment.upsert({
      where: { studentId_courseId: { studentId, courseId } },
      update: { finalAttendancePercentage: currentPercentage },
      create: { studentId, courseId, finalAttendancePercentage: currentPercentage },
    });
  }

  return {
    studentId,
    courseId,
    previousPercentage: enrollment?.finalAttendancePercentage ?? null,
    currentPercentage,
    absences,
    totalSessions,
  };
}

/** `true` solo cuando el estudiante CRUZA el umbral hacia abajo (evita correos repetidos). */
export function enteredRisk(result: AttendanceRecalculation): boolean {
  const threshold = getAttendanceRiskThreshold();
  if (result.totalSessions === 0 || result.absences === 0) return false;
  if (result.currentPercentage >= threshold) return false;
  return result.previousPercentage === null || result.previousPercentage >= threshold;
}

/**
 * Si el estudiante acaba de entrar en riesgo académico, programa (sin bloquear la
 * respuesta HTTP) la alerta por correo al estudiante y al docente titular.
 */
export function scheduleRiskAlertIfNeeded(result: AttendanceRecalculation): void {
  if (!enteredRisk(result)) return;

  runInBackground('attendance-risk-alert', async () => {
    const [student, course] = await Promise.all([
      prisma.student.findUnique({
        where: { id: result.studentId },
        select: { name: true, email: true, code: true },
      }),
      prisma.course.findUnique({
        where: { id: result.courseId },
        select: {
          name: true,
          code: true,
          teacher: { select: { name: true, email: true, isActive: true } },
        },
      }),
    ]);
    if (!student || !course) return;

    const level = getSemaforoLevel(result.currentPercentage);
    await notifyAttendanceRisk(
      {
        studentName: student.name,
        studentEmail: student.email,
        studentCode: student.code,
        courseName: course.name,
        courseCode: course.code,
        attendancePercentage: result.currentPercentage,
        thresholdPercentage: getAttendanceRiskThreshold(),
        absences: result.absences,
        totalSessions: result.totalSessions,
        levelLabel: getSemaforoLabel(level),
      },
      course.teacher && course.teacher.isActive
        ? { name: course.teacher.name, email: course.teacher.email }
        : null,
    );
  });
}
