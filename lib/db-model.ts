// ═══════════════════════════════════════════════════════════════════════════════
// Aula Check — Utilidades del Modelo de Datos (Prisma / PostgreSQL)
// ─ Parser liviano de `prisma/schema.prisma` (modelos, enums, relaciones).
// ─ Proyección del estado de la app a filas relacionales (una tabla por modelo).
// ─ Validación de integridad referencial y unicidad guiada por el esquema.
// Este módulo es puro (sin APIs de navegador ni de Node) para usarse en cliente
// y en el Route Handler `/api/database`.
// ═══════════════════════════════════════════════════════════════════════════════

import type { AdminCourse, AttendanceStatus, ClassSession, Incapacity, Student, Teacher } from './types';
import { CANONICAL_SEMESTER_SESSIONS, computeStudentMetrics } from './student-history';

// ─── Tipos del esquema parseado ──────────────────────────────────────────────

export type FieldKind = 'scalar' | 'enum' | 'relation';

export interface ParsedField {
  name: string;
  type: string;
  kind: FieldKind;
  isList: boolean;
  isOptional: boolean;
  isId: boolean;
  isUnique: boolean;
  defaultValue: string | null;
  /** Para relaciones del lado FK: columnas locales y columnas referenciadas. */
  relationFields: string[];
  relationReferences: string[];
  relationName: string | null;
  doc: string;
}

export interface ParsedModel {
  name: string;
  tableName: string;
  doc: string;
  fields: ParsedField[];
  compositeUniques: string[][];
}

export interface ParsedEnum {
  name: string;
  doc: string;
  values: string[];
}

export interface ParsedRelation {
  /** Modelo hijo (contiene la FK). */
  from: string;
  /** Modelo padre (referenciado). */
  to: string;
  fkFields: string[];
  references: string[];
  optional: boolean;
  label: string;
}

export interface ParsedSchema {
  provider: string;
  models: ParsedModel[];
  enums: ParsedEnum[];
  relations: ParsedRelation[];
}

export const REQUIRED_MODELS = [
  'Student',
  'Teacher',
  'Course',
  'Enrollment',
  'AttendanceSession',
  'AttendanceRecord',
  'Incapacity',
] as const;

// ─── Parser ──────────────────────────────────────────────────────────────────

function docAbove(source: string, index: number): string {
  const before = source.slice(0, index).split(/\r?\n/);
  const docs: string[] = [];
  for (let i = before.length - 1; i >= 0; i--) {
    const line = before[i].trim();
    if (line === '' && docs.length === 0) continue;
    if (line.startsWith('///')) docs.unshift(line.replace(/^\/\/\/\s?/, ''));
    else break;
  }
  return docs.join(' ');
}

function splitList(raw: string | undefined): string[] {
  return raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];
}

