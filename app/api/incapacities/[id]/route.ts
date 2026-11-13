import { NextRequest } from 'next/server';
import type { Teacher } from '@prisma/client';
import prisma from '@/lib/prisma';
import { authorize, errorDetails, runInBackground, safeJson } from '@/lib/api';
import {
  recalculateEnrollmentAttendance,
  scheduleRiskAlertIfNeeded,
} from '@/lib/attendance-risk';
import { notifyStudentIncapacityReviewed } from '@/lib/mail';

interface PatchIncapacityBody {
  status?: 'APPROVED' | 'REJECTED' | 'APROBADA' | 'RECHAZADA' | 'Aprobada' | 'Rechazada' | string;
  teacherId?: string;
  teacherEmail?: string;
  teacherName?: string;
  reviewerName?: string;
  /** Ignorado: el rol se toma exclusivamente de la cookie firmada (SEC-01). */
  role?: string;
  reviewerComment?: string;
  // Datos opcionales para sincronizar si la solicitud se creó primero en el store local
  studentId?: string;
  studentName?: string;
  courseCode?: string;
  courseName?: string;
  date?: string;
  reason?: string;
  type?: string;
  fileName?: string;
}

/** Zona horaria institucional (Colombia, UTC-5 sin horario de verano). */
const INSTITUTION_UTC_OFFSET_HOURS = -5;

