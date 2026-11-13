import { NextRequest } from 'next/server';
import type { AttendanceStatus, Prisma, Student } from '@prisma/client';
import prisma from '@/lib/prisma';
import { authorize, errorDetails, isUniqueConstraintError, safeJson } from '@/lib/api';
import type { AuthenticatedUser } from '@/lib/auth';
import {
  recalculateEnrollmentAttendance,
  scheduleRiskAlertIfNeeded,
  type AttendanceRecalculation,
} from '@/lib/attendance-risk';

interface CreateRecordPayload {
  sessionId?: string;
  studentId?: string;
  studentCode?: string;
  studentName?: string;
  studentEmail?: string;
  studentProgram?: string;
  checkInMethod?: 'QR' | 'PIN' | 'MANUAL' | 'qr' | 'pin' | 'manual' | string;
  status?: string;
  notes?: string;
}

const KNOWN_SEED_STUDENTS: Record<
  string,
  { code: string; name: string; email: string; program: string }
> = {
  '2021815001': { code: '2021815001', name: 'Juan David Pérez',  email: 'juan.perez@universidad.edu.co',  program: 'Ing. de Sistemas' },
  '1':          { code: '2021815023', name: 'Valentina Torres',  email: 'v.torres@universidad.edu.co',    program: 'Ing. de Sistemas' },
  '2':          { code: '2020815041', name: 'Santiago Ríos',     email: 's.rios@universidad.edu.co',      program: 'Ing. de Sistemas' },
  '3':          { code: '2022815007', name: 'Mariana Ospina',    email: 'm.ospina@universidad.edu.co',    program: 'Ing. de Sistemas' },
  '4':          { code: '2021815088', name: 'Daniel Herrera',    email: 'd.herrera@universidad.edu.co',   program: 'Ing. de Sistemas' },
  '5':          { code: '2023815012', name: 'Isabella Vargas',   email: 'i.vargas@universidad.edu.co',    program: 'Ing. de Sistemas' },
  '6':          { code: '2020815065', name: 'Alejandro Muñoz',   email: 'a.munoz@universidad.edu.co',     program: 'Ing. de Sistemas' },
  '7':          { code: '2022815034', name: 'Sofía Cardona',     email: 's.cardona@universidad.edu.co',   program: 'Ing. de Sistemas' },
  '8':          { code: '2021815056', name: 'Mateo González',    email: 'm.gonzalez@universidad.edu.co',  program: 'Ing. de Sistemas' },
  '9':          { code: '2020815029', name: 'Paula Jiménez',     email: 'p.jimenez@universidad.edu.co',   program: 'Ing. de Sistemas' },
  '10':         { code: '2023815044', name: 'Nicolás Castro',    email: 'n.castro@universidad.edu.co',    program: 'Ing. de Sistemas' },
  '11':         { code: '2021815071', name: 'Camila Morales',    email: 'c.morales@universidad.edu.co',   program: 'Ing. de Sistemas' },
  '12':         { code: '2022815019', name: 'Andrés Patiño',     email: 'a.patino@universidad.edu.co',    program: 'Ing. de Sistemas' },
};

const PRESENT_STATUSES: ReadonlySet<AttendanceStatus> = new Set<AttendanceStatus>([
  'PRESENTE',
  'TARDANZA',
  'PRESENTE_MANUAL',
]);

const RECORD_INCLUDE = {
  student: true,
  session: { include: { course: true, teacher: true } },
} satisfies Prisma.AttendanceRecordInclude;

/** Estado calculado en servidor según la tolerancia (lo que aplica a un estudiante). */
function computeTimelyStatus(startedAt: Date, toleranceMinutes: number): AttendanceStatus {
  const minutesLate = Math.floor((Date.now() - startedAt.getTime()) / 60000);
  return minutesLate <= toleranceMinutes ? 'PRESENTE' : 'TARDANZA';
}

/** Solo docentes/coordinación pueden fijar un estado explícito (p. ej. manual o ausente). */
function normalizeStaffStatus(
  rawStatus: string | undefined,
  startedAt: Date,
  toleranceMinutes: number,
): AttendanceStatus {
  const upper = rawStatus?.trim().toUpperCase();
  if (
    upper === 'PRESENTE' ||
    upper === 'TARDANZA' ||
    upper === 'PRESENTE_MANUAL' ||
    upper === 'AUSENTE' ||
    upper === 'JUSTIFICADO'
  ) {
    return upper;
  }
  return computeTimelyStatus(startedAt, toleranceMinutes);
}

