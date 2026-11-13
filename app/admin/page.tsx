'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Users,
  GraduationCap,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  FileHeart,
  Database,
  ChevronRight,
} from 'lucide-react';
import { useAulaCheckStore } from '@/lib/store';
import { computeStudentMetrics } from '@/lib/student-history';

export default function AdminDashboard() {
  const students     = useAulaCheckStore((s) => s.students);
  const courses      = useAulaCheckStore((s) => s.courses);
  const session      = useAulaCheckStore((s) => s.session);
  const incapacities = useAulaCheckStore((s) => s.incapacities);
  const pendingIncapacities = incapacities.filter((i) => i.status === 'Pendiente').length;

  const studentsMetrics = useMemo(() => {
    return students.map((s) => ({
      student: s,
      metrics: computeStudentMetrics(s),
    }));
  }, [students]);

  const totalStudents = studentsMetrics.length;
  const totalCourses  = courses.length;
  const avgAttendance = totalStudents > 0
    ? (studentsMetrics.reduce((acc, sm) => acc + sm.metrics.percentage, 0) / totalStudents).toFixed(1)
    : '0.0';

  const verde  = studentsMetrics.filter((sm) => sm.metrics.level === 'verde').length;
  const ambar  = studentsMetrics.filter((sm) => sm.metrics.level === 'ambar').length;
  const rojo   = studentsMetrics.filter((sm) => sm.metrics.level === 'rojo').length;
  const atRiskStudents = studentsMetrics.filter((sm) => sm.metrics.level === 'rojo');

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#0071e3]/10 text-[#0071e3] text-[11px] font-semibold uppercase tracking-wider mb-2">
          Supervisión Académica
        </span>
        <h1 className="text-2xl sm:text-3xl text-[#1d1d1f] font-bold tracking-tight">
          Dashboard General
        </h1>
        <p className="text-sm text-[#6e6e73] mt-1">
          Resumen institucional del sistema de asistencia Aula Check — Período 2026-2
        </p>
      </div>

      {/* Stats Cards (Liquid Glass) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          {
            icon: Users,
            label: 'Estudiantes',
            value: totalStudents,
            iconBg: 'bg-[#0071e3]/10 text-[#0071e3]',
          },
          {
            icon: BookOpen,
            label: 'Asignaturas',
            value: totalCourses,
            iconBg: 'bg-[#0071e3]/10 text-[#0071e3]',
          },
          {
            icon: TrendingUp,
            label: 'Asistencia Prom.',
            value: `${avgAttendance}%`,
            iconBg: 'bg-[#34c759]/12 text-[#248a3d]',
          },
          {
            icon: GraduationCap,
            label: 'Sesión Activa',
            value: session.isActive ? 'Sí' : 'No',
            iconBg: session.isActive
              ? 'bg-[#34c759]/12 text-[#248a3d]'
              : 'bg-black/[0.05] text-[#6e6e73]',
          },
        ].map(({ icon: Icon, label, value, iconBg }) => (
          <div
            key={label}
            className="bg-white/75 backdrop-blur-2xl border border-black/[0.06] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] rounded-2xl p-5 flex flex-col gap-2.5"
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold text-[#1d1d1f] tracking-tight">{value}</div>
            <div className="text-xs font-medium text-[#6e6e73]">{label}</div>
          </div>
        ))}
      </div>

      {/* Accesos rápidos a módulos críticos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Link
          href="/admin/incapacities"
          className="flex items-center justify-between gap-4 p-5 bg-white/75 backdrop-blur-2xl border border-black/[0.06] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] rounded-2xl hover:bg-white transition-all group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#ff9500]/12 text-[#c93400] flex items-center justify-center shrink-0">
              <FileHeart className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-[#1d1d1f] text-sm">Incapacidades</div>
              <div className="text-xs text-[#6e6e73] mt-0.5">
                {pendingIncapacities > 0
                  ? `${pendingIncapacities} solicitud(es) pendiente(s) de evaluación`
                  : `${incapacities.length} solicitudes registradas en el sistema`}
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#6e6e73] group-hover:text-[#0071e3] group-hover:translate-x-0.5 transition-all shrink-0" />
        </Link>

        <Link
          href="/admin/database"
          className="flex items-center justify-between gap-4 p-5 bg-white/75 backdrop-blur-2xl border border-black/[0.06] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] rounded-2xl hover:bg-white transition-all group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-[#1d1d1f] text-sm">Modelo de Datos / BD</div>
              <div className="text-xs text-[#6e6e73] mt-0.5">
                Esquema relacional, diccionario de datos y registros sincronizados
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#6e6e73] group-hover:text-[#0071e3] group-hover:translate-x-0.5 transition-all shrink-0" />
        </Link>
      </div>

      {/* Semáforo de Permanencia */}
      <div className="bg-white/75 backdrop-blur-2xl border border-black/[0.06] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] rounded-2xl p-6 mb-8">
        <h2 className="text-base text-[#1d1d1f] font-bold tracking-tight mb-5 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[#c93400]" />
          Semáforo de Permanencia Institucional
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl p-5 bg-[#34c759]/[0.06] border border-[#34c759]/20">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-3 h-3 rounded-full bg-[#34c759]" />
              <span className="text-xs text-[#1d1d1f] font-semibold">Verde — Estable</span>
            </div>
            <div className="text-2xl text-[#1d1d1f] font-bold">{verde}</div>
            <p className="text-xs text-[#6e6e73] mt-1">Asistencia ≥ 75%</p>
            <div className="mt-3 h-1.5 bg-black/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#34c759] rounded-full transition-all"
                style={{ width: `${totalStudents > 0 ? (verde / totalStudents) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="rounded-2xl p-5 bg-[#ff9500]/[0.06] border border-[#ff9500]/20">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-3 h-3 rounded-full bg-[#ff9500]" />
              <span className="text-xs text-[#1d1d1f] font-semibold">Amarillo — Alerta</span>
            </div>
            <div className="text-2xl text-[#1d1d1f] font-bold">{ambar}</div>
            <p className="text-xs text-[#6e6e73] mt-1">Asistencia 60% – 74%</p>
            <div className="mt-3 h-1.5 bg-black/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#ff9500] rounded-full transition-all"
                style={{ width: `${totalStudents > 0 ? (ambar / totalStudents) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="rounded-2xl p-5 bg-[#ff3b30]/[0.06] border border-[#ff3b30]/20">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-3 h-3 rounded-full bg-[#ff3b30]" />
              <span className="text-xs text-[#1d1d1f] font-semibold">Rojo — En Riesgo</span>
            </div>
            <div className="text-2xl text-[#1d1d1f] font-bold">{rojo}</div>
            <p className="text-xs text-[#6e6e73] mt-1">Asistencia &lt; 60%</p>
            <div className="mt-3 h-1.5 bg-black/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#ff3b30] rounded-full transition-all"
                style={{ width: `${totalStudents > 0 ? (rojo / totalStudents) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Estudiantes en riesgo */}
      {rojo > 0 ? (
        <div className="bg-white/75 backdrop-blur-2xl border border-black/[0.06] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] rounded-2xl p-6">
          <h2 className="text-base text-[#1d1d1f] font-bold tracking-tight mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#d70015]" />
            Estudiantes en Riesgo de Pérdida de Cupo
          </h2>
          <div className="space-y-2.5">
            {atRiskStudents.map(({ student: s, metrics }) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-[#ff3b30]/[0.05] border border-[#ff3b30]/15"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#ff3b30]/15 flex items-center justify-center text-xs text-[#d70015] font-bold">
                    {s.avatarInitials}
                  </div>
                  <div>
                    <div className="text-sm text-[#1d1d1f] font-semibold">{s.name}</div>
                    <div className="text-xs text-[#6e6e73]">
                      {s.code} • {s.program}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base text-[#d70015] font-bold">{metrics.percentage}%</div>
                  <div className="text-[11px] text-[#6e6e73]">Asistencia</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white/75 backdrop-blur-2xl border border-black/[0.06] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] rounded-2xl p-6 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-[#34c759]/12 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-[#248a3d]" />
          </div>
          <div>
            <div className="text-sm text-[#1d1d1f] font-bold">Sin alertas críticas</div>
            <p className="text-xs text-[#6e6e73]">
              Ningún estudiante se encuentra en riesgo de pérdida de cupo por inasistencia.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
