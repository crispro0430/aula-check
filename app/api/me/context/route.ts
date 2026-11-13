import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authorize, errorDetails, safeJson } from '@/lib/api';

const COURSE_SELECT = {
  id: true,
  code: true,
  name: true,
  room: true,
  schedule: true,
  teacher: { select: { id: true, name: true, email: true } },
  enrollments: {
    select: {
      finalAttendancePercentage: true,
      student: {
        select: { id: true, code: true, name: true, email: true, program: true, isActive: true },
      },
    },
  },
} as const;

/**
 * GET /api/me/context
 * Contexto académico REAL (PostgreSQL) del usuario autenticado, para hidratar la interfaz:
 * - Docente: sus asignaturas y los estudiantes matriculados en ellas.
 * - Estudiante: su perfil y las asignaturas en que está matriculado.
 * - Coordinación: todas las asignaturas.
 * Nunca expone contraseñas ni datos de otros cursos.
 */
export async function GET(request: NextRequest) {
  const auth = authorize(request, ['admin', 'teacher', 'student']);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  try {
    const where =
      user.role === 'teacher'
        ? { teacherId: user.id }
        : user.role === 'student'
        ? { enrollments: { some: { studentId: user.id } } }
        : {};

    const [courses, teacher] = await Promise.all([
      prisma.course.findMany({ where, select: COURSE_SELECT, orderBy: { code: 'asc' } }),
      user.role === 'teacher'
        ? prisma.teacher.findUnique({
            where: { id: user.id },
            select: { id: true, name: true, email: true, department: true, title: true, phone: true, isActive: true },
          })
        : Promise.resolve(null),
    ]);

    // Un estudiante solo ve sus propios datos de matrícula, no los de sus compañeros.
    const visibleCourses =
      user.role === 'student'
        ? courses.map((course) => ({
            ...course,
            enrollments: course.enrollments.filter((e) => e.student.id === user.id),
          }))
        : courses;

    const studentsById = new Map<
      string,
      { id: string; code: string; name: string; email: string; program: string; isActive: boolean }
    >();
    for (const course of visibleCourses) {
      for (const enrollment of course.enrollments) {
        studentsById.set(enrollment.student.id, enrollment.student);
      }
    }

    return safeJson({
      role: user.role,
      courses: visibleCourses.map((course) => ({
        id: course.id,
        code: course.code,
        name: course.name,
        room: course.room,
        schedule: course.schedule,
        teacherName: course.teacher?.name ?? '',
        teacherEmail: course.teacher?.email ?? '',
        enrolledStudentCodes: course.enrollments.map((e) => e.student.code),
        attendanceByStudentCode: Object.fromEntries(
          course.enrollments.map((e) => [e.student.code, e.finalAttendancePercentage ?? 100]),
        ),
      })),
      students: [...studentsById.values()],
      teachers: teacher ? [teacher] : [],
    });
  } catch (error) {
    console.error('[GET /api/me/context] Error:', error);
    return safeJson(
      { error: 'No se pudo cargar el contexto académico.', ...errorDetails(error) },
      { status: 500 },
    );
  }
}
