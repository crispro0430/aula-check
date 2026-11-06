'use client';

import { create } from 'zustand';
import { subscribeWithSelector, persist, createJSONStorage } from 'zustand/middleware';
import type {
  Student,
  ClassSession,
  SessionSummary,
  CheckInResult,
  AttendanceStatus,
  AdminCourse,
  UserRole,
  Teacher,
  Incapacity,
  IncapacityStatus,
  NewIncapacityInput,
} from './types';
import { computeStudentMetrics } from './student-history';

// ─── Datos Semilla de Estudiantes ─────────────────────────────────────────────

const SEED_STUDENTS: Student[] = [
  { id: '2021815001', name: 'Juan David Pérez',  code: '2021815001', program: 'Ing. de Sistemas', email: 'juan.perez@universidad.edu.co', avatarInitials: 'JP', status: 'pendiente', points: 0, checkinTime: null, attendanceRate: 90 },
  { id: '1',  name: 'Valentina Torres',  code: '2021815023', program: 'Ing. de Sistemas', email: 'v.torres@universidad.edu.co',  avatarInitials: 'VT', status: 'pendiente', points: 0, checkinTime: null, attendanceRate: 90 },
  { id: '2',  name: 'Santiago Ríos',     code: '2020815041', program: 'Ing. de Sistemas', email: 's.rios@universidad.edu.co',    avatarInitials: 'SR', status: 'pendiente', points: 0, checkinTime: null, attendanceRate: 80 },
  { id: '3',  name: 'Mariana Ospina',    code: '2022815007', program: 'Ing. de Sistemas', email: 'm.ospina@universidad.edu.co',  avatarInitials: 'MO', status: 'pendiente', points: 0, checkinTime: null, attendanceRate: 70 },
  { id: '4',  name: 'Daniel Herrera',    code: '2021815088', program: 'Ing. de Sistemas', email: 'd.herrera@universidad.edu.co', avatarInitials: 'DH', status: 'pendiente', points: 0, checkinTime: null, attendanceRate: 90 },
  { id: '5',  name: 'Isabella Vargas',   code: '2023815012', program: 'Ing. de Sistemas', email: 'i.vargas@universidad.edu.co',  avatarInitials: 'IV', status: 'pendiente', points: 0, checkinTime: null, attendanceRate: 50 },
  { id: '6',  name: 'Alejandro Muñoz',   code: '2020815065', program: 'Ing. de Sistemas', email: 'a.munoz@universidad.edu.co',   avatarInitials: 'AM', status: 'pendiente', points: 0, checkinTime: null, attendanceRate: 100 },
  { id: '7',  name: 'Sofía Cardona',     code: '2022815034', program: 'Ing. de Sistemas', email: 's.cardona@universidad.edu.co', avatarInitials: 'SC', status: 'pendiente', points: 0, checkinTime: null, attendanceRate: 70 },
  { id: '8',  name: 'Mateo González',    code: '2021815056', program: 'Ing. de Sistemas', email: 'm.gonzalez@universidad.edu.co',avatarInitials: 'MG', status: 'pendiente', points: 0, checkinTime: null, attendanceRate: 80 },
  { id: '9',  name: 'Paula Jiménez',     code: '2020815029', program: 'Ing. de Sistemas', email: 'p.jimenez@universidad.edu.co', avatarInitials: 'PJ', status: 'pendiente', points: 0, checkinTime: null, attendanceRate: 50 },
  { id: '10', name: 'Nicolás Castro',    code: '2023815044', program: 'Ing. de Sistemas', email: 'n.castro@universidad.edu.co',  avatarInitials: 'NC', status: 'pendiente', points: 0, checkinTime: null, attendanceRate: 90 },
  { id: '11', name: 'Camila Morales',    code: '2021815071', program: 'Ing. de Sistemas', email: 'c.morales@universidad.edu.co', avatarInitials: 'CM', status: 'pendiente', points: 0, checkinTime: null, attendanceRate: 80 },
  { id: '12', name: 'Andrés Patiño',     code: '2022815019', program: 'Ing. de Sistemas', email: 'a.patino@universidad.edu.co',  avatarInitials: 'AP', status: 'pendiente', points: 0, checkinTime: null, attendanceRate: 60 },
];

// ─── Datos Semilla de Cursos (Módulo Admin) ──────────────────────────────────

