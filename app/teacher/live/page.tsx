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
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 rounded-2xl bg-white/80 backdrop-blur-2xl border border-black/[0.06] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] transition-all duration-200 ${popping ? 'scale-[1.01]' : ''}`}>
      {/* Left: Avatar + Info */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 rounded-full bg-[#0071e3]/10 flex items-center justify-center text-xs text-[#0071e3] font-bold shrink-0">
          {student.avatarInitials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#1d1d1f] font-semibold truncate">{student.name}</span>
            {student.points > 0 && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-[#ff9500]/12 text-[#b64400] text-[11px] font-semibold">
                <Star className="w-3 h-3 fill-[#ff9500] text-[#ff9500]" />
                {student.points}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-[#86868b] flex-wrap mt-0.5">
            <span className="font-mono">{student.code}</span>
            {student.checkinTime && (
              <>
                <span className="text-black/20">•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#0071e3]" />
                  {formatTime(student.checkinTime)}
                </span>
              </>
            )}
            {hasPendingJustification && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#0071e3]/10 text-[#0071e3] text-[11px] font-semibold border border-[#0071e3]/20">
                <AlertCircle className="w-3 h-3" />
                Excusa: {student.justification?.reason}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Actions & Status */}
      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap">
        {/* Status Badge */}
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${bg} ${text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
          {getStatusLabel(student.status)}
        </span>

        {/* Aprobar Justificación pendiente */}
        {hasPendingJustification && (
          <button
            onClick={onApproveJustification}
            title={`Aprobar justificación por ${student.justification?.reason}: "${student.justification?.comments}"`}
            className="px-3 py-1.5 rounded-full bg-[#0071e3]/10 hover:bg-[#0071e3]/15 text-[#0071e3] text-xs font-semibold flex items-center gap-1.5 border border-[#0071e3]/20 transition-all active:scale-[0.98]"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Aprobar Excusa (Art. 42)
          </button>
        )}

        {/* Botón de Contingencia Manual (para estudiantes sin conexión o batería) */}
        {(student.status === 'pendiente' || student.status === 'ausente') && (
          <button
            onClick={onManualValidate}
            title="Marcar asistencia manual por falla de dispositivo o conexión"
            className="px-3 py-1.5 rounded-full bg-[#0071e3]/10 hover:bg-[#0071e3]/15 text-[#0071e3] text-xs font-semibold flex items-center gap-1.5 border border-[#0071e3]/20 transition-all active:scale-[0.98]"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Validar Contingencia
          </button>
        )}

        {/* +1 Participación */}
        {(student.status === 'presente' || student.status === 'presente_manual' || student.status === 'tardanza') && (
          <button
            onClick={handlePoint}
            title="Agregar punto de participación"
            className="w-9 h-9 rounded-full flex items-center justify-center bg-[#ff9500]/12 text-[#ff9500] hover:bg-[#ff9500]/20 active:scale-[0.95] transition-all border border-[#ff9500]/25"
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
  const syncRemoteRecords      = useAulaCheckStore((s) => s.syncRemoteRecords);
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

  // Sincronización en tiempo real desde Supabase para reflejar check-ins desde celulares
  useEffect(() => {
    if (!session.isActive || (!session.id && !session.pin)) return;

    const fetchRemoteRecords = async () => {
      try {
        const query = session.id
          ? `sessionId=${encodeURIComponent(session.id)}`
          : `pin=${encodeURIComponent(session.pin)}`;
        const res = await fetch(`/api/attendance/record?${query}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          records?: Array<{
            studentId: string;
            status: string;
            checkinAt?: string | null;
            student?: { id: string; code: string; name: string; email: string; program: string };
          }>;
        };
        if (data.records) {
          syncRemoteRecords(data.records);
        }
      } catch {
        // Fallback silencioso a store local
      }
    };

    void fetchRemoteRecords();
    const pollId = setInterval(fetchRemoteRecords, 4000);
    return () => clearInterval(pollId);
  }, [session.isActive, session.id, session.pin, syncRemoteRecords]);

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
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-base font-medium text-[#86868b]">No hay sesión activa.</p>
        <button onClick={() => router.push('/teacher/setup')} className="px-6 py-2.5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] active:scale-[0.98] text-white text-sm font-semibold transition-all">
          Iniciar sesión
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#34c759]/12 text-[#248a3d] text-[11px] font-semibold">
              <Wifi className="w-3.5 h-3.5 animate-pulse" /> Sesión activa
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl text-[#1d1d1f] font-bold tracking-tight">Consola en Vivo</h1>
          <p className="text-xs sm:text-sm text-[#86868b] mt-0.5">{session.course} — {session.room}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-right">
            <div className="text-[11px] text-[#86868b]">Tiempo transcurrido</div>
            <div className="font-mono text-lg text-[#0071e3] font-bold">{elapsed}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-[#86868b]">PIN activo</div>
            <div className="font-mono text-lg text-[#1d1d1f] font-bold tracking-widest">{session.pin}</div>
          </div>
          <button
            onClick={regeneratePin}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white/80 border border-black/[0.08] hover:bg-white text-[#86868b] hover:text-[#1d1d1f] transition-all active:scale-[0.98]"
            title="Renovar PIN"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => router.push('/teacher/summary')}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] active:scale-[0.98] text-white font-semibold text-xs sm:text-sm transition-all shadow-[0_6px_18px_-4px_rgba(0,113,227,0.45)]"
          >
            Cerrar clase
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total',        value: total,        icon: Users,       color: 'bg-white/80 text-[#1d1d1f]', iconColor: 'text-[#0071e3]' },
          { label: 'Presentes',    value: presentes,    icon: UserCheck,   color: 'bg-[#34c759]/10 text-[#1d1d1f]', iconColor: 'text-[#34c759]' },
          { label: 'Justificados', value: justificados, icon: ShieldCheck, color: 'bg-[#0071e3]/10 text-[#1d1d1f]', iconColor: 'text-[#0071e3]' },
          { label: 'Pendientes',   value: pendientes,   icon: Clock,       color: 'bg-[#ff9500]/10 text-[#1d1d1f]', iconColor: 'text-[#ff9500]' },
          { label: 'Ausentes',     value: ausentes,     icon: UserX,       color: 'bg-[#ff3b30]/10 text-[#1d1d1f]', iconColor: 'text-[#ff3b30]' },
        ].map(({ label, value, icon: Icon, color, iconColor }) => (
          <div key={label} className={`rounded-2xl p-4 flex items-center gap-3 backdrop-blur-2xl border border-black/[0.06] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] ${color}`}>
            <Icon className={`w-5 h-5 shrink-0 ${iconColor}`} />
            <div>
              <div className="text-xl font-bold leading-none">{value}</div>
              <div className="text-[11px] text-[#86868b] font-medium mt-1">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Progress Bar ── */}
      <div className="mb-6 bg-white/80 backdrop-blur-2xl rounded-[28px] p-5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] border border-black/[0.06]">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-[#1d1d1f] font-semibold">Asistencia registrada</span>
            {justificados > 0 && (
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#0071e3]/10 text-[#0071e3] font-semibold">
                +{justificados} Justificados (Art. 42 protegidos)
              </span>
            )}
          </div>
          <span className="text-sm text-[#0071e3] font-bold">{total > 0 ? Math.round(((presentes + justificados) / total) * 100) : 0}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-black/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#34c759] transition-all duration-500"
            style={{ width: `${total > 0 ? ((presentes + justificados) / total) * 100 : 0}%` }}
          />
        </div>
        <div className="mt-2.5 text-xs text-[#86868b] flex items-center justify-between flex-wrap gap-2">
          <span>{presentes} presentes + {justificados} justificados de {total} estudiantes</span>
          <span className="text-[11px] text-[#34c759] font-semibold">Semáforo institucional activo</span>
        </div>
      </div>

      {/* ── Filters (Segmented Control iOS) ── */}
      <div className="mb-5">
        <div className="inline-flex flex-wrap gap-1 bg-black/[0.05] p-1 rounded-xl">
          {([
            { key: 'all',         label: `Todos (${total})` },
            { key: 'presente',    label: `Presentes (${presentes})` },
            { key: 'justificado', label: `Justificados (${justificados})` },
            { key: 'pendiente',   label: `Pendientes (${pendientes})` },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] ${
                filter === key
                  ? 'bg-white text-[#1d1d1f] shadow-[0_1px_4px_rgba(0,0,0,0.08)]'
                  : 'text-[#86868b] hover:text-[#1d1d1f]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Student List ── */}
      <div className="flex flex-col gap-2.5">
        {filteredStudents.length === 0 && (
          <div className="text-center py-12 text-[#86868b] text-sm bg-white/60 rounded-[28px] border border-black/[0.06]">
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
