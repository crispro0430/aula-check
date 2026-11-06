// ─── Tipos Base ──────────────────────────────────────────────────────────────

export type AttendanceStatus =
  | 'presente'
  | 'tardanza'
  | 'ausente'
  | 'pendiente'
  | 'presente_manual'
  | 'justificado';

export type SemaforoLevel = 'verde' | 'ambar' | 'rojo';

export type UserRole = 'teacher' | 'student' | 'admin';

// ─── Justificación de Inasistencia (Art. 42) ─────────────────────────────────

export interface Justification {
  reason: 'Médico' | 'Laboral' | 'Fuerza Mayor';
  comments: string;
  submittedAt: Date;
  status: 'pendiente' | 'aprobada' | 'rechazada';
}

// ─── Incapacidades / Excusas (Flujo Estudiante → Docente/Admin) ─────────────

export type IncapacityType = 'Médica' | 'Laboral' | 'Fuerza Mayor';

export type IncapacityStatus = 'Pendiente' | 'Aprobada' | 'Rechazada';

export interface Incapacity {
  id: string;
  studentId: string;
  studentName: string;
  courseCode: string;
  courseName: string;
  date: string;            // Fecha de la falta (YYYY-MM-DD)
  reason: string;          // Motivo detallado
  type: IncapacityType;
  fileName: string;        // Nombre del soporte adjunto
  fileDataUrl: string;     // DataURL del soporte (preview); '' si no se pudo almacenar
  status: IncapacityStatus;
  reviewerComment: string;
  createdAt: string;       // ISO timestamp
  reviewedAt?: string;     // ISO timestamp de la revisión
  reviewedBy?: string;     // Nombre del revisor (docente / coordinación)
}

export type NewIncapacityInput = Omit<
  Incapacity,
  'id' | 'status' | 'reviewerComment' | 'createdAt' | 'reviewedAt' | 'reviewedBy'
>;

// ─── Estudiante ───────────────────────────────────────────────────────────────

export interface Student {
  id: string;
  name: string;
  code: string; // Código estudiantil
  program: string; // Carrera
  email: string;
  avatarInitials: string;
  status: AttendanceStatus;
  points: number; // Puntos de participación
  checkinTime: Date | null;
  attendanceRate: number; // Porcentaje asistencia acumulada (0-100)
  justification?: Justification;
  /** Fechas (YYYY-MM-DD) con incapacidad aprobada → se registran como "Justificado". */
  justifiedDates?: string[];
}

// ─── Sesión de Clase ─────────────────────────────────────────────────────────

export interface ClassSession {
  isActive: boolean;
  pin: string; // PIN de 6 dígitos activo
  pinExpiresAt: number; // Timestamp Unix (ms) de expiración del PIN
  course: string;
  courseCode: string;
  room: string;
  teacher: string;
  teacherTitle: string;
  tolerance: number; // minutos de tolerancia
  mode: 'qr' | 'pin' | 'both';
  startTime: Date | null;
  topic: string;
  period: string;
}

// ─── Resumen de Sesión ────────────────────────────────────────────────────────

export interface SessionSummary {
  topic: string;
  observations: string;
  contingencies: string;
  closedAt: Date | null;
}

// ─── Check-in Result ─────────────────────────────────────────────────────────

export interface CheckInResult {
  success: boolean;
  student?: Student;
  errorType?: 'wrong_pin' | 'expired' | 'already_registered' | 'session_inactive';
  errorMessage?: string;
}

// ─── Curso Administrado (Módulo Admin) ───────────────────────────────────────

export interface AdminCourse {
  id: string;
  code: string;        // Código de la asignatura (ej. SIS401)
  name: string;        // Nombre de la asignatura
  room: string;        // Salón habitual
  teacher: string;     // Profesor asignado
  schedule: string;    // Horario
  students: number;    // Número de matriculados
  enrolledStudentIds?: string[]; // IDs de estudiantes matriculados en la materia
}

export interface AttendanceHistoryEntry {
  date: string;          // Fecha de la sesión
  courseCode: string;     // Código de la asignatura
  courseName: string;     // Nombre de la asignatura
  status: AttendanceStatus;
  topic: string;
  notes?: string;
}

// ─── Docente Registrado (Directorio de Profesores) ─────────────────────────

export interface Teacher {
  id: string;
  name: string;
  email: string;
  department: string;
  title: string;
  phone?: string;
  avatarInitials: string;
}
