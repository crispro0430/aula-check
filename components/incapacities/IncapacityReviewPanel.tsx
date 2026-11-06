'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Eye,
  Search,
  Inbox,
  User,
  BookOpen,
  CalendarDays,
  MessageSquare,
  ShieldCheck,
  Paperclip,
  Lock,
  CheckCircle2,
  XCircle,
  GraduationCap,
  RefreshCw,
} from 'lucide-react';
import { useAulaCheckStore } from '@/lib/store';
import { computeStudentMetrics } from '@/lib/student-history';
import { getSemaforoLevel } from '@/lib/utils';
import type { Incapacity, IncapacityStatus } from '@/lib/types';
import { SupportPreviewModal, TYPE_ICON, formatDate, formatDateTime } from './shared';

type Filter = 'Todas' | IncapacityStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'Todas',     label: 'Todas' },
  { key: 'Pendiente', label: 'Pendientes' },
  { key: 'Aprobada',  label: 'Aprobadas' },
  { key: 'Rechazada', label: 'Rechazadas' },
];

const SEMAFORO_STYLE: Record<'verde' | 'ambar' | 'rojo', string> = {
  verde: 'bg-emerald-100 text-emerald-800',
  ambar: 'bg-amber-100 text-amber-800',
  rojo:  'bg-red-100 text-red-800',
};

function AuditStatusBadge({
  status,
  mode,
  reviewedBy,
}: {
  status: IncapacityStatus;
  mode: 'teacher' | 'admin-audit';
  reviewedBy?: string;
}) {
  const isCoordOverride = Boolean(
    reviewedBy &&
      (reviewedBy.toLowerCase().includes('coordinac') ||
        reviewedBy.toLowerCase().includes('override') ||
        reviewedBy.toLowerCase().includes('superadmin')),
  );

  if (status === 'Aprobada') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-bold whitespace-nowrap bg-emerald-100 text-emerald-800 border-emerald-300">
        <span aria-hidden>✅</span>
        {isCoordOverride
          ? 'APROBADA POR COORDINACIÓN'
          : mode === 'admin-audit'
          ? 'APROBADA POR DOCENTE'
          : 'Aprobada'}
      </span>
    );
  }
  if (status === 'Rechazada') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-bold whitespace-nowrap bg-red-100 text-red-800 border-red-300">
        <span aria-hidden>❌</span>
        {isCoordOverride
          ? 'RECHAZADA POR COORDINACIÓN'
          : mode === 'admin-audit'
          ? 'RECHAZADA POR DOCENTE'
          : 'Rechazada'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-bold whitespace-nowrap bg-amber-100 text-amber-800 border-amber-300">
      <span aria-hidden>⏳</span>
      {mode === 'admin-audit' ? 'PENDIENTE' : 'Pendiente'}
    </span>
  );
}

interface Props {
  /** Modo de operación: 'teacher' (acción directa en sus cursos) o 'admin-audit' (solo lectura / auditoría). */
  mode?: 'teacher' | 'admin-audit';
  /** ID del docente titular (para filtrar GET /api/incapacities?teacherId=... y autorizar PATCH). */
  teacherId?: string;
  /** Nombre del usuario / docente. */
  reviewerName: string;
  /** Etiqueta de rol mostrada en cabecera. */
  roleLabel: string;
}

