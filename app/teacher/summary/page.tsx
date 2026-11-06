'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, CheckCircle2, AlertTriangle, BookOpen, Users, UserCheck, Star, Clock, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAulaCheckStore } from '@/lib/store';
import { formatTime, formatDate } from '@/lib/utils';

export default function SummaryPage() {
  const router = useRouter();
  const session              = useAulaCheckStore((s) => s.session);
  const students             = useAulaCheckStore((s) => s.students);
  const closeSession         = useAulaCheckStore((s) => s.closeSession);
  const resetSession         = useAulaCheckStore((s) => s.resetSession);
  const markManualAttendance  = useAulaCheckStore((s) => s.markManualAttendance);
  const pendingIncapacities   = useAulaCheckStore(
    (s) => s.incapacities.filter((i) => i.status === 'Pendiente').length,
  );

  const [topic, setTopic] = useState(session.topic);
  const [observations, setObservations] = useState('');
  const [contingencies, setContingencies] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const presentes   = students.filter((s) => s.status === 'presente' || s.status === 'presente_manual').length;
  const tardanza    = students.filter((s) => s.status === 'tardanza').length;
  const justificados= students.filter((s) => s.status === 'justificado').length;
  const ausentes    = students.filter((s) => s.status === 'ausente' || s.status === 'pendiente').length;
  const totalPoints = students.reduce((acc, s) => acc + s.points, 0);
  const topStudents = [...students].filter((s) => s.points > 0).sort((a, b) => b.points - a.points).slice(0, 5);

  // ─── Generador de Acta Oficial Excel (.xlsx) ─────────────────────────────────────
  // Usa SheetJS para generar un archivo .xlsx nativo, eliminando por completo
  // los problemas de codificación UTF-8 con tildes y caracteres especiales.
  function handleDownloadExcel() {
    const now = new Date();
    const attendancePercentage = students.length > 0
      ? ((presentes + tardanza + justificados) / students.length * 100).toFixed(1)
      : '0.0';

    // Construir datos como array de arrays (AOA) para la hoja
    const data: (string | number)[][] = [
      ['ACTA DE ASISTENCIA — AULA CHECK'],
      ['Sistema Institucional de Control de Asistencia'],
      [],
      ['Asignatura:', `${session.course} (${session.courseCode})`],
      ['Docente:', session.teacher],
      ['Aula:', session.room],
      ['Fecha:', session.startTime ? formatDate(session.startTime) : formatDate(now)],
      ['Hora de inicio:', session.startTime ? formatTime(session.startTime) : 'N/A'],
      ['Período académico:', session.period || '2026-2'],
      ['Tema:', topic || session.topic || 'Sin especificar'],
      [],
      ['Quórum total:', `${presentes + tardanza + justificados} / ${students.length}`],
      ['Porcentaje de asistencia:', `${attendancePercentage}%`],
      ['Presentes:', presentes],
      ['Tardanzas:', tardanza],
      ['Justificados:', justificados],
      ['Ausentes:', ausentes],
      [],
      ['DETALLE DE ASISTENCIA'],
      ['Código Estudiantil', 'Nombre Completo', 'Estado', 'Hora de Registro', 'Participaciones'],
    ];

    // Filas de estudiantes
    students.forEach((s) => {
      data.push([
        s.code,
        s.name,
        getStatusLabel(s.status),
        s.checkinTime ? formatTime(s.checkinTime) : '-',
        s.points,
      ]);
    });

    // Pie del acta
    data.push([]);
    data.push(['Generado por Aula Check el', `${formatDate(now)} a las ${formatTime(now)}`]);
    data.push(['Este documento es una constancia digital generada automáticamente.']);

    // Crear hoja y libro de trabajo
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Ajustar ancho de columnas para legibilidad
    ws['!cols'] = [
      { wch: 22 },  // A: Código Estudiantil / Etiquetas
      { wch: 28 },  // B: Nombre Completo / Valores
      { wch: 20 },  // C: Estado
      { wch: 18 },  // D: Hora de Registro
      { wch: 16 },  // E: Participaciones
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Acta de Asistencia');

    // Generar nombre del archivo: ActaAsistencia_CODIGO_PERIODO_YYYYMMDD.xlsx
    const dateStr = (session.startTime || now)
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '');
    const currentPeriod = session.period || '2026-2';
    const fileName = `ActaAsistencia_${session.courseCode}_${currentPeriod}_${dateStr}.xlsx`;

    // Descargar el archivo
    XLSX.writeFile(wb, fileName);
  }

  async function handleClose() {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    closeSession({ topic, observations, contingencies, closedAt: new Date() });
    setSubmitted(true);
    setLoading(false);
  }

  function handleNewSession() {
    resetSession();
    router.push('/teacher/setup');
  }

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 flex flex-col items-center text-center animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mb-5 animate-success-pop">
          <CheckCircle2 className="w-12 h-12 text-emerald-600" />
        </div>
        <h1 className="text-headline-xl text-on-surface font-bold mb-2">¡Sesión cerrada!</h1>
        <p className="text-body-lg text-on-surface-variant mb-8 max-w-sm">
          La bitácora de la clase fue guardada en el sistema institucional. Los registros de asistencia están disponibles en el panel administrativo.
        </p>
        <div className="grid grid-cols-3 gap-3 w-full mb-8">
          {[
            { label: 'Presentes',  value: presentes,   color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Tardanzas',  value: tardanza,    color: 'text-amber-600   bg-amber-50'   },
            { label: 'Ausentes',   value: ausentes,    color: 'text-red-600     bg-red-50'     },
          ].map(({ label, value, color }) => (
            <div key={label} className={`rounded-xl p-3 text-center ${color} border border-outline-variant/20`}>
              <div className="text-headline-md font-bold">{value}</div>
              <div className="text-label-sm opacity-80">{label}</div>
            </div>
          ))}
        </div>
        <button
          onClick={handleDownloadExcel}
          className="w-full h-12 rounded-xl bg-blue-600 text-white font-semibold text-label-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 mb-3"
        >
          <Download className="w-5 h-5" />
          📥 Descargar Acta Oficial (Excel)
        </button>
        <button
          onClick={handleNewSession}
          className="w-full h-12 rounded-xl bg-primary-container text-white font-semibold text-label-lg hover:bg-primary transition-colors"
        >
          Nueva sesión
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      {/* ── Header ── */}
      <div className="mb-8">
        <h1 className="text-headline-xl text-primary font-bold tracking-tight mb-1">Resumen y Cierre de Sesión</h1>
        <p className="text-body-lg text-on-surface-variant">
          Completa la bitácora de la clase antes de cerrar la sesión.
          {session.startTime && (
            <span> Iniciada a las <strong>{formatTime(session.startTime)}</strong> del <strong>{formatDate(session.startTime)}</strong>.</span>
          )}
        </p>
      </div>

      {/* ── Acceso rápido: Bandeja de Incapacidades ── */}
      <Link
        href="/teacher/incapacities"
        className="mb-6 flex items-center justify-between gap-3 p-4 rounded-2xl border border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors shadow-card"
      >
        <span className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden>📄</span>
          <span>
            <span className="block font-bold text-amber-900">Bandeja de Incapacidades / Excusas</span>
            <span className="block text-body-sm text-amber-800">
              {pendingIncapacities > 0
                ? `${pendingIncapacities} solicitud(es) pendiente(s) de revisión`
                : 'No hay solicitudes pendientes'}
            </span>
          </span>
        </span>
        <span className="text-label-lg font-bold text-amber-900">Revisar →</span>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Formulario ── */}
        <div className="lg:col-span-2 flex flex-col gap-5">

          {/* Estadísticas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: UserCheck, label: 'Presentes',    value: presentes,   color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
              { icon: Clock,     label: 'Tardanzas',    value: tardanza,    color: 'text-amber-600   bg-amber-50   border-amber-200'   },
              { icon: Users,     label: 'Ausentes',     value: ausentes,    color: 'text-red-600     bg-red-50     border-red-200'     },
              { icon: Star,      label: 'Pts. totales', value: totalPoints, color: 'text-primary bg-primary-fixed/40 border-outline-variant' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className={`rounded-xl p-4 flex flex-col gap-1 border ${color}`}>
                <Icon className="w-5 h-5 opacity-70" />
                <div className="text-headline-md font-bold">{value}</div>
                <div className="text-label-sm opacity-70">{label}</div>
              </div>
            ))}
          </div>

          {/* Bitácora */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-card border border-outline-variant/20">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 text-primary-container" />
              <h2 className="text-headline-sm text-on-surface font-bold">Bitácora de la clase</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-label-lg text-on-surface font-semibold block mb-1.5">
                  Tema desarrollado <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border-2 border-outline-variant bg-surface-container-low text-on-surface text-body-lg focus:outline-none focus:border-primary-container focus:ring-4 focus:ring-primary-container/10 transition-all"
                />
              </div>

              <div>
                <label className="text-label-lg text-on-surface font-semibold block mb-1.5">
                  Observaciones generales
                </label>
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  rows={3}
                  placeholder="Comportamiento del grupo, avances, dudas frecuentes..."
                  className="w-full px-4 py-3 rounded-xl border-2 border-outline-variant bg-surface-container-low text-on-surface text-body-lg placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary-container focus:ring-4 focus:ring-primary-container/10 transition-all resize-none"
                />
              </div>

              <div>
                <label className="text-label-lg text-on-surface font-semibold block mb-1.5 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Contingencias
                </label>
                <textarea
                  value={contingencies}
                  onChange={(e) => setContingencies(e.target.value)}
                  rows={2}
                  placeholder="Problemas técnicos, ausencias justificadas, incidentes..."
                  className="w-full px-4 py-3 rounded-xl border-2 border-outline-variant bg-surface-container-low text-on-surface text-body-lg placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary-container focus:ring-4 focus:ring-primary-container/10 transition-all resize-none"
                />
              </div>
            </div>
          </div>

          {/* Botón de descarga de acta oficial Excel */}
          <button
            onClick={handleDownloadExcel}
            className="w-full h-12 rounded-xl bg-blue-600 text-white font-bold text-label-lg flex items-center justify-center gap-3 hover:bg-blue-700 transition-all active:scale-[0.98] shadow-md mb-3"
          >
            <Download className="w-5 h-5" />
            📥 Descargar Acta Oficial (Excel)
          </button>

          <button
            onClick={handleClose}
            disabled={!topic.trim() || loading}
            className="w-full h-14 rounded-xl bg-primary-container text-white font-bold text-label-lg flex items-center justify-center gap-3 hover:bg-primary transition-all active:scale-[0.98] shadow-elevated disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <FileText className="w-5 h-5" />
                Guardar bitácora y cerrar sesión
              </>
            )}
          </button>
        </div>

        {/* ── Panel Lateral ── */}
        <div className="flex flex-col gap-4">
          {/* Top participantes */}
          <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-card border border-outline-variant/20">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
              <h3 className="text-label-lg text-on-surface font-bold">Top Participantes</h3>
            </div>
            {topStudents.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant text-center py-4">
                Ningún estudiante tiene puntos de participación aún.
              </p>
            ) : (
              <div className="space-y-2">
                {topStudents.map((s, idx) => (
                  <div key={s.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-container-low">
                    <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-label-sm font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-label-lg text-on-surface font-semibold truncate">{s.name}</div>
                    </div>
                    <span className="flex items-center gap-0.5 text-amber-600 font-bold text-label-lg">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      {s.points}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Asistentes */}
          <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-card border border-outline-variant/20">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-label-lg text-on-surface font-bold">Lista de asistencia</h3>
              {justificados > 0 && (
                <span className="text-label-sm px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-semibold border border-purple-200">
                  {justificados} Justificados (Art. 42)
                </span>
              )}
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {students.map((s) => {
                const { bg, text } = getStatusClassesMini(s.status);
                const isPendingOrAbsent = s.status === 'pendiente' || s.status === 'ausente';
                return (
                  <div key={s.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-outline-variant/10 last:border-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-full bg-primary-fixed flex items-center justify-center text-label-sm text-primary font-bold shrink-0">
                        {s.avatarInitials}
                      </div>
                      <span className="text-body-sm text-on-surface truncate">{s.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-label-sm px-2 py-0.5 rounded-full font-semibold ${bg} ${text}`}>
                        {getStatusLabel(s.status)}
                      </span>

                      {isPendingOrAbsent && (
                        <button
                          onClick={() => markManualAttendance(s.id)}
                          className="text-label-sm px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold border border-blue-200 transition-colors shadow-sm"
                          title="Validar contingencia (sin batería/conexión)"
                        >
                          Validar Contingencia
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Mini helpers to avoid import issues in same file
function getStatusLabel(status: string): string {
  switch (status) {
    case 'presente':        return 'Presente';
    case 'presente_manual': return 'Presente (Manual)';
    case 'justificado':     return 'Justificado';
    case 'tardanza':        return 'Tardanza';
    case 'ausente':         return 'Ausente';
    default:                return 'Pendiente';
  }
}

function getStatusClassesMini(status: string): { bg: string; text: string } {
  switch (status) {
    case 'presente':        return { bg: 'bg-emerald-50', text: 'text-emerald-700' };
    case 'presente_manual': return { bg: 'bg-blue-50',    text: 'text-blue-700' };
    case 'justificado':     return { bg: 'bg-purple-50',  text: 'text-purple-700' };
    case 'tardanza':        return { bg: 'bg-amber-50',   text: 'text-amber-700'   };
    case 'ausente':         return { bg: 'bg-red-50',     text: 'text-red-700'     };
    default:                return { bg: 'bg-slate-100',  text: 'text-slate-500'   };
  }
}
