import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  encodeSessionToken,
  ensureInstitutionalUsersSeeded,
  hashPassword,
  isHashedPassword,
  isValidInstitutionalEmail,
  verifyInstitutionalPassword,
  type AuthenticatedUser,
} from '@/lib/auth';
import { errorDetails, runInBackground } from '@/lib/api';
import { authenticateWithLDAP, type LdapDirectoryUser } from '@/lib/ldap';
import { upsertDirectoryUserInPostgres } from '@/lib/ldap-sync';

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

const REDIRECT_BY_ROLE = {
  admin: '/admin',
  teacher: '/teacher/setup',
  student: '/student/check-in',
} as const;

/**
 * Just-In-Time (JIT) Provisioning: reutiliza la sincronización de `lib/ldap-sync.ts`
 * (nombre + `isActive`) para mantener PostgreSQL coherente con OpenLDAP (ARQ-01).
 */
async function provisionLdapUserInPostgres(ldapUser: LdapDirectoryUser): Promise<AuthOutcome> {
  const synced = await upsertDirectoryUserInPostgres(ldapUser);

  if (synced.isActive === false) {
    return { ok: false, status: 403, error: DISABLED_ACCOUNT_ERROR };
  }

  return {
    ok: true,
    authProvider: 'ldap',
    redirectTo: REDIRECT_BY_ROLE[synced.role],
    user: {
      id: synced.id,
      name: synced.name,
      email: synced.email,
      role: synced.role,
      code: synced.code,
      department: synced.department,
      title: synced.title,
      program: synced.program,
    },
  };
}

/**
 * Migra de forma transparente una contraseña heredada en texto plano a hash scrypt
 * tras un login exitoso (sin bloquear la respuesta).
 */
function upgradeLegacyPassword(
  model: 'coordinator' | 'teacher' | 'student',
  id: string,
  storedPassword: string | null,
  plainPassword: string,
): void {
  if (isHashedPassword(storedPassword)) return;
  runInBackground(`password-upgrade:${model}`, async () => {
    const hashed = await hashPassword(plainPassword);
    if (model === 'coordinator') {
      await prisma.coordinator.update({ where: { id }, data: { password: hashed } });
    } else if (model === 'teacher') {
      await prisma.teacher.update({ where: { id }, data: { password: hashed } });
    } else {
      await prisma.student.update({ where: { id }, data: { password: hashed } });
    }
  });
}

/**
 * Flujo de respaldo (Fallback) contra PostgreSQL / Supabase.
 */
async function authenticateWithPostgresFallback(
  email: string,
  password: string,
): Promise<AuthOutcome> {
  // 1. Coordinator -> rol 'admin'
  const coordinator = await prisma.coordinator.findUnique({ where: { email } });
  if (coordinator) {
    if (!(await verifyInstitutionalPassword(coordinator.password, password))) {
      return { ok: false, status: 401, error: INVALID_CREDENTIALS_ERROR };
    }
    upgradeLegacyPassword('coordinator', coordinator.id, coordinator.password, password);
    return {
      ok: true,
      authProvider: 'postgresql',
      redirectTo: REDIRECT_BY_ROLE.admin,
      user: {
        id: coordinator.id,
        name: coordinator.name,
        email: coordinator.email,
        role: 'admin',
        department: coordinator.department,
      },
    };
  }

  // 2. Teacher -> rol 'teacher'
  const teacher = await prisma.teacher.findUnique({ where: { email } });
  if (teacher) {
    if (!(await verifyInstitutionalPassword(teacher.password, password))) {
      return { ok: false, status: 401, error: INVALID_CREDENTIALS_ERROR };
    }
    if (teacher.isActive === false) {
      return { ok: false, status: 403, error: DISABLED_ACCOUNT_ERROR };
    }
    upgradeLegacyPassword('teacher', teacher.id, teacher.password, password);
    return {
      ok: true,
      authProvider: 'postgresql',
      redirectTo: REDIRECT_BY_ROLE.teacher,
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

  // 3. Student -> rol 'student'
  const student = await prisma.student.findUnique({ where: { email } });
  if (student) {
    if (!(await verifyInstitutionalPassword(student.password, password))) {
      return { ok: false, status: 401, error: INVALID_CREDENTIALS_ERROR };
    }
    if (student.isActive === false) {
      return { ok: false, status: 403, error: DISABLED_ACCOUNT_ERROR };
    }
    upgradeLegacyPassword('student', student.id, student.password, password);
    return {
      ok: true,
      authProvider: 'postgresql',
      redirectTo: REDIRECT_BY_ROLE.student,
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
    const body = (await request.json().catch(() => ({}))) as LoginRequestBody;
    const email = (typeof body.email === 'string' ? body.email : '').trim().toLowerCase();
    const password = (typeof body.password === 'string' ? body.password : '').trim();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Ingresa tu correo institucional y tu contraseña.' },
        { status: 400 },
      );
    }

    if (email.length > 254 || password.length > 256) {
      return NextResponse.json({ error: INVALID_CREDENTIALS_ERROR }, { status: 400 });
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

    // Paso 1: OpenLDAP (si está habilitado)
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
      // 'unavailable' | 'disabled' → fallback transparente a PostgreSQL
    }

    // Paso 2: Fallback PostgreSQL (Supabase)
    if (!outcome) {
      outcome = await authenticateWithPostgresFallback(email, password);
    }

    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.error }, { status: outcome.status });
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
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    console.error('[POST /api/auth/login] Error:', error);
    return NextResponse.json(
      {
        error: 'Error en el servidor de autenticación institucional.',
        ...errorDetails(error),
      },
      { status: 500 },
    );
  }
}
