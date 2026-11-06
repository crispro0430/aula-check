import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const teachers = await prisma.teacher.findMany({
      include: { courses: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ teachers });
  } catch (error) {
    console.error('[GET /api/admin/teachers] Error:', error);
    return NextResponse.json(
      { error: 'No se pudieron consultar los docentes.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      id?: string;
      name?: string;
      email?: string;
      department?: string;
      title?: string;
      phone?: string;
    };

    const name = body.name?.trim();
    const email = body.email?.trim()?.toLowerCase();
    const department =
      body.department?.trim() || 'Escuela de Ingeniería de Sistemas y Computación';
    const title = body.title?.trim() || 'Profesor(a) Asistente';
    const phone = body.phone?.trim() || '+57 (2) 321-2100';

    if (!name || !email) {
      return NextResponse.json(
        { error: 'El nombre y el correo institucional del docente son obligatorios.' },
        { status: 400 },
      );
    }

    const teacher = await prisma.teacher.upsert({
      where: { email },
      update: { name, department, title, phone },
      create: {
        id: body.id?.trim() || undefined,
        name,
        email,
        department,
        title,
        phone,
      },
    });

    return NextResponse.json({ teacher }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/admin/teachers] Error:', error);
    return NextResponse.json(
      {
        error: 'No se pudo dar de alta al docente en Supabase.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

