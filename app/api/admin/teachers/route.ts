import { NextRequest } from 'next/server';
import { authorize, errorDetails, safeJson } from '@/lib/api';
import prisma from '@/lib/prisma';
import { DEFAULT_INSTITUTIONAL_PASSWORD, hashPassword } from '@/lib/auth';
import { upsertLdapUser } from '@/lib/ldap';

export async function GET(request: NextRequest) {
  const auth = authorize(request, ['admin']);
  if (!auth.ok) return auth.response;

  try {
    const teachers = await prisma.teacher.findMany({
      include: { courses: true },
      orderBy: { createdAt: 'desc' },
    });
    return safeJson({ teachers });
  } catch (error) {
    console.error('[GET /api/admin/teachers] Error:', error);
    return safeJson(
      { error: 'No se pudieron consultar los docentes.' },
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
      name?: string;
      email?: string;
      department?: string;
      title?: string;
      phone?: string;
      password?: string;
    };

    const name = body.name?.trim();
    const email = body.email?.trim()?.toLowerCase();
    const department =
      body.department?.trim() || 'Escuela de Ingeniería de Sistemas y Computación';
    const title = body.title?.trim() || 'Profesor(a) Asistente';
    const phone = body.phone?.trim() || '+57 (2) 321-2100';
    const password = body.password?.trim() || DEFAULT_INSTITUTIONAL_PASSWORD;

    if (!name || !email) {
      return safeJson(
        { error: 'El nombre y el correo institucional del docente son obligatorios.' },
        { status: 400 },
      );
    }

    // Validar unicidad de correo institucional antes de crear
    const existingTeacher = await prisma.teacher.findUnique({ where: { email } });
    if (existingTeacher) {
      return safeJson(
        {
          error: `El correo institucional "${email}" ya está asignado a ${existingTeacher.name}.`,
          field: 'email',
        },
        { status: 409 },
      );
    }

    const existingStudent = await prisma.student.findUnique({ where: { email } });
    if (existingStudent) {
      return safeJson(
        {
          error: `El correo institucional "${email}" ya pertenece a un estudiante matriculado.`,
          field: 'email',
        },
        { status: 409 },
      );
    }

    const teacher = await prisma.teacher.create({
      data: {
        id: body.id?.trim() || undefined,
        name,
        email,
        department,
        title,
        phone,
        password: await hashPassword(password),
        isActive: true,
      },
    });

    try {
      const ldapRes = await upsertLdapUser({
        name: teacher.name,
        email: teacher.email,
        password,
        role: 'teacher',
        isActive: teacher.isActive,
        department: teacher.department,
        title: teacher.title,
        phone: teacher.phone ?? undefined,
      });
      if (!ldapRes.ok && ldapRes.reason !== 'LDAP_DISABLED') {
        console.warn(`[POST /api/admin/teachers] Sync LDAP no bloqueante: ${ldapRes.reason}`);
      }
    } catch (ldapErr) {
      console.warn('[POST /api/admin/teachers] Sync LDAP falló (no bloqueante):', ldapErr);
    }

    return safeJson({ teacher }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/admin/teachers] Error:', error);
    return safeJson(
      {
        error: 'No se pudo dar de alta al docente en Supabase.',
        ...errorDetails(error),
      },
      { status: 500 },
    );
  }
}

