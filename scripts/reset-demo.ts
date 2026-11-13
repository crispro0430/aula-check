/**
 * Aula Check — Restablece el ESCENARIO DE DEMOSTRACIÓN a su punto inicial.
 *
 * Uso (desde app/):   npx tsx --env-file=.env scripts/reset-demo.ts
 *
 * - Solo borra y recrea filas de la demo (ids con prefijo `demo-` y correos *.demo@...).
 *   No modifica usuarios, cursos ni registros existentes fuera de la demo.
 * - Es idempotente: puedes ejecutarlo antes de cada ensayo y justo antes de sustentar.
 * - Las fechas del historial se calculan respecto a HOY (zona horaria de Colombia).
 */
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

export const DEMO_PASSWORD = 'AulaDemo2026*';

const DEMO = {
  coordinator: {
    id: 'demo-coord',
    name: 'Coordinación Ingeniería de Sistemas (Demo)',
    email: 'coordinacion.demo@ucc.edu.co',
    department: 'Facultad de Ingeniería · Programa de Ingeniería de Sistemas',
  },
  teacher: {
    id: 'demo-teacher',
    name: 'Ing. Laura Restrepo Gaviria',
    email: 'docente.demo@ucc.edu.co',
    department: 'Facultad de Ingeniería · Programa de Ingeniería de Sistemas',
    title: 'Magíster en Ingeniería de Software',
    phone: '+57 (604) 444 6065 Ext. 2201',
  },
  courses: [
    {
      id: 'demo-course-isw801',
      code: 'ISW-801',
      name: 'Ingeniería de Software II',
      room: 'Bloque A · Sala de Cómputo 3',
      schedule: 'Mar/Jue 18:00 - 20:00',
    },
    {
      id: 'demo-course-dsw802',
      code: 'DSW-802',
      name: 'Desarrollo Web y Móvil',
      room: 'Bloque B · Laboratorio de Software 2',
      schedule: 'Lun/Mié 18:00 - 20:00',
    },
  ],
  students: [
    {
      id: 'demo-st-1',
      code: '2026990001',
      name: 'Andrés Felipe Gómez',
      email: 'andres.gomez.demo@campusucc.edu.co',
      program: 'Ingeniería de Sistemas',
    },
    {
      id: 'demo-st-2',
      code: '2026990002',
      name: 'Valeria Rodríguez Ospina',
      email: 'valeria.rodriguez.demo@campusucc.edu.co',
      program: 'Ingeniería de Sistemas',
    },
    {
      id: 'demo-st-3',
      code: '2026990003',
      name: 'Santiago Martínez Ruiz',
      email: 'santiago.martinez.demo@campusucc.edu.co',
      program: 'Ingeniería de Sistemas',
    },
  ],
} as const;

const COURSE_IDS = DEMO.courses.map((c) => c.id);
const STUDENT_IDS = DEMO.students.map((s) => s.id);
const [ISW, DSW] = DEMO.courses;
const [ST_AL_DIA, ST_EN_BORDE, ST_INCAPACIDAD] = DEMO.students;

type Status = 'PRESENTE' | 'TARDANZA' | 'AUSENTE';

/**
 * Historial (4 clases cerradas por materia):
 * - ISW-801: Estudiante 1 → 4/4 (100 %) · Estudiante 2 → 3/4 (75 %, en el umbral)
 *            Estudiante 3 → 3/4 (75 %), con la falta de hace 7 días cubierta por una
 *            incapacidad PENDIENTE lista para aprobar en vivo.
 * - DSW-802: los tres al 100 %.
 */
const HISTORY: Array<{
  courseId: string;
  daysAgo: number;
  topic: string;
  statuses: Record<string, Status>;
}> = [
  { courseId: ISW.id, daysAgo: 21, topic: 'Requisitos y casos de uso', statuses: { [ST_AL_DIA.id]: 'PRESENTE', [ST_EN_BORDE.id]: 'PRESENTE', [ST_INCAPACIDAD.id]: 'PRESENTE' } },
  { courseId: ISW.id, daysAgo: 14, topic: 'Patrones de diseño GoF', statuses: { [ST_AL_DIA.id]: 'PRESENTE', [ST_EN_BORDE.id]: 'AUSENTE', [ST_INCAPACIDAD.id]: 'PRESENTE' } },
  { courseId: ISW.id, daysAgo: 7, topic: 'Arquitectura limpia y capas', statuses: { [ST_AL_DIA.id]: 'PRESENTE', [ST_EN_BORDE.id]: 'PRESENTE', [ST_INCAPACIDAD.id]: 'AUSENTE' } },
  { courseId: ISW.id, daysAgo: 3, topic: 'Pruebas unitarias y TDD', statuses: { [ST_AL_DIA.id]: 'PRESENTE', [ST_EN_BORDE.id]: 'TARDANZA', [ST_INCAPACIDAD.id]: 'PRESENTE' } },
  { courseId: DSW.id, daysAgo: 20, topic: 'Fundamentos de React', statuses: { [ST_AL_DIA.id]: 'PRESENTE', [ST_EN_BORDE.id]: 'PRESENTE', [ST_INCAPACIDAD.id]: 'PRESENTE' } },
  { courseId: DSW.id, daysAgo: 13, topic: 'Next.js y Server Components', statuses: { [ST_AL_DIA.id]: 'PRESENTE', [ST_EN_BORDE.id]: 'PRESENTE', [ST_INCAPACIDAD.id]: 'PRESENTE' } },
  { courseId: DSW.id, daysAgo: 6, topic: 'APIs REST y autenticación', statuses: { [ST_AL_DIA.id]: 'PRESENTE', [ST_EN_BORDE.id]: 'PRESENTE', [ST_INCAPACIDAD.id]: 'TARDANZA' } },
  { courseId: DSW.id, daysAgo: 2, topic: 'Aplicaciones móviles híbridas', statuses: { [ST_AL_DIA.id]: 'PRESENTE', [ST_EN_BORDE.id]: 'PRESENTE', [ST_INCAPACIDAD.id]: 'PRESENTE' } },
];

