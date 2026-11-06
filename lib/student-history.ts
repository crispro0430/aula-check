import type { Student, AttendanceHistoryEntry, AttendanceStatus } from './types';
import { getSemaforoLevel } from './utils';

export interface StudentCalculatedMetrics {
  totalSessions: number;
  attended: number;
  justified: number;
  absent: number;
  percentage: number;
  level: 'verde' | 'ambar' | 'rojo';
  history: AttendanceHistoryEntry[];
}

// ─── Sesiones Canónicas del Período 2026-2 (Agosto - Septiembre 2026) ─────────
export const CANONICAL_SEMESTER_SESSIONS = [
  { num: 1,  date: '2026-08-10', topic: 'Presentación del curso, lineamientos y arquitectura de software' },
  { num: 2,  date: '2026-08-12', topic: 'Requerimientos no funcionales y atributos de calidad (ISO 25010)' },
  { num: 3,  date: '2026-08-18', topic: 'Patrones arquitectónicos: MVC, Monolitos vs. Microservicios' },
  { num: 4,  date: '2026-08-24', topic: 'Arquitectura Limpia (Clean Architecture) y Principios SOLID' },
  { num: 5,  date: '2026-08-26', topic: 'Diseño de contratos OpenAPI, RESTful APIs y comunicación HTTP' },
  { num: 6,  date: '2026-08-31', topic: 'Sistemas Event-Driven y colas de mensajería con RabbitMQ' },
  { num: 7,  date: '2026-09-07', topic: 'Caché distribuido (Redis) y estrategias de alta concurrencia' },
  { num: 8,  date: '2026-09-09', topic: 'Contenedores y orquestación con Docker en entornos cloud' },
  { num: 9,  date: '2026-09-14', topic: 'Seguridad en capas de aplicación, Tokens JWT y OAuth2' },
  { num: 10, date: '2026-09-21', topic: 'Taller práctico evaluativo y revisión de casos de estudio' },
];

// Perfil auditado de inasistencias y justificaciones por estudiante en el Período 2026-2
// Las ausencias y justificaciones corresponden exactamente a las sesiones indicadas
const STUDENT_PROFILES: Record<string, { absences: number[]; justified: number[] }> = {
  // Alejandro Muñoz: 10 presentes, 0 ausencias -> 100% (Verde)
  '2020815065': { absences: [], justified: [] },
  // Valentina Torres: 9 presentes, 1 ausencia (Sesión 6) -> 90% (Verde)
  '2021815023': { absences: [6], justified: [] },
  // Nicolás Castro: 9 presentes, 1 ausencia (Sesión 8) -> 90% (Verde)
  '2023815044': { absences: [8], justified: [] },
  // Juan David Pérez: 9 presentes, 1 ausencia (Sesión 4) -> 90% (Verde)
  '2021815001': { absences: [4], justified: [] },
  // Daniel Herrera: 9 presentes, 1 ausencia (Sesión 7) -> 90% (Verde)
  '2021815088': { absences: [7], justified: [] },
  // Mateo González: 8 presentes, 2 ausencias (Sesiones 3 y 8) -> 80% (Verde)
  '2021815056': { absences: [3, 8], justified: [] },
  // Santiago Ríos: 8 presentes, 2 ausencias (Sesiones 4 y 9) -> 80% (Verde)
  '2020815041': { absences: [4, 9], justified: [] },
  // Camila Morales: 8 presentes, 2 ausencias (Sesiones 5 y 8) -> 80% (Verde)
  '2021815071': { absences: [5, 8], justified: [] },
  // Mariana Ospina: 7 presentes, 3 ausencias (Sesiones 2, 5 y 8) -> 70% (Amarillo)
  '2022815007': { absences: [2, 5, 8], justified: [] },
  // Sofía Cardona: 7 presentes, 3 ausencias (Sesiones 3, 6 y 9) -> 70% (Amarillo)
  '2022815034': { absences: [3, 6, 9], justified: [] },
  // Andrés Patiño: 6 presentes, 4 ausencias (Sesiones 2, 4, 7 y 9) -> 60% (Amarillo)
  '2022815019': { absences: [2, 4, 7, 9], justified: [] },
  // Isabella Vargas: 5 presentes, 5 ausencias (Sesiones 2, 4, 6, 8 y 10) -> 50% (Rojo)
  '2023815012': { absences: [2, 4, 6, 8, 10], justified: [] },
  // Paula Jiménez: 5 presentes, 5 ausencias (Sesiones 1, 3, 5, 8 y 10) -> 50% (Rojo)
  '2020815029': { absences: [1, 3, 5, 8, 10], justified: [] },
};

