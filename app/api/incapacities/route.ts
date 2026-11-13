import { NextRequest } from 'next/server';
import type { IncapacityStatus, IncapacityType, Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { authorize, errorDetails, runInBackground, safeJson } from '@/lib/api';
import { notifyTeacherIncapacitySubmitted } from '@/lib/mail';

/** Soportes permitidos: PDF/imagen en Base64 o referencia interna `soporte://` (SEC-05). */
const ALLOWED_SUPPORT_PATTERN =
  /^data:(application\/pdf|image\/(png|jpeg|jpg|webp));base64,[A-Za-z0-9+/=\s]+$/;
const INTERNAL_SUPPORT_PATTERN = /^soporte:\/\/[\w.\- ()áéíóúÁÉÍÓÚñÑ]{1,200}$/;
const MAX_INLINE_SUPPORT_LENGTH = 250_000;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isAllowedSupportUrl(value: string): boolean {
  return ALLOWED_SUPPORT_PATTERN.test(value) || INTERNAL_SUPPORT_PATTERN.test(value);
}

function sanitizeFileName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.trim() : '';
  const cleaned = name.replace(/[^\w.\- ()áéíóúÁÉÍÓÚñÑ]/g, '_').slice(0, 120);
  return cleaned || 'soporte_adjunto.pdf';
}

function typeLabel(type: IncapacityType): string {
  return type === 'LABORAL' ? 'Laboral' : type === 'FUERZA_MAYOR' ? 'Fuerza Mayor' : 'Médica';
}

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
let seedIncapacitiesPromise: Promise<void> | null = null;