const SEED_COURSES: AdminCourse[] = [
  {
    id: 'c1',
    code: 'G401',
    name: 'Arquitectura de Software',
    room: 'Edificio de Ingeniería G-401',
    teacher: 'Prof. Dr. Alejandro Morales',
    schedule: 'Lun/Mié 08:00 - 10:00',
    students: 13,
    enrolledStudentIds: ['2021815001', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
  },
  {
    id: 'c2',
    code: 'G402',
    name: 'Sistemas Distribuidos',
    room: 'Laboratorio de Cómputo B-204',
    teacher: 'Prof. Dr. Alejandro Morales',
    schedule: 'Mar/Jue 10:00 - 12:00',
    students: 8,
    enrolledStudentIds: ['2021815001', '1', '2', '4', '6', '8', '10', '11'],
  },
  {
    id: 'c3',
    code: 'G405',
    name: 'Taller de Grado',
    room: 'Sala de Proyectos A-110',
    teacher: 'Prof. Dr. Alejandro Morales',
    schedule: 'Vie 14:00 - 18:00',
    students: 5,
    enrolledStudentIds: ['2021815001', '1', '6', '10', '11'],
  },
];

// ─── Datos Semilla de Profesores (Directorio de Docentes) ───────────────────────

const SEED_TEACHERS: Teacher[] = [
  {
    id: 't1',
    name: 'Prof. Dr. Alejandro Morales',
    email: 'alejandro.morales@universidad.edu.co',
    department: 'Escuela de Ingeniería de Sistemas y Computación',
    title: 'Ph.D. en Ingeniería de Software',
    phone: '+57 (2) 321-2100 Ext. 401',
    avatarInitials: 'AM',
  },
  {
    id: 't2',
    name: 'Dra. Carolina Mendoza',
    email: 'carolina.mendoza@universidad.edu.co',
    department: 'Escuela de Ingeniería de Sistemas y Computación',
    title: 'Doctora en Ciencias de la Computación',
    phone: '+57 (2) 321-2100 Ext. 405',
    avatarInitials: 'CM',
  },
  {
    id: 't3',
    name: 'Ing. Carlos Eduardo Ruiz',
    email: 'carlos.ruiz@universidad.edu.co',
    department: 'Departamento de Telecomunicaciones y Redes',
    title: 'Magíster en Ciberseguridad y Redes',
    phone: '+57 (2) 321-2100 Ext. 412',
    avatarInitials: 'CR',
  },
  {
    id: 't4',
    name: 'Dra. Marcela Valencia',
    email: 'marcela.valencia@universidad.edu.co',
    department: 'Escuela de Ingeniería de Sistemas y Computación',
    title: 'Ph.D. en Inteligencia Artificial y Datos',
    phone: '+57 (2) 321-2100 Ext. 420',
    avatarInitials: 'MV',
  },
];

// ─── Datos Semilla de Incapacidades / Excusas ────────────────────────────────
// Dos registros iniciales (uno Pendiente y otro Aprobado) para que la bandeja
// de revisión y el historial del estudiante nunca se vean vacíos en la demo.

function makeDemoSupport(title: string, lines: string[]): string {
  const textLines = lines
    .map((l, i) => `<text x="40" y="${190 + i * 34}" font-size="20" fill="#334155">${l}</text>`)
    .join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="620" height="800" viewBox="0 0 620 800">` +
    `<rect width="620" height="800" fill="#ffffff"/>` +
    `<rect width="620" height="110" fill="#0b3d91"/>` +
    `<text x="40" y="68" font-size="30" font-weight="bold" fill="#ffffff">${title}</text>` +
    `<text x="40" y="150" font-size="16" fill="#64748b">Documento de soporte (demo) — Aula Check</text>` +
    textLines +
    `<rect x="40" y="640" width="220" height="2" fill="#94a3b8"/>` +
    `<text x="40" y="670" font-size="16" fill="#64748b">Firma y sello autorizado</text>` +
    `</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

const SEED_INCAPACITIES: Incapacity[] = [
  {
    id: 'inc-seed-001',
    studentId: '2021815001',
    studentName: 'Juan David Pérez',
    courseCode: 'G401',
    courseName: 'Arquitectura de Software',
    date: '2026-08-24',
    reason: 'Cuadro febril agudo con diagnóstico de faringoamigdalitis. La EPS otorga 2 días de incapacidad médica.',
    type: 'Médica',
    fileName: 'incapacidad_eps_sura.svg',
    fileDataUrl: makeDemoSupport('Incapacidad Médica — EPS', [
      'Paciente: Juan David Pérez',
      'Documento: 2021815001',
      'Diagnóstico: J03.9 Faringoamigdalitis aguda',
      'Días de incapacidad: 2 (24/08/2026 - 25/08/2026)',
      'Médico tratante: Dra. Laura Gómez — RM 45821',
    ]),
    status: 'Pendiente',
    reviewerComment: '',
    createdAt: '2026-08-25T09:12:00.000Z',
  },
  {
    id: 'inc-seed-002',
    studentId: '2',
    studentName: 'Santiago Ríos',
    courseCode: 'G401',
    courseName: 'Arquitectura de Software',
    date: '2026-09-14',
    reason: 'Turno laboral extraordinario asignado por la empresa de práctica (inventario anual). Se adjunta certificado.',
    type: 'Laboral',
    fileName: 'certificado_laboral_practica.svg',
    fileDataUrl: makeDemoSupport('Certificado Laboral', [
      'Empresa: TELEBIT S.A.S.',
      'Practicante: Santiago Ríos — 2020815041',
      'Se certifica turno extraordinario el 14/09/2026',
      'Horario: 06:00 a 18:00',
      'Firma: Jefe de Talento Humano',
    ]),
    status: 'Aprobada',
    reviewerComment: 'Soporte laboral verificado con la empresa. Inasistencia justificada.',
    createdAt: '2026-09-15T14:30:00.000Z',
    reviewedAt: '2026-09-16T10:05:00.000Z',
    reviewedBy: 'Prof. Dr. Alejandro Morales',
  },
];

/** Límite (~1.5 MB) para guardar el DataURL del soporte en localStorage. */
export const MAX_SUPPORT_DATAURL_LENGTH = 1_500_000;

/**
 * Refleja en el expediente de cada estudiante las incapacidades APROBADAS:
 * sus fechas quedan como "Justificado" y se recalcula el Semáforo de Permanencia.
 */
function syncApprovedIncapacities(students: Student[], incapacities: Incapacity[]): Student[] {
  return students.map((s) => {
    const justifiedDates = Array.from(
      new Set(
        incapacities
          .filter((i) => i.status === 'Aprobada' && (i.studentId === s.id || i.studentId === s.code))
          .map((i) => i.date),
      ),
    );
    const next: Student = { ...s, justifiedDates };
    return { ...next, attendanceRate: computeStudentMetrics(next).percentage };
  });
}

// ─── Generadores ─────────────────────────────────────────────────────────────

function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateReceiptId(): string {
  return 'AC-' + Math.floor(100000 + Math.random() * 899999).toString();
}

/**
 * Sincroniza en segundo plano la sesión activa con PostgreSQL/Supabase
 * mediante POST /api/attendance/session para que los dispositivos móviles
 * de los estudiantes puedan validar el PIN/QR desde cualquier navegador.
 */
async function persistSessionToDatabase(payload: {
  courseId?: string;
  courseCode: string;
  courseName: string;
  room: string;
  teacherId?: string;
  teacherName: string;
  pin: string;
  qrCode?: string;
  durationMinutes?: number;
  toleranceMinutes?: number;
  mode?: string;
  topic?: string;
}): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch('/api/attendance/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { session?: { id?: string } };
    return data.session?.id ?? null;
  } catch {
    // Fallback silencioso si está offline
    return null;
  }
}

// ─── Helper: Re-hidratar Dates desde strings JSON ────────────────────────────
// JSON.stringify serializa Date como string ISO; esta función los convierte de
// vuelta a objetos Date tras leer desde localStorage.

function rehydrateDates(state: Partial<AulaCheckStore>): void {
  if (state.session) {
    if (!state.session.period || state.session.period.startsWith('2025') || state.session.period === '2026-1') {
      state.session.period = '2026-2';
    }
  }
  if (state.session?.startTime) {
    state.session.startTime = new Date(state.session.startTime as unknown as string);
  }
  if (state.students) {
    // Si la lista de estudiantes no tiene a Juan David Pérez (por caché previo de localStorage), agregarlo
    if (!state.students.some((s) => s.name === 'Juan David Pérez' || s.email === 'juan.perez@universidad.edu.co' || s.id === '2021815001')) {
      state.students.unshift({
        id: '2021815001',
        name: 'Juan David Pérez',
        code: '2021815001',
        program: 'Ing. de Sistemas',
        email: 'juan.perez@universidad.edu.co',
        avatarInitials: 'JP',
        status: 'pendiente',
        points: 0,
        checkinTime: null,
        attendanceRate: 90,
      });
    }
    state.students = state.students.map((s) => ({
      ...s,
      attendanceRate: computeStudentMetrics(s).percentage,
      checkinTime: s.checkinTime ? new Date(s.checkinTime as unknown as string) : null,
      justification: s.justification
        ? {
            ...s.justification,
            submittedAt: new Date(s.justification.submittedAt as unknown as string),
          }
        : undefined,
    }));
  }
  if (state.courses) {
    state.courses = state.courses.map((c) => {
      const defaultIds = c.id === 'c1' || c.code === 'G401'
        ? ['2021815001', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
        : c.id === 'c2' || c.code === 'G402'
        ? ['2021815001', '1', '2', '4', '6', '8', '10', '11']
        : ['2021815001', '1', '6', '10', '11'];
      const enrolled = c.enrolledStudentIds && c.enrolledStudentIds.length > 0 ? c.enrolledStudentIds : defaultIds;
      return {
        ...c,
        enrolledStudentIds: enrolled,
        students: enrolled.length,
      };
    });
  }
  if (!state.teachers || state.teachers.length === 0) {
    state.teachers = SEED_TEACHERS.map((t) => ({ ...t }));
  }
  if (!Array.isArray(state.incapacities)) {
    state.incapacities = SEED_INCAPACITIES.map((i) => ({ ...i }));
  }
  if (state.students) {
    state.students = syncApprovedIncapacities(state.students, state.incapacities);
  }
  if (state.lastCheckIn?.student?.checkinTime) {
    state.lastCheckIn.student.checkinTime = new Date(
      state.lastCheckIn.student.checkinTime as unknown as string,
    );
  }
  if (state.summary?.closedAt) {
    state.summary.closedAt = new Date(state.summary.closedAt as unknown as string);
  }
}

// ─── Store Interface ──────────────────────────────────────────────────────────

interface AulaCheckStore {
  session: ClassSession;
  students: Student[];
  lastCheckIn: {
    result: 'success' | 'error' | null;
    student: Student | null;
    receiptId: string;
    errorType: string | null;
  };
  summary: SessionSummary;
  currentUser: { role: UserRole; name: string; email: string } | null;

  // ─── Acciones ─────────────────────────────────────────────────────────────
  setCurrentUser: (role: UserRole, name: string, email: string) => void;
  clearCurrentUser: () => void;
  startSession: (config: {
    courseId?: string;
    course: string;
    courseCode: string;
    room: string;
    tolerance: number;
    mode: 'qr' | 'pin' | 'both';
    topic: string;
    period?: string;
  }) => string;
  setSessionId: (id: string) => void;
  closeSession: (summary: SessionSummary) => void;
  regeneratePin: () => string;
  checkIn: (pin: string, studentId?: string) => CheckInResult;
  checkInStudent: (pin: string, studentId?: string) => CheckInResult;
  applyRemoteCheckIn: (params: {
    pin: string;
    sessionId?: string;
    courseCode: string;
    courseName: string;
    room?: string;
    teacher?: string;
    tolerance?: number;
    studentId?: string;
    studentCode?: string;
    studentName?: string;
    studentEmail?: string;
    status?: AttendanceStatus;
  }) => Student;
  setCheckInError: (
    errorType: 'wrong_pin' | 'expired' | 'already_registered' | 'session_inactive',
    student?: Student | null,
  ) => void;
  syncRemoteRecords: (
    records: Array<{
      studentId: string;
      status: string;
      checkinAt?: string | null;
      student?: { id: string; code: string; name: string; email: string; program: string };
    }>,
  ) => void;
  markManualAttendance: (studentId: string) => void;
  submitJustification: (
    studentId: string,
    reason: 'Médico' | 'Laboral' | 'Fuerza Mayor',
    comments: string
  ) => void;
  approveJustification: (studentId: string) => void;
  addParticipationPoint: (studentId: string) => void;
  resetSession: () => void;

  // ─── Acciones Admin (Gestión de Cursos y Profesores) ────────────────────
  courses: AdminCourse[];
  addCourse: (course: Omit<AdminCourse, 'id'>) => void;
  updateCourse: (id: string, data: Partial<AdminCourse>) => void;
  deleteCourse: (id: string) => void;
  enrollStudentInCourse: (courseId: string, studentId: string) => void;
  unenrollStudentFromCourse: (courseId: string, studentId: string) => void;

  teachers: Teacher[];
  addTeacher: (teacher: Omit<Teacher, 'id'>) => void;
  updateTeacher: (id: string, data: Partial<Teacher>) => void;
  assignCourseToTeacher: (courseId: string, teacherName: string) => void;

  // ─── Incapacidades / Excusas ─────────────────────────────────────────────
  incapacities: Incapacity[];
  submitIncapacity: (data: NewIncapacityInput) => Incapacity;
  reviewIncapacity: (
    id: string,
    decision: Exclude<IncapacityStatus, 'Pendiente'>,
    reviewerComment: string,
    reviewedBy: string,
  ) => void;
}

// ─── Default State ────────────────────────────────────────────────────────────

const DEFAULT_SESSION: ClassSession = {
  isActive: false,
  pin: '',
  pinExpiresAt: 0,
  course: 'Arquitectura de Software',
  courseCode: 'G401',
  room: 'Edificio de Ingeniería G-401',
  teacher: 'Prof. Dr. Alejandro Morales',
  teacherTitle: 'Ing. y Arq. de Software',
  tolerance: 15,
  mode: 'both',
  startTime: null,
  topic: '',
  period: '2026-2',
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAulaCheckStore = create<AulaCheckStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        session: DEFAULT_SESSION,
        students: syncApprovedIncapacities(SEED_STUDENTS.map((s) => ({ ...s })), SEED_INCAPACITIES),
        lastCheckIn: { result: null, student: null, receiptId: '', errorType: null },
        summary: { topic: '', observations: '', contingencies: '', closedAt: null },
        currentUser: {
          role: 'student',
          name: 'Juan David Pérez',
          email: 'juan.perez@universidad.edu.co',
        },
        courses: SEED_COURSES.map((c) => ({ ...c })),
        teachers: SEED_TEACHERS.map((t) => ({ ...t })),
        incapacities: SEED_INCAPACITIES.map((i) => ({ ...i })),

        setCurrentUser: (role, name, email) => {
          set({ currentUser: { role, name, email } });
        },

        clearCurrentUser: () => {
          set({ currentUser: null });
        },

        startSession: (config) => {
          const pin = generatePin();
          const pinExpiresAt = Date.now() + 30 * 1000;
          set({
            session: {
              ...DEFAULT_SESSION,
              ...config,
              isActive: true,
              pin,
              pinExpiresAt,
              startTime: new Date(),
              teacher: 'Prof. Dr. Alejandro Morales',
              teacherTitle: 'Ing. y Arq. de Software',
              period: config.period || '2026-2',
            },
            students: syncApprovedIncapacities(
              SEED_STUDENTS.map((s) => ({
                ...s,
                status: 'pendiente',
                points: 0,
                checkinTime: null,
              })),
              get().incapacities,
            ),
          });

          void persistSessionToDatabase({
            courseId: config.courseId || config.courseCode,
            courseCode: config.courseCode,
            courseName: config.course,
            room: config.room,
            teacherName: 'Prof. Dr. Alejandro Morales',
            pin,
            qrCode: `${typeof window !== 'undefined' ? window.location.origin : ''}/student/check-in?pin=${pin}&code=${encodeURIComponent(config.courseCode)}&name=${encodeURIComponent(config.course)}&room=${encodeURIComponent(config.room)}&session=active`,
            durationMinutes: Math.max(config.tolerance || 15, 30),
            toleranceMinutes: config.tolerance,
            mode: config.mode,
            topic: config.topic,
          }).then((dbId) => {
            if (dbId) {
              set((state) => ({ session: { ...state.session, id: dbId } }));
            }
          });

          return pin;
        },

        setSessionId: (id) => {
          set((state) => ({ session: { ...state.session, id } }));
        },

        closeSession: (summaryData) => {
          set((state) => ({
            session: { ...state.session, isActive: false },
            summary: { ...summaryData, closedAt: new Date() },
          }));
        },

        regeneratePin: () => {
          const newPin = generatePin();
          const currentSession = get().session;
          set((state) => ({
            session: {
              ...state.session,
              pin: newPin,
              pinExpiresAt: Date.now() + 30 * 1000,
            },
          }));

          if (currentSession.isActive) {
            void persistSessionToDatabase({
              courseId: currentSession.courseCode,
              courseCode: currentSession.courseCode,
              courseName: currentSession.course,
              room: currentSession.room,
              teacherName: currentSession.teacher,
              pin: newPin,
              qrCode: `${typeof window !== 'undefined' ? window.location.origin : ''}/student/check-in?pin=${newPin}&code=${encodeURIComponent(currentSession.courseCode)}&name=${encodeURIComponent(currentSession.course)}&room=${encodeURIComponent(currentSession.room)}&session=active`,
              durationMinutes: Math.max(currentSession.tolerance || 15, 30),
              toleranceMinutes: currentSession.tolerance,
              mode: currentSession.mode,
              topic: currentSession.topic,
            }).then((dbId) => {
              if (dbId) {
                set((state) => ({ session: { ...state.session, id: dbId } }));
              }
            });
          }

          return newPin;
        },

        checkInStudent: (pin: string, studentId?: string) => {
          const { session, students, currentUser } = get();

          if (!session.isActive) {
            const result: CheckInResult = {
              success: false,
              errorType: 'session_inactive',
              errorMessage: 'No hay una sesión de clase activa en este momento.',
            };
            set({ lastCheckIn: { result: 'error', student: null, receiptId: '', errorType: 'session_inactive' } });
            return result;
          }

          if (pin !== session.pin) {
            const result: CheckInResult = {
              success: false,
              errorType: 'wrong_pin',
              errorMessage: `El PIN ingresado (${pin}) es incorrecto o ha expirado.`,
            };
            set({ lastCheckIn: { result: 'error', student: null, receiptId: '', errorType: 'wrong_pin' } });
            return result;
          }

          let targetStudent: Student | undefined;

          // 1. Si se provee studentId explícito, usarlo
          if (studentId) {
            targetStudent = students.find((s) => s.id === studentId || s.code === studentId);
          }

          // 2. Si no, identificar al estudiante activo en currentUser (Juan David Pérez)
          if (!targetStudent && currentUser) {
            targetStudent = students.find(
              (s) =>
                (currentUser.email && s.email.toLowerCase() === currentUser.email.toLowerCase()) ||
                (currentUser.name && s.name.toLowerCase() === currentUser.name.toLowerCase())
            );
          }

          // 3. Si currentUser existe pero no estaba en students, agregarlo
          if (!targetStudent && currentUser?.name) {
            const studentCode = '2021815001';
            targetStudent = {
              id: studentCode,
              name: currentUser.name,
              code: studentCode,
              program: 'Ing. de Sistemas',
              email: currentUser.email || 'juan.perez@universidad.edu.co',
              avatarInitials: currentUser.name
                .split(' ')
                .slice(0, 2)
                .map((p) => p[0])
                .join('')
                .toUpperCase() || 'JP',
              status: 'pendiente',
              points: 0,
              checkinTime: null,
              attendanceRate: 85,
            };
            students.unshift(targetStudent);
          }

          // 4. Fallback si no se encontró con currentUser: buscar por Juan David Pérez
          if (!targetStudent) {
            targetStudent = students.find(
              (s) => s.name === 'Juan David Pérez' || s.email === 'juan.perez@universidad.edu.co'
            );
          }

          // 5. Último fallback a pendientes
          if (!targetStudent) {
            const pendingStudents = students.filter((s) => s.status === 'pendiente');
            targetStudent = pendingStudents[0] || students[0];
          }

          if (!targetStudent) {
            const result: CheckInResult = {
              success: false,
              errorType: 'already_registered',
              errorMessage: 'Todos los estudiantes ya han registrado su asistencia.',
            };
            set({ lastCheckIn: { result: 'error', student: null, receiptId: '', errorType: 'already_registered' } });
            return result;
          }

          if (targetStudent.status === 'presente' || targetStudent.status === 'tardanza') {
            const result: CheckInResult = {
              success: false,
              errorType: 'already_registered',
              errorMessage: `${targetStudent.name} ya tiene su asistencia registrada.`,
              student: targetStudent,
            };
            set({ lastCheckIn: { result: 'error', student: targetStudent, receiptId: '', errorType: 'already_registered' } });
            return result;
          }

          const now = new Date();
          const minutesLate = session.startTime
            ? Math.floor((now.getTime() - session.startTime.getTime()) / 60000)
            : 0;
          const status: AttendanceStatus = minutesLate <= session.tolerance ? 'presente' : 'tardanza';
          const receiptId = generateReceiptId();

          const updatedStudent: Student = { ...targetStudent, status, checkinTime: now };
          const updatedStudents = students.some((s) => s.id === updatedStudent.id)
            ? students.map((s) => (s.id === updatedStudent.id ? updatedStudent : s))
            : [updatedStudent, ...students];

          set({
            students: updatedStudents,
            lastCheckIn: { result: 'success', student: updatedStudent, receiptId, errorType: null },
          });

          return { success: true, student: updatedStudent };
        },

        checkIn: (pin: string, studentId?: string) => {
          return get().checkInStudent(pin, studentId);
        },

        applyRemoteCheckIn: (params) => {
          const { students, currentUser, session } = get();
          const now = new Date();

          let targetStudent: Student | undefined;
          if (params.studentId) {
            targetStudent = students.find(
              (s) => s.id === params.studentId || s.code === params.studentId,
            );
          }
          if (!targetStudent && params.studentCode) {
            targetStudent = students.find((s) => s.code === params.studentCode || s.id === params.studentCode);
          }
          if (!targetStudent && currentUser) {
            targetStudent = students.find(
              (s) =>
                (currentUser.email && s.email.toLowerCase() === currentUser.email.toLowerCase()) ||
                (currentUser.name && s.name.toLowerCase() === currentUser.name.toLowerCase()),
            );
          }
          if (!targetStudent) {
            targetStudent = students[0];
          }

          const resolvedStatus: AttendanceStatus = params.status || 'presente';
          const updatedStudent: Student = {
            ...targetStudent,
            name: params.studentName || targetStudent.name,
            code: params.studentCode || targetStudent.code,
            email: params.studentEmail || targetStudent.email,
            status: resolvedStatus,
            checkinTime: now,
          };

          const updatedStudents = students.some((s) => s.id === updatedStudent.id)
            ? students.map((s) => (s.id === updatedStudent.id ? updatedStudent : s))
            : [updatedStudent, ...students];

          const receiptId = generateReceiptId();

          set({
            session: {
              ...session,
              id: params.sessionId ?? session.id,
              isActive: true,
              pin: params.pin,
              courseCode: params.courseCode || session.courseCode,
              course: params.courseName || session.course,
              room: params.room || session.room,
              teacher: params.teacher || session.teacher,
              tolerance: params.tolerance ?? session.tolerance,
              startTime: session.startTime ?? now,
            },
            students: updatedStudents,
            lastCheckIn: {
              result: 'success',
              student: updatedStudent,
              receiptId,
              errorType: null,
            },
          });

          return updatedStudent;
        },

        setCheckInError: (errorType, student = null) => {
          set({
            lastCheckIn: {
              result: 'error',
              student,
              receiptId: '',
              errorType,
            },
          });
        },

        syncRemoteRecords: (records) => {
          if (!Array.isArray(records) || records.length === 0) return;
          set((state) => {
            const nextStudents = state.students.map((st) => {
              const match = records.find(
                (r) =>
                  r.studentId === st.id ||
                  r.studentId === st.code ||
                  r.student?.code === st.code ||
                  (r.student?.email && r.student.email.toLowerCase() === st.email.toLowerCase()),
              );
              if (!match) return st;
              const upper = match.status.toUpperCase();
              const mappedStatus: AttendanceStatus =
                upper === 'TARDANZA'
                  ? 'tardanza'
                  : upper === 'PRESENTE_MANUAL'
                  ? 'presente_manual'
                  : upper === 'JUSTIFICADO'
                  ? 'justificado'
                  : upper === 'AUSENTE'
                  ? 'ausente'
                  : 'presente';
              return {
                ...st,
                status: mappedStatus,
                checkinTime: match.checkinAt ? new Date(match.checkinAt) : st.checkinTime ?? new Date(),
              };
            });
            return { students: nextStudents };
          });
        },

        markManualAttendance: (studentId: string) => {
          const now = new Date();
          set((state) => ({
            students: state.students.map((s) =>
              s.id === studentId || s.code === studentId
                ? { ...s, status: 'presente_manual' as AttendanceStatus, checkinTime: now }
                : s
            ),
          }));
        },

        submitJustification: (
          studentId: string,
          reason: 'Médico' | 'Laboral' | 'Fuerza Mayor',
          comments: string
        ) => {
          const now = new Date();
          const { currentUser, students } = get();
          const targetId =
            studentId ||
            (currentUser
              ? students.find(
                  (s) =>
                    s.email.toLowerCase() === currentUser.email.toLowerCase() ||
                    s.name.toLowerCase() === currentUser.name.toLowerCase()
                )?.id
              : undefined);

          set((state) => ({
            students: state.students.map((s) =>
              s.id === targetId || s.code === targetId
                ? {
                    ...s,
                    justification: {
                      reason,
                      comments,
                      submittedAt: now,
                      status: 'pendiente',
                    },
                  }
                : s
            ),
          }));
        },

        approveJustification: (studentId: string) => {
          set((state) => ({
            students: state.students.map((s) =>
              s.id === studentId || s.code === studentId
                ? {
                    ...s,
                    status: 'justificado' as AttendanceStatus,
                    justification: s.justification
                      ? { ...s.justification, status: 'aprobada' }
                      : undefined,
                  }
                : s
            ),
          }));
        },

        addParticipationPoint: (studentId: string) => {
          set((state) => ({
            students: state.students.map((s) =>
              s.id === studentId ? { ...s, points: s.points + 1 } : s,
            ),
          }));
        },

        resetSession: () => {
          set({
            session: DEFAULT_SESSION,
            students: syncApprovedIncapacities(SEED_STUDENTS.map((s) => ({ ...s })), get().incapacities),
            lastCheckIn: { result: null, student: null, receiptId: '', errorType: null },
            summary: { topic: '', observations: '', contingencies: '', closedAt: null },
          });
        },

        // ─── Acciones Admin ───────────────────────────────────────────────────
        addCourse: (course) => {
          const id = 'c' + Date.now();
          set((state) => ({
            courses: [...state.courses, { ...course, id }],
          }));
        },

        updateCourse: (id, data) => {
          set((state) => ({
            courses: state.courses.map((c) =>
              c.id === id ? { ...c, ...data } : c
            ),
          }));
        },

        deleteCourse: (id) => {
          set((state) => ({
            courses: state.courses.filter((c) => c.id !== id),
          }));
        },

        enrollStudentInCourse: (courseId, studentId) => {
          set((state) => ({
            courses: state.courses.map((c) => {
              if (c.id !== courseId) return c;
              const currentIds = c.enrolledStudentIds || [];
              if (currentIds.includes(studentId)) return c;
              const updated = [...currentIds, studentId];
              return {
                ...c,
                enrolledStudentIds: updated,
                students: updated.length,
              };
            }),
          }));
        },

        unenrollStudentFromCourse: (courseId, studentId) => {
          set((state) => ({
            courses: state.courses.map((c) => {
              if (c.id !== courseId) return c;
              const currentIds = c.enrolledStudentIds || [];
              const updated = currentIds.filter((id) => id !== studentId);
              return {
                ...c,
                enrolledStudentIds: updated,
                students: updated.length,
              };
            }),
          }));
        },

        addTeacher: (data) => {
          const newTeacher: Teacher = {
            ...data,
            id: 't-' + Date.now(),
          };
          set((state) => ({ teachers: [...state.teachers, newTeacher] }));
        },

        updateTeacher: (id, data) => {
          set((state) => ({
            teachers: state.teachers.map((t) => (t.id === id ? { ...t, ...data } : t)),
          }));
        },

        assignCourseToTeacher: (courseId, teacherName) => {
          set((state) => ({
            courses: state.courses.map((c) =>
              c.id === courseId ? { ...c, teacher: teacherName } : c
            ),
          }));
        },

        // ─── Incapacidades / Excusas ──────────────────────────────────────────
        submitIncapacity: (data) => {
          const incapacity: Incapacity = {
            ...data,
            fileDataUrl:
              data.fileDataUrl.length <= MAX_SUPPORT_DATAURL_LENGTH ? data.fileDataUrl : '',
            id: 'inc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
            status: 'Pendiente',
            reviewerComment: '',
            createdAt: new Date().toISOString(),
          };
          set((state) => ({ incapacities: [incapacity, ...state.incapacities] }));
          return incapacity;
        },

        reviewIncapacity: (id, decision, reviewerComment, reviewedBy) => {
          set((state) => {
            const incapacities = state.incapacities.map((i) =>
              i.id === id
                ? {
                    ...i,
                    status: decision,
                    reviewerComment: reviewerComment.trim(),
                    reviewedAt: new Date().toISOString(),
                    reviewedBy,
                  }
                : i,
            );
            return {
              incapacities,
              students: syncApprovedIncapacities(state.students, incapacities),
            };
          });
        },
      }),

      // ─── persist config ───────────────────────────────────────────────────
      {
        name: 'aula-check-session', // clave en localStorage
        storage: createJSONStorage(() => localStorage),

        // Solo persistir datos, nunca las funciones (no son serializables)
        partialize: (state) => ({
          session:      state.session,
          students:     state.students,
          lastCheckIn:  state.lastCheckIn,
          summary:      state.summary,
          currentUser:  state.currentUser,
          courses:      state.courses,
          teachers:     state.teachers,
          incapacities: state.incapacities,
        }),

        // Re-hidratar objetos Date tras leer desde localStorage
        onRehydrateStorage: () => (state) => {
          if (state) rehydrateDates(state);
        },
      },
    ),
  ),
);

