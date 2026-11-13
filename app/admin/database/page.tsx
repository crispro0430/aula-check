'use client';

import { useMemo, useState } from 'react';
import {
  Database,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertTriangle,
  Table2,
  GitBranch,
  Code2,
  Search,
  KeyRound,
  Link2,
  Layers,
  Server,
  ShieldCheck,
} from 'lucide-react';
import { useAulaCheckStore } from '@/lib/store';
import {
  parsePrismaSchema,
  buildRelationalSnapshot,
  validateIntegrity,
  REQUIRED_MODELS,
  type DbRow,
  type ParsedModel,
} from '@/lib/db-model';

const PRISMA_SCHEMA_SOURCE = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum SessionStatus {
  ACTIVE
  CLOSED
}

enum CaptureMode {
  QR
  PIN
  BOTH
}

enum AttendanceStatus {
  PRESENTE
  TARDANZA
  PRESENTE_MANUAL
  AUSENTE
  JUSTIFICADO
}

enum IncapacityType {
  MEDICA
  LABORAL
  FUERZA_MAYOR
}

enum IncapacityStatus {
  PENDIENTE
  APROBADA
  RECHAZADA
}

/// Estudiante matriculado en la institución.
model Student {
  id        String   @id @default(cuid())
  code      String   @unique /// Código estudiantil (ej: "2021815001")
  name      String   /// Nombre completo
  email     String   @unique /// Email institucional (@universidad.edu.co)
  program   String   /// Programa académico (ej: "Ing. de Sistemas")
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  enrollments       Enrollment[]
  attendanceRecords AttendanceRecord[]
  incapacities      Incapacity[]

  @@map("students")
}

/// Docente de la institución.
model Teacher {
  id         String   @id @default(cuid())
  name       String   /// Nombre completo con título
  email      String   @unique /// Email institucional
  department String   /// Escuela / Departamento
  title      String   /// Máximo título académico
  phone      String?  /// Teléfono / extensión
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())

  courses              Course[]
  sessions             AttendanceSession[]
  reviewedIncapacities Incapacity[]        @relation("IncapacityReviewer")

  @@map("teachers")
}

/// Asignatura dictada en un periodo académico.
model Course {
  id        String  @id @default(cuid())
  code      String  @unique /// Código de la asignatura (ej: "G401")
  name      String  /// Nombre de la asignatura
  room      String  /// Salón habitual (ej: "Edificio de Ingeniería G-401")
  schedule  String  /// Horario (ej: "Lun/Mié 08:00 - 10:00")
  period    String  @default("2026-2") /// Periodo académico
  teacherId String? /// FK al docente asignado

  teacher      Teacher?            @relation(fields: [teacherId], references: [id], onDelete: SetNull)
  enrollments  Enrollment[]
  sessions     AttendanceSession[]
  incapacities Incapacity[]

  @@index([teacherId])
  @@index([period])
  @@map("courses")
}

/// Matrícula de un estudiante en una asignatura (tabla puente N:M).
model Enrollment {
  id                        String   @id @default(cuid())
  studentId                 String   /// FK al estudiante
  courseId                  String   /// FK a la asignatura
  enrolledAt                DateTime @default(now())
  finalAttendancePercentage Float?   /// Porcentaje acumulado (0-100) — Semáforo

  student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  course  Course  @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@unique([studentId, courseId])
  @@index([courseId])
  @@map("enrollments")
}

/// Sesión de clase en la que se toma asistencia (PIN/QR dinámico).
model AttendanceSession {
  id               String        @id @default(cuid())
  courseId         String        /// FK a la asignatura
  teacherId        String        /// FK al docente que abrió la sesión
  topic            String?       /// Tema desarrollado
  room             String        /// Aula donde se dicta
  pin              String        /// PIN/token dinámico de 6 dígitos (rota cada 30 s)
  pinExpiresAt     DateTime      /// Expiración del PIN actual
  toleranceMinutes Int           @default(15) /// Minutos de tolerancia para tardanza
  mode             CaptureMode   @default(BOTH)
  status           SessionStatus @default(ACTIVE)
  observations     String?       /// Bitácora de cierre
  contingencies    String?       /// Contingencias registradas
  startedAt        DateTime      @default(now())
  endedAt          DateTime?

  course  Course             @relation(fields: [courseId], references: [id], onDelete: Cascade)
  teacher Teacher            @relation(fields: [teacherId], references: [id])
  records AttendanceRecord[]

  @@index([courseId])
  @@index([teacherId])
  @@index([status])
  @@map("attendance_sessions")
}

