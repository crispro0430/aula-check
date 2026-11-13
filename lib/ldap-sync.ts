import prisma from '@/lib/prisma';
import { DEFAULT_INSTITUTIONAL_PASSWORD } from '@/lib/auth';
import {
  pullAllUsersFromLdap,
  syncLdapCourseGroup,
  type LdapDirectoryUser,
} from '@/lib/ldap';

export async function generateUniqueStudentCode(preferredCode?: string): Promise<string> {
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
 * Sincroniza un usuario obtenido desde OpenLDAP hacia PostgreSQL (Supabase).
 */
export async function upsertDirectoryUserInPostgres(
  ldapUser: LdapDirectoryUser,
): Promise<{
  role: 'admin' | 'teacher' | 'student';
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  code?: string;
  department?: string;
  title?: string;
  phone?: string | null;
  program?: string;
}> {
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
      role: 'admin',
      id: coordinator.id,
      name: coordinator.name,
      email: coordinator.email,
      isActive: true,
      department: coordinator.department,
    };
  }

  if (ldapUser.role === 'teacher') {
    const teacher = await prisma.teacher.upsert({
      where: { email: ldapUser.email },
      update: {
        name: ldapUser.name,
        isActive: ldapUser.isActive,
      },
      create: {
        name: ldapUser.name,
        email: ldapUser.email,
        password: DEFAULT_INSTITUTIONAL_PASSWORD,
        department:
          ldapUser.department || 'Escuela de Ingeniería de Sistemas y Computación',
        title: ldapUser.title || 'Docente Institucional',
        phone: ldapUser.phone ?? null,
        isActive: ldapUser.isActive,
      },
    });

    return {
      role: 'teacher',
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      isActive: teacher.isActive,
      department: teacher.department,
      title: teacher.title,
      phone: teacher.phone,
    };
  }

  const existingStudent = await prisma.student.findUnique({
    where: { email: ldapUser.email },
  });

  const student = existingStudent
    ? await prisma.student.update({
        where: { id: existingStudent.id },
        data: {
          name: ldapUser.name,
          isActive: ldapUser.isActive,
        },
      })
    : await prisma.student.create({
        data: {
          code: await generateUniqueStudentCode(ldapUser.code),
          name: ldapUser.name,
          email: ldapUser.email,
          password: DEFAULT_INSTITUTIONAL_PASSWORD,
          program: ldapUser.department || 'Ing. de Sistemas',
          isActive: ldapUser.isActive,
        },
      });

  return {
    role: 'student',
    id: student.id,
    name: student.name,
    email: student.email,
    isActive: student.isActive,
    code: student.code,
    program: student.program,
  };
}

/**
 * Reconcilia todos los usuarios de OpenLDAP (`ou=coordinacion`, `ou=docentes`, `ou=estudiantes`)
 * contra Supabase PostgreSQL.
 */
export async function reconcileAllLdapUsersToPostgres(): Promise<{
  ok: boolean;
  reason?: string;
  counts: { coordinators: number; teachers: number; students: number; total: number };
}> {
  const pullResult = await pullAllUsersFromLdap();
  if (!pullResult.ok) {
    return {
      ok: false,
      reason: pullResult.reason,
      counts: { coordinators: 0, teachers: 0, students: 0, total: 0 },
    };
  }

  let coordinators = 0;
  let teachers = 0;
  let students = 0;

  for (const ldapUser of pullResult.users) {
    const synced = await upsertDirectoryUserInPostgres(ldapUser);
    if (synced.role === 'admin') coordinators += 1;
    else if (synced.role === 'teacher') teachers += 1;
    else students += 1;
  }

  return {
    ok: true,
    counts: {
      coordinators,
      teachers,
      students,
      total: coordinators + teachers + students,
    },
  };
}

/**
 * Sincroniza de forma no bloqueante el grupo `groupOfNames` de una asignatura en OpenLDAP
 * consultando su docente titular y estudiantes matriculados en Prisma.
 */
export async function syncCourseGroupNonBlocking(
  courseId: string,
  extraStudentEmails: string[] = [],
): Promise<void> {
  try {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        teacher: { select: { email: true } },
        enrollments: {
          include: {
            student: { select: { email: true } },
          },
        },
      },
    });

    if (!course) return;

    const studentEmails = Array.from(
      new Set([
        ...course.enrollments.map((e) => e.student.email),
        ...extraStudentEmails,
      ]),
    );

    const res = await syncLdapCourseGroup({
      code: course.code,
      name: course.name,
      teacherEmail: course.teacher?.email ?? null,
      studentEmails,
    });

    if (!res.ok && res.reason !== 'LDAP_DISABLED') {
      console.warn(`[LDAP] syncLdapCourseGroup(${course.code}): ${res.reason}`);
    }
  } catch (error) {
    console.warn('[LDAP] Error no bloqueante en syncCourseGroupNonBlocking:', error);
  }
}

