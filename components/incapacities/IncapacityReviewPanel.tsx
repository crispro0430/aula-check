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
  Paperclip,
  CheckCircle2,
  XCircle,
  GraduationCap,
  RefreshCw,
  SlidersHorizontal,
  X,
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

function cleanDisplayName(name: string | undefined): string {
  if (!name) return '';
  return name.replace(/\s*\([^)]*\)/g, '').trim();
}

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
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold whitespace-nowrap bg-emerald-50 text-emerald-800 border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        {isCoordOverride
          ? 'Aprobada por Coordinación'
          : mode === 'admin-audit'
          ? 'Aprobada por Docente'
          : 'Aprobada'}
      </span>
    );
  }
  if (status === 'Rechazada') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold whitespace-nowrap bg-red-50 text-red-800 border-red-200">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        {isCoordOverride
          ? 'Rechazada por Coordinación'
          : mode === 'admin-audit'
          ? 'Rechazada por Docente'
          : 'Rechazada'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold whitespace-nowrap bg-amber-50 text-amber-800 border-amber-200">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      Pendiente
    </span>
  );
}

interface Props {
  mode?: 'teacher' | 'admin-audit';
  teacherId?: string;
  reviewerName: string;
  roleLabel: string;
}

export default function IncapacityReviewPanel({
  mode = 'teacher',
  teacherId = 't1',
  reviewerName,
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
        name: cleanDisplayName(currentUser.name),
        email: currentUser.email,
      };
    }
    return (
      teachers.find((t) => t.id === teacherId || t.name === reviewerName) ??
      teachers[0] ?? {
        id: teacherId,
        name: cleanDisplayName(reviewerName),
        email: 'alejandro.morales@universidad.edu.co',
      }
    );
  }, [mode, currentUser, teachers, teacherId, reviewerName]);

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

  const assignedCourseTeacher = useMemo(() => {
    if (!selected) return 'Prof. Dr. Alejandro Morales';
    const courseObj = courses.find((c) => c.code.toUpperCase() === selected.courseCode.toUpperCase());
    return courseObj?.teacher || 'Prof. Dr. Alejandro Morales';
  }, [selected, courses]);

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
      return { label: 'Si se rechaza', percentage: next.percentage };
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
      setToast('Escribe una observación indicando el motivo del rechazo.');
      return;
    }

    setSubmitting(true);
    setToast('');
    const effectiveReviewerName = isCoordOverride
      ? 'Coordinación Académica'
      : cleanDisplayName(activeTeacher?.name || reviewerName);
    const effectiveTeacherId = activeTeacher?.id || teacherId;
    const effectiveComment =
      comment.trim() ||
      (isCoordOverride
        ? decision === 'Aprobada'
          ? 'Reevaluada y aprobada por Coordinación Académica.'
          : 'Reevaluada y rechazada por Coordinación Académica.'
        : decision === 'Aprobada'
        ? 'Soporte validado y aprobado por el docente titular.'
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
          ? `Solicitud aprobada por Coordinación. Se actualizó el expediente de ${selected.studentName}.`
          : `Solicitud rechazada por Coordinación. Se actualizó el expediente de ${selected.studentName}.`
        : decision === 'Aprobada'
        ? `Excusa aprobada. La falta del ${formatDate(selected.date)} quedó justificada para ${selected.studentName}.`
        : `Solicitud rechazada. ${selected.studentName} verá tu observación en su portal.`,
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
      {/* ── Encabezado Limpio (Apple / Vercel Design System) ── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-headline-lg font-bold text-on-surface tracking-tight">
            Incapacidades
          </h1>
          <p className="text-body-md text-on-surface-variant mt-0.5">
            {mode === 'teacher'
              ? 'Revisión y dictamen de excusas médicas de tus asignaturas'
              : 'Auditoría y reevaluación de excusas médicas institucionales'}
          </p>
        </div>

        {/* Buscador y botón de sincronización alineados sin desborde */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto shrink-0">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar estudiante o asignatura…"
              aria-label="Buscar incapacidades"
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-outline-variant/60 bg-surface-container-lowest text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
          </div>
          <button
            type="button"
            onClick={() => void fetchFromApi(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 h-10 px-3.5 rounded-xl border border-outline-variant/60 bg-surface-container-lowest hover:bg-surface-container text-xs font-semibold text-on-surface whitespace-nowrap transition-all disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-primary ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Sincronizando…' : 'Actualizar'}</span>
          </button>
        </div>
      </div>

      {/* ── Filtros por estado ── */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por estado">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              filter === key
                ? 'bg-primary-container text-white border-primary-container shadow-2xs'
                : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/50 hover:border-primary/40'
            }`}
          >
            {label}
            <span
              className={`px-1.5 py-0.5 rounded-full text-[11px] ${
                filter === key ? 'bg-white/20 text-white' : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* ── Grilla Principal: Tabla 100% si no hay selección, o 7/5 al inspeccionar ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* ── Tabla con scroll horizontal suave ── */}
        <div
          className={`${
            selected ? 'xl:col-span-7' : 'xl:col-span-12'
          } w-full bg-surface-container-lowest rounded-2xl shadow-card border border-outline-variant/30 overflow-hidden transition-all`}
        >
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2.5 py-16 px-6 text-on-surface-variant text-center">
              <Inbox className="w-9 h-9 text-on-surface-variant/50" />
              <p className="font-semibold text-on-surface text-body-md">
                No hay solicitudes en este filtro
              </p>
              {mode === 'teacher' && activeTeacher && (
                <div className="max-w-md text-body-sm text-on-surface-variant space-y-2">
                  {teacherAssignedCoursesList.length > 0 ? (
                    <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                      {teacherAssignedCoursesList.map((c) => (
                        <span
                          key={c.code}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          {c.code} — {c.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p>No tienes asignaturas asignadas actualmente.</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto scroll-smooth">
              <table className="w-full min-w-[760px] text-left text-body-sm border-collapse">
                <thead className="bg-surface-container/70 text-on-surface-variant text-xs font-semibold uppercase tracking-wider border-b border-outline-variant/30">
                  <tr>
                    <th className="px-4 py-3.5">Estudiante</th>
                    <th className="px-4 py-3.5">Asignatura</th>
                    <th className="px-4 py-3.5 whitespace-nowrap">Fecha Falta</th>
                    <th className="px-4 py-3.5">Estado</th>
                    <th className="px-4 py-3.5 min-w-[180px]">Evaluador</th>
                    <th className="px-4 py-3.5 text-right whitespace-nowrap min-w-[120px]">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {filtered.map((inc) => {
                    const courseObj = courses.find(
                      (c) => c.code.toUpperCase() === inc.courseCode.toUpperCase(),
                    );
                    const reviewerDisplay = cleanDisplayName(
                      inc.reviewedBy || courseObj?.teacher || 'Prof. Dr. Alejandro Morales',
                    );
                    return (
                      <tr
                        key={inc.id}
                        onClick={() => selectIncapacity(inc)}
                        className={`cursor-pointer transition-colors ${
                          selectedId === inc.id ? 'bg-primary-fixed/25' : 'hover:bg-surface-container-low/70'
                        }`}
                      >
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-on-surface whitespace-nowrap">
                            {inc.studentName}
                          </div>
                          <div className="text-xs text-on-surface-variant font-mono">
                            {inc.studentId}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-on-surface whitespace-nowrap">
                            {inc.courseCode}
                          </div>
                          <div
                            className="text-xs text-on-surface-variant truncate max-w-[180px]"
                            title={inc.courseName}
                          >
                            {inc.courseName}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-on-surface">
                          {formatDate(inc.date)}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <AuditStatusBadge
                            status={inc.status}
                            mode={mode}
                            reviewedBy={inc.reviewedBy}
                          />
                        </td>
                        <td className="px-4 py-3.5 min-w-[180px]" title={reviewerDisplay}>
                          <div className="text-xs font-medium text-on-surface flex items-center gap-1.5">
                            <GraduationCap className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="truncate">{reviewerDisplay}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap min-w-[120px]">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectIncapacity(inc);
                            }}
                            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                              mode === 'admin-audit'
                                ? 'bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200/80'
                                : 'bg-slate-100 text-slate-800 hover:bg-slate-200/80'
                            }`}
                          >
                            {mode === 'admin-audit' ? (
                              <>
                                <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                                <span>Reevaluar</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5 shrink-0" />
                                <span>Revisar</span>
                              </>
                            )}
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

        {/* ── Panel de Detalle / Evaluación (Solo visible cuando hay una solicitud seleccionada) ── */}
        {selected && (
          <div className="xl:col-span-5 bg-surface-container-lowest rounded-2xl shadow-card border border-outline-variant/30 p-5 sm:p-6 h-fit xl:sticky xl:top-24 animate-fade-in">
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-mono text-on-surface-variant">{selected.id}</p>
                  <h2 className="text-headline-sm font-bold text-on-surface mt-0.5">
                    {TYPE_ICON[selected.type]} Incapacidad {selected.type}
                  </h2>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <AuditStatusBadge
                    status={selected.status}
                    mode={mode}
                    reviewedBy={selected.reviewedBy}
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
                    aria-label="Cerrar panel de detalle"
                    title="Cerrar detalle y ver tabla completa"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <dl className="grid grid-cols-1 gap-2 text-body-sm pt-1">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-primary shrink-0" />
                  <dt className="sr-only">Estudiante</dt>
                  <dd className="truncate">
                    <strong>{selected.studentName}</strong> ({selected.studentId})
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary shrink-0" />
                  <dt className="sr-only">Asignatura</dt>
                  <dd className="truncate">
                    {selected.courseCode} — {selected.courseName}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-primary shrink-0" />
                  <dt className="sr-only">Evaluador</dt>
                  <dd className="truncate">
                    Responsable:{' '}
                    <strong>{cleanDisplayName(selected.reviewedBy || assignedCourseTeacher)}</strong>
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary shrink-0" />
                  <dt className="sr-only">Fecha</dt>
                  <dd>
                    Falta del <strong>{formatDate(selected.date)}</strong> • radicada{' '}
                    {formatDateTime(selected.createdAt)}
                  </dd>
                </div>
              </dl>

              <div className="p-3.5 rounded-xl bg-surface-container/70 text-body-sm text-on-surface">
                <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                  Motivo
                </p>
                {selected.reason}
              </div>

              <button
                type="button"
                onClick={() => setPreview(selected)}
                className="flex items-center gap-3 p-3.5 rounded-xl border border-dashed border-primary/40 hover:bg-primary-fixed/20 text-left transition-colors"
              >
                <Paperclip className="w-4 h-4 text-primary shrink-0" />
                <span className="min-w-0">
                  <span className="block font-semibold text-on-surface text-body-sm truncate">
                    {selected.fileName}
                  </span>
                  <span className="block text-xs text-primary font-medium">
                    Ver soporte adjunto
                  </span>
                </span>
              </button>

              {metrics && (
                <div className="p-3.5 rounded-xl border border-outline-variant/40 bg-surface-container-low/40">
                  <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
                    Semáforo de Permanencia
                  </p>
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className={`px-2.5 py-1 rounded-full font-bold ${SEMAFORO_STYLE[metrics.level]}`}>
                      Actual: {metrics.percentage}%
                    </span>
                    {projected !== null && projected.percentage !== metrics.percentage && (
                      <>
                        <span aria-hidden className="text-on-surface-variant">→</span>
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
                <div className="space-y-3 pt-1">
                  <div>
                    <label
                      htmlFor="reviewer-comment"
                      className="flex items-center gap-1.5 text-xs font-semibold text-on-surface mb-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-primary" /> Observación docente
                    </label>
                    <textarea
                      id="reviewer-comment"
                      rows={3}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Escribe una observación sobre el soporte…"
                      className="w-full px-3 py-2 rounded-xl border border-outline-variant/60 bg-surface-container-low text-body-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => decide('Aprobada')}
                      disabled={submitting || selected.status === 'Aprobada'}
                      className="h-11 rounded-xl bg-emerald-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-2xs"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Aprobar
                    </button>
                    <button
                      type="button"
                      onClick={() => decide('Rechazada')}
                      disabled={submitting || selected.status === 'Rechazada'}
                      className="h-11 rounded-xl bg-red-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-2xs"
                    >
                      <XCircle className="w-4 h-4" />
                      Rechazar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Reevaluar Estado
                    </span>
                    <span className="text-[11px] font-medium text-slate-500">
                      Coordinación
                    </span>
                  </div>

                  <div>
                    <label
                      htmlFor="coord-audit-note"
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 mb-1"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-violet-600" /> Nota de auditoría
                    </label>
                    <textarea
                      id="coord-audit-note"
                      rows={2}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Nota de auditoría opcional…"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-violet-500/30 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => decide('Aprobada')}
                      disabled={submitting}
                      className="h-10 px-3 rounded-xl bg-emerald-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-emerald-700 disabled:opacity-40 transition-colors whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      Aprobada por Coordinación
                    </button>
                    <button
                      type="button"
                      onClick={() => decide('Rechazada')}
                      disabled={submitting}
                      className="h-10 px-3 rounded-xl bg-red-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-red-700 disabled:opacity-40 transition-colors whitespace-nowrap"
                    >
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                      Rechazada por Coordinación
                    </button>
                  </div>
                </div>
              )}

              {selected.reviewedAt && (
                <p className="text-xs text-on-surface-variant">
                  Última revisión: {formatDateTime(selected.reviewedAt)}
                  {selected.reviewedBy ? ` por ${cleanDisplayName(selected.reviewedBy)}` : ''}
                </p>
              )}
              {toast && (
                <div
                  className="p-3 rounded-xl bg-slate-900 text-white text-xs font-medium"
                  role="status"
                >
                  {toast}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <SupportPreviewModal incapacity={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
