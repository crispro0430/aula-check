import { NextRequest, NextResponse } from 'next/server';
import type { AttendanceStatus } from '@prisma/client';
import prisma from '@/lib/prisma';

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

function normalizeAttendanceStatus(
  rawStatus: string | undefined,
  startedAt: Date,
  toleranceMinutes: number,
): AttendanceStatus {
  if (rawStatus) {
    const upper = rawStatus.trim().toUpperCase();
    if (
      upper === 'PRESENTE' ||
      upper === 'TARDANZA' ||
      upper === 'PRESENTE_MANUAL' ||
      upper === 'AUSENTE' ||
      upper === 'JUSTIFICADO'
    ) {
      return upper;
    }
  }
  const minutesLate = Math.floor((Date.now() - startedAt.getTime()) / 60000);
  return minutesLate <= toleranceMinutes ? 'PRESENTE' : 'TARDANZA';
}

/**
 * POST /api/attendance/record
 * Persiste el registro de asistencia del estudiante en AttendanceRecord de Supabase,
 * evitando duplicados mediante la restricción única @@unique([sessionId, studentId]).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateRecordPayload;
    const sessionId = body.sessionId?.trim();
    const rawStudentId = (body.studentId || body.studentCode || '2021815001').trim();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'El campo "sessionId" es obligatorio.' },
        { status: 400 },
      );
    }

    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: { course: true, teacher: true },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'La sesión de asistencia indicada no existe.', errorType: 'session_inactive' },
        { status: 404 },
      );
    }

    // Resolver datos del estudiante (buscar en semilla conocida o usar los enviados)
    const seedByKey =
      KNOWN_SEED_STUDENTS[rawStudentId] ??
      Object.values(KNOWN_SEED_STUDENTS).find((s) => s.code === rawStudentId);

    const code = (body.studentCode?.trim() || seedByKey?.code || rawStudentId);
    const name = (body.studentName?.trim() || seedByKey?.name || 'Juan David Pérez');
    const email = (
      body.studentEmail?.trim() ||
      seedByKey?.email ||
      `${code}@universidad.edu.co`
    ).toLowerCase();
    const program = body.studentProgram?.trim() || seedByKey?.program || 'Ing. de Sistemas';

    // Asegurar que el estudiante exista en PostgreSQL (evitar violación de FK)
    let student = await prisma.student.findFirst({
      where: {
        OR: [{ id: rawStudentId }, { code }, { email }],
      },
    });

    if (!student) {
      student = await prisma.student.create({
        data: {
          id: rawStudentId,
          code,
          name,
          email,
          program,
        },
      });
    }

    const status = normalizeAttendanceStatus(
      body.status,
      session.startedAt,
      session.toleranceMinutes,
    );
    const methodLabel = (body.checkInMethod ?? 'PIN').toString().toUpperCase();
    const notes = body.notes?.trim() || `Check-in vía ${methodLabel}`;

    // Verificar si ya existe un registro para este estudiante en esta sesión
    const existingRecord = await prisma.attendanceRecord.findUnique({
      where: {
        sessionId_studentId: {
          sessionId: session.id,
          studentId: student.id,
        },
      },
      include: {
        student: true,
        session: { include: { course: true, teacher: true } },
      },
    });

    if (
      existingRecord &&
      (existingRecord.status === 'PRESENTE' ||
        existingRecord.status === 'TARDANZA' ||
        existingRecord.status === 'PRESENTE_MANUAL')
    ) {
      return NextResponse.json(
        {
          alreadyRegistered: true,
          record: {
            ...existingRecord,
            checkInMethod: methodLabel,
          },
          student: existingRecord.student,
          session: existingRecord.session,
          course: existingRecord.session.course,
        },
        { status: 200 },
      );
    }

    // Crear o actualizar evitando duplicados
    const savedRecord = await prisma.attendanceRecord.upsert({
      where: {
        sessionId_studentId: {
          sessionId: session.id,
          studentId: student.id,
        },
      },
      update: {
        status,
        checkinAt: new Date(),
        notes,
      },
      create: {
        sessionId: session.id,
        studentId: student.id,
        status,
        checkinAt: new Date(),
        points: 0,
        notes,
      },
      include: {
        student: true,
        session: { include: { course: true, teacher: true } },
      },
    });

    return NextResponse.json(
      {
        alreadyRegistered: false,
        record: {
          ...savedRecord,
          checkInMethod: methodLabel,
        },
        student: savedRecord.student,
        session: savedRecord.session,
        course: savedRecord.session.course,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/attendance/record] Error:', error);
    return NextResponse.json(
      {
        error: 'No se pudo registrar la asistencia en la base de datos.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/attendance/record?sessionId=...
 * Devuelve los registros de asistencia de una sesión para sincronizar en tiempo real.
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId')?.trim();
    const pin = request.nextUrl.searchParams.get('pin')?.trim();

    if (!sessionId && !pin) {
      return NextResponse.json(
        { error: 'Proporciona "sessionId" o "pin" para consultar registros.' },
        { status: 400 },
      );
    }

    const records = await prisma.attendanceRecord.findMany({
      where: sessionId
        ? { sessionId }
        : { session: { pin, status: 'ACTIVE' } },
      include: {
        student: true,
      },
      orderBy: { checkinAt: 'desc' },
    });

    return NextResponse.json({ records });
  } catch (error) {
    console.error('[GET /api/attendance/record] Error:', error);
    return NextResponse.json(
      { error: 'Error al consultar registros de asistencia.' },
      { status: 500 },
    );
  }
}

