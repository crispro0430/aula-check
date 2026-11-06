import { NextRequest, NextResponse } from 'next/server';
import type { IncapacityStatus, IncapacityType } from '@prisma/client';
import prisma from '@/lib/prisma';

function mapIncapacityType(raw?: string): IncapacityType {
  const norm = (raw ?? 'MEDICA').toUpperCase();
  if (norm.includes('LABORAL')) return 'LABORAL';
  if (norm.includes('FUERZA')) return 'FUERZA_MAYOR';
  return 'MEDICA';
}

function mapIncapacityStatus(raw?: string): IncapacityStatus {
  const norm = (raw ?? 'PENDIENTE').toUpperCase();
  if (norm === 'APPROVED' || norm === 'APROBADA' || norm === 'APROBADO') return 'APROBADA';
  if (norm === 'REJECTED' || norm === 'RECHAZADA' || norm === 'RECHAZADO') return 'RECHAZADA';
  return 'PENDIENTE';
}

/**
 * Asegura que los datos semilla (Docente titular, Cursos, Estudiantes e Incapacidades iniciales)
 * existan en PostgreSQL/Supabase para que las consultas filtradas por teacherId funcionen desde el primer momento.
 */
async function ensureSeedIncapacities() {
  const count = await prisma.incapacity.count();
  if (count > 0) return;

  const teacher = await prisma.teacher.upsert({
    where: { email: 'alejandro.morales@universidad.edu.co' },
    update: {},
    create: {
      id: 't1',
      name: 'Prof. Dr. Alejandro Morales',
      email: 'alejandro.morales@universidad.edu.co',
      department: 'Escuela de Ingeniería de Sistemas y Computación',
      title: 'Ph.D. en Ingeniería de Software',
      phone: '+57 (2) 321-2100 Ext. 401',
    },
  });

  const courseG401 = await prisma.course.upsert({
    where: { code: 'G401' },
    update: { teacherId: teacher.id },
    create: {
      id: 'c1',
      code: 'G401',
      name: 'Arquitectura de Software',
      room: 'Edificio de Ingeniería G-401',
      schedule: 'Lun/Mié 08:00 - 10:00',
      period: '2026-2',
      teacherId: teacher.id,
    },
  });

  await prisma.course.upsert({
    where: { code: 'G402' },
    update: { teacherId: teacher.id },
    create: {
      id: 'c2',
      code: 'G402',
      name: 'Sistemas Distribuidos',
      room: 'Laboratorio de Cómputo B-204',
      schedule: 'Mar/Jue 10:00 - 12:00',
      period: '2026-2',
      teacherId: teacher.id,
    },
  });

  const student1 = await prisma.student.upsert({
    where: { code: '2021815001' },
    update: {},
    create: {
      id: '2021815001',
      code: '2021815001',
      name: 'Juan David Pérez',
      email: 'juan.perez@universidad.edu.co',
      program: 'Ing. de Sistemas',
    },
  });

  const student2 = await prisma.student.upsert({
    where: { code: '2020815041' },
    update: {},
    create: {
      id: '2',
      code: '2020815041',
      name: 'Santiago Ríos',
      email: 's.rios@universidad.edu.co',
      program: 'Ing. de Sistemas',
    },
  });

  await prisma.incapacity.upsert({
    where: { id: 'inc-seed-001' },
    update: {},
    create: {
      id: 'inc-seed-001',
      studentId: student1.id,
      courseId: courseG401.id,
      absenceDate: new Date('2026-08-24T12:00:00.000Z'),
      type: 'MEDICA',
      reason: 'Cuadro febril agudo con diagnóstico de faringoamigdalitis. La EPS otorga 2 días de incapacidad médica.',
      fileName: 'incapacidad_eps_sura.svg',
      fileUrl: 'soporte://incapacidad_eps_sura.svg',
      status: 'PENDIENTE',
      createdAt: new Date('2026-08-25T09:12:00.000Z'),
    },
  });

  await prisma.incapacity.upsert({
    where: { id: 'inc-seed-002' },
    update: {},
    create: {
      id: 'inc-seed-002',
      studentId: student2.id,
      courseId: courseG401.id,
      absenceDate: new Date('2026-09-14T12:00:00.000Z'),
      type: 'LABORAL',
      reason: 'Turno laboral extraordinario asignado por la empresa de práctica (inventario anual). Se adjunta certificado.',
      fileName: 'certificado_laboral_practica.svg',
      fileUrl: 'soporte://certificado_laboral_practica.svg',
      status: 'APROBADA',
      reviewerComment: 'Soporte laboral verificado con la empresa. Inasistencia justificada.',
      reviewerName: teacher.name,
      reviewedById: teacher.id,
      reviewedAt: new Date('2026-09-16T10:05:00.000Z'),
      createdAt: new Date('2026-09-15T14:30:00.000Z'),
    },
  });
}

