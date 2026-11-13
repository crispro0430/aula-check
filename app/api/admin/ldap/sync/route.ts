import { NextRequest } from 'next/server';
import { authorize, errorDetails, safeJson } from '@/lib/api';
import prisma from '@/lib/prisma';
import { reconcileAllLdapUsersToPostgres } from '@/lib/ldap-sync';

export async function POST(request: NextRequest) {
  const auth = authorize(request, ['admin']);
  if (!auth.ok) return auth.response;

  try {
    const result = await reconcileAllLdapUsersToPostgres();

    if (!result.ok) {
      return safeJson(
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

    return safeJson({
      success: true,
      ldapAvailable: true,
      counts: result.counts,
      students,
      teachers,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[POST /api/admin/ldap/sync] Error:', error);
    return safeJson(
      {
        success: false,
        error: 'Error al reconciliar usuarios desde OpenLDAP hacia Supabase.',
        ...errorDetails(error),
      },
      { status: 500 },
    );
  }
}

