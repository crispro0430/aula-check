import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { deleteLdapCourseGroup } from '@/lib/ldap';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const codeParam = url.searchParams.get('code')?.trim().toUpperCase();

    const existing = await prisma.course.findFirst({
      where: {
        OR: [
          { id },
          { code: id.toUpperCase() },
          ...(codeParam ? [{ code: codeParam }] : []),
        ],
      },
    });

    const targetCode = existing?.code || codeParam || id.toUpperCase();

    if (existing) {
      await prisma.course.delete({
        where: { id: existing.id },
      });
    }

    try {
      const ldapRes = await deleteLdapCourseGroup(targetCode);
      if (!ldapRes.ok && ldapRes.reason !== 'LDAP_DISABLED') {
        console.warn(`[DELETE /api/admin/courses/[id]] Delete LDAP: ${ldapRes.reason}`);
      }
    } catch (ldapErr) {
      console.warn('[DELETE /api/admin/courses/[id]] Delete LDAP falló:', ldapErr);
    }

    return NextResponse.json({
      success: true,
      deletedId: existing?.id ?? id,
    });
  } catch (error) {
    console.error('[DELETE /api/admin/courses/[id]] Error:', error);
    return NextResponse.json(
      {
        error: 'No se pudo eliminar la asignatura de la base de datos.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
