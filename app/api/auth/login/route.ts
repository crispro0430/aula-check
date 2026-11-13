import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  DEFAULT_INSTITUTIONAL_PASSWORD,
  SESSION_COOKIE_NAME,
  encodeSessionToken,
  ensureInstitutionalUsersSeeded,
  isValidInstitutionalEmail,
  verifyInstitutionalPassword,
  type AuthenticatedUser,
} from '@/lib/auth';
import { authenticateWithLDAP, type LdapDirectoryUser } from '@/lib/ldap';

interface LoginRequestBody {
  email?: string;
  password?: string;
}

type AuthOutcome =
  | { ok: true; user: AuthenticatedUser; redirectTo: string; authProvider: 'ldap' | 'postgresql' }
  | { ok: false; status: 401 | 403; error: string };

const DISABLED_ACCOUNT_ERROR =
  'Cuenta institucional inhabilitada. Comunícate con Coordinación Académica';
const INVALID_CREDENTIALS_ERROR =
  'Credenciales inválidas. Verifica tu correo y contraseña';

async function generateUniqueStudentCode(preferredCode?: string): Promise<string> {
  if (preferredCode) {
    const existingByCode = await prisma.student.findUnique({
      where: { code: preferredCode },
      select: { id: true },
    });
    if (!existingByCode) {
      return preferredCode;
    }
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `20262${Math.floor(1000 + Math.random() * 9000)}`;
    const exists = await prisma.student.findUnique({
      where: { code: candidate },
      select: { id: true },
    });
    if (!exists) {
      return candidate;
    }
  }

  return `20262${Date.now().toString().slice(-6)}`;
}

/**
 * Just-In-Time (JIT) Provisioning: sincroniza o crea en Supabase PostgreSQL
 * al usuario autenticado por OpenLDAP según su Unidad Organizativa (OU),
 * preservando integridad referencial para asistencias, matrículas e incapacidades.
 */
async function provisionLdapUserInPostgres(ldapUser: LdapDirectoryUser): Promise<AuthOutcome> {
  if (ldapUser.role === 'admin') {
    const coordinator = await prisma.coordinator.upsert({
      where: { email: ldapUser.email },
      update: { name: ldapUser.name },
      create: {
        name: ldapUser.name,
        email: ldapUser.email,
        password: DEFAULT_INSTITUTIONAL_PASSWORD,
        department: ldapUser.department || 'Coordinación Académica',
        role: 'ADMIN',
      },
    });

    return {
      ok: true,
      authProvider: 'ldap',
      redirectTo: '/admin',
      user: {
        id: coordinator.id,
        name: coordinator.name,
        email: coordinator.email,
        role: 'admin',
        department: coordinator.department,
      },
    };
  }

  if (ldapUser.role === 'teacher') {
    const teacher = await prisma.teacher.upsert({
      where: { email: ldapUser.email },
      update: { name: ldapUser.name },
      create: {
        name: ldapUser.name,
        email: ldapUser.email,
        password: DEFAULT_INSTITUTIONAL_PASSWORD,
        department: ldapUser.department || 'Escuela de Ingeniería de Sistemas y Computación',
        title: ldapUser.title || 'Docente Institucional',
        phone: ldapUser.phone ?? null,
      },
    });

    if (teacher.isActive === false) {
      return { ok: false, status: 403, error: DISABLED_ACCOUNT_ERROR };
    }

    return {
      ok: true,
      authProvider: 'ldap',
      redirectTo: '/teacher/setup',
      user: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        role: 'teacher',
        department: teacher.department,
        title: teacher.title,
      },
    };
  }

  // Rol 'student' (ou=estudiantes)
  const existingStudent = await prisma.student.findUnique({
    where: { email: ldapUser.email },
  });

  const student = existingStudent
    ? await prisma.student.update({
        where: { id: existingStudent.id },
        data: { name: ldapUser.name },
      })
    : await prisma.student.create({
        data: {
          code: await generateUniqueStudentCode(ldapUser.code),
          name: ldapUser.name,
          email: ldapUser.email,
          password: DEFAULT_INSTITUTIONAL_PASSWORD,
          program: ldapUser.department || 'Ing. de Sistemas',
        },
      });

  if (student.isActive === false) {
    return { ok: false, status: 403, error: DISABLED_ACCOUNT_ERROR };
  }

  return {
    ok: true,
    authProvider: 'ldap',
    redirectTo: '/student/check-in',
    user: {
      id: student.id,
      name: student.name,
      email: student.email,
      role: 'student',
      code: student.code,
      program: student.program,
    },
  };
}