const INCAPACITY_DAYS_AGO = 7;

/** Fecha YYYY-MM-DD en Colombia (UTC-5) de hace N días. */
function bogotaDate(daysAgo: number): string {
  const nowBogota = new Date(Date.now() - 5 * 60 * 60 * 1000);
  nowBogota.setUTCDate(nowBogota.getUTCDate() - daysAgo);
  return nowBogota.toISOString().slice(0, 10);
}

/** Inicio de clase a las 18:00 hora Colombia (23:00 UTC) del día indicado. */
function classStart(day: string): Date {
  return new Date(`${day}T23:00:00.000Z`);
}

/** PDF mínimo válido (1 página) en Base64 para previsualizar el soporte en vivo. */
function buildSupportPdfDataUrl(lines: string[]): string {
  const escapePdf = (text: string) =>
    text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\\()]/g, (c) => `\\${c}`);
  const content = [
    'BT',
    '/F1 20 Tf',
    '72 760 Td',
    `(${escapePdf(lines[0] ?? '')}) Tj`,
    '/F1 12 Tf',
    ...lines.slice(1).flatMap((line) => ['0 -26 Td', `(${escapePdf(line)}) Tj`]),
    'ET',
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return `data:application/pdf;base64,${Buffer.from(pdf, 'latin1').toString('base64')}`;
}

async function cleanDemoData(): Promise<void> {
  const studentEmails = DEMO.students.map((s) => s.email);
  const studentCodes = DEMO.students.map((s) => s.code);
  const courseCodes = DEMO.courses.map((c) => c.code);

  const demoStudents = await prisma.student.findMany({
    where: { OR: [{ id: { in: STUDENT_IDS } }, { email: { in: studentEmails } }, { code: { in: studentCodes } }] },
    select: { id: true },
  });
  const demoCourses = await prisma.course.findMany({
    where: { OR: [{ id: { in: COURSE_IDS } }, { code: { in: courseCodes } }] },
    select: { id: true },
  });
  const studentIds = demoStudents.map((s) => s.id);
  const courseIds = demoCourses.map((c) => c.id);

  await prisma.$transaction([
    prisma.incapacity.deleteMany({
      where: { OR: [{ studentId: { in: studentIds } }, { courseId: { in: courseIds } }] },
    }),
    prisma.attendanceRecord.deleteMany({
      where: { OR: [{ studentId: { in: studentIds } }, { session: { courseId: { in: courseIds } } }] },
    }),
    prisma.attendanceSession.deleteMany({
      where: {
        OR: [
          { courseId: { in: courseIds } },
          { teacher: { OR: [{ id: DEMO.teacher.id }, { email: DEMO.teacher.email }] } },
        ],
      },
    }),
    prisma.enrollment.deleteMany({
      where: { OR: [{ studentId: { in: studentIds } }, { courseId: { in: courseIds } }] },
    }),
    prisma.course.deleteMany({ where: { id: { in: courseIds } } }),
    prisma.student.deleteMany({ where: { id: { in: studentIds } } }),
    prisma.teacher.deleteMany({
      where: { OR: [{ id: DEMO.teacher.id }, { email: DEMO.teacher.email }] },
    }),
    prisma.coordinator.deleteMany({
      where: { OR: [{ id: DEMO.coordinator.id }, { email: DEMO.coordinator.email }] },
    }),
  ]);
}

