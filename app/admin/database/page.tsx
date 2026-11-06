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

// ─── Fuente canónica de prisma/schema.prisma ─────────────────────────────────

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

// ─── Relaciones Cardinales Explícitas ────────────────────────────────────────

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
  const students     = useAulaCheckStore((s) => s.students);
  const teachers     = useAulaCheckStore((s) => s.teachers);
  const courses      = useAulaCheckStore((s) => s.courses);
  const incapacities = useAulaCheckStore((s) => s.incapacities);
  const session      = useAulaCheckStore((s) => s.session);

  const [activeTab, setActiveTab]         = useState<ViewTab>('er');
  const [selectedModel, setSelectedModel] = useState<string>('Student');
  const [searchQuery, setSearchQuery]     = useState<string>('');
  const [lastSync, setLastSync]           = useState<string>(() => new Date().toLocaleTimeString('es-CO'));
  const [syncing, setSyncing]             = useState<boolean>(false);
  const [syncBanner, setSyncBanner]       = useState<string>('');

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
    setTimeout(() => {
      const now = new Date().toLocaleTimeString('es-CO');
      setLastSync(now);
      setSyncing(false);
      setSyncBanner(
        `Sincronización completada (${now}) — ${totalRecords} registros verificados en ${REQUIRED_MODELS.length} tablas con ${issues.length} errores de integridad.`,
      );
    }, 350);
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
    <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-6 flex flex-col gap-6 animate-fade-in">
      {/* ── Cabecera y Estado del Motor ── */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-card border border-outline-variant/30 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-bold border border-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              Motor: PostgreSQL (Prisma ORM) / Estado: Activo / Modo: Sincronizado
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-100 text-violet-800 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" /> Integridad: {issues.length === 0 ? '100% OK' : `${issues.length} alertas`}
            </span>
          </div>
          <h1 className="text-headline-lg font-bold text-on-surface flex items-center gap-2.5">
            <Database className="w-7 h-7 text-violet-700 shrink-0" />
            🗄️ Modelo de Datos y Esquema Entidad-Relación
          </h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            Arquitectura relacional en <code className="px-1.5 py-0.5 rounded bg-surface-container font-mono text-xs">prisma/schema.prisma</code> sincronizada en tiempo real con el estado operativo de Aula Check (última sincronización: {lastSync}).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleForceSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-violet-600 text-white font-semibold text-label-lg hover:bg-violet-700 transition-colors shadow-card disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Sincronizar ahora
          </button>
          <button
            type="button"
            onClick={handleExportDictionary}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-surface-container-low border border-outline-variant/60 text-on-surface font-semibold text-label-lg hover:bg-surface-container transition-colors"
          >
            <Download className="w-4 h-4 text-violet-700" />
            Exportar Diccionario de Datos (JSON)
          </button>
        </div>
      </div>

      {syncBanner && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-body-sm font-medium" role="status">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          {syncBanner}
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
                  ? 'bg-violet-600 text-white border-violet-600 shadow-card'
                  : 'bg-surface-container-lowest border-outline-variant/40 hover:border-violet-400 shadow-card'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className={`text-xs font-mono uppercase ${isSelected && activeTab === 'records' ? 'text-violet-100' : 'text-on-surface-variant'}`}>
                  {modelMeta?.tableName ?? modelName}
                </span>
                <Table2 className={`w-4 h-4 ${isSelected && activeTab === 'records' ? 'text-white' : 'text-violet-600'}`} />
              </div>
              <div className="text-2xl font-extrabold mt-1">{count}</div>
              <div className={`text-xs font-semibold truncate ${isSelected && activeTab === 'records' ? 'text-white' : 'text-on-surface'}`}>
                {modelName}
              </div>
            </button>
          );
        })}

        <div className="p-3.5 rounded-2xl bg-slate-900 text-white shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-300 font-mono">
            <span>TOTAL FILAS</span>
            <Server className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-300 mt-1">{totalRecords}</div>
          <div className="text-xs font-semibold text-slate-300">7 tablas activas</div>
        </div>
      </div>

      {/* ── Selector de vista ── */}
      <div className="flex flex-wrap gap-2 bg-surface-container p-1.5 rounded-2xl w-fit">
        {([
          { key: 'er',      label: 'Diagrama Entidad-Relación y Campos', icon: GitBranch },
          { key: 'records', label: 'Explorador de Registros Reales',     icon: Layers },
          { key: 'prisma',  label: 'Esquema Prisma (DDL)',               icon: Code2 },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-label-lg font-semibold transition-all ${
              activeTab === key
                ? 'bg-surface-container-lowest text-violet-700 shadow-card'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── VISTA 1: Modelo Entidad-Relación ── */}
      {activeTab === 'er' && (
        <div className="flex flex-col gap-6">
          {/* Matriz de relaciones cardinales */}
          <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-card border border-outline-variant/30">
            <h2 className="text-headline-sm font-bold text-on-surface flex items-center gap-2 mb-3">
              <Link2 className="w-5 h-5 text-violet-700" />
              Relaciones Cardinales y Llaves Foráneas (PostgreSQL)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {CARDINAL_RELATIONS.map((rel) => (
                <div
                  key={`${rel.parent}-${rel.child}-${rel.fk}`}
                  className="p-3.5 rounded-xl border border-outline-variant/40 bg-surface-container-low flex flex-col gap-1"
                >
                  <div className="flex items-center gap-2 text-body-sm font-bold text-on-surface">
                    <span className="px-2 py-0.5 rounded bg-violet-100 text-violet-900 font-mono text-xs">{rel.parent}</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-900 text-amber-300 font-mono text-xs">{rel.cardinality}</span>
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-mono text-xs">{rel.child}</span>
                  </div>
                  <p className="text-xs font-mono text-violet-700 mt-1">{rel.fk}</p>
                  <p className="text-xs text-on-surface-variant">{rel.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tarjetas de cada entidad */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {schema.models.map((model: ParsedModel) => (
              <div
                key={model.name}
                className="bg-surface-container-lowest rounded-2xl shadow-card border border-outline-variant/30 overflow-hidden flex flex-col"
              >
                <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">{model.name}</span>
                      <span className="px-2 py-0.5 rounded bg-white/10 text-xs font-mono text-amber-300">
                        @@map(&quot;{model.tableName}&quot;)
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">{model.doc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedModel(model.name);
                      setActiveTab('records');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-bold whitespace-nowrap"
                  >
                    {(tables[model.name] ?? []).length} registros →
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-container text-on-surface-variant uppercase">
                      <tr>
                        <th className="px-4 py-2.5">Campo</th>
                        <th className="px-4 py-2.5">Tipo Prisma</th>
                        <th className="px-4 py-2.5">Tipo PostgreSQL</th>
                        <th className="px-4 py-2.5">Restricciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.fields.map((field) => {
                        const pgType =
                          PG_TYPE_MAP[field.type] ??
                          (field.kind === 'enum' ? `ENUM (${field.type})` : `RELACIÓN → ${field.type}`);
                        return (
                          <tr key={field.name} className="border-t border-outline-variant/20">
                            <td className="px-4 py-2 font-mono font-semibold text-on-surface flex items-center gap-1.5">
                              {field.isId && <KeyRound className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-label="PK" />}
                              {field.relationFields.length > 0 && <Link2 className="w-3.5 h-3.5 text-violet-600 shrink-0" aria-label="FK" />}
                              {field.name}
                            </td>
                            <td className="px-4 py-2 font-mono text-violet-700">
                              {field.type}
                              {field.isList ? '[]' : ''}
                              {field.isOptional ? '?' : ''}
                            </td>
                            <td className="px-4 py-2 font-mono text-on-surface-variant">{pgType}</td>
                            <td className="px-4 py-2">
                              <div className="flex flex-wrap gap-1">
                                {field.isId && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">PK</span>
                                )}
                                {field.isUnique && (
                                  <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 font-bold">UNIQUE</span>
                                )}
                                {field.defaultValue && (
                                  <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-mono">
                                    ={field.defaultValue}
                                  </span>
                                )}
                                {field.relationFields.length > 0 && (
                                  <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-900 font-mono">
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
        <div className="bg-surface-container-lowest rounded-2xl shadow-card border border-outline-variant/30 overflow-hidden">
          <div className="p-4 border-b border-outline-variant/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {REQUIRED_MODELS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSelectedModel(m)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    selectedModel === m
                      ? 'bg-violet-600 text-white'
                      : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {m} ({(tables[m] ?? []).length})
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Filtrar en ${selectedModel}…`}
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-outline-variant/50 bg-surface-container-low text-body-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              />
            </div>
          </div>

          {activeRows.length === 0 ? (
            <div className="p-12 text-center text-on-surface-variant text-body-sm">
              No hay registros que coincidan con el filtro en la tabla <strong>{selectedModel}</strong>.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[540px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container text-on-surface-variant uppercase sticky top-0">
                  <tr>
                    {activeColumns.map((col) => (
                      <th key={col} className="px-4 py-3 font-mono whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeRows.map((row, idx) => (
                    <tr key={String(row.id ?? idx)} className="border-t border-outline-variant/20 hover:bg-surface-container-low">
                      {activeColumns.map((col) => {
                        const val = row[col];
                        return (
                          <td key={col} className="px-4 py-2.5 font-mono whitespace-nowrap max-w-xs truncate">
                            {val === null ? (
                              <span className="text-on-surface-variant/60 italic">NULL</span>
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
            <div className="p-4 border-t border-amber-200 bg-amber-50 text-amber-900 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Se detectaron {issues.length} observaciones de integridad referencial.
            </div>
          )}
        </div>
      )}

      {/* ── VISTA 3: Fuente prisma/schema.prisma ── */}
      {activeTab === 'prisma' && (
        <div className="bg-slate-950 text-slate-100 rounded-2xl p-6 shadow-card overflow-x-auto">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/10">
            <span className="font-mono text-xs text-amber-300">prisma/schema.prisma — PostgreSQL</span>
            <span className="text-xs text-emerald-400 font-semibold">{schema.models.length} modelos • {schema.enums.length} enums</span>
          </div>
          <pre className="text-xs font-mono leading-relaxed">{PRISMA_SCHEMA_SOURCE}</pre>
        </div>
      )}
    </div>
  );
}