/**
 * Flujo de respaldo (Fallback) contra PostgreSQL / Supabase.
 */
async function authenticateWithPostgresFallback(
  email: string,
  password: string,
): Promise<AuthOutcome> {
  // 1. Consultar Coordinator (email exacto) -> rol = 'admin', destino '/admin'
  const coordinator = await prisma.coordinator.findUnique({ where: { email } });
  if (coordinator) {
    if (!verifyInstitutionalPassword(coordinator.password, password)) {
      return { ok: false, status: 401, error: INVALID_CREDENTIALS_ERROR };
    }
    return {
      ok: true,
      authProvider: 'postgresql',
      redirectTo: '/admin',
      user: {
        id: coordinator.id,
        name: coordinator.name,
        email: coordinator.email,
        role: 'admin',
        department: coordinator.department,
      },
    };
  }

  // 2. Consultar Teacher (email exacto) -> rol = 'teacher', destino '/teacher/setup'
  const teacher = await prisma.teacher.findUnique({ where: { email } });
  if (teacher) {
    if (!verifyInstitutionalPassword(teacher.password, password)) {
      return { ok: false, status: 401, error: INVALID_CREDENTIALS_ERROR };
    }
    if (teacher.isActive === false) {
      return { ok: false, status: 403, error: DISABLED_ACCOUNT_ERROR };
    }
    return {
      ok: true,
      authProvider: 'postgresql',
      redirectTo: '/teacher/setup',
      user: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        role: 'teacher',
        department: teacher.department,
        title: teacher.title,
      },
    };
  }

  // 3. Consultar Student (email exacto) -> rol = 'student', destino '/student/check-in'
  const student = await prisma.student.findUnique({ where: { email } });
  if (student) {
    if (!verifyInstitutionalPassword(student.password, password)) {
      return { ok: false, status: 401, error: INVALID_CREDENTIALS_ERROR };
    }
    if (student.isActive === false) {
      return { ok: false, status: 403, error: DISABLED_ACCOUNT_ERROR };
    }
    return {
      ok: true,
      authProvider: 'postgresql',
      redirectTo: '/student/check-in',
      user: {
        id: student.id,
        name: student.name,
        email: student.email,
        role: 'student',
        code: student.code,
        program: student.program,
      },
    };
  }

  return { ok: false, status: 401, error: INVALID_CREDENTIALS_ERROR };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LoginRequestBody;
    const email = (body.email ?? '').trim().toLowerCase();
    const password = (body.password ?? '').trim();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Ingresa tu correo institucional y tu contraseña.' },
        { status: 400 },
      );
    }

    if (!isValidInstitutionalEmail(email)) {
      return NextResponse.json(
        {
          error: 'Ingresa un correo institucional válido (@universidad.edu.co o .edu)',
        },
        { status: 400 },
      );
    }

    await ensureInstitutionalUsersSeeded();

    let outcome: AuthOutcome | null = null;

    // Paso 1: Intentar autenticación contra Directorio Activo / OpenLDAP si está habilitado
    if (process.env.LDAP_ENABLED === 'true') {
      const ldapResult = await authenticateWithLDAP(email, password);

      if (ldapResult.status === 'account_disabled') {
        return NextResponse.json(
          { error: ldapResult.message || DISABLED_ACCOUNT_ERROR },
          { status: 403 },
        );
      }

      if (ldapResult.status === 'invalid_credentials') {
        return NextResponse.json(
          { error: ldapResult.message || INVALID_CREDENTIALS_ERROR },
          { status: 401 },
        );
      }

      if (ldapResult.status === 'authenticated') {
        outcome = await provisionLdapUserInPostgres(ldapResult.user);
      }
      // Si status === 'unavailable' | 'disabled', conmuta transparentemente al fallback PostgreSQL
    }

    // Paso 2: Fallback transparente contra PostgreSQL (Supabase)
    if (!outcome) {
      outcome = await authenticateWithPostgresFallback(email, password);
    }

    if (!outcome.ok) {
      return NextResponse.json(
        { error: outcome.error },
        { status: outcome.status },
      );
    }

    const token = encodeSessionToken(outcome.user);
    const response = NextResponse.json({
      success: true,
      authenticated: true,
      authProvider: outcome.authProvider,
      user: outcome.user,
      redirectTo: outcome.redirectTo,
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 días
    });

    return response;
  } catch (error) {
    console.error('[POST /api/auth/login] Error:', error);
    return NextResponse.json(
      {
        error: 'Error en el servidor de autenticación institucional.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