// ─── Sincronización Cross-Tab via StorageEvent ────────────────────────────────
// Cuando otra pestaña modifica 'aula-check-session' en localStorage, el evento
// nativo 'storage' se dispara SOLO en las pestañas que NO hicieron el cambio.
// Leemos el nuevo valor y actualizamos el store local para mantener coherencia.

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event: StorageEvent) => {
    if (event.key !== 'aula-check-session' || !event.newValue) return;

    try {
      const parsed = JSON.parse(event.newValue) as {
        state: Partial<AulaCheckStore>;
      };
      const incoming = parsed.state;

      // Re-hidratar Dates (vienen como strings desde JSON)
      rehydrateDates(incoming);

      // Aplicar al store sin tocar las acciones (funciones)
      useAulaCheckStore.setState((current) => ({
        ...current,
        session:     incoming.session     ?? current.session,
        students:    incoming.students    ?? current.students,
        lastCheckIn: incoming.lastCheckIn ?? current.lastCheckIn,
        summary:     incoming.summary     ?? current.summary,
        currentUser: incoming.currentUser ?? current.currentUser,
        courses:     incoming.courses     ?? current.courses,
        teachers:    incoming.teachers    ?? current.teachers,
        incapacities: incoming.incapacities ?? current.incapacities,
      }));
    } catch {
      // JSON malformado u otro error — ignorar silenciosamente
    }
  });
}