/** El estudiante autenticado siempre se registra a sí mismo (anti-IDOR). */
async function resolveSessionStudent(user: AuthenticatedUser): Promise<Student> {
  const byId = await prisma.student.findUnique({ where: { id: user.id } });
  if (byId) return byId;
  const email = user.email.toLowerCase();
  const code = user.code?.trim() || user.id;
  return prisma.student.upsert({
    where: { email },
    update: {},
    create: {
      code,
      name: user.name,
      email,
      program: user.program || 'Ing. de Sistemas',
    },
  });
}

/** Docente/Coordinación registrando a un estudiante (contingencia manual). */
async function resolveStaffTargetStudent(body: CreateRecordPayload): Promise<Student> {
  const rawStudentId = (body.studentId || body.studentCode || '').trim();
  const seedByKey =
    KNOWN_SEED_STUDENTS[rawStudentId] ??
    Object.values(KNOWN_SEED_STUDENTS).find((s) => s.code === rawStudentId);

  const code = body.studentCode?.trim() || seedByKey?.code || rawStudentId;
  const name = body.studentName?.trim() || seedByKey?.name || 'Estudiante';
  const email = (
    body.studentEmail?.trim() ||
    seedByKey?.email ||
    `${code}@universidad.edu.co`
  ).toLowerCase();
  const program = body.studentProgram?.trim() || seedByKey?.program || 'Ing. de Sistemas';

  const findExisting = () =>
    prisma.student.findFirst({ where: { OR: [{ id: rawStudentId }, { code }, { email }] } });

  const existing = await findExisting();
  if (existing) return existing;

  try {
    return await prisma.student.create({ data: { id: rawStudentId, code, name, email, program } });
  } catch (error) {
    // Dos check-ins simultáneos del mismo estudiante: el otro ya lo creó.
    if (isUniqueConstraintError(error)) {
      const created = await findExisting();
      if (created) return created;
    }
    throw error;
  }
}

/**
 * POST /api/attendance/record
 * Persiste el registro de asistencia de forma atómica, evitando duplicados mediante
 * la restricción única @@unique([sessionId, studentId]) y preservando el check-in inicial.
 */
