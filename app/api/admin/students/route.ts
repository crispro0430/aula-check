import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const students = await prisma.student.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ students });
  } catch (error) {
    console.error('[GET /api/admin/students] Error:', error);
    return NextResponse.json(
      { error: 'No se pudieron consultar los estudiantes.' },
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
      email?: string;
      program?: string;
      password?: string;
    };

    const code = body.code?.trim();
    const name = body.name?.trim();
    const email = body.email?.trim()?.toLowerCase();
    const program = body.program?.trim() || 'Ing. de Sistemas';
    const password = body.password?.trim() || '123456';

    if (!code || !name || !email) {
      return NextResponse.json(
        { error: 'Los campos código, nombre y correo institucional son obligatorios.' },
        { status: 400 },
      );
    }

    // Validar unicidad de código y correo institucional antes de crear
    const existingByCode = await prisma.student.findUnique({ where: { code } });
    if (existingByCode) {
      return NextResponse.json(
        {
          error: `El código estudiantil "${code}" ya se encuentra asignado a ${existingByCode.name}.`,
          field: 'code',
        },
        { status: 409 },
      );
    }

    const existingByEmail = await prisma.student.findUnique({ where: { email } });
    if (existingByEmail) {
      return NextResponse.json(
        {
          error: `El correo institucional "${email}" ya pertenece al estudiante ${existingByEmail.name}.`,
          field: 'email',
        },
        { status: 409 },
      );
    }

    const existingTeacherEmail = await prisma.teacher.findUnique({ where: { email } });
    if (existingTeacherEmail) {
      return NextResponse.json(
        {
          error: `El correo institucional "${email}" ya está registrado en el directorio docente.`,
          field: 'email',
        },
        { status: 409 },
      );
    }

    const student = await prisma.student.create({
      data: {
        id: body.id?.trim() || code,
        code,
        name,
        email,
        program,
        password,
        isActive: true,
      },
    });

    return NextResponse.json({ student }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/admin/students] Error:', error);
    return NextResponse.json(
      {
        error: 'No se pudo dar de alta al estudiante en Supabase.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