/** Rango [inicio, fin) del día calendario institucional de la falta. */
function absenceDayRange(absenceDate: Date): { gte: Date; lt: Date } {
  const day = absenceDate.toISOString().slice(0, 10);
  const start = new Date(`${day}T00:00:00.000Z`);
  start.setUTCHours(start.getUTCHours() - INSTITUTION_UTC_OFFSET_HOURS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { gte: start, lt: end };
}

function typeLabel(type: string): string {
  return type === 'LABORAL' ? 'Laboral' : type === 'FUERZA_MAYOR' ? 'Fuerza Mayor' : 'Médica';
}

/**
 * PATCH /api/incapacities/[id]
 * Jerarquía de 2 niveles (rol tomado SIEMPRE de la sesión firmada):
 * - Nivel 1 (Docente Titular): aprueba o rechaza las solicitudes de sus asignaturas.
 * - Nivel 2 (Coordinación, role='admin'): Override institucional sobre cualquier incapacidad.
 * La actualización de la incapacidad, de los registros de asistencia y del Semáforo de
 * Permanencia se ejecuta en una única transacción atómica.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = authorize(request, ['teacher', 'admin']);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as PatchIncapacityBody;

    const isAdmin = user.role === 'admin';

    const rawStatus = String(body.status ?? '').toUpperCase().trim();
    const isApproved =
      rawStatus === 'APPROVED' || rawStatus === 'APROBADA' || rawStatus === 'APROBADO';
    const isRejected =
      rawStatus === 'REJECTED' || rawStatus === 'RECHAZADA' || rawStatus === 'RECHAZADO';

    if (!isApproved && !isRejected) {
      return safeJson({ error: 'Estado inválido. Usa "APPROVED" o "REJECTED".' }, { status: 400 });
    }

    const commentInput =
      typeof body.reviewerComment === 'string' ? body.reviewerComment.trim().slice(0, 2000) : '';

    // 1. Docente revisor: identidad desde la cookie firmada
    let teacher: Teacher | null = null;
    if (!isAdmin) {
      teacher =
        (await prisma.teacher.findUnique({ where: { id: user.id } })) ??
        (await prisma.teacher.findUnique({ where: { email: user.email.toLowerCase() } }));
      if (!teacher || teacher.isActive === false) {
        return safeJson(
          { error: 'No autorizado: perfil docente no encontrado o inhabilitado.' },
          { status: 403 },
        );
      }
    }

    // 2. Buscar la incapacidad (o sincronizarla si se radicó primero en el cliente)
    let existing = await prisma.incapacity.findUnique({
      where: { id },
      include: { course: true, student: true },
    });

    if (!existing && body.courseCode && body.studentId) {
      const courseCode = body.courseCode.trim();
      const studentCode = body.studentId.trim();
      const existingCourse = await prisma.course.findUnique({ where: { code: courseCode } });

      // Un docente solo puede sincronizar solicitudes de SUS asignaturas.
      if (!isAdmin && existingCourse?.teacherId && existingCourse.teacherId !== teacher?.id) {
        return safeJson(
          {
            error:
              'No autorizado: Solo el profesor titular asignado a esta asignatura o Coordinación Académica (Override) pueden evaluar esta incapacidad.',
          },
          { status: 403 },
        );
      }

      const course =
        existingCourse ??
        (await prisma.course.create({
          data: {
            code: courseCode,
            name: body.courseName?.trim() || 'Arquitectura de Software',
            room: 'Edificio de Ingeniería G-401',
            schedule: 'Lun/Mié 08:00 - 10:00',
            period: '2026-2',
            teacherId: teacher?.id ?? null,
          },
        }));

      const student = await prisma.student.upsert({
        where: { code: studentCode },
        update: {},
        create: {
          id: studentCode,
          code: studentCode,
          name: body.studentName?.trim() || 'Estudiante',
          email: `${studentCode}@universidad.edu.co`,
          program: 'Ing. de Sistemas',
        },
      });

      const dateInput = /^\d{4}-\d{2}-\d{2}$/.test(body.date ?? '') ? body.date : '2026-08-24';
      const fileName = (body.fileName || 'soporte.pdf').replace(/[^\w.\- ]/g, '_').slice(0, 120);

      existing = await prisma.incapacity.create({
        data: {
          id,
          studentId: student.id,
          courseId: course.id,
          absenceDate: new Date(`${dateInput}T12:00:00.000Z`),
          type: body.type?.toUpperCase().includes('LABORAL')
            ? 'LABORAL'
            : body.type?.toUpperCase().includes('FUERZA')
            ? 'FUERZA_MAYOR'
            : 'MEDICA',
          reason: (body.reason || 'Justificación de inasistencia').slice(0, 2000),
          fileName,
          fileUrl: `soporte://${fileName}`,
          status: 'PENDIENTE',
        },
        include: { course: true, student: true },
      });
    }

    if (!existing) {
      return safeJson({ error: `No se encontró la incapacidad con ID "${id}".` }, { status: 404 });
    }

    // 3. Permisos: si NO es Coordinación, debe ser el profesor titular de la materia.
    if (!isAdmin && existing.course.teacherId && existing.course.teacherId !== teacher?.id) {
      return safeJson(
        {
          error:
            'No autorizado: Solo el profesor titular asignado a esta asignatura o Coordinación Académica (Override) pueden evaluar esta incapacidad.',
        },
        { status: 403 },
      );
    }

    const nextDbStatus = isApproved ? 'APROBADA' : 'RECHAZADA';
    const effectiveReviewerName = isAdmin
      ? body.reviewerName?.trim().slice(0, 120) || 'Coordinación Académica (Override)'
      : teacher!.name;

    const reviewerComment =
      commentInput ||
      (isAdmin
        ? isApproved
          ? 'Reevaluada y aprobada por Coordinación Académica (Override).'
          : 'Reevaluada y rechazada por Coordinación Académica (Override).'
        : isApproved
        ? 'Soporte validado y aprobado por el docente titular de la asignatura.'
        : 'Solicitud rechazada por el docente titular.');

    const target = existing;

    // 4. Transacción atómica: incapacidad + registros de asistencia + Semáforo
    const { updated, recalculation } = await prisma.$transaction(async (tx) => {
      if (!isAdmin && !target.course.teacherId && teacher) {
        await tx.course.update({
          where: { id: target.course.id },
          data: { teacherId: teacher.id },
        });
      }

      const updatedIncapacity = await tx.incapacity.update({
        where: { id: target.id },
        data: {
          status: nextDbStatus,
          reviewerComment,
          reviewerName: effectiveReviewerName,
          reviewedById: isAdmin ? target.reviewedById : teacher!.id,
          reviewedAt: new Date(),
        },
        include: {
          student: { select: { id: true, name: true, code: true, email: true } },
          course: { select: { id: true, name: true, code: true, teacherId: true } },
          reviewedBy: { select: { id: true, name: true, email: true } },
        },
      });

      if (isApproved) {
        // Solo justifica las faltas del día de la incapacidad (DB-01.3).
        await tx.attendanceRecord.updateMany({
          where: {
            studentId: target.studentId,
            status: 'AUSENTE',
            session: { courseId: target.courseId, startedAt: absenceDayRange(target.absenceDate) },
          },
          data: {
            status: 'JUSTIFICADO',
            incapacityId: updatedIncapacity.id,
            notes: `Incapacidad aprobada por ${effectiveReviewerName}`,
          },
        });
      } else {
        // Revierte únicamente lo que justificó ESTA incapacidad (DB-01.3).
        await tx.attendanceRecord.updateMany({
          where: { incapacityId: updatedIncapacity.id },
          data: {
            status: 'AUSENTE',
            incapacityId: null,
            notes: `Incapacidad rechazada por ${effectiveReviewerName}`,
          },
        });
      }

      const recalc = await recalculateEnrollmentAttendance(tx, target.studentId, target.courseId);
      return { updated: updatedIncapacity, recalculation: recalc };
    });

    // 5. Notificaciones asíncronas (no bloquean la respuesta HTTP)
    runInBackground('incapacity-reviewed-mail', () =>
      notifyStudentIncapacityReviewed({
        studentName: updated.student.name,
        studentEmail: updated.student.email,
        studentCode: updated.student.code,
        courseName: updated.course.name,
        courseCode: updated.course.code,
        absenceDate: updated.absenceDate.toISOString().slice(0, 10),
        type: typeLabel(updated.type),
        reason: updated.reason,
        approved: isApproved,
        reviewerName: effectiveReviewerName,
        reviewerComment,
      }),
    );
    scheduleRiskAlertIfNeeded(recalculation);

    return safeJson({
      incapacity: {
        ...updated,
        documentUrl: updated.fileUrl ?? '',
        statusLabel:
          updated.status === 'APROBADA'
            ? isAdmin
              ? 'APROBADA POR COORDINACIÓN'
              : 'APROBADA POR DOCENTE'
            : updated.status === 'RECHAZADA'
            ? isAdmin
              ? 'RECHAZADA POR COORDINACIÓN'
              : 'RECHAZADA'
            : 'PENDIENTE',
      },
      updatedAttendancePercentage: recalculation.currentPercentage,
    });
  } catch (error) {
    console.error('[PATCH /api/incapacities/[id]] Error:', error);
    return safeJson(
      {
        error: 'No se pudo procesar la revisión de la incapacidad.',
        ...errorDetails(error),
      },
      { status: 500 },
    );
  }
}