async function seedDemoData(): Promise<void> {
  const password = await hashPassword(DEMO_PASSWORD);

  await prisma.coordinator.create({
    data: { ...DEMO.coordinator, password, role: 'ADMIN' },
  });
  await prisma.teacher.create({ data: { ...DEMO.teacher, password, isActive: true } });
  for (const course of DEMO.courses) {
    await prisma.course.create({ data: { ...course, period: '2026-2', teacherId: DEMO.teacher.id } });
  }
  for (const student of DEMO.students) {
    await prisma.student.create({ data: { ...student, password, isActive: true } });
  }

  // Sesiones cerradas + registros de asistencia
  const totals = new Map<string, { valid: number; total: number }>();
  for (const [index, entry] of HISTORY.entries()) {
    const course = DEMO.courses.find((c) => c.id === entry.courseId)!;
    const startedAt = classStart(bogotaDate(entry.daysAgo));
    const endedAt = new Date(startedAt.getTime() + 2 * 60 * 60 * 1000);
    const sessionId = `demo-ses-${String(index + 1).padStart(2, '0')}`;

    await prisma.attendanceSession.create({
      data: {
        id: sessionId,
        courseId: course.id,
        teacherId: DEMO.teacher.id,
        topic: entry.topic,
        room: course.room,
        pin: String(900000 + index),
        pinExpiresAt: endedAt,
        toleranceMinutes: 15,
        mode: 'BOTH',
        status: 'CLOSED',
        startedAt,
        endedAt,
        observations: 'Sesión del escenario de demostración',
      },
    });

    await prisma.attendanceRecord.createMany({
      data: Object.entries(entry.statuses).map(([studentId, status]) => ({
        sessionId,
        studentId,
        status,
        checkinAt:
          status === 'AUSENTE'
            ? null
            : new Date(startedAt.getTime() + (status === 'TARDANZA' ? 22 : 4) * 60 * 1000),
        notes: status === 'AUSENTE' ? 'Inasistencia registrada al cerrar la sesión' : 'Check-in vía QR',
      })),
    });

    for (const [studentId, status] of Object.entries(entry.statuses)) {
      const key = `${studentId}|${course.id}`;
      const acc = totals.get(key) ?? { valid: 0, total: 0 };
      acc.total += 1;
      if (status !== 'AUSENTE') acc.valid += 1;
      totals.set(key, acc);
    }
  }

  // Matrículas con el porcentaje coherente con el historial
  for (const student of DEMO.students) {
    for (const course of DEMO.courses) {
      const acc = totals.get(`${student.id}|${course.id}`) ?? { valid: 0, total: 0 };
      await prisma.enrollment.create({
        data: {
          studentId: student.id,
          courseId: course.id,
          finalAttendancePercentage: acc.total > 0 ? Math.round((acc.valid / acc.total) * 100) : 100,
        },
      });
    }
  }

  // Incapacidad PENDIENTE del Estudiante 3 (falta de ISW-801 de hace 7 días)
  const absenceDay = bogotaDate(INCAPACITY_DAYS_AGO);
  await prisma.incapacity.create({
    data: {
      id: 'demo-inc-001',
      studentId: ST_INCAPACIDAD.id,
      courseId: ISW.id,
      absenceDate: new Date(`${absenceDay}T12:00:00.000Z`),
      type: 'MEDICA',
      reason:
        'Cuadro de gastroenteritis aguda con atención por urgencias. La EPS otorga 1 día de incapacidad médica.',
      fileName: 'incapacidad_eps_santiago_martinez.pdf',
      fileUrl: buildSupportPdfDataUrl([
        'Certificado de Incapacidad Medica',
        'EPS Sura - Servicio de Urgencias (DOCUMENTO DE DEMOSTRACION)',
        `Paciente: ${ST_INCAPACIDAD.name} - C.C. 1.000.000.003`,
        `Fecha de atencion: ${absenceDay}`,
        'Diagnostico: Gastroenteritis aguda (CIE-10 A09)',
        'Dias de incapacidad: 1',
        'Medico tratante: Dra. Natalia Cardenas - R.M. 00000',
      ]),
      status: 'PENDIENTE',
      createdAt: new Date(`${bogotaDate(INCAPACITY_DAYS_AGO - 1)}T14:30:00.000Z`),
    },
  });
}

async function main(): Promise<void> {
  const dbRef = process.env.DATABASE_URL?.match(/postgres\.([a-z0-9]+)/)?.[1] ?? 'desconocida';
  console.log(`Restableciendo escenario de demo en la base de datos ${dbRef}...`);

  await cleanDemoData();
  await seedDemoData();

  const [sessions, records, enrollments] = await Promise.all([
    prisma.attendanceSession.count({ where: { courseId: { in: COURSE_IDS } } }),
    prisma.attendanceRecord.count({ where: { studentId: { in: STUDENT_IDS } } }),
    prisma.enrollment.findMany({
      where: { studentId: { in: STUDENT_IDS } },
      select: { finalAttendancePercentage: true, student: { select: { name: true } }, course: { select: { code: true } } },
      orderBy: [{ course: { code: 'asc' } }, { student: { code: 'asc' } }],
    }),
  ]);

  console.log(`✓ 1 coordinador, 1 docente, 2 materias, 3 estudiantes, ${sessions} sesiones, ${records} registros.`);
  for (const e of enrollments) {
    console.log(`  ${e.course.code}  ${e.student.name.padEnd(26)} ${e.finalAttendancePercentage}%`);
  }
  console.log('✓ Incapacidad PENDIENTE demo-inc-001 lista para aprobar en vivo.');
  console.log(`Contraseña de todas las cuentas demo: ${DEMO_PASSWORD}`);
}

main()
  .catch((error: unknown) => {
    console.error('✗ Error restableciendo la demo:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
