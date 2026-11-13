import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { reconcileAllLdapUsersToPostgres } from '@/lib/ldap-sync';

export async function POST() {
  try {
    const result = await reconcileAllLdapUsersToPostgres();

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          ldapAvailable: false,
          reason: result.reason,
          error:
            result.reason === 'LDAP_DISABLED'
              ? 'LDAP_ENABLED no está activo en las variables de entorno del servidor.'
              : 'No se pudo conectar con el servidor OpenLDAP (timeout 3000ms o red no accesible).',
        },
        { status: 503 },
      );
    }

    const [students, teachers] = await Promise.all([
      prisma.student.findMany({
        select: {
          id: true,
          code: true,
          name: true,
          email: true,
          program: true,
          isActive: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.teacher.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
          title: true,
          phone: true,
          isActive: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return NextResponse.json({
      success: true,
      ldapAvailable: true,
      counts: result.counts,
      students,
      teachers,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[POST /api/admin/ldap/sync] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al reconciliar usuarios desde OpenLDAP hacia Supabase.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

