'use client';

import { useMemo, useState } from 'react';
import { Eye, Search, Inbox, User, BookOpen, CalendarDays, MessageSquare, ShieldCheck, Paperclip } from 'lucide-react';
import { useAulaCheckStore } from '@/lib/store';
import { computeStudentMetrics } from '@/lib/student-history';
import { getSemaforoLevel } from '@/lib/utils';
import type { Incapacity, IncapacityStatus } from '@/lib/types';
import { IncapacityStatusBadge, SupportPreviewModal, TYPE_ICON, formatDate, formatDateTime } from './shared';

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

interface Props {
  /** Nombre que quedará registrado como revisor. */
  reviewerName: string;
  /** Rol que revisa (solo informativo en la cabecera). */
  roleLabel: string;
}

/** Bandeja de revisión de incapacidades para Docentes y Coordinación (Admin). */
export default function IncapacityReviewPanel({ reviewerName, roleLabel }: Props) {
  const incapacities     = useAulaCheckStore((s) => s.incapacities);
  const students         = useAulaCheckStore((s) => s.students);
  const reviewIncapacity = useAulaCheckStore((s) => s.reviewIncapacity);

  const [filter, setFilter]         = useState<Filter>('Pendiente');
  const [query, setQuery]           = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment]       = useState('');
  const [preview, setPreview]       = useState<Incapacity | null>(null);
  const [toast, setToast]           = useState('');

  const counts: Record<Filter, number> = {
    Todas: incapacities.length,
    Pendiente: incapacities.filter((i) => i.status === 'Pendiente').length,
    Aprobada: incapacities.filter((i) => i.status === 'Aprobada').length,
    Rechazada: incapacities.filter((i) => i.status === 'Rechazada').length,
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return incapacities
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
  }, [incapacities, filter, query]);

  const selected = incapacities.find((i) => i.id === selectedId) ?? null;
  const selectedStudent = selected
    ? students.find((s) => s.id === selected.studentId || s.code === selected.studentId)
    : undefined;
  const metrics = selectedStudent ? computeStudentMetrics(selectedStudent) : null;

  // Proyección del semáforo si se aprueba la incapacidad pendiente
  const projected = useMemo(() => {
    if (!selected || !selectedStudent || selected.status !== 'Pendiente') return null;
    const next = computeStudentMetrics({
      ...selectedStudent,
      justifiedDates: [...(selectedStudent.justifiedDates ?? []), selected.date],
    });
    return next.percentage;
  }, [selected, selectedStudent]);

  function selectIncapacity(inc: Incapacity) {
    setSelectedId(inc.id);
    setComment(inc.reviewerComment);
    setToast('');
  }

  function decide(decision: 'Aprobada' | 'Rechazada') {
    if (!selected) return;
    if (decision === 'Rechazada' && comment.trim().length === 0) {
      setToast('⚠️ Escribe una observación indicando el motivo del rechazo.');
      return;
    }
    reviewIncapacity(selected.id, decision, comment, reviewerName);
    setToast(
      decision === 'Aprobada'
        ? `✅ Incapacidad aprobada. La falta del ${formatDate(selected.date)} quedó como "Justificada" en el expediente de ${selected.studentName}.`
        : `❌ Incapacidad rechazada. ${selected.studentName} verá tu observación en su portal.`,
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-6 flex flex-col gap-5">
      {/* ── Encabezado ── */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 text-xs font-bold border border-blue-200">
            <ShieldCheck className="w-3.5 h-3.5" /> {roleLabel}
          </span>
          <h1 className="text-headline-lg font-bold text-on-surface mt-2">📄 Bandeja de Incapacidades / Excusas</h1>
          <p className="text-body-md text-on-surface-variant">
            Revisa los soportes radicados por los estudiantes. Al aprobar, la falta se marca como “Justificada” y no afecta el Semáforo de Permanencia.
          </p>
        </div>
        <div className="relative w-full md:w-72">
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
            <span className={`px-2 py-0.5 rounded-full text-xs ${filter === key ? 'bg-white/20' : 'bg-surface-container'}`}>{counts[key]}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* ── Lista ── */}
        <div className="lg:col-span-3 bg-surface-container-lowest rounded-2xl shadow-card border border-outline-variant/30 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-on-surface-variant">
              <Inbox className="w-10 h-10" />
              <p>No hay incapacidades en este filtro.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-body-sm">
                <thead className="bg-surface-container text-on-surface-variant text-label-md uppercase">
                  <tr>
                    <th className="px-4 py-3">Estudiante</th>
                    <th className="px-4 py-3">Asignatura</th>
                    <th className="px-4 py-3">Fecha falta</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inc) => (
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
                      <td className="px-4 py-3 whitespace-nowrap">{TYPE_ICON[inc.type]} {inc.type}</td>
                      <td className="px-4 py-3"><IncapacityStatusBadge status={inc.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); selectIncapacity(inc); }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-primary font-semibold hover:bg-primary-fixed/40"
                        >
                          <Eye className="w-4 h-4" /> Ver
                        </button>
                      </td>
                    </tr>
                  ))}
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
              <p className="text-body-sm">Verás el detalle, el soporte adjunto y las acciones de aprobación.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-mono text-on-surface-variant">{selected.id}</p>
                  <h2 className="text-headline-sm font-bold text-on-surface">{TYPE_ICON[selected.type]} Incapacidad {selected.type}</h2>
                </div>
                <IncapacityStatusBadge status={selected.status} />
              </div>

              <dl className="grid grid-cols-1 gap-2 text-body-sm">
                <div className="flex items-center gap-2"><User className="w-4 h-4 text-primary" /><dt className="sr-only">Estudiante</dt><dd><strong>{selected.studentName}</strong> ({selected.studentId})</dd></div>
                <div className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /><dt className="sr-only">Asignatura</dt><dd>{selected.courseCode} — {selected.courseName}</dd></div>
                <div className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-primary" /><dt className="sr-only">Fecha</dt><dd>Falta del <strong>{formatDate(selected.date)}</strong> • radicada {formatDateTime(selected.createdAt)}</dd></div>
              </dl>

              <div className="p-3 rounded-xl bg-surface-container text-body-sm text-on-surface">
                <p className="text-label-md font-bold text-on-surface-variant mb-1">Motivo</p>
                {selected.reason}
              </div>

              <button
                onClick={() => setPreview(selected)}
                className="flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-primary/40 hover:bg-primary-fixed/20 text-left transition-colors"
              >
                <Paperclip className="w-5 h-5 text-primary shrink-0" />
                <span className="min-w-0">
                  <span className="block font-semibold text-on-surface truncate">{selected.fileName}</span>
                  <span className="block text-xs text-primary font-semibold">Abrir / previsualizar soporte adjunto</span>
                </span>
              </button>

              {metrics && (
                <div className="p-3 rounded-xl border border-outline-variant/40">
                  <p className="text-label-md font-bold text-on-surface-variant mb-2">Semáforo de Permanencia</p>
                  <div className="flex items-center gap-2 flex-wrap text-body-sm">
                    <span className={`px-2.5 py-1 rounded-full font-bold ${SEMAFORO_STYLE[metrics.level]}`}>Actual: {metrics.percentage}%</span>
                    {projected !== null && projected !== metrics.percentage && (
                      <>
                        <span aria-hidden>→</span>
                        <span className={`px-2.5 py-1 rounded-full font-bold ${SEMAFORO_STYLE[getSemaforoLevel(projected)]}`}>Si se aprueba: {projected}%</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-on-surface-variant mt-2">
                    {metrics.attended} asistencias • {metrics.justified} justificadas • {metrics.absent} faltas
                  </p>
                </div>
              )}

              <div>
                <label htmlFor="reviewer-comment" className="flex items-center gap-1.5 text-label-md font-bold text-on-surface mb-1.5">
                  <MessageSquare className="w-4 h-4 text-primary" /> Observación del revisor
                </label>
                <textarea
                  id="reviewer-comment"
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Ej. Soporte verificado con la EPS…"
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant/60 bg-surface-container-low text-body-md focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => decide('Aprobada')}
                  disabled={selected.status === 'Aprobada'}
                  className="h-12 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-card"
                >
                  ✅ Aprobar
                </button>
                <button
                  onClick={() => decide('Rechazada')}
                  disabled={selected.status === 'Rechazada'}
                  className="h-12 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-card"
                >
                  ❌ Rechazar
                </button>
              </div>

              {selected.reviewedAt && (
                <p className="text-xs text-on-surface-variant">
                  Última revisión: {formatDateTime(selected.reviewedAt)}{selected.reviewedBy ? ` por ${selected.reviewedBy}` : ''}
                </p>
              )}
              {toast && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-body-sm" role="status">{toast}</div>
              )}
            </div>
          )}
        </div>
      </div>

      <SupportPreviewModal incapacity={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

