import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  SESSION_COOKIE_NAME,
  encodeSessionToken,
  ensureInstitutionalUsersSeeded,
  isValidInstitutionalEmail,
  verifyInstitutionalPassword,
  type AuthenticatedUser,
} from '@/lib/auth';
import type { UserRole } from '@/lib/types';

interface LoginRequestBody {
  email?: string;
  password?: string;
  roleRequested?: UserRole | string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LoginRequestBody;
    const email = (body.email ?? '').trim().toLowerCase();
    const password = (body.password ?? '').trim();
    const roleRequested = (body.roleRequested ?? '').toLowerCase() as UserRole | '';

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Ingresa tu correo institucional y tu contraseña.' },
        { status: 400 },
      );
    }

    if (!isValidInstitutionalEmail(email)) {
      return NextResponse.json(
        {
          error:
            'Dominio no autorizado. Debes ingresar un correo institucional universitario válido (ej: @universidad.edu.co).',
        },
        { status: 400 },
      );
    }

    await ensureInstitutionalUsersSeeded();

    let authenticatedUser: AuthenticatedUser | null = null;

    // 1. Si solicita rol Docente (o sin rol específico)
    if (!roleRequested || roleRequested === 'teacher') {
      const teacher = await prisma.teacher.findUnique({ where: { email } });
      if (teacher) {
        if (!verifyInstitutionalPassword(teacher.password, password)) {
          return NextResponse.json(
            { error: 'Contraseña incorrecta para la cuenta docente indicada.' },
            { status: 401 },
          );
        }
        authenticatedUser = {
          id: teacher.id,
          name: teacher.name,
          email: teacher.email,
          role: 'teacher',
          department: teacher.department,
          title: teacher.title,
        };
      }
    }

    // 2. Si solicita rol Estudiante (o aún no se encontró)
    if (!authenticatedUser && (!roleRequested || roleRequested === 'student')) {
      const student = await prisma.student.findUnique({ where: { email } });
      if (student) {
        if (!verifyInstitutionalPassword(student.password, password)) {
          return NextResponse.json(
            { error: 'Contraseña incorrecta para la cuenta estudiantil indicada.' },
            { status: 401 },
          );
        }
        authenticatedUser = {
          id: student.id,
          name: student.name,
          email: student.email,
          role: 'student',
          code: student.code,
          program: student.program,
        };
      }
    }

    // 3. Si solicita rol Coordinación / Admin (o aún no se encontró)
    if (!authenticatedUser && (!roleRequested || roleRequested === 'admin')) {
      const coordinator = await prisma.coordinator.findUnique({ where: { email } });
      if (coordinator) {
        if (!verifyInstitutionalPassword(coordinator.password, password)) {
          return NextResponse.json(
            { error: 'Contraseña de Coordinación Académica incorrecta.' },
            { status: 401 },
          );
        }
        authenticatedUser = {
          id: coordinator.id,
          name: coordinator.name,
          email: coordinator.email,
          role: 'admin',
          department: coordinator.department,
        };
      }
    }

    // 4. Si no coincidió en el rol solicitado, verificar si existe en otro rol para dar un mensaje claro
    if (!authenticatedUser) {
      const [inTeacher, inStudent, inAdmin] = await Promise.all([
        prisma.teacher.findUnique({ where: { email } }),
        prisma.student.findUnique({ where: { email } }),
        prisma.coordinator.findUnique({ where: { email } }),
      ]);

      if (inTeacher || inStudent || inAdmin) {
        const realRoleLabel = inTeacher
          ? 'Docente'
          : inStudent
          ? 'Estudiante'
          : 'Coordinación Académica';
        return NextResponse.json(
          {
            error: `El correo ${email} está registrado con el rol de ${realRoleLabel}. Selecciona la pestaña "${realRoleLabel}" para iniciar sesión.`,
          },
          { status: 403 },
        );
      }

      return NextResponse.json(
        {
          error: `No existe ningún usuario registrado con el correo ${email} en la institución.`,
        },
        { status: 401 },
      );
    }

    const token = encodeSessionToken(authenticatedUser);
    const response = NextResponse.json({
      authenticated: true,
      user: authenticatedUser,
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