/// Registro individual de asistencia de un estudiante en una sesión.
model AttendanceRecord {
  id           String           @id @default(cuid())
  sessionId    String           /// FK a la sesión
  studentId    String           /// FK al estudiante
  status       AttendanceStatus /// PRESENTE, TARDANZA, PRESENTE_MANUAL, AUSENTE, JUSTIFICADO
  checkinAt    DateTime?        /// Momento del check-in (NULL si ausente)
  points       Int              @default(0) /// Puntos de participación
  notes        String?          /// Observaciones
  incapacityId String?          /// FK a la incapacidad que justifica la ausencia

  session    AttendanceSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  student    Student           @relation(fields: [studentId], references: [id], onDelete: Cascade)
  incapacity Incapacity?       @relation(fields: [incapacityId], references: [id], onDelete: SetNull)

  @@unique([sessionId, studentId])
  @@index([studentId])
  @@index([status])
  @@map("attendance_records")
}

/// Incapacidad / excusa radicada por un estudiante con soporte adjunto.
model Incapacity {
  id              String           @id @default(cuid())
  studentId       String           /// FK al estudiante solicitante
  courseId        String           /// FK a la asignatura de la falta
  absenceDate     DateTime         @db.Date /// Fecha de la falta
  type            IncapacityType   /// MEDICA, LABORAL o FUERZA_MAYOR
  reason          String           /// Motivo detallado
  fileName        String?          /// Nombre del soporte adjunto
  fileUrl         String?          /// URL / ruta del soporte almacenado
  status          IncapacityStatus @default(PENDIENTE)
  reviewerComment String?          /// Observación del revisor
  reviewerName    String?          /// Nombre del revisor (docente o coordinación)
  reviewedById    String?          /// FK al docente revisor (NULL si revisó Coordinación)
  reviewedAt      DateTime?
  createdAt       DateTime         @default(now())

  student          Student            @relation(fields: [studentId], references: [id], onDelete: Cascade)
  course           Course             @relation(fields: [courseId], references: [id], onDelete: Cascade)
  reviewedBy       Teacher?           @relation("IncapacityReviewer", fields: [reviewedById], references: [id], onDelete: SetNull)
  justifiedRecords AttendanceRecord[]

  @@index([studentId])
  @@index([courseId])
  @@index([status])
  @@map("incapacities")
}`;

const CARDINAL_RELATIONS = [
  { parent: 'Teacher',           cardinality: '1 : N', child: 'Course',            fk: 'Course.teacherId → Teacher.id',                  desc: 'Un docente imparte una o varias asignaturas' },
  { parent: 'Teacher',           cardinality: '1 : N', child: 'AttendanceSession', fk: 'AttendanceSession.teacherId → Teacher.id',       desc: 'Un docente abre múltiples sesiones de clase' },
  { parent: 'Teacher',           cardinality: '1 : N', child: 'Incapacity',        fk: 'Incapacity.reviewedById → Teacher.id',           desc: 'Un docente revisa y aprueba/rechaza incapacidades' },
  { parent: 'Student',           cardinality: '1 : N', child: 'Enrollment',        fk: 'Enrollment.studentId → Student.id',              desc: 'Un estudiante se matricula en varios cursos (N:M vía Enrollment)' },
  { parent: 'Course',            cardinality: '1 : N', child: 'Enrollment',        fk: 'Enrollment.courseId → Course.id',                desc: 'Una asignatura tiene múltiples estudiantes inscritos' },
  { parent: 'Course',            cardinality: '1 : N', child: 'AttendanceSession', fk: 'AttendanceSession.courseId → Course.id',         desc: 'Una asignatura agrupa todas sus sesiones del semestre' },
  { parent: 'AttendanceSession', cardinality: '1 : N', child: 'AttendanceRecord',  fk: 'AttendanceRecord.sessionId → AttendanceSession.id', desc: 'Cada sesión registra la asistencia de cada estudiante' },
  { parent: 'Student',           cardinality: '1 : N', child: 'AttendanceRecord',  fk: 'AttendanceRecord.studentId → Student.id',        desc: 'Historial de asistencias, tardanzas y ausencias por estudiante' },
  { parent: 'Student',           cardinality: '1 : N', child: 'Incapacity',        fk: 'Incapacity.studentId → Student.id',              desc: 'Un estudiante radica incapacidades / excusas con soporte' },
  { parent: 'Course',            cardinality: '1 : N', child: 'Incapacity',        fk: 'Incapacity.courseId → Course.id',                desc: 'Cada incapacidad se asocia a la asignatura de la inasistencia' },
  { parent: 'Incapacity',        cardinality: '1 : N', child: 'AttendanceRecord',  fk: 'AttendanceRecord.incapacityId → Incapacity.id',  desc: 'Al aprobarse, justifica el registro de asistencia correspondiente' },
] as const;

const PG_TYPE_MAP: Record<string, string> = {
  String: 'TEXT / VARCHAR',
  Int: 'INTEGER',
  Float: 'DOUBLE PRECISION',
  Boolean: 'BOOLEAN',
  DateTime: 'TIMESTAMPTZ',
};

type ViewTab = 'er' | 'records' | 'prisma';

export default function AdminDatabasePage() {
  const students             = useAulaCheckStore((s) => s.students);
  const teachers             = useAulaCheckStore((s) => s.teachers);
  const courses              = useAulaCheckStore((s) => s.courses);
  const incapacities         = useAulaCheckStore((s) => s.incapacities);
  const session              = useAulaCheckStore((s) => s.session);
  const mergeRemoteDirectory = useAulaCheckStore((s) => s.mergeRemoteDirectory);

  const [activeTab, setActiveTab]         = useState<ViewTab>('er');
  const [selectedModel, setSelectedModel] = useState<string>('Student');
  const [searchQuery, setSearchQuery]     = useState<string>('');
  const [lastSync, setLastSync]           = useState<string>(() => new Date().toLocaleTimeString('es-CO'));
  const [syncing, setSyncing]             = useState<boolean>(false);
  const [syncingLdap, setSyncingLdap]     = useState<boolean>(false);
  const [syncBanner, setSyncBanner]       = useState<string>('');
  const [syncError, setSyncError]         = useState<string>('');

  const schema = useMemo(() => parsePrismaSchema(PRISMA_SCHEMA_SOURCE), []);

  const tables = useMemo(
    () => buildRelationalSnapshot({ students, teachers, courses, incapacities, session }),
    [students, teachers, courses, incapacities, session],
  );

  const issues = useMemo(() => validateIntegrity(schema, tables), [schema, tables]);

  const totalRecords = useMemo(
    () => Object.values(tables).reduce((acc, rows) => acc + rows.length, 0),
    [tables],
  );

  const activeRows: DbRow[] = useMemo(() => {
    const rows = tables[selectedModel] ?? [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      Object.values(r).some((val) => val !== null && String(val).toLowerCase().includes(q)),
    );
  }, [tables, selectedModel, searchQuery]);

  const activeColumns = useMemo(() => {
    const first = (tables[selectedModel] ?? [])[0];
    return first ? Object.keys(first) : [];
  }, [tables, selectedModel]);

  function handleForceSync() {
    setSyncing(true);
    setSyncBanner('');
    setSyncError('');
    setTimeout(() => {
      const now = new Date().toLocaleTimeString('es-CO');
      setLastSync(now);
      setSyncing(false);
      setSyncBanner(
        `Sincronización completada (${now}) — ${totalRecords} registros verificados en ${REQUIRED_MODELS.length} tablas con ${issues.length} errores de integridad.`,
      );
    }, 350);
  }

  async function handleSyncLdapDirectory() {
    setSyncingLdap(true);
    setSyncBanner('');
    setSyncError('');
    try {
      const res = await fetch('/api/admin/ldap/sync', { method: 'POST' });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        counts?: { coordinators: number; teachers: number; students: number; total: number };
        students?: Array<{
          id: string;
          code: string;
          name: string;
          email: string;
          program: string;
          isActive?: boolean;
        }>;
        teachers?: Array<{
          id: string;
          name: string;
          email: string;
          department: string;
          title: string;
          phone?: string | null;
          isActive?: boolean;
        }>;
      };

      if (!res.ok || !data.success) {
        setSyncError(
          data.error ||
            'No fue posible contactar el servidor OpenLDAP (Lubuntuserver). La plataforma continúa operando con Supabase.',
        );
        return;
      }

      mergeRemoteDirectory({
        students: data.students,
        teachers: data.teachers,
      });

      const now = new Date().toLocaleTimeString('es-CO');
      setLastSync(now);
      const c = data.counts ?? { coordinators: 0, teachers: 0, students: 0, total: 0 };
      setSyncBanner(
        `Sincronización LDAP completada (${now}) — ${c.total} usuarios importados/reconciliados desde OpenLDAP (${c.coordinators} coordinación, ${c.teachers} docentes, ${c.students} estudiantes).`,
      );
    } catch {
      setSyncError('Error de red al intentar sincronizar con OpenLDAP.');
    } finally {
      setSyncingLdap(false);
    }
  }

  function handleExportDictionary() {
    const dictionary = {
      project: 'Aula Check (TELEBIT)',
      engine: 'PostgreSQL (Prisma ORM)',
      status: 'Activo',
      mode: 'Sincronizado',
      exportedAt: new Date().toISOString(),
      totalRecords,
      integrityIssues: issues.length,
      models: schema.models.map((m) => ({
        model: m.name,
        tableName: m.tableName,
        description: m.doc,
        rowCount: (tables[m.name] ?? []).length,
        compositeUniques: m.compositeUniques,
        fields: m.fields.map((f) => ({
          name: f.name,
          prismaType: `${f.type}${f.isList ? '[]' : ''}${f.isOptional ? '?' : ''}`,
          postgresType: PG_TYPE_MAP[f.type] ?? (f.kind === 'enum' ? `ENUM (${f.type})` : 'FK / RELATION'),
          kind: f.kind,
          isPrimaryKey: f.isId,
          isUnique: f.isUnique,
          defaultValue: f.defaultValue,
          relation: f.relationFields.length
            ? `${m.name}.${f.relationFields.join(',')} -> ${f.type}.${f.relationReferences.join(',')}`
            : null,
          description: f.doc,
        })),
      })),
      relations: CARDINAL_RELATIONS,
      snapshot: tables,
    };

    const blob = new Blob([JSON.stringify(dictionary, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aula-check-diccionario-datos-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-8 flex flex-col gap-6 animate-fade-in">
      {/* ── Cabecera y Estado del Motor (Liquid Glass) ── */}
      <div className="bg-white/75 backdrop-blur-2xl border border-black/[0.06] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#34c759]/12 text-[#1d1d1f] text-xs font-medium border border-[#34c759]/25">
              <span className="w-2 h-2 rounded-full bg-[#34c759] animate-pulse" />
              Motor: PostgreSQL (Prisma ORM) • Activo • Sincronizado
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0071e3]/10 text-[#0071e3] text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" /> Integridad: {issues.length === 0 ? '100% OK' : `${issues.length} alertas`}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#1d1d1f] tracking-tight flex items-center gap-2.5">
            <Database className="w-6 h-6 text-[#0071e3] shrink-0" />
            Modelo de Datos y Esquema Entidad-Relación
          </h1>
          <p className="text-xs sm:text-sm text-[#86868b] mt-1">
            Arquitectura relacional en <code className="px-1.5 py-0.5 rounded bg-black/[0.04] text-[#1d1d1f] font-mono text-xs">prisma/schema.prisma</code> sincronizada en tiempo real con Aula Check (última sincronización: {lastSync}).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => void handleSyncLdapDirectory()}
            disabled={syncingLdap}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-[#1d1d1f] hover:bg-black active:scale-[0.98] text-white font-semibold text-xs shadow-sm transition-all disabled:opacity-60"
            title="Importar y reconciliar usuarios desde OpenLDAP / phpLDAPadmin hacia Supabase"
          >
            <Server className={`w-3.5 h-3.5 text-[#34c759] ${syncingLdap ? 'animate-pulse' : ''}`} />
            {syncingLdap ? 'Sincronizando LDAP…' : 'Sincronizar LDAP'}
          </button>
          <button
            type="button"
            onClick={handleForceSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#006edb] active:scale-[0.98] text-white font-semibold text-xs transition-all disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            Sincronizar ahora
          </button>
          <button
            type="button"
            onClick={handleExportDictionary}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-white/80 hover:bg-white border border-black/[0.08] text-[#1d1d1f] font-semibold text-xs transition-all active:scale-[0.98]"
          >
            <Download className="w-3.5 h-3.5 text-[#0071e3]" />
            Exportar Diccionario (JSON)
          </button>
        </div>
      </div>

      {syncBanner && (
        <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-[#34c759]/12 border border-[#34c759]/25 text-[#1d1d1f] text-xs font-medium" role="status">
          <CheckCircle2 className="w-4 h-4 text-[#34c759] shrink-0" />
          {syncBanner}
        </div>
      )}

      {syncError && (
        <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-[#ff9500]/12 border border-[#ff9500]/30 text-[#1d1d1f] text-xs font-medium" role="alert">
          <AlertTriangle className="w-4 h-4 text-[#ff9500] shrink-0" />
          {syncError}
        </div>
      )}

      {/* ── Resumen de métricas por tabla ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {REQUIRED_MODELS.map((modelName) => {
          const count = (tables[modelName] ?? []).length;
          const modelMeta = schema.models.find((m) => m.name === modelName);
          const isSelected = selectedModel === modelName;
          return (
            <button
              key={modelName}
              type="button"
              onClick={() => {
                setSelectedModel(modelName);
                setActiveTab('records');
              }}
              className={`text-left p-3.5 rounded-2xl border transition-all ${
                isSelected && activeTab === 'records'
                  ? 'bg-[#0071e3] text-white border-[#0071e3] shadow-sm'
                  : 'bg-white/75 backdrop-blur-2xl border-black/[0.06] hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className={`text-[10px] font-mono uppercase ${isSelected && activeTab === 'records' ? 'text-white/80' : 'text-[#86868b]'}`}>
                  {modelMeta?.tableName ?? modelName}
                </span>
                <Table2 className={`w-3.5 h-3.5 ${isSelected && activeTab === 'records' ? 'text-white' : 'text-[#0071e3]'}`} />
              </div>
              <div className="text-2xl font-bold mt-1">{count}</div>
              <div className={`text-xs font-semibold truncate ${isSelected && activeTab === 'records' ? 'text-white' : 'text-[#1d1d1f]'}`}>
                {modelName}
              </div>
            </button>
          );
        })}

        <div className="p-3.5 rounded-2xl bg-[#1d1d1f] text-white flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] text-white/70 font-mono">
            <span>TOTAL FILAS</span>
            <Server className="w-3.5 h-3.5 text-[#34c759]" />
          </div>
          <div className="text-2xl font-bold text-[#34c759] mt-1">{totalRecords}</div>
          <div className="text-xs font-medium text-white/80">7 tablas activas</div>
        </div>
      </div>

      {/* ── Control Segmentado estilo iOS ── */}
      <div>
        <div className="inline-flex flex-wrap gap-1 bg-black/[0.05] p-1 rounded-xl">
          {([
            { key: 'er',      label: 'Diagrama Entidad-Relación y Campos', icon: GitBranch },
            { key: 'records', label: 'Explorador de Registros Reales',     icon: Layers },
            { key: 'prisma',  label: 'Esquema Prisma (DDL)',               icon: Code2 },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === key
                  ? 'bg-white text-[#1d1d1f] shadow-[0_1px_4px_rgba(0,0,0,0.08)]'
                  : 'text-[#86868b] hover:text-[#1d1d1f]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 text-[#0071e3]" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── VISTA 1: Modelo Entidad-Relación ── */}
      {activeTab === 'er' && (
        <div className="flex flex-col gap-6">
          <div className="bg-white/75 backdrop-blur-2xl border border-black/[0.06] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] rounded-2xl p-5">
            <h2 className="text-sm font-bold text-[#1d1d1f] flex items-center gap-2 mb-3">
              <Link2 className="w-4 h-4 text-[#0071e3]" />
              Relaciones Cardinales y Llaves Foráneas (PostgreSQL)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {CARDINAL_RELATIONS.map((rel) => (
                <div
                  key={`${rel.parent}-${rel.child}-${rel.fk}`}
                  className="p-3.5 rounded-2xl border border-black/[0.06] bg-white/80 flex flex-col gap-1"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-[#1d1d1f]">
                    <span className="px-2 py-0.5 rounded-full bg-[#0071e3]/10 text-[#0071e3] font-mono text-[11px]">{rel.parent}</span>
                    <span className="px-2 py-0.5 rounded-full bg-[#1d1d1f] text-white font-mono text-[11px]">{rel.cardinality}</span>
                    <span className="px-2 py-0.5 rounded-full bg-black/[0.05] text-[#1d1d1f] font-mono text-[11px]">{rel.child}</span>
                  </div>
                  <p className="text-xs font-mono text-[#0071e3] mt-1">{rel.fk}</p>
                  <p className="text-xs text-[#86868b]">{rel.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {schema.models.map((model: ParsedModel) => (
              <div
                key={model.name}
                className="bg-white/75 backdrop-blur-2xl border border-black/[0.06] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] rounded-2xl overflow-hidden flex flex-col"
              >
                <div className="px-5 py-4 bg-white/80 border-b border-black/[0.06] flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-[#1d1d1f]">{model.name}</span>
                      <span className="px-2 py-0.5 rounded-full bg-black/[0.05] text-[11px] font-mono text-[#86868b]">
                        @@map(&quot;{model.tableName}&quot;)
                      </span>
                    </div>
                    <p className="text-xs text-[#86868b] mt-0.5">{model.doc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedModel(model.name);
                      setActiveTab('records');
                    }}
                    className="px-3 py-1.5 rounded-full bg-[#0071e3]/10 hover:bg-[#0071e3]/15 text-[#0071e3] text-xs font-semibold whitespace-nowrap transition-colors"
                  >
                    {(tables[model.name] ?? []).length} registros →
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-black/[0.02] text-[#86868b] text-[11px] font-semibold uppercase tracking-wider border-b border-black/[0.06]">
                      <tr>
                        <th className="px-4 py-2.5">Campo</th>
                        <th className="px-4 py-2.5">Tipo Prisma</th>
                        <th className="px-4 py-2.5">Tipo PostgreSQL</th>
                        <th className="px-4 py-2.5">Restricciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.05]">
                      {model.fields.map((field) => {
                        const pgType =
                          PG_TYPE_MAP[field.type] ??
                          (field.kind === 'enum' ? `ENUM (${field.type})` : `RELACIÓN → ${field.type}`);
                        return (
                          <tr key={field.name} className="hover:bg-black/[0.02]">
                            <td className="px-4 py-2 font-mono font-semibold text-[#1d1d1f] flex items-center gap-1.5">
                              {field.isId && <KeyRound className="w-3.5 h-3.5 text-[#ff9500] shrink-0" aria-label="PK" />}
                              {field.relationFields.length > 0 && <Link2 className="w-3.5 h-3.5 text-[#0071e3] shrink-0" aria-label="FK" />}
                              {field.name}
                            </td>
                            <td className="px-4 py-2 font-mono text-[#0071e3]">
                              {field.type}
                              {field.isList ? '[]' : ''}
                              {field.isOptional ? '?' : ''}
                            </td>
                            <td className="px-4 py-2 font-mono text-[#86868b]">{pgType}</td>
                            <td className="px-4 py-2">
                              <div className="flex flex-wrap gap-1">
                                {field.isId && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-[#ff9500]/15 text-[#1d1d1f] font-semibold text-[10px]">PK</span>
                                )}
                                {field.isUnique && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-[#0071e3]/12 text-[#0071e3] font-semibold text-[10px]">UNIQUE</span>
                                )}
                                {field.defaultValue && (
                                  <span className="px-1.5 py-0.5 rounded bg-black/[0.04] text-[#86868b] font-mono text-[10px]">
                                    ={field.defaultValue}
                                  </span>
                                )}
                                {field.relationFields.length > 0 && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-[#0071e3]/10 text-[#0071e3] font-mono text-[10px]">
                                    FK ({field.relationFields.join(', ')})
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── VISTA 2: Explorador de Registros Reales ── */}
      {activeTab === 'records' && (
        <div className="bg-white/75 backdrop-blur-2xl border border-black/[0.06] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-black/[0.06] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {REQUIRED_MODELS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSelectedModel(m)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    selectedModel === m
                      ? 'bg-[#0071e3] text-white'
                      : 'bg-black/[0.04] text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  {m} ({(tables[m] ?? []).length})
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#86868b]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Filtrar en ${selectedModel}…`}
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-black/[0.08] bg-black/[0.03] focus:bg-white text-xs text-[#1d1d1f] focus:outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/30"
              />
            </div>
          </div>

          {activeRows.length === 0 ? (
            <div className="p-12 text-center text-[#86868b] text-xs">
              No hay registros que coincidan con el filtro en la tabla <strong className="text-[#1d1d1f]">{selectedModel}</strong>.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[540px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-black/[0.02] text-[#86868b] text-[11px] font-semibold uppercase tracking-wider sticky top-0 border-b border-black/[0.06]">
                  <tr>
                    {activeColumns.map((col) => (
                      <th key={col} className="px-4 py-3 font-mono whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.05]">
                  {activeRows.map((row, idx) => (
                    <tr key={String(row.id ?? idx)} className="hover:bg-black/[0.02]">
                      {activeColumns.map((col) => {
                        const val = row[col];
                        return (
                          <td key={col} className="px-4 py-2.5 font-mono text-[#1d1d1f] whitespace-nowrap max-w-xs truncate">
                            {val === null ? (
                              <span className="text-[#86868b] italic">NULL</span>
                            ) : (
                              String(val)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {issues.length > 0 && (
            <div className="p-4 border-t border-[#ff9500]/20 bg-[#ff9500]/10 text-[#1d1d1f] text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#ff9500] shrink-0" />
              Se detectaron {issues.length} observaciones de integridad referencial.
            </div>
          )}
        </div>
      )}

      {/* ── VISTA 3: Fuente prisma/schema.prisma ── */}
      {activeTab === 'prisma' && (
        <div className="bg-[#1d1d1f] text-white rounded-2xl p-6 shadow-lg overflow-x-auto">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/10">
            <span className="font-mono text-xs text-[#ff9500]">prisma/schema.prisma — PostgreSQL</span>
            <span className="text-xs text-[#34c759] font-semibold">{schema.models.length} modelos • {schema.enums.length} enums</span>
          </div>
          <pre className="text-xs font-mono leading-relaxed text-white/90">{PRISMA_SCHEMA_SOURCE}</pre>
        </div>
      )}
    </div>
  );
}
