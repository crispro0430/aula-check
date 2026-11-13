'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, CheckCircle2, AlertTriangle, BookOpen, Users, UserCheck, Star, Clock, Download } from 'lucide-react';
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
  async function handleDownloadExcel() {
    // Carga diferida: SheetJS solo se descarga al exportar (PERF-01)
    const XLSX = await import('xlsx');
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
        <div className="w-20 h-20 rounded-full bg-[#34c759]/15 flex items-center justify-center mb-5 animate-success-pop">
          <CheckCircle2 className="w-11 h-11 text-[#248a3d]" />
        </div>
        <h1 className="text-2xl sm:text-3xl text-[#1d1d1f] font-bold tracking-tight mb-2">¡Sesión cerrada!</h1>
        <p className="text-sm text-[#6e6e73] mb-8 max-w-sm leading-relaxed">
          La bitácora de la clase fue guardada en el sistema institucional. Los registros de asistencia están disponibles en el panel administrativo.
        </p>
        <div className="grid grid-cols-3 gap-3 w-full mb-8">
          {[
            { label: 'Presentes',  value: presentes,   color: 'text-[#248a3d] bg-[#34c759]/10 border-[#34c759]/25' },
            { label: 'Tardanzas',  value: tardanza,    color: 'text-[#b64400] bg-[#ff9500]/10 border-[#ff9500]/25' },
            { label: 'Ausentes',   value: ausentes,    color: 'text-[#d70015] bg-[#ff3b30]/10 border-[#ff3b30]/25' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`rounded-2xl p-4 text-center border ${color}`}>
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs opacity-80 font-medium">{label}</div>
            </div>
          ))}
        </div>
        <button
          onClick={() => void handleDownloadExcel()}
          className="w-full h-11 rounded-full bg-[#0071e3] hover:bg-[#0077ed] active:scale-[0.98] text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 mb-3 shadow-[0_6px_18px_-4px_rgba(0,113,227,0.45)]"
        >
          <Download className="w-4 h-4" />
          Descargar Acta Oficial (Excel)
        </button>
        <button
          onClick={handleNewSession}
          className="w-full h-11 rounded-full bg-black/[0.05] hover:bg-black/[0.08] active:scale-[0.98] text-[#1d1d1f] font-semibold text-sm transition-all"
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
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#0071e3]/10 text-[#0071e3] text-[11px] font-semibold uppercase tracking-wider mb-2">
          Cierre de Sesión
        </span>
        <h1 className="text-2xl sm:text-3xl text-[#1d1d1f] font-bold tracking-tight mb-1">Resumen y Cierre de Sesión</h1>
        <p className="text-sm text-[#6e6e73]">
          Completa la bitácora de la clase antes de cerrar la sesión.
          {session.startTime && (
            <span> Iniciada a las <strong className="text-[#1d1d1f]">{formatTime(session.startTime)}</strong> del <strong className="text-[#1d1d1f]">{formatDate(session.startTime)}</strong>.</span>
          )}
        </p>
      </div>

      {/* ── Acceso rápido: Bandeja de Incapacidades ── */}
      <Link
        href="/teacher/incapacities"
        className="mb-6 flex items-center justify-between gap-3 p-4 rounded-2xl border border-[#ff9500]/25 bg-[#ff9500]/[0.08] hover:bg-[#ff9500]/[0.14] transition-all active:scale-[0.99]"
      >
        <span className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#ff9500]/15 text-[#c93400] flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </span>
          <span>
            <span className="block font-bold text-sm text-[#1d1d1f]">Bandeja de Incapacidades / Excusas</span>
            <span className="block text-xs text-[#6e6e73]">
              {pendingIncapacities > 0
                ? `${pendingIncapacities} solicitud(es) pendiente(s) de revisión`
                : 'No hay solicitudes pendientes'}
            </span>
          </span>
        </span>
        <span className="text-xs font-semibold text-[#0071e3] shrink-0">Revisar →</span>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Formulario ── */}
        <div className="lg:col-span-2 flex flex-col gap-5">

          {/* Estadísticas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: UserCheck, label: 'Presentes',    value: presentes,   color: 'bg-[#34c759]/10 border-[#34c759]/25', iconCls: 'text-[#248a3d]' },
              { icon: Clock,     label: 'Tardanzas',    value: tardanza,    color: 'bg-[#ff9500]/10 border-[#ff9500]/25', iconCls: 'text-[#c93400]' },
              { icon: Users,     label: 'Ausentes',     value: ausentes,    color: 'bg-[#ff3b30]/10 border-[#ff3b30]/25', iconCls: 'text-[#d70015]' },
              { icon: Star,      label: 'Pts. totales', value: totalPoints, color: 'bg-[#0071e3]/10 border-[#0071e3]/20', iconCls: 'text-[#0071e3]' },
            ].map(({ icon: Icon, label, value, color, iconCls }) => (
              <div key={label} className={`rounded-2xl p-4 flex flex-col gap-1 border ${color}`}>
                <Icon className={`w-5 h-5 ${iconCls}`} />
                <div className="text-2xl font-bold text-[#1d1d1f]">{value}</div>
                <div className="text-[11px] font-medium text-[#6e6e73]">{label}</div>
              </div>
            ))}
          </div>

          {/* Bitácora */}
          <div className="bg-white/80 backdrop-blur-2xl rounded-[28px] p-6 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] border border-black/[0.06]">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <h2 className="text-base text-[#1d1d1f] font-bold tracking-tight">Bitácora de la clase</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-[#1d1d1f] font-semibold block mb-1.5">
                  Tema desarrollado <span className="text-[#d70015]">*</span>
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-black/[0.08] bg-black/[0.03] focus:bg-white text-[#1d1d1f] text-sm focus:outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/30 transition-all"
                />
              </div>

              <div>
                <label className="text-xs text-[#1d1d1f] font-semibold block mb-1.5">
                  Observaciones generales
                </label>
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  rows={3}
                  placeholder="Comportamiento del grupo, avances, dudas frecuentes..."
                  className="w-full px-4 py-3 rounded-xl border border-black/[0.08] bg-black/[0.03] focus:bg-white text-[#1d1d1f] text-sm placeholder:text-[#6e6e73] focus:outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/30 transition-all resize-none"
                />
              </div>

              <div>
                <label className="text-xs text-[#1d1d1f] font-semibold block mb-1.5 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#c93400]" />
                  Contingencias
                </label>
                <textarea
                  value={contingencies}
                  onChange={(e) => setContingencies(e.target.value)}
                  rows={2}
                  placeholder="Problemas técnicos, ausencias justificadas, incidentes..."
                  className="w-full px-4 py-3 rounded-xl border border-black/[0.08] bg-black/[0.03] focus:bg-white text-[#1d1d1f] text-sm placeholder:text-[#6e6e73] focus:outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/30 transition-all resize-none"
                />
              </div>
            </div>
          </div>

          {/* Botón de descarga de acta oficial Excel */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => void handleDownloadExcel()}
              className="w-full sm:flex-1 h-12 rounded-full bg-white hover:bg-black/[0.03] active:scale-[0.98] border border-black/[0.1] text-[#1d1d1f] font-semibold text-sm flex items-center justify-center gap-2.5 transition-all"
            >
              <Download className="w-4 h-4 text-[#0071e3]" />
              Descargar Acta Oficial (Excel)
            </button>

            <button
              onClick={handleClose}
              disabled={!topic.trim() || loading}
              className="w-full sm:flex-1 h-12 rounded-full bg-[#0071e3] hover:bg-[#0077ed] active:scale-[0.98] text-white font-semibold text-sm flex items-center justify-center gap-2.5 transition-all shadow-[0_8px_20px_-6px_rgba(0,113,227,0.55)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Guardar bitácora y cerrar sesión
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Panel Lateral ── */}
        <div className="flex flex-col gap-4">
          {/* Top participantes */}
          <div className="bg-white/80 backdrop-blur-2xl rounded-[28px] p-5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] border border-black/[0.06]">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-4 h-4 text-[#c93400] fill-[#ff9500]" />
              <h3 className="text-sm text-[#1d1d1f] font-bold tracking-tight">Top Participantes</h3>
            </div>
            {topStudents.length === 0 ? (
              <p className="text-xs text-[#6e6e73] text-center py-4">
                Ningún estudiante tiene puntos de participación aún.
              </p>
            ) : (
              <div className="space-y-2">
                {topStudents.map((s, idx) => (
                  <div key={s.id} className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-black/[0.03]">
                    <span className="w-6 h-6 rounded-full bg-[#ff9500]/15 text-[#b64400] text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-[#1d1d1f] font-semibold truncate">{s.name}</div>
                    </div>
                    <span className="flex items-center gap-0.5 text-[#b64400] font-bold text-xs">
                      <Star className="w-3.5 h-3.5 fill-[#ff9500] text-[#c93400]" />
                      {s.points}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Asistentes */}
          <div className="bg-white/80 backdrop-blur-2xl rounded-[28px] p-5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] border border-black/[0.06]">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-sm text-[#1d1d1f] font-bold tracking-tight">Lista de asistencia</h3>
              {justificados > 0 && (
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#0071e3]/10 text-[#0071e3] font-semibold">
                  {justificados} Justificados (Art. 42)
                </span>
              )}
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {students.map((s) => {
                const { bg, text } = getStatusClassesMini(s.status);
                const isPendingOrAbsent = s.status === 'pendiente' || s.status === 'ausente';
                return (
                  <div key={s.id} className="flex items-center justify-between gap-2 py-2 border-b border-black/[0.05] last:border-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-full bg-[#0071e3]/10 flex items-center justify-center text-[11px] text-[#0071e3] font-bold shrink-0">
                        {s.avatarInitials}
                      </div>
                      <span className="text-xs font-medium text-[#1d1d1f] truncate">{s.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${bg} ${text}`}>
                        {getStatusLabel(s.status)}
                      </span>

                      {isPendingOrAbsent && (
                        <button
                          type="button"
                          onClick={() => markManualAttendance(s.id)}
                          aria-label={`Validar asistencia por contingencia de ${s.name}`}
                          className="touch-target inline-flex items-center min-h-[28px] text-[11px] px-2.5 py-1 rounded-full bg-[#0071e3]/10 text-[#0071e3] hover:bg-[#0071e3]/15 font-semibold border border-[#0071e3]/20 transition-all active:scale-[0.98]"
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
    case 'presente':        return { bg: 'bg-[#34c759]/12', text: 'text-[#248a3d]' };
    case 'presente_manual': return { bg: 'bg-[#0071e3]/12', text: 'text-[#0071e3]' };
    case 'justificado':     return { bg: 'bg-[#0071e3]/12', text: 'text-[#0062c4]' };
    case 'tardanza':        return { bg: 'bg-[#ff9500]/12', text: 'text-[#b64400]' };
    case 'ausente':         return { bg: 'bg-[#ff3b30]/12', text: 'text-[#c42b22]' };
    default:                return { bg: 'bg-black/[0.05]',  text: 'text-[#6e6e73]' };
  }
}
