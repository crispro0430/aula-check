import { NextRequest } from 'next/server';
import type { CaptureMode, Teacher } from '@prisma/client';
import prisma from '@/lib/prisma';
import { authorize, errorDetails, safeJson } from '@/lib/api';
import type { AuthenticatedUser } from '@/lib/auth';

interface CreateSessionPayload {
  sessionId?: string;
  courseId?: string;
  courseCode?: string;
  courseName?: string;
  room?: string;
  schedule?: string;
  teacherId?: string;
  teacherName?: string;
  teacherEmail?: string;
  teacherDepartment?: string;
  teacherTitle?: string;
  pin?: string;
  qrCode?: string;
  durationMinutes?: number;
  toleranceMinutes?: number;
  mode?: string;
  topic?: string;
}

const PIN_PATTERN = /^[A-Za-z0-9]{4,12}$/;
const MAX_DURATION_MINUTES = 6 * 60;

function normalizeCaptureMode(mode?: string): CaptureMode {
  const upper = (mode ?? 'BOTH').toUpperCase();
  if (upper === 'QR' || upper === 'PIN' || upper === 'BOTH') {
    return upper;
  }
  return 'BOTH';
}

/**
 * Resuelve el docente dueño de la sesión. Para el rol `teacher` la identidad sale
 * SIEMPRE de la cookie firmada; Coordinación (admin) puede indicar el docente.
 */
async function resolveTeacher(
  user: AuthenticatedUser,
  body: CreateSessionPayload,
): Promise<Teacher | null> {
  if (user.role === 'teacher') {
    return (
      (await prisma.teacher.findUnique({ where: { id: user.id } })) ??
      (await prisma.teacher.findUnique({ where: { email: user.email.toLowerCase() } }))
    );
  }

  const teacherEmail = (body.teacherEmail ?? 'alejandro.morales@universidad.edu.co')
    .trim()
    .toLowerCase();
  const teacherName = body.teacherName?.trim() || 'Prof. Dr. Alejandro Morales';
  return prisma.teacher.upsert({
    where: { email: teacherEmail },
    update: {},
    create: {
      id: body.teacherId?.trim() || undefined,
      name: teacherName,
      email: teacherEmail,
      department: body.teacherDepartment ?? 'Escuela de Ingeniería de Sistemas y Computación',
      title: body.teacherTitle ?? 'Ph.D. en Ingeniería de Software',
    },
  });
}

/**
 * POST /api/attendance/session
 * Crea una sesión activa o ROTA el PIN de la sesión existente (DB-01):
 * - Si llega `sessionId` de una sesión ACTIVA del mismo docente → actualiza su PIN.
 * - Si existe una sesión ACTIVA con el mismo PIN del mismo docente → la actualiza.
 * - En otro caso crea una sesión nueva (apertura desde /teacher/setup).
 */
