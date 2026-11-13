import { NextRequest } from 'next/server';
import { authorize, errorDetails, safeJson } from '@/lib/api';
import prisma from '@/lib/prisma';
import { DEFAULT_INSTITUTIONAL_PASSWORD, hashPassword } from '@/lib/auth';
import { upsertLdapUser } from '@/lib/ldap';

export async function GET(request: NextRequest) {
  const auth = authorize(request, ['admin']);
  if (!auth.ok) return auth.response;

  try {
    const students = await prisma.student.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return safeJson({ students });
  } catch (error) {
    console.error('[GET /api/admin/students] Error:', error);
    return safeJson(
      { error: 'No se pudieron consultar los estudiantes.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = authorize(request, ['admin']);
  if (!auth.ok) return auth.response;

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
    const password = body.password?.trim() || DEFAULT_INSTITUTIONAL_PASSWORD;

    if (!code || !name || !email) {
      return safeJson(
        { error: 'Los campos código, nombre y correo institucional son obligatorios.' },
        { status: 400 },
      );
    }

    // Validar unicidad de código y correo institucional antes de crear
    const existingByCode = await prisma.student.findUnique({ where: { code } });
    if (existingByCode) {
      return safeJson(
        {
          error: `El código estudiantil "${code}" ya se encuentra asignado a ${existingByCode.name}.`,
          field: 'code',
        },
        { status: 409 },
      );
    }

    const existingByEmail = await prisma.student.findUnique({ where: { email } });
    if (existingByEmail) {
      return safeJson(
        {
          error: `El correo institucional "${email}" ya pertenece al estudiante ${existingByEmail.name}.`,
          field: 'email',
        },
        { status: 409 },
      );
    }

    const existingTeacherEmail = await prisma.teacher.findUnique({ where: { email } });
    if (existingTeacherEmail) {
      return safeJson(
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
        password: await hashPassword(password),
        isActive: true,
      },
    });

    try {
      const ldapRes = await upsertLdapUser({
        name: student.name,
        email: student.email,
        password,
        role: 'student',
        isActive: student.isActive,
        code: student.code,
        department: student.program,
      });
      if (!ldapRes.ok && ldapRes.reason !== 'LDAP_DISABLED') {
        console.warn(`[POST /api/admin/students] Sync LDAP no bloqueante: ${ldapRes.reason}`);
      }
    } catch (ldapErr) {
      console.warn('[POST /api/admin/students] Sync LDAP falló (no bloqueante):', ldapErr);
    }

    return safeJson({ student }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/admin/students] Error:', error);
    return safeJson(
      {
        error: 'No se pudo dar de alta al estudiante en Supabase.',
        ...errorDetails(error),
      },
      { status: 500 },
    );
  }
}

