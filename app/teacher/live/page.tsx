'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Award, Users, UserCheck, UserX, Clock, Star, RefreshCw, ChevronRight, Wifi, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAulaCheckStore } from '@/lib/store';
import { getStatusClasses, getStatusLabel, formatTime } from '@/lib/utils';
import type { Student } from '@/lib/types';

// ─── Student Row ─────────────────────────────────────────────────────────────

function StudentRow({
  student,
  onAddPoint,
  onManualValidate,
  onApproveJustification,
}: {
  student: Student;
  onAddPoint: () => void;
  onManualValidate: () => void;
  onApproveJustification: () => void;
}) {
  const { bg, text, dot } = getStatusClasses(student.status);
  const [popping, setPopping] = useState(false);

  function handlePoint() {
    setPopping(true);
    onAddPoint();
    setTimeout(() => setPopping(false), 400);
  }

  const hasPendingJustification = student.justification && student.justification.status === 'pendiente';

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-surface-container-lowest border border-outline-variant/20 transition-all duration-200 hover:shadow-card ${popping ? 'scale-[1.01]' : ''}`}>
      {/* Left: Avatar + Info */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 rounded-full bg-primary-fixed flex items-center justify-center text-label-md text-primary font-bold shrink-0">
          {student.avatarInitials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-label-lg text-on-surface font-semibold truncate">{student.name}</span>
            {student.points > 0 && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-label-sm">
                <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                {student.points}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-body-sm text-on-surface-variant flex-wrap">
            <span>{student.code}</span>
            {student.checkinTime && (
              <>
                <span className="text-outline-variant">•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTime(student.checkinTime)}
                </span>
              </>
            )}
            {hasPendingJustification && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-label-sm font-semibold border border-purple-200">
                <AlertCircle className="w-3 h-3 text-purple-600" />
                Excusa: {student.justification?.reason}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Actions & Status */}
      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap">
        {/* Status Badge */}
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-label-sm font-semibold ${bg} ${text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
          {getStatusLabel(student.status)}
        </span>

        {/* Aprobar Justificación pendiente */}
        {hasPendingJustification && (
          <button
            onClick={onApproveJustification}
            title={`Aprobar justificación por ${student.justification?.reason}: "${student.justification?.comments}"`}
            className="px-2.5 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 text-label-sm font-bold flex items-center gap-1 border border-purple-200 transition-all active:scale-95"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
            Aprobar Excusa (Art. 42)
          </button>
        )}

        {/* Botón de Contingencia Manual (para estudiantes sin conexión o batería) */}
        {(student.status === 'pendiente' || student.status === 'ausente') && (
          <button
            onClick={onManualValidate}
            title="Marcar asistencia manual por falla de dispositivo o conexión"
            className="px-2.5 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-label-sm font-bold flex items-center gap-1 border border-blue-200 transition-all active:scale-95 shadow-sm"
          >
            <UserCheck className="w-3.5 h-3.5 text-blue-600" />
            Validar Contingencia
          </button>
        )}

        {/* +1 Participación */}
        {(student.status === 'presente' || student.status === 'presente_manual' || student.status === 'tardanza') && (
          <button
            onClick={handlePoint}
            title="Agregar punto de participación"
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-50 text-amber-600 hover:bg-amber-100 active:scale-90 transition-all border border-amber-200/50"
          >
            <Award className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Live Console Page ────────────────────────────────────────────────────────

export default function LivePage() {
  const router = useRouter();
  const session                = useAulaCheckStore((s) => s.session);
  const students               = useAulaCheckStore((s) => s.students);
  const addParticipationPoint  = useAulaCheckStore((s) => s.addParticipationPoint);
  const markManualAttendance   = useAulaCheckStore((s) => s.markManualAttendance);
  const approveJustification   = useAulaCheckStore((s) => s.approveJustification);
  const regeneratePin          = useAulaCheckStore((s) => s.regeneratePin);
  const [currentTime, setCurrentTime] = useState('');
  const [filter, setFilter] = useState<'all' | 'presente' | 'pendiente' | 'justificado'>('all');
  const [elapsed, setElapsed] = useState('');

  // Reloj
  useEffect(() => {
    const tick = () => setCurrentTime(formatTime(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Tiempo transcurrido
  useEffect(() => {
    if (!session.startTime) return;
    const update = () => {
      const diff = Math.floor((Date.now() - session.startTime!.getTime()) / 1000);
      const m = Math.floor(diff / 60).toString().padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      setElapsed(`${m}:${s}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [session.startTime]);

  const total        = students.length;
  const presentes    = students.filter((s) => s.status === 'presente' || s.status === 'presente_manual' || s.status === 'tardanza').length;
  const justificados = students.filter((s) => s.status === 'justificado').length;
  const pendientes   = students.filter((s) => s.status === 'pendiente').length;
  const ausentes     = students.filter((s) => s.status === 'ausente').length;

  const filteredStudents = students.filter((s) => {
    if (filter === 'all')        return true;
    if (filter === 'presente')   return s.status === 'presente' || s.status === 'presente_manual' || s.status === 'tardanza';
    if (filter === 'pendiente')  return s.status === 'pendiente';
    if (filter === 'justificado')return s.status === 'justificado' || s.justification?.status === 'pendiente';
    return true;
  });

  if (!session.isActive) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface gap-4 px-4">
        <p className="text-headline-sm text-on-surface-variant">No hay sesión activa.</p>
        <button onClick={() => router.push('/teacher/setup')} className="px-6 py-3 rounded-xl bg-primary-container text-white font-semibold">
          Iniciar sesión
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed text-label-sm uppercase tracking-widest font-bold">UT-06</span>
            <span className="inline-flex items-center gap-1.5 text-label-sm text-secondary font-semibold">
              <Wifi className="w-3.5 h-3.5 animate-pulse" /> Sesión activa
            </span>
          </div>
          <h1 className="text-headline-lg text-primary font-bold tracking-tight">Consola en Vivo</h1>
          <p className="text-body-sm text-on-surface-variant">{session.course} — {session.room}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-label-sm text-on-surface-variant">Tiempo transcurrido</div>
            <div className="font-mono text-headline-md text-primary font-bold">{elapsed}</div>
          </div>
          <div className="text-right">
            <div className="text-label-sm text-on-surface-variant">PIN activo</div>
            <div className="font-mono text-headline-md text-on-surface font-bold tracking-widest">{session.pin}</div>
          </div>
          <button
            onClick={regeneratePin}
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
            title="Renovar PIN"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => router.push('/teacher/summary')}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary-container text-white font-semibold text-label-lg hover:bg-primary transition-colors"
          >
            Cerrar clase
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total',        value: total,        icon: Users,       color: 'bg-surface-container-high text-on-surface' },
          { label: 'Presentes',    value: presentes,    icon: UserCheck,   color: 'bg-emerald-50 text-emerald-700' },
          { label: 'Justificados', value: justificados, icon: ShieldCheck, color: 'bg-purple-50 text-purple-700' },
          { label: 'Pendientes',   value: pendientes,   icon: Clock,       color: 'bg-amber-50 text-amber-700' },
          { label: 'Ausentes',     value: ausentes,     icon: UserX,       color: 'bg-red-50 text-red-700' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`rounded-xl p-4 flex items-center gap-3 ${color} border border-outline-variant/20`}>
            <Icon className="w-5 h-5 shrink-0 opacity-70" />
            <div>
              <div className="text-headline-md font-bold leading-none">{value}</div>
              <div className="text-label-sm opacity-70 mt-0.5">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Progress Bar ── */}
      <div className="mb-6 bg-surface-container-lowest rounded-2xl p-4 shadow-card border border-outline-variant/20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-label-lg text-on-surface font-semibold">Asistencia registrada</span>
            {justificados > 0 && (
              <span className="text-label-sm px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold">
                +{justificados} Justificados (Art. 42 protegidos)
              </span>
            )}
          </div>
          <span className="text-label-lg text-primary font-bold">{total > 0 ? Math.round(((presentes + justificados) / total) * 100) : 0}%</span>
        </div>
        <div className="h-3 rounded-full bg-surface-container overflow-hidden">
          <div
            className="h-full rounded-full bg-secondary transition-all duration-500"
            style={{ width: `${total > 0 ? ((presentes + justificados) / total) * 100 : 0}%` }}
          />
        </div>
        <div className="mt-2 text-body-sm text-on-surface-variant flex items-center justify-between">
          <span>{presentes} presentes + {justificados} justificados de {total} estudiantes</span>
          <span className="text-label-sm text-secondary font-semibold">Semáforo institucional activo</span>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {([
          { key: 'all',         label: `Todos (${total})` },
          { key: 'presente',    label: `Presentes (${presentes})` },
          { key: 'justificado', label: `Justificados (${justificados})` },
          { key: 'pendiente',   label: `Pendientes (${pendientes})` },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-xl text-label-lg font-semibold transition-all ${
              filter === key
                ? 'bg-primary-container text-white shadow-card'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Student List ── */}
      <div className="flex flex-col gap-2">
        {filteredStudents.length === 0 && (
          <div className="text-center py-12 text-on-surface-variant text-body-md">
            No hay estudiantes en este filtro.
          </div>
        )}
        {filteredStudents.map((student) => (
          <StudentRow
            key={student.id}
            student={student}
            onAddPoint={() => addParticipationPoint(student.id)}
            onManualValidate={() => markManualAttendance(student.id)}
            onApproveJustification={() => approveJustification(student.id)}
          />
        ))}
      </div>
    </div>
  );
}