export default function IncapacityReviewPanel({
  mode = 'teacher',
  teacherId = 't1',
  reviewerName,
  roleLabel,
}: Props) {
  const storeIncapacities = useAulaCheckStore((s) => s.incapacities);
  const students          = useAulaCheckStore((s) => s.students);
  const courses           = useAulaCheckStore((s) => s.courses);
  const teachers          = useAulaCheckStore((s) => s.teachers);
  const currentUser       = useAulaCheckStore((s) => s.currentUser);
  const reviewIncapacity  = useAulaCheckStore((s) => s.reviewIncapacity);
  const mergeRemoteIncapacities = useAulaCheckStore((s) => s.mergeRemoteIncapacities);

  const [filter, setFilter]         = useState<Filter>(mode === 'teacher' ? 'Pendiente' : 'Todas');
  const [query, setQuery]           = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment]       = useState('');
  const [preview, setPreview]       = useState<Incapacity | null>(null);
  const [toast, setToast]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [remoteAssignedCourses, setRemoteAssignedCourses] = useState<
    Array<{ id: string; code: string; name: string }>
  >([]);

  // Resolver datos del docente activo cuando está en modo 'teacher'
  const activeTeacher = useMemo(() => {
    if (mode !== 'teacher') return null;
    const byUser = currentUser
      ? teachers.find(
          (t) =>
            t.email.toLowerCase() === currentUser.email.toLowerCase() ||
            t.name.toLowerCase() === currentUser.name.toLowerCase(),
        )
      : undefined;
    if (byUser) return byUser;
    if (currentUser && currentUser.role === 'teacher') {
      return {
        id: currentUser.id || teacherId,
        name: currentUser.name,
        email: currentUser.email,
      };
    }
    return (
      teachers.find((t) => t.id === teacherId || t.name === reviewerName) ??
      teachers[0] ?? {
        id: teacherId,
        name: reviewerName,
        email: 'alejandro.morales@universidad.edu.co',
      }
    );
  }, [mode, currentUser, teachers, teacherId, reviewerName]);

  // Cursos asignados estrictamente a este profesor titular
  const teacherAssignedCoursesList = useMemo(() => {
    if (mode !== 'teacher' || !activeTeacher) return [];
    const localAssigned = courses
      .filter((c) => c.teacher.toLowerCase() === activeTeacher.name.toLowerCase())
      .map((c) => ({ id: c.id, code: c.code, name: c.name }));
    const mergedMap = new Map<string, { id: string; code: string; name: string }>();
    for (const c of localAssigned) {
      mergedMap.set(c.code.toUpperCase(), c);
    }
    for (const rc of remoteAssignedCourses) {
      if (!mergedMap.has(rc.code.toUpperCase())) {
        mergedMap.set(rc.code.toUpperCase(), rc);
      }
    }
    return Array.from(mergedMap.values());
  }, [mode, activeTeacher, courses, remoteAssignedCourses]);

  const teacherCourseCodes = useMemo(() => {
    if (mode !== 'teacher' || !activeTeacher) return null;
    return new Set(teacherAssignedCoursesList.map((c) => c.code.toUpperCase()));
  }, [mode, activeTeacher, teacherAssignedCoursesList]);

  // Consultar GET /api/incapacities (con ?teacherId=... si es docente) para sincronizar con Supabase
  const fetchFromApi = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);
      try {
        const qs =
          mode === 'teacher' && activeTeacher
            ? `?teacherId=${encodeURIComponent(activeTeacher.id)}&teacherEmail=${encodeURIComponent(activeTeacher.email)}&teacherName=${encodeURIComponent(activeTeacher.name)}`
            : '';
        const res = await fetch(`/api/incapacities${qs}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as {
          incapacities?: Array<Incapacity>;
          assignedCourses?: Array<{ id: string; code: string; name: string }>;
        };
        if (Array.isArray(data.assignedCourses)) {
          setRemoteAssignedCourses(data.assignedCourses);
        }
        if (Array.isArray(data.incapacities) && data.incapacities.length > 0) {
          mergeRemoteIncapacities(data.incapacities);
          for (const remote of data.incapacities) {
            const local = storeIncapacities.find((i) => i.id === remote.id);
            if (local && local.status === 'Pendiente' && remote.status !== 'Pendiente') {
              reviewIncapacity(
                remote.id,
                remote.status,
                remote.reviewerComment || '',
                remote.reviewedBy || reviewerName,
              );
            }
          }
        }
      } catch {
        // Fallback silencioso a store local
      } finally {
        if (isManual) setRefreshing(false);
      }
    },
    [mode, activeTeacher, mergeRemoteIncapacities, storeIncapacities, reviewIncapacity, reviewerName],
  );

  useEffect(() => {
    void fetchFromApi(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, activeTeacher?.id, activeTeacher?.email]);

  // Filtrar las incapacidades que pertenecen a los cursos del docente titular (o todas en modo admin-audit)
  const scopedIncapacities = useMemo(() => {
    if (mode !== 'teacher' || !teacherCourseCodes) return storeIncapacities;
    return storeIncapacities.filter((inc) => teacherCourseCodes.has(inc.courseCode.toUpperCase()));
  }, [mode, storeIncapacities, teacherCourseCodes]);

  const counts: Record<Filter, number> = {
    Todas: scopedIncapacities.length,
    Pendiente: scopedIncapacities.filter((i) => i.status === 'Pendiente').length,
    Aprobada: scopedIncapacities.filter((i) => i.status === 'Aprobada').length,
    Rechazada: scopedIncapacities.filter((i) => i.status === 'Rechazada').length,
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scopedIncapacities
      .filter((i) => filter === 'Todas' || i.status === filter)
      .filter(
        (i) =>
          !q ||
          i.studentName.toLowerCase().includes(q) ||
          i.courseCode.toLowerCase().includes(q) ||
          i.courseName.toLowerCase().includes(q) ||
          i.studentId.includes(q),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [scopedIncapacities, filter, query]);

  const selected = scopedIncapacities.find((i) => i.id === selectedId) ?? null;
  const selectedStudent = selected
    ? students.find((s) => s.id === selected.studentId || s.code === selected.studentId)
    : undefined;
  const metrics = selectedStudent ? computeStudentMetrics(selectedStudent) : null;

  // Docente titular del curso de la incapacidad seleccionada
  const assignedCourseTeacher = useMemo(() => {
    if (!selected) return 'Prof. Dr. Alejandro Morales';
    const courseObj = courses.find((c) => c.code.toUpperCase() === selected.courseCode.toUpperCase());
    return courseObj?.teacher || 'Prof. Dr. Alejandro Morales';
  }, [selected, courses]);

  // Proyección del semáforo si se aprueba (o si se revoca en Override)
  const projected = useMemo(() => {
    if (!selected || !selectedStudent) return null;
    if (selected.status !== 'Aprobada') {
      const next = computeStudentMetrics({
        ...selectedStudent,
        justifiedDates: Array.from(new Set([...(selectedStudent.justifiedDates ?? []), selected.date])),
      });
      return { label: 'Si se aprueba', percentage: next.percentage };
    }
    if (mode === 'admin-audit' && selected.status === 'Aprobada') {
      const next = computeStudentMetrics({
        ...selectedStudent,
        justifiedDates: (selectedStudent.justifiedDates ?? []).filter((d) => d !== selected.date),
      });
      return { label: 'Si se rechaza (Override)', percentage: next.percentage };
    }
    return null;
  }, [selected, selectedStudent, mode]);

  function selectIncapacity(inc: Incapacity) {
    setSelectedId(inc.id);
    setComment(inc.reviewerComment);
    setToast('');
  }

  async function decide(decision: 'Aprobada' | 'Rechazada') {
    if (!selected) return;
    const isCoordOverride = mode === 'admin-audit';

    if (!isCoordOverride && decision === 'Rechazada' && comment.trim().length === 0) {
      setToast('⚠️ Escribe una observación indicando el motivo del rechazo.');
      return;
    }

    setSubmitting(true);
    setToast('');
    const effectiveReviewerName = isCoordOverride
      ? 'Coordinación Académica (Override)'
      : activeTeacher?.name || reviewerName;
    const effectiveTeacherId = activeTeacher?.id || teacherId;
    const effectiveComment =
      comment.trim() ||
      (isCoordOverride
        ? decision === 'Aprobada'
          ? 'Reevaluada y aprobada por Coordinación Académica (Override).'
          : 'Reevaluada y rechazada por Coordinación Académica (Override).'
        : decision === 'Aprobada'
        ? 'Soporte validado y aprobado por el docente titular de la asignatura.'
        : 'Solicitud rechazada por el docente titular.');

    try {
      await fetch(`/api/incapacities/${encodeURIComponent(selected.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: decision === 'Aprobada' ? 'APPROVED' : 'REJECTED',
          role: isCoordOverride ? 'admin' : 'teacher',
          reviewerName: effectiveReviewerName,
          teacherId: effectiveTeacherId,
          teacherEmail: activeTeacher?.email,
          teacherName: effectiveReviewerName,
          reviewerComment: effectiveComment,
          studentId: selected.studentId,
          studentName: selected.studentName,
          courseCode: selected.courseCode,
          courseName: selected.courseName,
          date: selected.date,
          reason: selected.reason,
          type: selected.type,
          fileName: selected.fileName,
        }),
      });
    } catch {
      // Fallback local si no hay red
    }

    reviewIncapacity(selected.id, decision, effectiveComment, effectiveReviewerName);
    setComment(effectiveComment);
    setSubmitting(false);
    setToast(
      isCoordOverride
        ? decision === 'Aprobada'
          ? `✅ Override aplicado: Solicitud marcada como "Aprobada por Coordinación". Se actualizó la asistencia a Justificada y se recalculó el Semáforo de Permanencia de ${selected.studentName}.`
          : `❌ Override aplicado: Solicitud marcada como "Rechazada por Coordinación". Se actualizó el registro de inasistencia y el Semáforo de Permanencia de ${selected.studentName}.`
        : decision === 'Aprobada'
        ? `✅ Excusa aprobada por ${effectiveReviewerName}. La falta del ${formatDate(selected.date)} quedó como "Justificada" en el expediente de ${selected.studentName}.`
        : `❌ Solicitud rechazada por ${effectiveReviewerName}. ${selected.studentName} verá tu observación en su portal.`,
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-6 flex flex-col gap-5">
      {/* ── Encabezado ── */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
              mode === 'admin-audit'
                ? 'bg-violet-50 text-violet-800 border-violet-200'
                : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}
          >
            {mode === 'admin-audit' ? <Lock className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            {roleLabel}
          </span>
          <h1 className="text-headline-lg font-bold text-on-surface mt-2">
            {mode === 'teacher'
              ? '📄 Gestión de Excusas e Incapacidades'
              : '🛡️ Supervisión Global y Reevaluación de Incapacidades (Override)'}
          </h1>
          <p className="text-body-md text-on-surface-variant">
            {mode === 'teacher'
              ? `Solicitudes radicadas por tus estudiantes en tus asignaturas (${activeTeacher?.name ?? reviewerName}). Al aprobar una excusa, la asistencia pasa a "Justificada" y protege el Semáforo de Permanencia.`
              : 'Visión global consolidada (Nivel 2 — Superadmin). Supervisa el dictamen de cada docente titular y ejerce potestad de Anulación / Reevaluación (Override) con ajuste automático en el Semáforo de Permanencia.'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
          <button
            type="button"
            onClick={() => void fetchFromApi(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-outline-variant/60 bg-surface-container-lowest hover:bg-surface-container text-label-md font-semibold text-on-surface transition-all disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-4 h-4 text-primary ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Sincronizando…' : '🔄 Refrescar solicitudes'}
          </button>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar estudiante o asignatura…"
              aria-label="Buscar incapacidades"
              className="w-full h-11 pl-9 pr-3 rounded-xl border border-outline-variant/60 bg-surface-container-lowest text-body-md focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
      </div>

      {/* ── Banner de jerarquía de 2 niveles en modo Coordinación (Superadmin / Override) ── */}
      {mode === 'admin-audit' && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-violet-50 border border-violet-200 text-violet-950 text-body-sm">
          <ShieldCheck className="w-5 h-5 text-violet-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-violet-900">
              Jerarquía de 2 Niveles — Coordinación Académica con Potestad de Override (Superadmin)
            </p>
            <p className="text-violet-800 mt-0.5">
              <strong>Nivel 1 (Docente Titular):</strong> Evalúa en primera instancia las excusas de sus asignaturas.{' '}
              <strong>Nivel 2 (Coordinación):</strong> Puede auditar todas las solicitudes y usar{' '}
              <strong>&ldquo;Reevaluar Estado&rdquo;</strong> para aprobar o rechazar por Coordinación, actualizando en tiempo real el registro de asistencia y el Semáforo de Permanencia Estudiantil.
            </p>
          </div>
        </div>
      )}

      {/* ── Filtros ── */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por estado">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-label-lg font-semibold border transition-all ${
              filter === key
                ? 'bg-primary-container text-white border-primary-container shadow-card'
                : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/50 hover:border-primary/50'
            }`}
          >
            {label}
            <span className={`px-2 py-0.5 rounded-full text-xs ${filter === key ? 'bg-white/20' : 'bg-surface-container'}`}>
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* ── Lista ── */}
        <div className="lg:col-span-3 bg-surface-container-lowest rounded-2xl shadow-card border border-outline-variant/30 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2.5 py-16 px-6 text-on-surface-variant text-center">
              <Inbox className="w-10 h-10 text-primary/60" />
              <p className="font-bold text-on-surface text-body-md">
                No hay incapacidades en este filtro.
              </p>
              {mode === 'teacher' && activeTeacher && (
                <div className="max-w-md text-body-sm text-on-surface-variant space-y-2">
                  {teacherAssignedCoursesList.length > 0 ? (
                    <>
                      <p>
                        No tienes solicitudes registradas con estado{' '}
                        <strong>{filter === 'Todas' ? 'activo' : filter}</strong> en tus asignaturas a cargo:
                      </p>
                      <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                        {teacherAssignedCoursesList.map((c) => (
                          <span
                            key={c.code}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 text-xs font-semibold"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            {c.code} — {c.name}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p>
                      Actualmente no tienes asignaturas asignadas como docente titular ({activeTeacher.name}). Solicita a Coordinación Académica la asignación de tus cursos.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-body-sm">
                <thead className="bg-surface-container text-on-surface-variant text-label-md uppercase">
                  <tr>
                    <th className="px-4 py-3">Estudiante</th>
                    <th className="px-4 py-3">Asignatura</th>
                    <th className="px-4 py-3">Fecha falta</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Docente Revisor / Titular</th>
                    <th className="px-4 py-3 text-right">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inc) => {
                    const courseObj = courses.find(
                      (c) => c.code.toUpperCase() === inc.courseCode.toUpperCase(),
                    );
                    const reviewerDisplay =
                      inc.reviewedBy || courseObj?.teacher || 'Prof. Dr. Alejandro Morales';
                    return (
                      <tr
                        key={inc.id}
                        onClick={() => selectIncapacity(inc)}
                        className={`border-t border-outline-variant/20 cursor-pointer transition-colors ${
                          selectedId === inc.id ? 'bg-primary-fixed/30' : 'hover:bg-surface-container-low'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-on-surface">{inc.studentName}</div>
                          <div className="text-xs text-on-surface-variant font-mono">{inc.studentId}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold">{inc.courseCode}</div>
                          <div className="text-xs text-on-surface-variant">{inc.courseName}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(inc.date)}</td>
                        <td className="px-4 py-3">
                          <AuditStatusBadge
                            status={inc.status}
                            mode={mode}
                            reviewedBy={inc.reviewedBy}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs font-semibold text-on-surface flex items-center gap-1">
                            <GraduationCap className="w-3.5 h-3.5 text-primary shrink-0" />
                            {reviewerDisplay}
                          </div>
                          <div className="text-[11px] text-on-surface-variant">
                            {inc.status === 'Pendiente'
                              ? 'Pendiente de revisión docente'
                              : inc.reviewedBy?.toLowerCase().includes('coordinac')
                              ? 'Reevaluada por Coordinación (Override)'
                              : `Evaluada por ${reviewerDisplay}`}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              selectIncapacity(inc);
                            }}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                              mode === 'admin-audit'
                                ? 'bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 text-xs'
                                : 'text-primary hover:bg-primary-fixed/40'
                            }`}
                          >
                            <Eye className="w-4 h-4" />
                            {mode === 'admin-audit' ? 'Reevaluar Estado' : 'Ver'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Detalle ── */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-2xl shadow-card border border-outline-variant/30 p-5 h-fit lg:sticky lg:top-24">
          {!selected ? (
            <div className="flex flex-col items-center gap-2 py-12 text-on-surface-variant text-center">
              <Eye className="w-10 h-10" />
              <p className="font-semibold">Selecciona una solicitud</p>
              <p className="text-body-sm">
                {mode === 'teacher'
                  ? 'Verás el motivo, fechas, soporte adjunto y los botones para aprobar o rechazar la excusa.'
                  : 'Verás el expediente completo de la solicitud, el soporte adjunto y el dictamen del profesor titular.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-mono text-on-surface-variant">{selected.id}</p>
                  <h2 className="text-headline-sm font-bold text-on-surface">
                    {TYPE_ICON[selected.type]} Incapacidad {selected.type}
                  </h2>
                </div>
                <AuditStatusBadge
                  status={selected.status}
                  mode={mode}
                  reviewedBy={selected.reviewedBy}
                />
              </div>

              <dl className="grid grid-cols-1 gap-2 text-body-sm">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  <dt className="sr-only">Estudiante</dt>
                  <dd>
                    <strong>{selected.studentName}</strong> ({selected.studentId})
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <dt className="sr-only">Asignatura</dt>
                  <dd>
                    {selected.courseCode} — {selected.courseName}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-primary" />
                  <dt className="sr-only">Docente Titular</dt>
                  <dd>
                    Docente titular:{' '}
                    <strong>{selected.reviewedBy || assignedCourseTeacher}</strong>
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary" />
                  <dt className="sr-only">Fecha</dt>
                  <dd>
                    Falta del <strong>{formatDate(selected.date)}</strong> • radicada{' '}
                    {formatDateTime(selected.createdAt)}
                  </dd>
                </div>
              </dl>

              <div className="p-3 rounded-xl bg-surface-container text-body-sm text-on-surface">
                <p className="text-label-md font-bold text-on-surface-variant mb-1">Motivo detallado</p>
                {selected.reason}
              </div>

              <button
                onClick={() => setPreview(selected)}
                className="flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-primary/40 hover:bg-primary-fixed/20 text-left transition-colors"
              >
                <Paperclip className="w-5 h-5 text-primary shrink-0" />
                <span className="min-w-0">
                  <span className="block font-semibold text-on-surface truncate">{selected.fileName}</span>
                  <span className="block text-xs text-primary font-semibold">
                    Abrir / previsualizar soporte adjunto
                  </span>
                </span>
              </button>

              {metrics && (
                <div className="p-3 rounded-xl border border-outline-variant/40">
                  <p className="text-label-md font-bold text-on-surface-variant mb-2">
                    Semáforo de Permanencia
                  </p>
                  <div className="flex items-center gap-2 flex-wrap text-body-sm">
                    <span className={`px-2.5 py-1 rounded-full font-bold ${SEMAFORO_STYLE[metrics.level]}`}>
                      Actual: {metrics.percentage}%
                    </span>
                    {projected !== null && projected.percentage !== metrics.percentage && (
                      <>
                        <span aria-hidden>→</span>
                        <span
                          className={`px-2.5 py-1 rounded-full font-bold ${
                            SEMAFORO_STYLE[getSemaforoLevel(projected.percentage)]
                          }`}
                        >
                          {projected.label}: {projected.percentage}%
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-on-surface-variant mt-2">
                    {metrics.attended} asistencias • {metrics.justified} justificadas • {metrics.absent} faltas
                  </p>
                </div>
              )}

              {mode === 'teacher' ? (
                <>
                  <div>
                    <label
                      htmlFor="reviewer-comment"
                      className="flex items-center gap-1.5 text-label-md font-bold text-on-surface mb-1.5"
                    >
                      <MessageSquare className="w-4 h-4 text-primary" /> Observación del docente
                    </label>
                    <textarea
                      id="reviewer-comment"
                      rows={3}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Ej. Certificado médico validado. Se justifica la inasistencia…"
                      className="w-full px-3 py-2.5 rounded-xl border border-outline-variant/60 bg-surface-container-low text-body-md focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => decide('Aprobada')}
                      disabled={submitting || selected.status === 'Aprobada'}
                      className="h-12 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center gap-1.5 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-card"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Aprobar Excusa
                    </button>
                    <button
                      type="button"
                      onClick={() => decide('Rechazada')}
                      disabled={submitting || selected.status === 'Rechazada'}
                      className="h-12 rounded-xl bg-red-600 text-white font-bold flex items-center justify-center gap-1.5 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-card"
                    >
                      <XCircle className="w-4 h-4" />
                      Rechazar
                    </button>
                  </div>
                </>
              ) : (
                <div className="p-4 rounded-xl bg-violet-50/60 border border-violet-200 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-violet-900">
                      Reevaluar Estado (Override de Coordinación)
                    </span>
                    <AuditStatusBadge
                      status={selected.status}
                      mode="admin-audit"
                      reviewedBy={selected.reviewedBy}
                    />
                  </div>
                  <p className="text-body-sm text-on-surface">
                    <strong>Evaluador actual:</strong>{' '}
                    {selected.reviewedBy || assignedCourseTeacher}
                  </p>

                  <div>
                    <label
                      htmlFor="coord-audit-note"
                      className="flex items-center gap-1.5 text-label-md font-bold text-violet-950 mb-1"
                    >
                      <MessageSquare className="w-4 h-4 text-violet-700" /> Nota de auditoría (Coordinación)
                    </label>
                    <textarea
                      id="coord-audit-note"
                      rows={3}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Ingresa nota de auditoría o justificación del Override administrativo…"
                      className="w-full px-3 py-2 rounded-xl border border-violet-300 bg-white text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-violet-500/40 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => decide('Aprobada')}
                      disabled={submitting}
                      className="h-11 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-emerald-700 disabled:opacity-40 transition-colors shadow-card"
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      Aprobada por Coordinación
                    </button>
                    <button
                      type="button"
                      onClick={() => decide('Rechazada')}
                      disabled={submitting}
                      className="h-11 px-3 rounded-xl bg-red-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-red-700 disabled:opacity-40 transition-colors shadow-card"
                    >
                      <XCircle className="w-4 h-4 shrink-0" />
                      Rechazada por Coordinación
                    </button>
                  </div>
                </div>
              )}

              {selected.reviewedAt && (
                <p className="text-xs text-on-surface-variant">
                  Última revisión: {formatDateTime(selected.reviewedAt)}
                  {selected.reviewedBy ? ` por ${selected.reviewedBy}` : ''}
                </p>
              )}
              {toast && (
                <div
                  className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-body-sm"
                  role="status"
                >
                  {toast}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <SupportPreviewModal incapacity={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
