'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Upload, Send, CheckCircle2, AlertCircle, Paperclip, Eye, CalendarX, Inbox, RefreshCw } from 'lucide-react';
import { useAulaCheckStore, MAX_SUPPORT_DATAURL_LENGTH } from '@/lib/store';
import { computeStudentMetrics } from '@/lib/student-history';
import type { Incapacity, IncapacityType, Student } from '@/lib/types';
import {
  INCAPACITY_TYPES,
  IncapacityStatusBadge,
  SupportPreviewModal,
  TYPE_ICON,
  formatDate,
  formatDateTime,
} from './shared';

const ACCEPTED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'] as const;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

/** Sección "📄 Mis Incapacidades / Excusas" del portal estudiantil. */
export default function StudentIncapacities() {
  const currentUser      = useAulaCheckStore((s) => s.currentUser);
  const students         = useAulaCheckStore((s) => s.students);
  const courses          = useAulaCheckStore((s) => s.courses);
  const incapacities            = useAulaCheckStore((s) => s.incapacities);
  const submitIncapacity        = useAulaCheckStore((s) => s.submitIncapacity);
  const mergeRemoteIncapacities = useAulaCheckStore((s) => s.mergeRemoteIncapacities);
  const [refreshing, setRefreshing] = useState(false);

  async function refreshStudentRequests() {
    setRefreshing(true);
    try {
      const res = await fetch('/api/incapacities');
      if (res.ok) {
        const data = (await res.json()) as { incapacities?: Incapacity[] };
        if (data.incapacities) {
          mergeRemoteIncapacities(data.incapacities);
        }
      }
    } catch {
      // Fallback local
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void refreshStudentRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Identificar al estudiante activo ──
  const student: Student | undefined = useMemo(() => {
    const byUser = currentUser
      ? students.find(
          (s) =>
            s.email.toLowerCase() === currentUser.email.toLowerCase() ||
            s.name.toLowerCase() === currentUser.name.toLowerCase(),
        )
      : undefined;
    return byUser ?? students.find((s) => s.id === '2021815001') ?? students[0];
  }, [currentUser, students]);

  const studentCourses = useMemo(() => {
    if (!student) return courses;
    const enrolled = courses.filter((c) => c.enrolledStudentIds?.includes(student.id));
    return enrolled.length > 0 ? enrolled : courses;
  }, [courses, student]);

  const myIncapacities = useMemo(
    () =>
      student
        ? incapacities
            .filter((i) => i.studentId === student.id || i.studentId === student.code)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        : [],
    [incapacities, student],
  );

  const metrics = useMemo(() => (student ? computeStudentMetrics(student) : null), [student]);
  const absentDates = useMemo(
    () => (metrics ? metrics.history.filter((h) => h.status === 'ausente').map((h) => h.date) : []),
    [metrics],
  );

  // ── Estado del formulario ──
  const [courseCode, setCourseCode] = useState<string>(studentCourses[0]?.code ?? '');
  const [date, setDate]             = useState<string>('');
  const [type, setType]             = useState<IncapacityType>('Médica');
  const [reason, setReason]         = useState<string>('');
  const [file, setFile]             = useState<File | null>(null);
  const [error, setError]           = useState<string>('');
  const [success, setSuccess]       = useState<string>('');
  const [loading, setLoading]       = useState<boolean>(false);
  const [preview, setPreview]       = useState<Incapacity | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveCourseCode = courseCode || studentCourses[0]?.code || '';

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setError('');
    if (selected) {
      const lower = selected.name.toLowerCase();
      if (!ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
        setError('Formato no permitido. Usa PDF, PNG, JPG o JPEG.');
        setFile(null);
        e.target.value = '';
        return;
      }
    }
    setFile(selected);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!student) return setError('No se pudo identificar al estudiante.');
    const course = studentCourses.find((c) => c.code === effectiveCourseCode);
    if (!course) return setError('Selecciona la asignatura.');
    if (!date) return setError('Indica la fecha de la falta.');
    if (reason.trim().length < 10) return setError('Describe el motivo con al menos 10 caracteres.');
    if (!file) return setError('Adjunta el soporte médico / laboral (PDF, PNG o JPG).');

    setLoading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const created = submitIncapacity({
        studentId: student.id,
        studentName: student.name,
        courseCode: course.code,
        courseName: course.name,
        date,
        reason: reason.trim(),
        type,
        fileName: file.name,
        fileDataUrl: dataUrl,
      });

      // Sincronizar inmediatamente en PostgreSQL/Supabase con studentId y courseId
      try {
        await fetch('/api/incapacities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: created.id,
            studentId: student.code || student.id,
            studentName: student.name,
            studentEmail: student.email,
            courseId: course.id,
            courseCode: course.code,
            courseName: course.name,
            date,
            reason: reason.trim(),
            type,
            fileName: file.name,
            documentUrl: dataUrl,
          }),
        });
      } catch {
        // Fallback silencioso a store local
      }
      setSuccess(
        dataUrl.length > MAX_SUPPORT_DATAURL_LENGTH
          ? `Solicitud radicada (${created.id}). El archivo es pesado: se guardó solo su nombre para revisión.`
          : `Solicitud radicada correctamente (${created.id}). Quedó en estado Pendiente.`,
      );
      setDate('');
      setReason('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch {
      setError('No se pudo leer el archivo adjunto. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  }

  const counts = {
    Pendiente: myIncapacities.filter((i) => i.status === 'Pendiente').length,
    Aprobada:  myIncapacities.filter((i) => i.status === 'Aprobada').length,
    Rechazada: myIncapacities.filter((i) => i.status === 'Rechazada').length,
  };

  const inputCls =
    'w-full h-11 px-3.5 rounded-xl border border-black/[0.08] bg-black/[0.03] focus:bg-white text-[#1d1d1f] text-sm focus:outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/30 transition-all';

  return (
    <div className="flex flex-col gap-5">
      {/* ── Encabezado ── */}
      <div className="bg-white/80 backdrop-blur-2xl rounded-[28px] p-5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] border border-black/[0.06]">
        <h2 className="text-base font-bold text-[#1d1d1f] tracking-tight">Mis Incapacidades / Excusas</h2>
        <p className="text-xs text-[#86868b] mt-1 leading-relaxed">
          Radica tu soporte (Art. 42 del Reglamento Estudiantil). Al ser aprobado, la falta queda como
          <strong className="text-[#248a3d]"> Justificada</strong> y no afecta tu Semáforo de Permanencia.
        </p>
        {metrics && (
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-black/[0.03] p-2.5 border border-black/[0.04]">
              <div className="text-lg font-bold text-[#1d1d1f]">{metrics.percentage}%</div>
              <div className="text-[11px] font-medium text-[#86868b]">Asistencia</div>
            </div>
            <div className="rounded-2xl bg-[#34c759]/10 p-2.5 border border-[#34c759]/20">
              <div className="text-lg font-bold text-[#248a3d]">{metrics.justified}</div>
              <div className="text-[11px] font-medium text-[#248a3d]">Justificadas</div>
            </div>
            <div className="rounded-2xl bg-[#ff3b30]/10 p-2.5 border border-[#ff3b30]/20">
              <div className="text-lg font-bold text-[#c42b22]">{metrics.absent}</div>
              <div className="text-[11px] font-medium text-[#c42b22]">Faltas</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Formulario de radicación ── */}
      <form
        onSubmit={handleSubmit}
        className="bg-white/80 backdrop-blur-2xl rounded-[28px] p-5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] border border-black/[0.06] space-y-4"
        noValidate
      >
        <h3 className="text-sm font-bold text-[#1d1d1f] tracking-tight flex items-center gap-2">
          <Upload className="w-4 h-4 text-[#0071e3]" /> Radicar nueva incapacidad
        </h3>

        <div>
          <label htmlFor="inc-course" className="text-xs font-semibold text-[#1d1d1f] block mb-1.5">Asignatura</label>
          <select id="inc-course" value={effectiveCourseCode} onChange={(e) => setCourseCode(e.target.value)} className={inputCls}>
            {studentCourses.map((c) => (
              <option key={c.id} value={c.code}>{c.code} — {c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="inc-date" className="text-xs font-semibold text-[#1d1d1f] block mb-1.5">Fecha de la falta</label>
          <input id="inc-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          {absentDates.length > 0 && (
            <div className="mt-2">
              <p className="text-[11px] text-[#86868b] flex items-center gap-1 mb-1.5">
                <CalendarX className="w-3.5 h-3.5 text-[#ff3b30]" /> Tus inasistencias registradas (toca para usar):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {absentDates.map((d) => (
                  <button
                    type="button"
                    key={d}
                    onClick={() => setDate(d)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all active:scale-[0.98] ${
                      date === d ? 'bg-[#0071e3] text-white border-[#0071e3]' : 'bg-[#ff3b30]/10 text-[#c42b22] border-[#ff3b30]/20 hover:bg-[#ff3b30]/15'
                    }`}
                  >
                    {formatDate(d)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <span className="text-xs font-semibold text-[#1d1d1f] block mb-1.5">Tipo de incapacidad</span>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de incapacidad">
            {INCAPACITY_TYPES.map((t) => (
              <button
                type="button"
                key={t}
                role="radio"
                aria-checked={type === t}
                onClick={() => setType(t)}
                className={`py-2.5 px-2 rounded-xl border text-xs font-semibold transition-all active:scale-[0.98] ${
                  type === t ? 'border-[#0071e3] bg-[#0071e3]/10 text-[#0071e3]' : 'border-black/[0.08] bg-black/[0.03] text-[#86868b] hover:text-[#1d1d1f]'
                }`}
              >
                <span aria-hidden>{TYPE_ICON[t]}</span> {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="inc-reason" className="text-xs font-semibold text-[#1d1d1f] block mb-1.5">Motivo detallado</label>
          <textarea
            id="inc-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe la situación, diagnóstico o circunstancia que impidió asistir…"
            className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-black/[0.03] focus:bg-white text-[#1d1d1f] text-sm placeholder:text-[#86868b] focus:outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/30 transition-all resize-none"
          />
        </div>

        <div>
          <label htmlFor="inc-file" className="text-xs font-semibold text-[#1d1d1f] block mb-1.5">Soporte médico / laboral</label>
          <label
            htmlFor="inc-file"
            className="flex items-center gap-3 p-4 rounded-2xl border border-dashed border-[#0071e3]/35 hover:border-[#0071e3] cursor-pointer bg-[#0071e3]/[0.03] hover:bg-[#0071e3]/[0.06] transition-colors"
          >
            <Paperclip className="w-4 h-4 text-[#0071e3] shrink-0" />
            <span className="text-xs text-[#86868b] truncate">
              {file ? <strong className="text-[#1d1d1f]">{file.name}</strong> : 'Seleccionar archivo (PDF, PNG, JPG)'}
            </span>
          </label>
          <input
            id="inc-file"
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={handleFileChange}
            className="sr-only"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-2xl bg-[#ff3b30]/10 border border-[#ff3b30]/20 text-[#1d1d1f] text-xs" role="alert">
            <AlertCircle className="w-4 h-4 text-[#ff3b30] mt-0.5 shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-start gap-2 p-3 rounded-2xl bg-[#34c759]/10 border border-[#34c759]/25 text-[#1d1d1f] text-xs" role="status">
            <CheckCircle2 className="w-4 h-4 text-[#34c759] mt-0.5 shrink-0" /> {success}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-full bg-[#0071e3] hover:bg-[#0077ed] active:scale-[0.98] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 shadow-[0_6px_18px_-4px_rgba(0,113,227,0.45)]"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Radicar incapacidad
        </button>
      </form>

      {/* ── Estado de mis solicitudes ── */}
      <div className="bg-white/80 backdrop-blur-2xl rounded-[28px] p-5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] border border-black/[0.06]">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <h3 className="text-sm font-bold text-[#1d1d1f] tracking-tight">Estado de mis solicitudes</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshStudentRequests()}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/[0.05] hover:bg-black/[0.08] text-xs font-semibold text-[#1d1d1f] transition-all active:scale-[0.98] disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#0071e3] ${refreshing ? 'animate-spin' : ''}`} />
              Refrescar
            </button>
            <div className="flex gap-1 text-[11px] font-bold">
              <span className="px-2 py-0.5 rounded-full bg-[#ff9500]/15 text-[#b64400]">{counts.Pendiente}</span>
              <span className="px-2 py-0.5 rounded-full bg-[#34c759]/15 text-[#248a3d]">{counts.Aprobada}</span>
              <span className="px-2 py-0.5 rounded-full bg-[#ff3b30]/15 text-[#c42b22]">{counts.Rechazada}</span>
            </div>
          </div>
        </div>

        {myIncapacities.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-[#86868b]">
            <Inbox className="w-8 h-8 text-[#86868b]/50" />
            <p className="text-xs">Aún no has radicado incapacidades.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {myIncapacities.map((inc) => (
              <li key={inc.id} className="rounded-2xl border border-black/[0.06] bg-white/70 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#1d1d1f] text-xs sm:text-sm truncate">
                      {TYPE_ICON[inc.type]} {inc.courseCode} — {inc.courseName}
                    </p>
                    <p className="text-[11px] text-[#86868b] mt-0.5">
                      Falta: {formatDate(inc.date)} • Radicada: {formatDateTime(inc.createdAt)}
                    </p>
                  </div>
                  <IncapacityStatusBadge status={inc.status} />
                </div>
                <p className="text-xs text-[#86868b] mt-2 line-clamp-2 leading-relaxed">{inc.reason}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setPreview(inc)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0066cc] hover:underline truncate"
                  >
                    <Eye className="w-3.5 h-3.5 shrink-0" /> {inc.fileName}
                  </button>
                </div>
                {inc.status !== 'Pendiente' && (
                  <div
                    className={`mt-2.5 p-3 rounded-xl text-xs border ${
                      inc.status === 'Aprobada'
                        ? 'bg-[#34c759]/10 border-[#34c759]/20 text-[#1d1d1f]'
                        : 'bg-[#ff3b30]/10 border-[#ff3b30]/20 text-[#1d1d1f]'
                    }`}
                  >
                    <strong>Comentario del revisor{inc.reviewedBy ? ` (${inc.reviewedBy})` : ''}:</strong>{' '}
                    {inc.reviewerComment || 'Sin observaciones.'}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <SupportPreviewModal incapacity={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

