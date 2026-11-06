import { NextRequest, NextResponse } from 'next/server';
import type { CaptureMode } from '@prisma/client';
import prisma from '@/lib/prisma';

interface CreateSessionPayload {
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

function normalizeCaptureMode(mode?: string): CaptureMode {
  const upper = (mode ?? 'BOTH').toUpperCase();
  if (upper === 'QR' || upper === 'PIN' || upper === 'BOTH') {
    return upper;
  }
  return 'BOTH';
}

/**
 * POST /api/attendance/session
 * Crea (o actualiza) una sesión activa de asistencia en PostgreSQL/Supabase
 * para que cualquier dispositivo (ej. celular del estudiante) pueda validar el PIN/QR.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateSessionPayload;
    const pin = body.pin?.trim();

    if (!pin) {
      return NextResponse.json(
        { error: 'El campo "pin" es obligatorio para crear la sesión.' },
        { status: 400 },
      );
    }

    const durationMinutes =
      typeof body.durationMinutes === 'number' && body.durationMinutes > 0
        ? body.durationMinutes
        : 30;
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    // 1. Asegurar que el Docente exista en PostgreSQL (evitar error de FK)
    const teacherEmail = (body.teacherEmail ?? 'alejandro.morales@universidad.edu.co').trim().toLowerCase();
    const teacherName = body.teacherName?.trim() || 'Prof. Dr. Alejandro Morales';
    const teacher = await prisma.teacher.upsert({
      where: { email: teacherEmail },
      update: { name: teacherName },
      create: {
        id: body.teacherId?.trim() || undefined,
        name: teacherName,
        email: teacherEmail,
        department: body.teacherDepartment ?? 'Escuela de Ingeniería de Sistemas y Computación',
        title: body.teacherTitle ?? 'Ph.D. en Ingeniería de Software',
      },
    });

    // 2. Asegurar que la Asignatura (Course) exista en PostgreSQL (evitar error de FK)
    const courseCode = (body.courseCode || body.courseId || 'G401').trim();
    const courseName = body.courseName?.trim() || 'Arquitectura de Software';
    const room = body.room?.trim() || 'Edificio de Ingeniería G-401';
    const schedule = body.schedule?.trim() || 'Lun/Mié 08:00 - 10:00';

    const course = await prisma.course.upsert({
      where: { code: courseCode },
      update: {
        name: courseName,
        room,
        teacherId: teacher.id,
      },
      create: {
        id: body.courseId?.trim() || undefined,
        code: courseCode,
        name: courseName,
        room,
        schedule,
        period: '2026-2',
        teacherId: teacher.id,
      },
    });

    // 3. Guardar (o actualizar si ya existe con el mismo PIN) la sesión activa en AttendanceSession
    const existingByPin = await prisma.attendanceSession.findFirst({
      where: {
        pin,
        status: 'ACTIVE',
      },
      orderBy: { startedAt: 'desc' },
    });

    const createdSession = existingByPin
      ? await prisma.attendanceSession.update({
          where: { id: existingByPin.id },
          data: {
            courseId: course.id,
            teacherId: teacher.id,
            topic: body.topic?.trim() || existingByPin.topic || 'Sesión de clase',
            room,
            pinExpiresAt: expiresAt,
            toleranceMinutes:
              typeof body.toleranceMinutes === 'number' && body.toleranceMinutes >= 0
                ? body.toleranceMinutes
                : existingByPin.toleranceMinutes,
            mode: normalizeCaptureMode(body.mode),
            status: 'ACTIVE',
          },
          include: {
            course: true,
            teacher: true,
          },
        })
      : await prisma.attendanceSession.create({
          data: {
            courseId: course.id,
            teacherId: teacher.id,
            topic: body.topic?.trim() || 'Sesión de clase',
            room,
            pin,
            pinExpiresAt: expiresAt,
            toleranceMinutes:
              typeof body.toleranceMinutes === 'number' && body.toleranceMinutes >= 0
                ? body.toleranceMinutes
                : 15,
            mode: normalizeCaptureMode(body.mode),
            status: 'ACTIVE',
          },
          include: {
            course: true,
            teacher: true,
          },
        });

    return NextResponse.json(
      {
        session: {
          ...createdSession,
          expiresAt: createdSession.pinExpiresAt.toISOString(),
          qrCode: body.qrCode ?? null,
        },
        course: createdSession.course,
        teacher: createdSession.teacher,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/attendance/session] Error:', error);
    return NextResponse.json(
      {
        error: 'No se pudo guardar la sesión de asistencia en la base de datos.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/attendance/session?pin=XXXXXX
 * Valida en PostgreSQL/Supabase si existe una sesión ACTIVE con ese PIN y cuya
 * fecha de expiración (pinExpiresAt / expiresAt) sea mayor o igual al momento actual.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const pin = searchParams.get('pin')?.trim();

    // Si no se envía ?pin, permite consultar la última sesión activa (útil para sincronizar UI)
    if (!pin) {
      const latestActive = await prisma.attendanceSession.findFirst({
        where: {
          status: 'ACTIVE',
          pinExpiresAt: { gte: new Date() },
        },
        include: {
          course: true,
          teacher: true,
          records: {
            include: { student: true },
            orderBy: { checkinAt: 'desc' },
          },
        },
        orderBy: { startedAt: 'desc' },
      });

      if (!latestActive) {
        return NextResponse.json(
          { valid: false, errorType: 'session_inactive', message: 'No hay ninguna sesión activa en este momento.' },
          { status: 404 },
        );
      }

      return NextResponse.json({
        valid: true,
        session: {
          ...latestActive,
          expiresAt: latestActive.pinExpiresAt.toISOString(),
        },
        course: latestActive.course,
        teacher: latestActive.teacher,
      });
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
        teacher: true,
      },
      orderBy: { startedAt: 'desc' },
    });

    if (!activeSession) {
      // Verificar si el PIN existió pero expiró o fue cerrado
      const expiredOrClosed = await prisma.attendanceSession.findFirst({
        where: { pin },
        orderBy: { startedAt: 'desc' },
      });

      const isExpired = Boolean(expiredOrClosed);
      return NextResponse.json(
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

    return NextResponse.json({
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
    return NextResponse.json(
      {
        valid: false,
        error: 'Error al consultar la sesión de asistencia en el servidor.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