export function parsePrismaSchema(source: string): ParsedSchema {
  const blockRe = /^(model|enum)\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  const rawModels: { name: string; body: string; doc: string }[] = [];
  const enums: ParsedEnum[] = [];

  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(source)) !== null) {
    const [, kind, name, body] = match;
    const doc = docAbove(source, match.index);
    if (kind === 'enum') {
      const values = body
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('//'))
        .map((l) => l.split(/\s+/)[0]);
      enums.push({ name, doc, values });
    } else {
      rawModels.push({ name, body, doc });
    }
  }

  const modelNames = new Set(rawModels.map((m) => m.name));
  const enumNames = new Set(enums.map((e) => e.name));
  const providerMatch = /datasource\s+\w+\s*\{[\s\S]*?provider\s*=\s*"([^"]+)"/.exec(source);

  const models: ParsedModel[] = rawModels.map(({ name, body, doc }) => {
    const fields: ParsedField[] = [];
    const compositeUniques: string[][] = [];
    let tableName = name;

    for (const rawLine of body.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('//') && !line.startsWith('///')) continue;
      if (line.startsWith('///')) continue;
      if (line.startsWith('@@')) {
        const map = /@@map\("([^"]+)"\)/.exec(line);
        if (map) tableName = map[1];
        const uniq = /@@unique\(\[([^\]]*)\]\)/.exec(line);
        if (uniq) compositeUniques.push(splitList(uniq[1]));
        continue;
      }
      const fm = /^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/.exec(line);
      if (!fm) continue;
      const [, fname, ftype, list, optional, restRaw] = fm;
      const docIdx = restRaw.indexOf('///');
      const attrs = docIdx >= 0 ? restRaw.slice(0, docIdx) : restRaw;
      const fdoc = docIdx >= 0 ? restRaw.slice(docIdx + 3).trim() : '';
      const rel = /@relation\(([^)]*)\)/.exec(attrs);
      const def = /@default\(((?:[^()]|\([^()]*\))*)\)/.exec(attrs);

      fields.push({
        name: fname,
        type: ftype,
        kind: modelNames.has(ftype) ? 'relation' : enumNames.has(ftype) ? 'enum' : 'scalar',
        isList: Boolean(list),
        isOptional: Boolean(optional),
        isId: /@id\b/.test(attrs),
        isUnique: /@unique\b/.test(attrs),
        defaultValue: def ? def[1] : null,
        relationFields: splitList(rel ? /fields:\s*\[([^\]]*)\]/.exec(rel[1])?.[1] : undefined),
        relationReferences: splitList(rel ? /references:\s*\[([^\]]*)\]/.exec(rel[1])?.[1] : undefined),
        relationName: rel ? /"([^"]+)"/.exec(rel[1])?.[1] ?? null : null,
        doc: fdoc,
      });
    }
    return { name, tableName, doc, fields, compositeUniques };
  });

  const relations: ParsedRelation[] = [];
  for (const m of models) {
    for (const f of m.fields) {
      if (f.kind === 'relation' && f.relationFields.length > 0) {
        relations.push({
          from: m.name,
          to: f.type,
          fkFields: f.relationFields,
          references: f.relationReferences,
          optional: f.isOptional,
          label: f.relationName ?? f.name,
        });
      }
    }
  }

  return { provider: providerMatch?.[1] ?? 'desconocido', models, enums, relations };
}

// ─── Proyección relacional del estado de la app ──────────────────────────────

export type DbCell = string | number | null;
export type DbRow = Record<string, DbCell>;
export type DbTables = Record<string, DbRow[]>;

export interface AppStateSnapshot {
  students: Student[];
  teachers: Teacher[];
  courses: AdminCourse[];
  incapacities: Incapacity[];
  session: ClassSession;
}

const STATUS_TO_DB: Record<AttendanceStatus, string> = {
  presente: 'PRESENTE',
  tardanza: 'TARDANZA',
  presente_manual: 'PRESENTE_MANUAL',
  ausente: 'AUSENTE',
  pendiente: 'AUSENTE',
  justificado: 'JUSTIFICADO',
};