export async function POST(request: NextRequest) {
  const auth = authorize(request, ['student', 'teacher', 'admin']);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  try {
    const body = (await request.json().catch(() => ({}))) as CreateRecordPayload;
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';

    if (!sessionId) {
      return safeJson({ error: 'El campo "sessionId" es obligatorio.' }, { status: 400 });
    }

    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: { course: true, teacher: true },
    });

    if (!session) {
      return safeJson(
        { error: 'La sesión de asistencia indicada no existe.', errorType: 'session_inactive' },
        { status: 404 },
      );
    }

    const isStudent = user.role === 'student';

    if (isStudent && (session.status !== 'ACTIVE' || session.pinExpiresAt < new Date())) {
      return safeJson(
        { error: 'La sesión de asistencia ya no está activa.', errorType: 'session_inactive' },
        { status: 409 },
      );
    }

    if (user.role === 'teacher' && session.teacherId !== user.id) {
      return safeJson(
        { error: 'No autorizado: solo el docente titular de la sesión puede registrar asistencia.' },
        { status: 403 },
      );
    }

    if (!isStudent && !(body.studentId || body.studentCode)) {
      return safeJson(
        { error: 'Indica "studentId" o "studentCode" del estudiante a registrar.' },
        { status: 400 },
      );
    }

    const student = isStudent
      ? await resolveSessionStudent(user)
      : await resolveStaffTargetStudent(body);

    const status = isStudent
      ? computeTimelyStatus(session.startedAt, session.toleranceMinutes)
      : normalizeStaffStatus(body.status, session.startedAt, session.toleranceMinutes);

    const methodLabel = String(body.checkInMethod ?? 'PIN').toUpperCase().slice(0, 20);
    const notes =
      (!isStudent && typeof body.notes === 'string' ? body.notes.trim().slice(0, 500) : '') ||
      `Check-in vía ${methodLabel}`;
    const checkinAt = status === 'AUSENTE' ? null : new Date();
    const where = { sessionId_studentId: { sessionId: session.id, studentId: student.id } };

    type Outcome = {
      alreadyRegistered: boolean;
      record: Prisma.AttendanceRecordGetPayload<{ include: typeof RECORD_INCLUDE }>;
      recalculation: AttendanceRecalculation | null;
    };

    const runTransaction = () =>
      prisma.$transaction(async (tx): Promise<Outcome> => {
        const existing = await tx.attendanceRecord.findUnique({ where, include: RECORD_INCLUDE });

        if (existing && PRESENT_STATUSES.has(existing.status)) {
          return { alreadyRegistered: true, record: existing, recalculation: null };
        }

        if (existing) {
          // Compare-and-set: solo actualiza si nadie cambió el estado entretanto.
          const { count } = await tx.attendanceRecord.updateMany({
            where: { id: existing.id, status: existing.status },
            data: { status, checkinAt: existing.checkinAt ?? checkinAt, notes },
          });
          const current = await tx.attendanceRecord.findUniqueOrThrow({
            where: { id: existing.id },
            include: RECORD_INCLUDE,
          });
          if (count === 0) {
            return { alreadyRegistered: true, record: current, recalculation: null };
          }
          const recalculation = await recalculateEnrollmentAttendance(
            tx,
            student.id,
            session.courseId,
            { createEnrollmentIfMissing: false },
          );
          return { alreadyRegistered: false, record: current, recalculation };
        }

        const created = await tx.attendanceRecord.create({
          data: {
            sessionId: session.id,
            studentId: student.id,
            status,
            checkinAt,
            points: 0,
            notes,
          },
          include: RECORD_INCLUDE,
        });
        const recalculation = await recalculateEnrollmentAttendance(
          tx,
          student.id,
          session.courseId,
          { createEnrollmentIfMissing: false },
        );
        return { alreadyRegistered: false, record: created, recalculation };
      });

    let outcome: Outcome;
    try {
      outcome = await runTransaction();
    } catch (error) {
      // Carrera entre dos peticiones simultáneas: la otra ya insertó el registro.
      if (!isUniqueConstraintError(error)) throw error;
      const record = await prisma.attendanceRecord.findUniqueOrThrow({
        where,
        include: RECORD_INCLUDE,
      });
      outcome = { alreadyRegistered: true, record, recalculation: null };
    }

    if (outcome.recalculation) {
      scheduleRiskAlertIfNeeded(outcome.recalculation);
    }

    const { record } = outcome;
    return safeJson(
      {
        alreadyRegistered: outcome.alreadyRegistered,
        record: { ...record, checkInMethod: methodLabel },
        student: record.student,
        session: record.session,
        course: record.session.course,
      },
      { status: outcome.alreadyRegistered ? 200 : 201 },
    );
  } catch (error) {
    console.error('[POST /api/attendance/record] Error:', error);
    return safeJson(
      {
        error: 'No se pudo registrar la asistencia en la base de datos.',
        ...errorDetails(error),
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/attendance/record?sessionId=...
 * Devuelve los registros de una sesión para la consola docente en tiempo real.
 */
export async function GET(request: NextRequest) {
  const auth = authorize(request, ['teacher', 'admin']);
  if (!auth.ok) return auth.response;

  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId')?.trim();
    const pin = request.nextUrl.searchParams.get('pin')?.trim();

    if (!sessionId && !pin) {
      return safeJson(
        { error: 'Proporciona "sessionId" o "pin" para consultar registros.' },
        { status: 400 },
      );
    }

    const teacherScope = auth.user.role === 'teacher' ? { teacherId: auth.user.id } : {};

    const records = await prisma.attendanceRecord.findMany({
      where: sessionId
        ? { sessionId, session: teacherScope }
        : { session: { pin, status: 'ACTIVE', ...teacherScope } },
      include: {
        student: {
          select: { id: true, code: true, name: true, email: true, program: true, isActive: true },
        },
      },
      orderBy: { checkinAt: 'desc' },
    });

    return safeJson({ records });
  } catch (error) {
    console.error('[GET /api/attendance/record] Error:', error);
    return safeJson({ error: 'Error al consultar registros de asistencia.' }, { status: 500 });
  }
}