/**
 * GET /api/incapacities
 * - Si recibe ?teacherId=... retorna únicamente las incapacidades radicadas para los cursos
 *   que imparte ese docente específico (`course.teacherId === teacherId`).
 * - Si no recibe ?teacherId, retorna todas las incapacidades (para auditoría de Coordinación).
 * - Incluye información del estudiante (`name`, `code`, `email`), del curso (`name`, `code`)
 *   y el soporte adjunto (`documentUrl`).
 */
export async function GET(request: NextRequest) {
  try {
    await ensureSeedIncapacities();

    const teacherParam = request.nextUrl.searchParams.get('teacherId')?.trim();
    const teacherEmailParam = request.nextUrl.searchParams.get('teacherEmail')?.trim();
    const teacherNameParam = request.nextUrl.searchParams.get('teacherName')?.trim();

    let resolvedTeacherIds: string[] | null = null;

    if (teacherParam || teacherEmailParam || teacherNameParam) {
      const orConditions: Array<{ id?: string; email?: string; name?: string }> = [];
      if (teacherParam) {
        orConditions.push({ id: teacherParam });
        orConditions.push({ email: teacherParam.toLowerCase() });
        orConditions.push({ name: teacherParam });
      }
      if (teacherEmailParam) {
        orConditions.push({ email: teacherEmailParam.toLowerCase() });
      }
      if (teacherNameParam) {
        orConditions.push({ name: teacherNameParam });
      }

      const matchingTeachers = await prisma.teacher.findMany({
        where: { OR: orConditions },
        select: { id: true },
      });

      resolvedTeacherIds = matchingTeachers.map((t) => t.id);
      if (teacherParam && !resolvedTeacherIds.includes(teacherParam)) {
        resolvedTeacherIds.push(teacherParam);
      }
    }

    const incapacities = await prisma.incapacity.findMany({
      where: resolvedTeacherIds
        ? {
            course: {
              teacherId: { in: resolvedTeacherIds },
            },
          }
        : undefined,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            code: true,
            email: true,
            program: true,
          },
        },
        course: {
          select: {
            id: true,
            name: true,
            code: true,
            room: true,
            teacherId: true,
            teacher: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        reviewedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = incapacities.map((inc) => ({
      id: inc.id,
      studentId: inc.student.code || inc.studentId,
      studentName: inc.student.name,
      courseCode: inc.course.code,
      courseName: inc.course.name,
      date: inc.absenceDate.toISOString().slice(0, 10),
      reason: inc.reason,
      type:
        inc.type === 'LABORAL'
          ? 'Laboral'
          : inc.type === 'FUERZA_MAYOR'
          ? 'Fuerza Mayor'
          : 'Médica',
      fileName: inc.fileName ?? 'soporte_adjunto.pdf',
      documentUrl: inc.fileUrl ?? '',
      fileDataUrl: inc.fileUrl?.startsWith('data:') ? inc.fileUrl : '',
      status:
        inc.status === 'APROBADA'
          ? 'Aprobada'
          : inc.status === 'RECHAZADA'
          ? 'Rechazada'
          : 'Pendiente',
      rawStatus: inc.status,
      reviewerComment: inc.reviewerComment ?? '',
      reviewedBy: inc.reviewerName ?? inc.reviewedBy?.name ?? inc.course.teacher?.name ?? undefined,
      reviewedById: inc.reviewedById ?? undefined,
      reviewedAt: inc.reviewedAt ? inc.reviewedAt.toISOString() : undefined,
      createdAt: inc.createdAt.toISOString(),
      student: {
        id: inc.student.id,
        name: inc.student.name,
        code: inc.student.code,
        email: inc.student.email,
      },
      course: {
        id: inc.course.id,
        name: inc.course.name,
        code: inc.course.code,
        teacherId: inc.course.teacherId,
        teacherName: inc.course.teacher?.name ?? 'Prof. Dr. Alejandro Morales',
      },
    }));

    return NextResponse.json({ incapacities: formatted });
  } catch (error) {
    console.error('[GET /api/incapacities] Error:', error);
    return NextResponse.json(
      {
        error: 'No se pudieron consultar las incapacidades.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/incapacities
 * Permite a un estudiante radicar una incapacidad en PostgreSQL/Supabase.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      id?: string;
      studentId: string;
      studentName: string;
      studentEmail?: string;
      courseCode: string;
      courseName: string;
      date: string;
      reason: string;
      type: string;
      fileName: string;
      fileDataUrl?: string;
      documentUrl?: string;
    };

    const studentCode = (body.studentId || '2021815001').trim();
    const studentEmail = (body.studentEmail || `${studentCode}@universidad.edu.co`).toLowerCase();

    const student = await prisma.student.upsert({
      where: { code: studentCode },
      update: { name: body.studentName || 'Juan David Pérez' },
      create: {
        id: studentCode,
        code: studentCode,
        name: body.studentName || 'Juan David Pérez',
        email: studentEmail,
        program: 'Ing. de Sistemas',
      },
    });

    const defaultTeacher = await prisma.teacher.upsert({
      where: { email: 'alejandro.morales@universidad.edu.co' },
      update: {},
      create: {
        id: 't1',
        name: 'Prof. Dr. Alejandro Morales',
        email: 'alejandro.morales@universidad.edu.co',
        department: 'Escuela de Ingeniería de Sistemas y Computación',
        title: 'Ph.D. en Ingeniería de Software',
      },
    });

    const course = await prisma.course.upsert({
      where: { code: body.courseCode.trim() },
      update: {},
      create: {
        code: body.courseCode.trim(),
        name: body.courseName.trim(),
        room: 'Edificio de Ingeniería G-401',
        schedule: 'Lun/Mié 08:00 - 10:00',
        period: '2026-2',
        teacherId: defaultTeacher.id,
      },
    });

    const rawDocUrl = body.documentUrl || body.fileDataUrl || '';
    const storedUrl = rawDocUrl.length <= 250_000 ? rawDocUrl : `soporte://${body.fileName}`;

    const created = await prisma.incapacity.create({
      data: {
        id: body.id || undefined,
        studentId: student.id,
        courseId: course.id,
        absenceDate: new Date(`${body.date}T12:00:00.000Z`),
        type: mapIncapacityType(body.type),
        reason: body.reason.trim(),
        fileName: body.fileName,
        fileUrl: storedUrl,
        status: mapIncapacityStatus('PENDIENTE'),
      },
      include: {
        student: { select: { name: true, code: true, email: true } },
        course: { select: { name: true, code: true, teacherId: true } },
      },
    });

    return NextResponse.json(
      {
        incapacity: {
          ...created,
          documentUrl: created.fileUrl ?? '',
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/incapacities] Error:', error);
    return NextResponse.json(
      {
        error: 'No se pudo radicar la incapacidad en la base de datos.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

