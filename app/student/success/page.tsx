'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock, MapPin, User, Shield, ChevronRight, Star, TrendingUp, AlertTriangle } from 'lucide-react';
import { useAulaCheckStore } from '@/lib/store';
import { getSemaforoLevel, getSemaforoLabel, formatTime, formatDate } from '@/lib/utils';

// ─── Semáforo Widget ──────────────────────────────────────────────────────────

function SemaforoWidget({ attendanceRate }: { attendanceRate: number }) {
  const level      = getSemaforoLevel(attendanceRate);
  const label      = getSemaforoLabel(level);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 300);
    return () => clearTimeout(t);
  }, []);

  const bars = [
    { threshold: 75, label: '75%', level: 'verde',  color: 'bg-emerald-500', glow: 'shadow-[0_0_16px_rgba(16,185,129,0.5)]' },
    { threshold: 60, label: '60%', level: 'ambar',  color: 'bg-amber-500',   glow: 'shadow-[0_0_16px_rgba(245,158,11,0.5)]' },
    { threshold: 0,  label: '<60%',level: 'rojo',   color: 'bg-red-500',     glow: 'shadow-[0_0_16px_rgba(239,68,68,0.5)]'  },
  ];

  const levelConfig = {
    verde: { bg: 'bg-[#34c759]/[0.08]', border: 'border-[#34c759]/25', title: 'text-[#248a3d]' },
    ambar: { bg: 'bg-[#ff9500]/[0.08]', border: 'border-[#ff9500]/25', title: 'text-[#b64400]' },
    rojo:  { bg: 'bg-[#ff3b30]/[0.08]', border: 'border-[#ff3b30]/25', title: 'text-[#c42b22]' },
  }[level];

  return (
    <div className={`rounded-[28px] p-5 border backdrop-blur-2xl ${levelConfig.bg} ${levelConfig.border}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[11px] text-[#86868b] font-semibold uppercase tracking-wider mb-1">Semáforo de Permanencia</div>
          <div className={`text-base font-bold ${levelConfig.title}`}>{label}</div>
        </div>
        <div className={`text-3xl font-bold tracking-tight ${levelConfig.title}`}>{attendanceRate}%</div>
      </div>

      {/* Traffic light */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex flex-col gap-2">
          {bars.map(({ level: bLevel, color, glow }) => (
            <div
              key={bLevel}
              className={`w-7 h-7 rounded-full transition-all duration-700 ${
                level === bLevel && animated ? `${color} ${glow} scale-110` : 'bg-black/[0.08] opacity-40'
              }`}
            />
          ))}
        </div>

        <div className="flex-1">
          {/* Progress bar */}
          <div className="h-2.5 rounded-full bg-black/[0.06] overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                level === 'verde' ? 'bg-[#34c759]' : level === 'ambar' ? 'bg-[#ff9500]' : 'bg-[#ff3b30]'
              }`}
              style={{ width: animated ? `${attendanceRate}%` : '0%' }}
            />
          </div>
          <div className="flex justify-between text-[11px] font-medium text-[#86868b]">
            <span>0%</span>
            <span className="text-[#ff3b30]">60%</span>
            <span className="text-[#ff9500]">75%</span>
            <span className="text-[#34c759]">100%</span>
          </div>
        </div>
      </div>

      {/* Thresholds legend */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {bars.map(({ label: bLabel, color }) => (
          <div key={bLabel} className="flex flex-col items-center gap-1">
            <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
            <span className="text-[11px] text-[#86868b]">{bLabel}</span>
          </div>
        ))}
      </div>

      {/* Action hint */}
      {level !== 'verde' && (
        <div className="mt-4 flex items-start gap-2 p-3 rounded-2xl bg-white/75 border border-black/[0.05]">
          <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${levelConfig.title}`} />
          <p className="text-xs text-[#1d1d1f] leading-relaxed">
            {level === 'ambar'
              ? 'Estás cerca del límite de inasistencias. Asiste con regularidad para mantener tu cupo.'
              : 'Tu porcentaje de asistencia está por debajo del mínimo requerido. Consulta con coordinación académica.'}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Success Page ─────────────────────────────────────────────────────────────

export default function SuccessPage() {
  const router     = useRouter();
  const lastCheckIn = useAulaCheckStore((s) => s.lastCheckIn);
  const session     = useAulaCheckStore((s) => s.session);
  const student    = lastCheckIn.student;

  // Redirect if no successful check-in
  useEffect(() => {
    if (!lastCheckIn.result || lastCheckIn.result !== 'success') {
      router.replace('/student/check-in');
    }
  }, [lastCheckIn, router]);

  if (!student) return null;

  const now = new Date();

  return (
    <div className="flex flex-col gap-5 py-6 animate-fade-in">

      {/* ── Success Banner ── */}
      <section className="flex flex-col items-center text-center pt-4 pb-2">
        {/* Animated checkmark */}
        <div className="relative flex items-center justify-center mb-4">
          <div className="absolute w-28 h-28 rounded-full bg-[#34c759]/20 animate-ping opacity-30" />
          <div className="absolute w-24 h-24 rounded-full bg-[#34c759]/10" />
          <div className="relative w-20 h-20 rounded-full bg-[#34c759] flex items-center justify-center shadow-[0_12px_28px_-6px_rgba(52,199,89,0.5)] animate-success-pop">
            <CheckCircle2 className="w-11 h-11 text-white" style={{ strokeWidth: 2.5 }} />
          </div>
          {/* Badge */}
          <div className="absolute -top-1 -right-2 bg-white rounded-full px-2.5 py-0.5 flex items-center gap-1 shadow-sm border border-black/[0.06]">
            <Shield className="w-3 h-3 text-[#34c759]" />
            <span className="text-[11px] text-[#248a3d] font-bold">Verificado</span>
          </div>
        </div>

        <h1 className="text-2xl text-[#1d1d1f] font-bold tracking-tight mb-1">
          ¡Asistencia Confirmada!
        </h1>
        <p className="text-xs sm:text-sm text-[#86868b] max-w-xs">
          Tu presencia fue registrada exitosamente en el servidor universitario.
        </p>
      </section>

      {/* ── Comprobante Oficial (Apple Wallet Card) ── */}
      <div className="bg-white/85 backdrop-blur-2xl rounded-[28px] shadow-[0_8px_30px_-6px_rgba(0,0,0,0.06)] overflow-hidden border border-black/[0.06]">
        {/* Accent bar */}
        <div className="h-1.5 w-full bg-[#0071e3]" />
        <div className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 px-3.5 py-2.5 bg-black/[0.03] rounded-2xl border border-black/[0.04]">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#0071e3]" />
              <span className="text-[11px] text-[#0071e3] font-bold uppercase tracking-widest">Comprobante Oficial</span>
            </div>
            <span className="text-[11px] font-mono text-[#1d1d1f] bg-white px-2.5 py-0.5 rounded-full border border-black/[0.06]">
              {lastCheckIn.receiptId}
            </span>
          </div>

          {/* Subject */}
          <div className="mb-4">
            <span className="text-[11px] text-[#86868b] font-semibold uppercase tracking-wider block mb-0.5">Asignatura</span>
            <h2 className="text-base text-[#1d1d1f] font-bold tracking-tight">{session.course} ({session.courseCode})</h2>
          </div>

          {/* Grid info */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { icon: User,         label: 'Estudiante',  value: student.name },
              { icon: Shield,       label: 'ID / Código', value: student.code },
              { icon: Clock,        label: 'Hora',        value: formatTime(student.checkinTime || now) },
              { icon: CheckCircle2, label: 'Estado',      value: student.status === 'presente' ? 'Presente' : 'Tardanza' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-black/[0.03] rounded-2xl p-3 border border-black/[0.04]">
                <div className="flex items-center gap-1 text-[11px] text-[#86868b] mb-0.5">
                  <Icon className="w-3 h-3 text-[#0071e3]" />{label}
                </div>
                <div className="text-xs text-[#1d1d1f] font-semibold truncate">{value}</div>
              </div>
            ))}
          </div>

          {/* Date */}
          <div className="flex items-center justify-between pt-3 border-t border-black/[0.06]">
            <span className="text-xs text-[#86868b]">Fecha de registro</span>
            <span className="text-xs text-[#1d1d1f] font-semibold">{formatDate(now)}</span>
          </div>
        </div>
      </div>

      {/* ── Semáforo de Permanencia ── */}
      <SemaforoWidget attendanceRate={student.attendanceRate} />

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: TrendingUp, label: 'Asistencia acumulada', value: `${student.attendanceRate}%`, color: 'text-[#0071e3]' },
          { icon: Star,       label: 'Puntos de participación', value: student.points.toString(), color: 'text-[#ff9500]' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white/80 backdrop-blur-2xl rounded-2xl p-4 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] border border-black/[0.06]">
            <Icon className={`w-5 h-5 ${color} mb-2`} />
            <div className={`text-2xl font-bold tracking-tight ${color}`}>{value}</div>
            <div className="text-[11px] font-medium text-[#86868b] mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* ── CTA ── */}
      <button
        onClick={() => router.push('/')}
        className="w-full h-11 rounded-full bg-black/[0.05] hover:bg-black/[0.08] active:scale-[0.98] text-[#1d1d1f] font-semibold text-sm flex items-center justify-center gap-2 transition-all"
      >
        Volver al inicio
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
