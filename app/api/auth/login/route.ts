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

interface LoginRequestBody {
  email?: string;
  password?: string;
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

    let authenticatedUser: AuthenticatedUser | null = null;
    let redirectTo = '/';

    // 1. Consultar Coordinator (email exacto) -> rol = 'admin', destino '/admin'
    const coordinator = await prisma.coordinator.findUnique({ where: { email } });
    if (coordinator) {
      if (!verifyInstitutionalPassword(coordinator.password, password)) {
        return NextResponse.json(
          { error: 'Credenciales inválidas. Verifica tu correo y contraseña' },
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
      redirectTo = '/admin';
    }

    // 2. Consultar Teacher (email exacto) -> rol = 'teacher', destino '/teacher/setup'
    if (!authenticatedUser) {
      const teacher = await prisma.teacher.findUnique({ where: { email } });
      if (teacher) {
        if (!verifyInstitutionalPassword(teacher.password, password)) {
          return NextResponse.json(
            { error: 'Credenciales inválidas. Verifica tu correo y contraseña' },
            { status: 401 },
          );
        }
        if (teacher.isActive === false) {
          return NextResponse.json(
            {
              error: 'Cuenta institucional inhabilitada. Comunícate con Coordinación Académica',
            },
            { status: 403 },
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
        redirectTo = '/teacher/setup';
      }
    }

    // 3. Consultar Student (email exacto) -> rol = 'student', destino '/student/check-in'
    if (!authenticatedUser) {
      const student = await prisma.student.findUnique({ where: { email } });
      if (student) {
        if (!verifyInstitutionalPassword(student.password, password)) {
          return NextResponse.json(
            { error: 'Credenciales inválidas. Verifica tu correo y contraseña' },
            { status: 401 },
          );
        }
        if (student.isActive === false) {
          return NextResponse.json(
            {
              error: 'Cuenta institucional inhabilitada. Comunícate con Coordinación Académica',
            },
            { status: 403 },
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
        redirectTo = '/student/check-in';
      }
    }

    // 4. Si no coincide en ninguna tabla, responder con error 401 claro
    if (!authenticatedUser) {
      return NextResponse.json(
        {
          error: 'Credenciales inválidas. Verifica tu correo y contraseña',
        },
        { status: 401 },
      );
    }

    const token = encodeSessionToken(authenticatedUser);
    const response = NextResponse.json({
      success: true,
      authenticated: true,
      user: authenticatedUser,
      redirectTo,
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