/** Memoiza la semilla para no ejecutar `count()` en cada GET (DB-02). */
function ensureSeedIncapacitiesOnce(): Promise<void> {
  if (!seedIncapacitiesPromise) {
    seedIncapacitiesPromise = ensureSeedIncapacities().catch((error: unknown) => {
      seedIncapacitiesPromise = null;
      throw error;
    });
  }
  return seedIncapacitiesPromise;
}

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
  const auth = authorize(request, ['student', 'teacher', 'admin']);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  try {
    await ensureSeedIncapacitiesOnce();

    // Para docentes, la identidad se fuerza desde la cookie firmada (anti-IDOR).
    const isTeacher = user.role === 'teacher';
    const teacherParam = isTeacher
      ? user.id
      : request.nextUrl.searchParams.get('teacherId')?.trim();
    const teacherEmailParam = isTeacher
      ? user.email
      : request.nextUrl.searchParams.get('teacherEmail')?.trim();
    const teacherNameParam = isTeacher
      ? undefined
      : request.nextUrl.searchParams.get('teacherName')?.trim();

    let resolvedTeacherIds: string[] | null = null;
    let assignedCourses: Array<{ id: string; code: string; name: string; room: string; schedule: string }> = [];
    let studentFilter: Prisma.IncapacityWhereInput | null = null;

    if (user.role === 'student') {
      // El estudiante solo ve SUS incapacidades (antes se filtraba en el cliente).
      studentFilter = {
        student: { OR: [{ id: user.id }, { email: user.email.toLowerCase() }] },
      };
      assignedCourses = await prisma.course.findMany({
        select: { id: true, code: true, name: true, room: true, schedule: true },
        orderBy: { code: 'asc' },
      });
    } else if (teacherParam || teacherEmailParam || teacherNameParam) {
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
      if (!isTeacher && teacherParam && !resolvedTeacherIds.includes(teacherParam)) {
        resolvedTeacherIds.push(teacherParam);
      }

      assignedCourses = await prisma.course.findMany({
        where: { teacherId: { in: resolvedTeacherIds } },
        select: { id: true, code: true, name: true, room: true, schedule: true },
        orderBy: { code: 'asc' },
      });
    } else {
      assignedCourses = await prisma.course.findMany({
        select: { id: true, code: true, name: true, room: true, schedule: true },
        orderBy: { code: 'asc' },
      });
    }

    const incapacities = await prisma.incapacity.findMany({
      where: studentFilter
        ? studentFilter
        : resolvedTeacherIds
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
      // Soportes históricos que no cumplan el formato permitido nunca se devuelven como URL activa.
      documentUrl:
        inc.fileUrl && isAllowedSupportUrl(inc.fileUrl)
          ? inc.fileUrl
          : `soporte://${sanitizeFileName(inc.fileName)}`,
      fileDataUrl:
        inc.fileUrl?.startsWith('data:') && isAllowedSupportUrl(inc.fileUrl) ? inc.fileUrl : '',
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

    return safeJson({
      incapacities: formatted,
      assignedCourses,
    });
  } catch (error) {
    console.error('[GET /api/incapacities] Error:', error);
    return safeJson(
      {
        error: 'No se pudieron consultar las incapacidades.',
        ...errorDetails(error),
      },
      { status: 500 },
    );
  }
}

interface CreateIncapacityBody {
  id?: string;
  studentId?: string;
  studentName?: string;
  studentEmail?: string;
  courseId?: string;
  courseCode?: string;
  courseName?: string;
  date?: string;
  reason?: string;
  type?: string;
  fileName?: string;
  fileDataUrl?: string;
  documentUrl?: string;
}

/**
 * POST /api/incapacities
 * Permite a un estudiante radicar una incapacidad. El estudiante se toma SIEMPRE
 * de la sesión firmada; al docente titular se le notifica por correo en segundo plano.
 */
export async function POST(request: NextRequest) {
  const auth = authorize(request, ['student', 'admin']);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  try {
    const body = (await request.json().catch(() => ({}))) as CreateIncapacityBody;

    const courseCodeInput = typeof body.courseCode === 'string' ? body.courseCode.trim() : '';
    const courseNameInput = typeof body.courseName === 'string' ? body.courseName.trim() : '';
    const reasonInput = typeof body.reason === 'string' ? body.reason.trim() : '';
    const dateInput = typeof body.date === 'string' ? body.date.trim() : '';

    if (!courseCodeInput || !reasonInput || !ISO_DATE_PATTERN.test(dateInput)) {
      return safeJson(
        { error: 'Asignatura, fecha (AAAA-MM-DD) y motivo son obligatorios.' },
        { status: 400 },
      );
    }
    if (reasonInput.length > 2000) {
      return safeJson({ error: 'El motivo no puede superar 2000 caracteres.' }, { status: 400 });
    }

    const fileName = sanitizeFileName(body.fileName);
    const rawDocUrl = (body.documentUrl || body.fileDataUrl || '').trim();
    if (rawDocUrl && rawDocUrl.length <= MAX_INLINE_SUPPORT_LENGTH && !isAllowedSupportUrl(rawDocUrl)) {
      return safeJson(
        { error: 'Formato de soporte no permitido. Adjunta un PDF o una imagen (PNG, JPG, WEBP).' },
        { status: 400 },
      );
    }
    const storedUrl =
      rawDocUrl && rawDocUrl.length <= MAX_INLINE_SUPPORT_LENGTH
        ? rawDocUrl
        : `soporte://${fileName}`;

    let student;
    if (user.role === 'student') {
      student =
        (await prisma.student.findUnique({ where: { id: user.id } })) ??
        (await prisma.student.findUnique({ where: { email: user.email.toLowerCase() } }));
      if (!student) {
        return safeJson(
          { error: 'No se encontró tu perfil de estudiante en la base de datos institucional.' },
          { status: 403 },
        );
      }
    } else {
      // Coordinación radicando en nombre de un estudiante (flujo administrativo).
      const studentCode = (body.studentId || '').trim();
      if (!studentCode) {
        return safeJson({ error: 'Indica el código del estudiante.' }, { status: 400 });
      }
      const studentEmail = (body.studentEmail || `${studentCode}@universidad.edu.co`).toLowerCase();
      student = await prisma.student.upsert({
        where: { code: studentCode },
        update: {},
        create: {
          id: studentCode,
          code: studentCode,
          name: body.studentName?.trim() || 'Estudiante',
          email: studentEmail,
          program: 'Ing. de Sistemas',
        },
      });
    }

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
      where: { code: courseCodeInput },
      update: {},
      create: {
        id: body.courseId?.trim() || undefined,
        code: courseCodeInput,
        name: courseNameInput || courseCodeInput,
        room: 'Edificio de Ingeniería G-401',
        schedule: 'Lun/Mié 08:00 - 10:00',
        period: '2026-2',
        teacherId: defaultTeacher.id,
      },
    });

    const incapacityId =
      typeof body.id === 'string' && /^[\w-]{1,64}$/.test(body.id.trim()) ? body.id.trim() : undefined;

    const created = await prisma.incapacity.create({
      data: {
        id: incapacityId,
        studentId: student.id,
        courseId: course.id,
        absenceDate: new Date(`${dateInput}T12:00:00.000Z`),
        type: mapIncapacityType(body.type),
        reason: reasonInput,
        fileName,
        fileUrl: storedUrl,
        status: mapIncapacityStatus('PENDIENTE'),
      },
      include: {
        student: { select: { name: true, code: true, email: true } },
        course: {
          select: {
            name: true,
            code: true,
            teacherId: true,
            teacher: { select: { name: true, email: true, isActive: true } },
          },
        },
      },
    });

    // Notificación al docente titular (no bloquea la respuesta HTTP)
    const titular = created.course.teacher;
    if (titular && titular.isActive) {
      runInBackground('incapacity-submitted-mail', () =>
        notifyTeacherIncapacitySubmitted(
          { name: titular.name, email: titular.email },
          {
            studentName: created.student.name,
            studentEmail: created.student.email,
            studentCode: created.student.code,
            courseName: created.course.name,
            courseCode: created.course.code,
            absenceDate: dateInput,
            type: typeLabel(created.type),
            reason: created.reason,
          },
        ),
      );
    }

    return safeJson(
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
    return safeJson(
      {
        error: 'No se pudo radicar la incapacidad en la base de datos.',
        ...errorDetails(error),
      },
      { status: 500 },
    );
  }
}

