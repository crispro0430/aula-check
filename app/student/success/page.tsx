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
    verde: { bg: 'bg-emerald-50', border: 'border-emerald-200', title: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
    ambar: { bg: 'bg-amber-50',   border: 'border-amber-200',   title: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700'     },
    rojo:  { bg: 'bg-red-50',     border: 'border-red-200',     title: 'text-red-700',     badge: 'bg-red-100 text-red-700'         },
  }[level];

  return (
    <div className={`rounded-2xl p-5 border ${levelConfig.bg} ${levelConfig.border}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-1">Semáforo de Permanencia</div>
          <div className={`text-headline-sm font-bold ${levelConfig.title}`}>{label}</div>
        </div>
        <div className={`text-headline-xl font-bold ${levelConfig.title}`}>{attendanceRate}%</div>
      </div>

      {/* Traffic light */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex flex-col gap-2">
          {bars.map(({ level: bLevel, color, glow }) => (
            <div
              key={bLevel}
              className={`w-8 h-8 rounded-full transition-all duration-700 ${
                level === bLevel && animated ? `${color} ${glow} scale-110` : 'bg-surface-container opacity-40'
              }`}
            />
          ))}
        </div>

        <div className="flex-1">
          {/* Progress bar */}
          <div className="h-3 rounded-full bg-surface-container overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                level === 'verde' ? 'bg-emerald-500' : level === 'ambar' ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: animated ? `${attendanceRate}%` : '0%' }}
            />
          </div>
          <div className="flex justify-between text-label-sm text-on-surface-variant">
            <span>0%</span>
            <span className="text-red-500">60%</span>
            <span className="text-amber-500">75%</span>
            <span className="text-emerald-500">100%</span>
          </div>
        </div>
      </div>

      {/* Thresholds legend */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {bars.map(({ label: bLabel, color }) => (
          <div key={bLabel} className="flex flex-col items-center gap-1">
            <div className={`w-3 h-3 rounded-full ${color}`} />
            <span className="text-label-sm text-on-surface-variant">{bLabel}</span>
          </div>
        ))}
      </div>

      {/* Action hint */}
      {level !== 'verde' && (
        <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-white/60">
          <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${levelConfig.title}`} />
          <p className="text-body-sm text-on-surface-variant">
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
          <div className="absolute w-28 h-28 rounded-full bg-emerald-100 animate-ping opacity-30" />
          <div className="absolute w-24 h-24 rounded-full bg-emerald-50" />
          <div className="relative w-20 h-20 rounded-full bg-secondary flex items-center justify-center shadow-lg shadow-secondary/30 animate-success-pop">
            <CheckCircle2 className="w-11 h-11 text-white" style={{ strokeWidth: 2.5 }} />
          </div>
          {/* Badge */}
          <div className="absolute -top-1 -right-1 bg-white rounded-full px-2 py-0.5 flex items-center gap-1 shadow-card">
            <Shield className="w-3 h-3 text-secondary" />
            <span className="text-label-sm text-secondary font-bold">Verificado</span>
          </div>
        </div>

        <h1 className="text-headline-lg-mobile text-on-surface font-bold tracking-tight mb-1">
          ¡Asistencia Confirmada!
        </h1>
        <p className="text-body-md text-on-surface-variant max-w-xs">
          Tu presencia fue registrada exitosamente en el servidor universitario.
        </p>
      </section>

      {/* ── Comprobante Oficial ── */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-card overflow-hidden border border-outline-variant/20">
        {/* Accent bar */}
        <div className="h-2 w-full bg-primary-container" />
        <div className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 px-3 py-2 bg-surface-container-low rounded-xl">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-label-md text-primary font-bold uppercase tracking-widest">Comprobante Oficial</span>
            </div>
            <span className="text-label-sm font-mono text-on-surface-variant bg-white px-2 py-0.5 rounded-lg shadow-card">
              {lastCheckIn.receiptId}
            </span>
          </div>

          {/* Subject */}
          <div className="mb-4">
            <span className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-0.5">Asignatura</span>
            <h2 className="text-headline-sm text-on-surface font-bold">{session.course} ({session.courseCode})</h2>
          </div>

          {/* Grid info */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { icon: User,         label: 'Estudiante',  value: student.name },
              { icon: Shield,       label: 'ID / Código', value: student.code },
              { icon: Clock,        label: 'Hora',        value: formatTime(student.checkinTime || now) },
              { icon: CheckCircle2, label: 'Estado',      value: student.status === 'presente' ? 'Presente' : 'Tardanza' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-surface-container-low/60 rounded-xl p-3">
                <div className="flex items-center gap-1 text-label-sm text-on-surface-variant mb-0.5">
                  <Icon className="w-3 h-3" />{label}
                </div>
                <div className="text-body-md text-on-surface font-semibold truncate">{value}</div>
              </div>
            ))}
          </div>

          {/* Date */}
          <div className="flex items-center justify-between pt-3 border-t border-outline-variant/20">
            <span className="text-label-sm text-on-surface-variant">Fecha de registro</span>
            <span className="text-label-md text-on-surface font-semibold">{formatDate(now)}</span>
          </div>
        </div>
      </div>

      {/* ── Semáforo de Permanencia ── */}
      <SemaforoWidget attendanceRate={student.attendanceRate} />

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: TrendingUp, label: 'Asistencia acumulada', value: `${student.attendanceRate}%`, color: 'text-primary' },
          { icon: Star,       label: 'Puntos de participación', value: student.points.toString(), color: 'text-amber-600' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-surface-container-lowest rounded-xl p-4 shadow-card border border-outline-variant/20">
            <Icon className={`w-5 h-5 ${color} mb-2`} />
            <div className={`text-headline-md font-bold ${color}`}>{value}</div>
            <div className="text-label-sm text-on-surface-variant">{label}</div>
          </div>
        ))}
      </div>

      {/* ── CTA ── */}
      <button
        onClick={() => router.push('/')}
        className="w-full h-12 rounded-xl bg-surface-container text-on-surface font-semibold text-label-lg flex items-center justify-center gap-2 hover:bg-surface-container-high transition-colors"
      >
        Volver al inicio
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
