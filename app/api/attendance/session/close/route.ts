import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authorize, errorDetails, safeJson } from '@/lib/api';
import {
  recalculateEnrollmentAttendance,
  scheduleRiskAlertIfNeeded,
  type AttendanceRecalculation,
} from '@/lib/attendance-risk';

interface CloseSessionBody {
  sessionId?: string;
  topic?: string;
  observations?: string;
  contingencies?: string;
}

function cleanText(value: unknown, max = 2000): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;
}

/**
 * POST /api/attendance/session/close
 * Cierra la sesión en PostgreSQL de forma atómica:
 * 1. Marca la sesión como CLOSED (con bitácora de cierre).
 * 2. Registra AUSENTE a cada estudiante matriculado en la asignatura que no hizo check-in.
 * 3. Recalcula el Semáforo de Permanencia y, tras responder, envía las alertas de riesgo
 *    académico a quienes acaban de cruzar el umbral.
 * Es idempotente: cerrar una sesión ya cerrada no vuelve a registrar inasistencias.
 */
export async function POST(request: NextRequest) {
  const auth = authorize(request, ['teacher', 'admin']);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  try {
    const body = (await request.json().catch(() => ({}))) as CloseSessionBody;
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    if (!sessionId) {
      return safeJson({ error: 'El campo "sessionId" es obligatorio.' }, { status: 400 });
    }

    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      select: { id: true, courseId: true, teacherId: true, status: true },
    });
    if (!session) {
      return safeJson({ error: 'La sesión indicada no existe.' }, { status: 404 });
    }
    if (user.role === 'teacher' && session.teacherId !== user.id) {
      return safeJson(
        { error: 'No autorizado: solo el docente titular puede cerrar esta sesión.' },
        { status: 403 },
      );
    }
    if (session.status === 'CLOSED') {
      return safeJson({ closed: true, alreadyClosed: true, absencesRecorded: 0 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Compare-and-set: solo el primer cierre registra inasistencias.
      const { count } = await tx.attendanceSession.updateMany({
        where: { id: session.id, status: 'ACTIVE' },
        data: {
          status: 'CLOSED',
          endedAt: new Date(),
          pinExpiresAt: new Date(),
          topic: cleanText(body.topic, 300),
          observations: cleanText(body.observations),
          contingencies: cleanText(body.contingencies),
        },
      });
      if (count === 0) {
        return { alreadyClosed: true, absencesRecorded: 0, recalculations: [] as AttendanceRecalculation[] };
      }

      const [enrollments, existingRecords] = await Promise.all([
        tx.enrollment.findMany({
          where: { courseId: session.courseId, student: { isActive: true } },
          select: { studentId: true },
        }),
        tx.attendanceRecord.findMany({
          where: { sessionId: session.id },
          select: { studentId: true },
        }),
      ]);

      const withRecord = new Set(existingRecords.map((r) => r.studentId));
      const absentStudentIds = enrollments
        .map((e) => e.studentId)
        .filter((studentId) => !withRecord.has(studentId));

      if (absentStudentIds.length > 0) {
        await tx.attendanceRecord.createMany({
          data: absentStudentIds.map((studentId) => ({
            sessionId: session.id,
            studentId,
            status: 'AUSENTE' as const,
            checkinAt: null,
            notes: 'Inasistencia registrada al cerrar la sesión',
          })),
          skipDuplicates: true,
        });
      }

      const recalculations: AttendanceRecalculation[] = [];
      for (const { studentId } of enrollments) {
        recalculations.push(
          await recalculateEnrollmentAttendance(tx, studentId, session.courseId, {
            createEnrollmentIfMissing: false,
          }),
        );
      }
      return { alreadyClosed: false, absencesRecorded: absentStudentIds.length, recalculations };
    });

    for (const recalculation of result.recalculations) {
      scheduleRiskAlertIfNeeded(recalculation);
    }

    return safeJson({
      closed: true,
      alreadyClosed: result.alreadyClosed,
      absencesRecorded: result.absencesRecorded,
    });
  } catch (error) {
    console.error('[POST /api/attendance/session/close] Error:', error);
    return safeJson(
      { error: 'No se pudo cerrar la sesión de asistencia.', ...errorDetails(error) },
      { status: 500 },
    );
  }
}
