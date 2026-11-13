import { NextRequest } from 'next/server';
import { authorize, errorDetails, safeJson } from '@/lib/api';
import prisma from '@/lib/prisma';
import { DEFAULT_INSTITUTIONAL_PASSWORD } from '@/lib/auth';
import { syncCourseGroupNonBlocking } from '@/lib/ldap-sync';

interface EnrollmentPayload {
  courseId?: string;
  courseCode?: string;
  courseName?: string;
  room?: string;
  schedule?: string;
  teacherName?: string;
  studentId?: string;
  studentCode?: string;
  studentEmail?: string;
  studentName?: string;
  studentProgram?: string;
}

async function resolveCourse(payload: EnrollmentPayload, createIfMissing: boolean) {
  const code = payload.courseCode?.trim().toUpperCase();
  const id = payload.courseId?.trim();

  const existing = await prisma.course.findFirst({
    where: {
      OR: [
        ...(id ? [{ id }] : []),
        ...(code ? [{ code }] : []),
      ],
    },
  });

  if (existing || !createIfMissing || !code) {
    return existing;
  }

  let teacherId: string | null = null;
  if (payload.teacherName?.trim()) {
    const teacher = await prisma.teacher.findFirst({
      where: { name: payload.teacherName.trim() },
      select: { id: true },
    });
    teacherId = teacher?.id ?? null;
  }

  return prisma.course.create({
    data: {
      id: id || undefined,
      code,
      name: payload.courseName?.trim() || code,
      room: payload.room?.trim() || 'Por asignar',
      schedule: payload.schedule?.trim() || 'Lun/Mié 08:00 - 10:00',
      period: '2026-2',
      teacherId,
    },
  });
}

async function resolveStudent(payload: EnrollmentPayload, createIfMissing: boolean) {
  const id = payload.studentId?.trim();
  const code = payload.studentCode?.trim();
  const email = payload.studentEmail?.trim().toLowerCase();

  const existing = await prisma.student.findFirst({
    where: {
      OR: [
        ...(id ? [{ id }] : []),
        ...(id ? [{ code: id }] : []),
        ...(code ? [{ code }] : []),
        ...(email ? [{ email }] : []),
      ],
    },
  });

  if (existing || !createIfMissing || !email || !code) {
    return existing;
  }

  return prisma.student.create({
    data: {
      id: code,
      code,
      name: payload.studentName?.trim() || email.split('@')[0],
      email,
      password: DEFAULT_INSTITUTIONAL_PASSWORD,
      program: payload.studentProgram?.trim() || 'Ing. de Sistemas',
      isActive: true,
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = authorize(request, ['admin']);
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as EnrollmentPayload;
    if (!body.courseId && !body.courseCode) {
      return safeJson(
        { error: 'Se requiere courseId o courseCode para matricular.' },
        { status: 400 },
      );
    }
    if (!body.studentId && !body.studentCode && !body.studentEmail) {
      return safeJson(
        { error: 'Se requiere identificar al estudiante para matricular.' },
        { status: 400 },
      );
    }

    const course = await resolveCourse(body, true);
    const student = await resolveStudent(body, true);

    if (!course || !student) {
      return safeJson(
        {
          success: false,
          syncedToDb: false,
          message: 'Asignatura o estudiante pendiente de persistencia en base de datos.',
        },
        { status: 202 },
      );
    }

    const enrollment = await prisma.enrollment.upsert({
      where: {
        studentId_courseId: {
          studentId: student.id,
          courseId: course.id,
        },
      },
      update: {},
      create: {
        studentId: student.id,
        courseId: course.id,
      },
    });

    await syncCourseGroupNonBlocking(course.id);

    return safeJson({ success: true, enrollment }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/admin/enrollments] Error:', error);
    return safeJson(
      {
        error: 'No se pudo registrar la matrícula en Supabase.',
        ...errorDetails(error),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = authorize(request, ['admin']);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const body = (await request.json().catch(() => ({}))) as EnrollmentPayload;

    const payload: EnrollmentPayload = {
      courseId: body.courseId || url.searchParams.get('courseId') || undefined,
      courseCode: body.courseCode || url.searchParams.get('courseCode') || undefined,
      studentId: body.studentId || url.searchParams.get('studentId') || undefined,
      studentCode: body.studentCode || url.searchParams.get('studentCode') || undefined,
      studentEmail: body.studentEmail || url.searchParams.get('studentEmail') || undefined,
    };

    const course = await resolveCourse(payload, false);
    const student = await resolveStudent(payload, false);

    if (course && student) {
      await prisma.enrollment.deleteMany({
        where: {
          courseId: course.id,
          studentId: student.id,
        },
      });
      await syncCourseGroupNonBlocking(course.id);
    }

    return safeJson({ success: true });
  } catch (error) {
    console.error('[DELETE /api/admin/enrollments] Error:', error);
    return safeJson(
      {
        error: 'No se pudo retirar la matrícula.',
        ...errorDetails(error),
      },
      { status: 500 },
    );
  }
}