export function getStudentAttendanceHistory(
  student: Student,
  courseCode = 'G401',
  courseName = 'Arquitectura de Software'
): AttendanceHistoryEntry[] {
  const profile = STUDENT_PROFILES[student.code] || STUDENT_PROFILES[student.id];
  const justifiedDates = new Set(student.justifiedDates ?? []);

  /** Aplica las incapacidades aprobadas: una ausencia en esa fecha pasa a "Justificado". */
  const applyApprovedIncapacity = (entry: AttendanceHistoryEntry): AttendanceHistoryEntry =>
    entry.status === 'ausente' && justifiedDates.has(entry.date)
      ? { ...entry, status: 'justificado', notes: 'Incapacidad / excusa aprobada por Docente o Coordinación' }
      : entry;

  if (profile) {
    return CANONICAL_SEMESTER_SESSIONS.map((session) => {
      let status: AttendanceStatus = 'presente';
      let notes = 'Asistencia confirmada puntualmente';

      if (profile.absences.includes(session.num)) {
        if (student.justification && session.num === profile.absences[0]) {
          status = 'justificado';
          notes = `Justificación radicada: ${student.justification.reason}`;
        } else {
          status = 'ausente';
          notes = 'Inasistencia injustificada a sesión de clase';
        }
      } else if (profile.justified.includes(session.num)) {
        status = 'justificado';
        notes = 'Incapacidad médica / fuerza mayor validada por coordinación';
      }

      return applyApprovedIncapacity({
        date: session.date,
        courseCode,
        courseName,
        status,
        topic: session.topic,
        notes,
      });
    });
  }

  // Fallback determinístico para cualquier estudiante adicional
  const targetRate = student.attendanceRate ?? 80;
  const targetAbsences = Math.max(0, Math.min(10, Math.round(10 * (1 - targetRate / 100))));
  const hasJustification = Boolean(student.justification);

  return CANONICAL_SEMESTER_SESSIONS.map((session, idx) => {
    let status: AttendanceStatus = 'presente';
    let notes = 'Asistencia confirmada';

    if (hasJustification && idx === 0 && targetAbsences > 0) {
      status = 'justificado';
      notes = `Justificación: ${student.justification?.reason || 'Validada'}`;
    } else if (idx < targetAbsences) {
      status = 'ausente';
      notes = 'Inasistencia sin registro de justificación';
    }

    return applyApprovedIncapacity({
      date: session.date,
      courseCode,
      courseName,
      status,
      topic: session.topic,
      notes,
    });
  });
}

/**
 * Calcula con rigor matemático estricto todas las métricas de asistencia de un estudiante
 * garantizando que las tarjetas superiores y las filas de la tabla inferior sumen con
 * exactitud matemática el mismo número de asistencias, justificadas y faltas.
 */
export function computeStudentMetrics(
  student: Student,
  courseCode = 'G401',
  courseName = 'Arquitectura de Software'
): StudentCalculatedMetrics {
  const history = getStudentAttendanceHistory(student, courseCode, courseName);
  const totalSessions = history.length;
  const attended = history.filter((s) => s.status.toLowerCase().includes('presente')).length;
  const justified = history.filter((s) => s.status.toLowerCase().includes('justificado')).length;
  const absent = history.filter(
    (s) => s.status.toLowerCase().includes('ausente') || s.status.toLowerCase().includes('falta')
  ).length;
  const percentage = totalSessions > 0 ? Math.round(((attended + justified) / totalSessions) * 100) : 100;
  const level = getSemaforoLevel(percentage);

  return {
    totalSessions,
    attended,
    justified,
    absent,
    percentage,
    level,
    history,
  };
}
