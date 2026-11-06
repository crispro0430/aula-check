'use client';

import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Upload, Send, CheckCircle2, AlertCircle, Paperclip, Eye, CalendarX, Inbox } from 'lucide-react';
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
  const incapacities     = useAulaCheckStore((s) => s.incapacities);
  const submitIncapacity = useAulaCheckStore((s) => s.submitIncapacity);

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
    'w-full h-12 px-4 rounded-xl border border-outline-variant/60 bg-surface-container-low text-on-surface text-body-md focus:outline-none focus:ring-2 focus:ring-primary/40';

  return (
    <div className="flex flex-col gap-5">
      {/* ── Encabezado ── */}
      <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-card border border-outline-variant/30">
        <h2 className="text-headline-sm font-bold text-on-surface">📄 Mis Incapacidades / Excusas</h2>
        <p className="text-body-sm text-on-surface-variant mt-1">
          Radica tu soporte (Art. 42 del Reglamento Estudiantil). Al ser aprobado, la falta queda como
          <strong className="text-emerald-700"> Justificada</strong> y no afecta tu Semáforo de Permanencia.
        </p>
        {metrics && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-surface-container p-2">
              <div className="text-headline-sm font-bold text-on-surface">{metrics.percentage}%</div>
              <div className="text-label-sm text-on-surface-variant">Asistencia</div>
            </div>
            <div className="rounded-xl bg-emerald-50 p-2">
              <div className="text-headline-sm font-bold text-emerald-700">{metrics.justified}</div>
              <div className="text-label-sm text-emerald-800">Justificadas</div>
            </div>
            <div className="rounded-xl bg-red-50 p-2">
              <div className="text-headline-sm font-bold text-red-700">{metrics.absent}</div>
              <div className="text-label-sm text-red-800">Faltas</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Formulario de radicación ── */}
      <form
        onSubmit={handleSubmit}
        className="bg-surface-container-lowest rounded-2xl p-5 shadow-card border border-outline-variant/30 space-y-4"
        noValidate
      >
        <h3 className="text-label-lg font-bold text-on-surface flex items-center gap-2">
          <Upload className="w-4 h-4 text-primary" /> Radicar nueva incapacidad
        </h3>

        <div>
          <label htmlFor="inc-course" className="text-label-md font-semibold text-on-surface block mb-1.5">Asignatura</label>
          <select id="inc-course" value={effectiveCourseCode} onChange={(e) => setCourseCode(e.target.value)} className={inputCls}>
            {studentCourses.map((c) => (
              <option key={c.id} value={c.code}>{c.code} — {c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="inc-date" className="text-label-md font-semibold text-on-surface block mb-1.5">Fecha de la falta</label>
          <input id="inc-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          {absentDates.length > 0 && (
            <div className="mt-2">
              <p className="text-label-sm text-on-surface-variant flex items-center gap-1 mb-1">
                <CalendarX className="w-3.5 h-3.5" /> Tus inasistencias registradas (toca para usar):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {absentDates.map((d) => (
                  <button
                    type="button"
                    key={d}
                    onClick={() => setDate(d)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                      date === d ? 'bg-primary text-white border-primary' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
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
          <span className="text-label-md font-semibold text-on-surface block mb-1.5">Tipo de incapacidad</span>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de incapacidad">
            {INCAPACITY_TYPES.map((t) => (
              <button
                type="button"
                key={t}
                role="radio"
                aria-checked={type === t}
                onClick={() => setType(t)}
                className={`py-2.5 px-2 rounded-xl border-2 text-label-md font-semibold transition-all ${
                  type === t ? 'border-primary bg-primary-fixed/40 text-primary' : 'border-outline-variant/50 text-on-surface-variant hover:border-primary/40'
                }`}
              >
                <span aria-hidden>{TYPE_ICON[t]}</span> {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="inc-reason" className="text-label-md font-semibold text-on-surface block mb-1.5">Motivo detallado</label>
          <textarea
            id="inc-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe la situación, diagnóstico o circunstancia que impidió asistir…"
            className="w-full px-4 py-3 rounded-xl border border-outline-variant/60 bg-surface-container-low text-on-surface text-body-md focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
          />
        </div>

        <div>
          <label htmlFor="inc-file" className="text-label-md font-semibold text-on-surface block mb-1.5">Soporte médico / laboral</label>
          <label
            htmlFor="inc-file"
            className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-outline-variant hover:border-primary cursor-pointer bg-surface-container-low transition-colors"
          >
            <Paperclip className="w-5 h-5 text-primary shrink-0" />
            <span className="text-body-sm text-on-surface-variant truncate">
              {file ? <strong className="text-on-surface">{file.name}</strong> : 'Seleccionar archivo (PDF, PNG, JPG)'}
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
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-body-sm" role="alert">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-body-sm" role="status">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> {success}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-xl bg-primary-container text-white font-bold text-label-lg flex items-center justify-center gap-2 hover:bg-primary transition-colors disabled:opacity-50 shadow-card active:scale-[0.98]"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Radicar incapacidad
        </button>
      </form>

      {/* ── Estado de mis solicitudes ── */}
      <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-card border border-outline-variant/30">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-label-lg font-bold text-on-surface">Estado de mis solicitudes</h3>
          <div className="flex gap-1 text-xs font-bold">
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">{counts.Pendiente}</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">{counts.Aprobada}</span>
            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800">{counts.Rechazada}</span>
          </div>
        </div>

        {myIncapacities.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-on-surface-variant">
            <Inbox className="w-8 h-8" />
            <p className="text-body-sm">Aún no has radicado incapacidades.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {myIncapacities.map((inc) => (
              <li key={inc.id} className="rounded-xl border border-outline-variant/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-on-surface text-body-md truncate">
                      {TYPE_ICON[inc.type]} {inc.courseCode} — {inc.courseName}
                    </p>
                    <p className="text-label-sm text-on-surface-variant">
                      Falta: {formatDate(inc.date)} • Radicada: {formatDateTime(inc.createdAt)}
                    </p>
                  </div>
                  <IncapacityStatusBadge status={inc.status} />
                </div>
                <p className="text-body-sm text-on-surface-variant mt-2 line-clamp-2">{inc.reason}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setPreview(inc)}
                    className="inline-flex items-center gap-1 text-label-sm font-semibold text-primary hover:underline truncate"
                  >
                    <Eye className="w-3.5 h-3.5 shrink-0" /> {inc.fileName}
                  </button>
                </div>
                {inc.status !== 'Pendiente' && (
                  <div
                    className={`mt-2 p-2.5 rounded-lg text-body-sm ${
                      inc.status === 'Aprobada' ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900'
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