const INCAPACITY_TYPE_TO_DB: Record<Incapacity['type'], string> = {
  'Médica': 'MEDICA',
  'Laboral': 'LABORAL',
  'Fuerza Mayor': 'FUERZA_MAYOR',
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Convierte el estado de Zustand en filas por tabla según el esquema Prisma. */
export function buildRelationalSnapshot(state: AppStateSnapshot): DbTables {
  const { students, teachers, courses, incapacities, session } = state;
  const teacherByName = new Map(teachers.map((t) => [t.name, t.id]));
  const courseByCode = new Map(courses.map((c) => [c.code, c]));
  const studentById = new Map(students.map((s) => [s.id, s]));
  const defaultTeacherId = teachers[0]?.id ?? null;

  const Student: DbRow[] = students.map((s) => ({
    id: s.id, code: s.code, name: s.name, email: s.email, program: s.program,
  }));

  const Teacher: DbRow[] = teachers.map((t) => ({
    id: t.id, name: t.name, email: t.email, department: t.department, title: t.title, phone: t.phone ?? null,
  }));

  const Course: DbRow[] = courses.map((c) => ({
    id: c.id, code: c.code, name: c.name, room: c.room, schedule: c.schedule, period: '2026-2',
    teacherId: teacherByName.get(c.teacher) ?? null,
  }));

  const Enrollment: DbRow[] = courses.flatMap((c) =>
    (c.enrolledStudentIds ?? []).map((sid) => ({
      id: `enr-${c.id}-${sid}`,
      studentId: sid,
      courseId: c.id,
      finalAttendancePercentage: studentById.get(sid)?.attendanceRate ?? null,
    })),
  );

  // Sesiones canónicas del periodo para la asignatura principal (G401) + sesión en vivo.
  const mainCourse = courseByCode.get('G401') ?? courses[0];
  const mainTeacherId = mainCourse ? teacherByName.get(mainCourse.teacher) ?? defaultTeacherId : defaultTeacherId;
  const AttendanceSession: DbRow[] = [];
  const AttendanceRecord: DbRow[] = [];

  const approvedByStudentDate = new Map<string, string>();
  for (const inc of incapacities) {
    if (inc.status === 'Aprobada') approvedByStudentDate.set(`${inc.studentId}|${inc.date}`, inc.id);
  }

  if (mainCourse && mainTeacherId) {
    const enrolled = (mainCourse.enrolledStudentIds ?? [])
      .map((id) => studentById.get(id))
      .filter((s): s is Student => Boolean(s));
    const histories = new Map(enrolled.map((s) => [s.id, computeStudentMetrics(s, mainCourse.code, mainCourse.name).history]));

    for (const cs of CANONICAL_SEMESTER_SESSIONS) {
      const sessionId = `ses-${mainCourse.code}-${String(cs.num).padStart(2, '0')}`;
      AttendanceSession.push({
        id: sessionId, courseId: mainCourse.id, teacherId: mainTeacherId, topic: cs.topic, room: mainCourse.room,
        pin: '——', toleranceMinutes: 15, mode: 'BOTH', status: 'CLOSED',
        startedAt: `${cs.date}T13:00:00.000Z`, endedAt: `${cs.date}T15:00:00.000Z`,
      });
      for (const s of enrolled) {
        const entry = histories.get(s.id)?.find((h) => h.date === cs.date);
        const status = entry ? STATUS_TO_DB[entry.status] : 'PRESENTE';
        AttendanceRecord.push({
          id: `rec-${sessionId}-${s.id}`,
          sessionId,
          studentId: s.id,
          status,
          checkinAt: status === 'AUSENTE' || status === 'JUSTIFICADO' ? null : `${cs.date}T13:05:00.000Z`,
          points: 0,
          notes: entry?.notes ?? null,
          incapacityId:
            status === 'JUSTIFICADO'
              ? approvedByStudentDate.get(`${s.id}|${cs.date}`) ?? approvedByStudentDate.get(`${s.code}|${cs.date}`) ?? null
              : null,
        });
      }
    }
  }

  if (session.startTime) {
    const liveCourse = courseByCode.get(session.courseCode) ?? mainCourse;
    if (liveCourse) {
      const liveId = 'ses-live';
      AttendanceSession.push({
        id: liveId, courseId: liveCourse.id, teacherId: teacherByName.get(session.teacher) ?? defaultTeacherId,
        topic: session.topic || null, room: session.room, pin: session.pin || '——',
        toleranceMinutes: session.tolerance, mode: session.mode.toUpperCase(),
        status: session.isActive ? 'ACTIVE' : 'CLOSED', startedAt: toIso(session.startTime), endedAt: null,
      });
      for (const s of students) {
        if (s.status === 'pendiente') continue;
        AttendanceRecord.push({
          id: `rec-${liveId}-${s.id}`, sessionId: liveId, studentId: s.id, status: STATUS_TO_DB[s.status],
          checkinAt: toIso(s.checkinTime), points: s.points, notes: null, incapacityId: null,
        });
      }
    }
  }

  const Incapacity: DbRow[] = incapacities.map((i) => ({
    id: i.id,
    studentId: i.studentId,
    courseId: courseByCode.get(i.courseCode)?.id ?? null,
    absenceDate: i.date,
    type: INCAPACITY_TYPE_TO_DB[i.type],
    reason: i.reason,
    fileName: i.fileName || null,
    fileUrl: i.fileDataUrl ? `data-url (${Math.round(i.fileDataUrl.length / 1024)} KB)` : null,
    status: i.status.toUpperCase(),
    reviewerComment: i.reviewerComment || null,
    reviewerName: i.reviewedBy ?? null,
    reviewedById: i.reviewedBy ? teacherByName.get(i.reviewedBy) ?? null : null,
    reviewedAt: i.reviewedAt ?? null,
    createdAt: i.createdAt,
  }));

  return { Student, Teacher, Course, Enrollment, AttendanceSession, AttendanceRecord, Incapacity };
}

// ─── Validación de integridad ────────────────────────────────────────────────

export interface IntegrityIssue {
  model: string;
  rowId: string;
  kind: 'foreign_key' | 'unique' | 'required';
  message: string;
}

export interface SyncReport {
  ok: boolean;
  mode: 'postgresql' | 'demo-local';
  syncedAt: string;
  counts: Record<string, number>;
  issues: IntegrityIssue[];
  message: string;
}

/** Valida FKs, unicidad y campos requeridos usando las reglas declaradas en el esquema. */
export function validateIntegrity(schema: ParsedSchema, tables: DbTables): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const idsByModel = new Map<string, Set<string>>();
  for (const m of schema.models) {
    idsByModel.set(m.name, new Set((tables[m.name] ?? []).map((r) => String(r.id))));
  }

  for (const m of schema.models) {
    const rows = tables[m.name] ?? [];
    const scalarFields = m.fields.filter((f) => f.kind !== 'relation' && !f.isList);

    // Requeridos (sin default y no opcionales)
    for (const f of scalarFields) {
      if (f.isOptional || f.defaultValue !== null) continue;
      for (const r of rows) {
        if (f.name in r && (r[f.name] === null || r[f.name] === '')) {
          issues.push({ model: m.name, rowId: String(r.id), kind: 'required', message: `${f.name} es obligatorio` });
        }
      }
    }

    // Unicidad simple y compuesta
    const uniqueSets = [
      ...scalarFields.filter((f) => f.isUnique || f.isId).map((f) => [f.name]),
      ...m.compositeUniques,
    ];
    for (const cols of uniqueSets) {
      const seen = new Set<string>();
      for (const r of rows) {
        if (cols.some((c) => !(c in r))) continue;
        const key = cols.map((c) => String(r[c])).join('|');
        if (seen.has(key)) {
          issues.push({ model: m.name, rowId: String(r.id), kind: 'unique', message: `Duplicado en (${cols.join(', ')}) = ${key}` });
        }
        seen.add(key);
      }
    }
  }

  // Llaves foráneas
  for (const rel of schema.relations) {
    const targetIds = idsByModel.get(rel.to) ?? new Set<string>();
    const fk = rel.fkFields[0];
    for (const r of tables[rel.from] ?? []) {
      const value = r[fk];
      if (value === null || value === undefined) {
        if (!rel.optional && fk in r) {
          issues.push({ model: rel.from, rowId: String(r.id), kind: 'foreign_key', message: `${fk} es nulo pero la relación con ${rel.to} es obligatoria` });
        }
        continue;
      }
      if (!targetIds.has(String(value))) {
        issues.push({ model: rel.from, rowId: String(r.id), kind: 'foreign_key', message: `${fk} = "${value}" no existe en ${rel.to}` });
      }
    }
  }

  return issues;
}

