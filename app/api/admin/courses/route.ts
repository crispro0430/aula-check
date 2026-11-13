import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { syncCourseGroupNonBlocking } from '@/lib/ldap-sync';

export async function GET() {
  try {
    const courses = await prisma.course.findMany({
      include: {
        teacher: true,
        enrollments: true,
      },
      orderBy: { code: 'asc' },
    });
    return NextResponse.json({ courses });
  } catch (error) {
    console.error('[GET /api/admin/courses] Error:', error);
    return NextResponse.json(
      { error: 'No se pudieron consultar las asignaturas.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      id?: string;
      code?: string;
      name?: string;
      room?: string;
      schedule?: string;
      period?: string;
      teacherId?: string;
      teacherName?: string;
      studentEmails?: string[];
    };

    const code = body.code?.trim().toUpperCase();
    const name = body.name?.trim();
    const room = body.room?.trim();
    const schedule = body.schedule?.trim() || 'Lun/Mié 08:00 - 10:00';
    const period = body.period?.trim() || '2026-2';

    if (!code || !name || !room) {
      return NextResponse.json(
        { error: 'Los campos código, nombre y salón son obligatorios.' },
        { status: 400 },
      );
    }

    let resolvedTeacherId: string | null = null;
    if (body.teacherId || body.teacherName) {
      const existingTeacher = await prisma.teacher.findFirst({
        where: {
          OR: [
            ...(body.teacherId ? [{ id: body.teacherId }] : []),
            ...(body.teacherName ? [{ name: body.teacherName.trim() }] : []),
          ],
        },
      });
      resolvedTeacherId = existingTeacher?.id ?? null;
    }

    const course = await prisma.course.upsert({
      where: { code },
      update: {
        name,
        room,
        schedule,
        period,
        teacherId: resolvedTeacherId,
      },
      create: {
        id: body.id?.trim() || undefined,
        code,
        name,
        room,
        schedule,
        period,
        teacherId: resolvedTeacherId,
      },
      include: { teacher: true },
    });

    await syncCourseGroupNonBlocking(
      course.id,
      Array.isArray(body.studentEmails) ? body.studentEmails : [],
    );

    return NextResponse.json({ course }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/admin/courses] Error:', error);
    return NextResponse.json(
      {
        error: 'No se pudo guardar la asignatura en Supabase.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
