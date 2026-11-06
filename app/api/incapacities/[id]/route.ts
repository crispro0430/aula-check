import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface PatchIncapacityBody {
  status?: 'APPROVED' | 'REJECTED' | 'APROBADA' | 'RECHAZADA' | 'Aprobada' | 'Rechazada' | string;
  teacherId?: string;
  teacherEmail?: string;
  teacherName?: string;
  reviewerName?: string;
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

/**
 * PATCH /api/incapacities/[id]
 * Jerarquía de 2 niveles:
 * - Nivel 1 (Docente Titular): Revisa y marca como 'APPROVED' o 'REJECTED' las solicitudes de sus asignaturas.
 * - Nivel 2 (Coordinación / Superadmin, role='admin'): Tiene potestad de Reevaluación / Override institucional
 *   sobre cualquier incapacidad, actualizando attendance_records y recalculando el Semáforo de Permanencia.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as PatchIncapacityBody;

    const isAdmin = body.role?.trim().toLowerCase() === 'admin';
    const teacherIdInput = body.teacherId?.trim();
    const teacherEmailInput = body.teacherEmail?.trim()?.toLowerCase();
    const teacherNameInput = body.teacherName?.trim();

    if (!isAdmin && !teacherIdInput && !teacherEmailInput && !teacherNameInput) {
      return NextResponse.json(
        {
          error:
            'No autorizado: Se requiere identificación del docente titular o rol de Coordinación (admin).',
        },
        { status: 403 },
      );
    }

    const rawStatus = (body.status ?? '').toUpperCase().trim();
    const isApproved =
      rawStatus === 'APPROVED' || rawStatus === 'APROBADA' || rawStatus === 'APROBADO';
    const isRejected =
      rawStatus === 'REJECTED' || rawStatus === 'RECHAZADA' || rawStatus === 'RECHAZADO';

    if (!isApproved && !isRejected) {
      return NextResponse.json(
        { error: 'Estado inválido. Usa "APPROVED" o "REJECTED".' },
        { status: 400 },
      );
    }

    // 1. Resolver el docente en PostgreSQL (si aplica o como referencia de curso)
    const teacherOr: Array<{ id?: string; email?: string; name?: string }> = [];
    if (teacherIdInput) {
      teacherOr.push({ id: teacherIdInput });
      teacherOr.push({ email: teacherIdInput.toLowerCase() });
      teacherOr.push({ name: teacherIdInput });
    }
    if (teacherEmailInput) teacherOr.push({ email: teacherEmailInput });
    if (teacherNameInput) teacherOr.push({ name: teacherNameInput });

    let teacher =
      teacherOr.length > 0
        ? await prisma.teacher.findFirst({
            where: { OR: teacherOr },
          })
        : null;

    if (!teacher) {
      teacher = await prisma.teacher.upsert({
        where: {
          email: teacherEmailInput || 'alejandro.morales@universidad.edu.co',
        },
        update: {},
        create: {
          id: teacherIdInput || 't1',
          name: teacherNameInput || 'Prof. Dr. Alejandro Morales',
          email: teacherEmailInput || 'alejandro.morales@universidad.edu.co',
          department: 'Escuela de Ingeniería de Sistemas y Computación',
          title: 'Ph.D. en Ingeniería de Software',
        },
      });
    }

    // 2. Buscar la incapacidad en la base de datos (o sincronizarla si se radicó primero en el cliente)
    let existing = await prisma.incapacity.findUnique({
      where: { id },
      include: {
        course: true,
        student: true,
      },
    });

    if (!existing && body.courseCode && body.studentId) {
      const course = await prisma.course.upsert({
        where: { code: body.courseCode.trim() },
        update: {},
        create: {
          code: body.courseCode.trim(),
          name: body.courseName?.trim() || 'Arquitectura de Software',
          room: 'Edificio de Ingeniería G-401',
          schedule: 'Lun/Mié 08:00 - 10:00',
          period: '2026-2',
          teacherId: teacher.id,
        },
      });

      const student = await prisma.student.upsert({
        where: { code: body.studentId.trim() },
        update: {},
        create: {
          id: body.studentId.trim(),
          code: body.studentId.trim(),
          name: body.studentName?.trim() || 'Estudiante',
          email: `${body.studentId.trim()}@universidad.edu.co`,
          program: 'Ing. de Sistemas',
        },
      });

      existing = await prisma.incapacity.create({
        data: {
          id,
          studentId: student.id,
          courseId: course.id,
          absenceDate: new Date(`${body.date || '2026-08-24'}T12:00:00.000Z`),
          type:
            body.type?.toUpperCase().includes('LABORAL')
              ? 'LABORAL'
              : body.type?.toUpperCase().includes('FUERZA')
              ? 'FUERZA_MAYOR'
              : 'MEDICA',
          reason: body.reason || 'Justificación de inasistencia',
          fileName: body.fileName || 'soporte.pdf',
          fileUrl: `soporte://${body.fileName || 'soporte.pdf'}`,
          status: 'PENDIENTE',
        },
        include: {
          course: true,
          student: true,
        },
      });
    }

    if (!existing) {
      return NextResponse.json(
        { error: `No se encontró la incapacidad con ID "${id}".` },
        { status: 404 },
      );
    }

    // 3. Validar permisos:
    //    - Si NO es admin (Coordinación Override), debe ser el profesor titular asignado a la materia.
    if (
      !isAdmin &&
      existing.course.teacherId &&
      existing.course.teacherId !== teacher.id &&
      teacherIdInput !== existing.course.teacherId
    ) {
      return NextResponse.json(
        {
          error:
            'No autorizado: Solo el profesor titular asignado a esta asignatura o Coordinación Académica (Override) pueden evaluar esta incapacidad.',
        },
        { status: 403 },
      );
    }

    if (!isAdmin && !existing.course.teacherId) {
      await prisma.course.update({
        where: { id: existing.course.id },
        data: { teacherId: teacher.id },
      });
    }

    const nextDbStatus = isApproved ? 'APROBADA' : 'RECHAZADA';
    const effectiveReviewerName = isAdmin
      ? body.reviewerName?.trim() || 'Coordinación Académica (Override)'
      : teacher.name;

    const reviewerComment =
      body.reviewerComment?.trim() ||
      (isAdmin
        ? isApproved
          ? 'Reevaluada y aprobada por Coordinación Académica (Override).'
          : 'Reevaluada y rechazada por Coordinación Académica (Override).'
        : isApproved
        ? 'Soporte validado y aprobado por el docente titular de la asignatura.'
        : 'Solicitud rechazada por el docente titular.');

    // 4. Actualizar la incapacidad en PostgreSQL
    const updated = await prisma.incapacity.update({
      where: { id: existing.id },
      data: {
        status: nextDbStatus,
        reviewerComment,
        reviewerName: effectiveReviewerName,
        reviewedById: isAdmin ? existing.reviewedById : teacher.id,
        reviewedAt: new Date(),
      },
      include: {
        student: { select: { id: true, name: true, code: true, email: true } },
        course: { select: { id: true, name: true, code: true, teacherId: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
    });

    // 5. Ajustar attendance_records y recalcular Semáforo de Permanencia en Enrollment
    let updatedAttendancePercentage: number | null = null;

    if (isApproved) {
      await prisma.attendanceRecord.updateMany({
        where: {
          studentId: existing.studentId,
          session: { courseId: existing.courseId },
          status: 'AUSENTE',
        },
        data: {
          status: 'JUSTIFICADO',
          incapacityId: updated.id,
          notes: `Incapacidad aprobada por ${effectiveReviewerName}`,
        },
      });
    } else if (isRejected) {
      // Si se rechaza (ej. Override de Coordinación sobre una excusa previamente justificada), revertir a AUSENTE
      await prisma.attendanceRecord.updateMany({
        where: {
          studentId: existing.studentId,
          session: { courseId: existing.courseId },
          OR: [{ incapacityId: updated.id }, { status: 'JUSTIFICADO' }],
        },
        data: {
          status: 'AUSENTE',
          incapacityId: null,
          notes: `Incapacidad rechazada por ${effectiveReviewerName}`,
        },
      });
    }

    const allCourseRecords = await prisma.attendanceRecord.findMany({
      where: {
        studentId: existing.studentId,
        session: { courseId: existing.courseId },
      },
    });

    if (allCourseRecords.length > 0) {
      const validCount = allCourseRecords.filter(
        (r) =>
          r.status === 'PRESENTE' ||
          r.status === 'TARDANZA' ||
          r.status === 'PRESENTE_MANUAL' ||
          r.status === 'JUSTIFICADO',
      ).length;
      updatedAttendancePercentage = Math.round((validCount / allCourseRecords.length) * 100);
    } else {
      updatedAttendancePercentage = 100;
    }

    await prisma.enrollment.upsert({
      where: {
        studentId_courseId: {
          studentId: existing.studentId,
          courseId: existing.courseId,
        },
      },
      update: {
        finalAttendancePercentage: updatedAttendancePercentage,
      },
      create: {
        studentId: existing.studentId,
        courseId: existing.courseId,
        finalAttendancePercentage: updatedAttendancePercentage,
      },
    });

    return NextResponse.json({
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
      updatedAttendancePercentage,
    });
  } catch (error) {
    console.error('[PATCH /api/incapacities/[id]] Error:', error);
    return NextResponse.json(
      {
        error: 'No se pudo procesar la revisión de la incapacidad.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
