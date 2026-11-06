import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      isActive?: boolean;
      code?: string;
      name?: string;
      email?: string;
      program?: string;
    };

    const existing = await prisma.student.findFirst({
      where: {
        OR: [
          { id },
          { code: id },
          ...(body.code ? [{ code: body.code.trim() }] : []),
          ...(body.email ? [{ email: body.email.trim().toLowerCase() }] : []),
        ],
      },
    });

    if (existing) {
      const nextIsActive =
        typeof body.isActive === 'boolean' ? body.isActive : !existing.isActive;
      const updated = await prisma.student.update({
        where: { id: existing.id },
        data: { isActive: nextIsActive },
      });
      return NextResponse.json({ student: updated });
    }

    if (body.code && body.name && body.email) {
      const created = await prisma.student.create({
        data: {
          id: body.code.trim(),
          code: body.code.trim(),
          name: body.name.trim(),
          email: body.email.trim().toLowerCase(),
          program: body.program?.trim() || 'Ingeniería de Sistemas',
          isActive: typeof body.isActive === 'boolean' ? body.isActive : false,
        },
      });
      return NextResponse.json({ student: created });
    }

    return NextResponse.json(
      { error: 'Estudiante no encontrado en la base de datos.' },
      { status: 404 },
    );
  } catch (error) {
    console.error('[PATCH /api/admin/students/[id]] Error:', error);
    return NextResponse.json(
      {
        error: 'No se pudo actualizar el estado del estudiante.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const existing = await prisma.student.findFirst({
      where: {
        OR: [{ id }, { code: id }],
      },
    });

    if (existing) {
      await prisma.student.delete({
        where: { id: existing.id },
      });
    }

    return NextResponse.json({
      success: true,
      deletedId: existing?.id ?? id,
    });
  } catch (error) {
    console.error('[DELETE /api/admin/students/[id]] Error:', error);
    return NextResponse.json(
      {
        error: 'No se pudo eliminar el estudiante de la base de datos.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