export async function POST(request: NextRequest) {
  const auth = authorize(request, ['teacher', 'admin']);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  try {
    const body = (await request.json().catch(() => ({}))) as CreateSessionPayload;
    const pin = typeof body.pin === 'string' ? body.pin.trim() : '';

    if (!pin) {
      return safeJson(
        { error: 'El campo "pin" es obligatorio para crear la sesión.' },
        { status: 400 },
      );
    }
    if (!PIN_PATTERN.test(pin)) {
      return safeJson({ error: 'Formato de PIN inválido.' }, { status: 400 });
    }

    const durationMinutes =
      typeof body.durationMinutes === 'number' && body.durationMinutes > 0
        ? Math.min(body.durationMinutes, MAX_DURATION_MINUTES)
        : 30;
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
    const toleranceInput =
      typeof body.toleranceMinutes === 'number' && body.toleranceMinutes >= 0
        ? Math.min(body.toleranceMinutes, MAX_DURATION_MINUTES)
        : undefined;

    // 1. Docente (desde la sesión firmada para el rol teacher)
    const teacher = await resolveTeacher(user, body);
    if (!teacher) {
      return safeJson(
        { error: 'No se encontró tu perfil docente en la base de datos institucional.' },
        { status: 403 },
      );
    }
    if (teacher.isActive === false) {
      return safeJson(
        { error: 'Cuenta institucional inhabilitada. Comunícate con Coordinación Académica' },
        { status: 403 },
      );
    }

    // 2. Asignatura: nunca se reasigna una materia que ya pertenece a otro docente.
    const courseCode = (body.courseCode || body.courseId || 'G401').trim();
    const courseName = body.courseName?.trim() || 'Arquitectura de Software';
    const room = body.room?.trim() || 'Edificio de Ingeniería G-401';
    const schedule = body.schedule?.trim() || 'Lun/Mié 08:00 - 10:00';

    const existingCourse = await prisma.course.findUnique({ where: { code: courseCode } });
    const canClaimCourse =
      !existingCourse ||
      !existingCourse.teacherId ||
      existingCourse.teacherId === teacher.id ||
      user.role === 'admin';

    const course = existingCourse
      ? await prisma.course.update({
          where: { id: existingCourse.id },
          data: canClaimCourse ? { name: courseName, room, teacherId: teacher.id } : {},
        })
      : await prisma.course.create({
          data: {
            id: body.courseId?.trim() || undefined,
            code: courseCode,
            name: courseName,
            room,
            schedule,
            period: '2026-2',
            teacherId: teacher.id,
          },
        });

    // 3. Rotación atómica sobre la MISMA sesión (sin crear filas huérfanas cada 30 s)
    const createdSession = await prisma.$transaction(async (tx) => {
      const requestedId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
      const ownerScope = user.role === 'admin' ? {} : { teacherId: teacher.id };

      const target =
        (requestedId
          ? await tx.attendanceSession.findFirst({
              where: { id: requestedId, status: 'ACTIVE', ...ownerScope },
            })
          : null) ??
        (await tx.attendanceSession.findFirst({
          where: { pin, status: 'ACTIVE', ...ownerScope },
          orderBy: { startedAt: 'desc' },
        }));

      if (target) {
        return tx.attendanceSession.update({
          where: { id: target.id },
          data: {
            pin,
            courseId: course.id,
            topic: body.topic?.trim() || target.topic || 'Sesión de clase',
            room,
            pinExpiresAt: expiresAt,
            toleranceMinutes: toleranceInput ?? target.toleranceMinutes,
            mode: normalizeCaptureMode(body.mode),
            status: 'ACTIVE',
          },
          include: { course: true, teacher: true },
        });
      }

      return tx.attendanceSession.create({
        data: {
          courseId: course.id,
          teacherId: teacher.id,
          topic: body.topic?.trim() || 'Sesión de clase',
          room,
          pin,
          pinExpiresAt: expiresAt,
          toleranceMinutes: toleranceInput ?? 15,
          mode: normalizeCaptureMode(body.mode),
          status: 'ACTIVE',
        },
        include: { course: true, teacher: true },
      });
    });

    return safeJson(
      {
        session: {
          ...createdSession,
          expiresAt: createdSession.pinExpiresAt.toISOString(),
          qrCode: typeof body.qrCode === 'string' ? body.qrCode : null,
        },
        course: createdSession.course,
        teacher: createdSession.teacher,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/attendance/session] Error:', error);
    return safeJson(
      {
        error: 'No se pudo guardar la sesión de asistencia en la base de datos.',
        ...errorDetails(error),
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/attendance/session?pin=XXXXXX
 * Valida si existe una sesión ACTIVE con ese PIN y sin expirar.
 * Sin `pin`, devuelve la última sesión activa (los registros solo para docentes/coordinación).
 */
export async function GET(request: NextRequest) {
  const auth = authorize(request, ['student', 'teacher', 'admin']);
  if (!auth.ok) return auth.response;
  const isStaff = auth.user.role !== 'student';

  try {
    const { searchParams } = request.nextUrl;
    const pin = searchParams.get('pin')?.trim();

    if (!pin) {
      const latestActive = await prisma.attendanceSession.findFirst({
        where: {
          status: 'ACTIVE',
          pinExpiresAt: { gte: new Date() },
          ...(auth.user.role === 'teacher' ? { teacherId: auth.user.id } : {}),
        },
        include: {
          course: true,
          teacher: { select: { id: true, name: true, email: true, department: true, title: true } },
          ...(isStaff
            ? {
                records: {
                  include: {
                    student: { select: { id: true, code: true, name: true, email: true, program: true } },
                  },
                  orderBy: { checkinAt: 'desc' as const },
                },
              }
            : {}),
        },
        orderBy: { startedAt: 'desc' },
      });

      if (!latestActive) {
        return safeJson(
          { valid: false, errorType: 'session_inactive', message: 'No hay ninguna sesión activa en este momento.' },
          { status: 404 },
        );
      }

      return safeJson({
        valid: true,
        session: {
          ...latestActive,
          expiresAt: latestActive.pinExpiresAt.toISOString(),
        },
        course: latestActive.course,
        teacher: latestActive.teacher,
      });
    }

    if (!PIN_PATTERN.test(pin)) {
      return safeJson(
        {
          valid: false,
          errorType: 'wrong_pin',
          message: 'El PIN ingresado es incorrecto o no corresponde a una sesión activa.',
        },
        { status: 404 },
      );
    }

    const now = new Date();
    const activeSession = await prisma.attendanceSession.findFirst({
      where: {
        pin,
        status: 'ACTIVE',
        pinExpiresAt: { gte: now },
      },
      include: {
        course: true,
        teacher: { select: { id: true, name: true, email: true, department: true, title: true } },
      },
      orderBy: { startedAt: 'desc' },
    });

    if (!activeSession) {
      const expiredOrClosed = await prisma.attendanceSession.findFirst({
        where: { pin },
        select: { id: true },
        orderBy: { startedAt: 'desc' },
      });

      const isExpired = Boolean(expiredOrClosed);
      return safeJson(
        {
          valid: false,
          errorType: isExpired ? 'expired' : 'wrong_pin',
          message: isExpired
            ? `El PIN (${pin}) ha expirado o la sesión ya fue cerrada.`
            : `El PIN ingresado (${pin}) es incorrecto o no corresponde a una sesión activa.`,
        },
        { status: 404 },
      );
    }

    return safeJson({
      valid: true,
      session: {
        ...activeSession,
        expiresAt: activeSession.pinExpiresAt.toISOString(),
      },
      course: activeSession.course,
      teacher: activeSession.teacher,
    });
  } catch (error) {
    console.error('[GET /api/attendance/session] Error:', error);
    return safeJson(
      {
        valid: false,
        error: 'Error al consultar la sesión de asistencia en el servidor.',
        ...errorDetails(error),
      },
      { status: 500 },
    );
  }
}
