'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { BookOpen, Users, GraduationCap, TrendingUp, AlertTriangle, CheckCircle2, FileHeart, Database, ChevronRight } from 'lucide-react';
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
        <h1 className="text-headline-xl text-violet-700 font-bold tracking-tight mb-1">
          Dashboard General
        </h1>
        <p className="text-body-lg text-on-surface-variant">
          Resumen institucional del sistema de asistencia Aula Check — Período 2026-2
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Users,         label: 'Estudiantes',     value: totalStudents,  color: 'text-violet-600 bg-violet-50 border-violet-200' },
          { icon: BookOpen,      label: 'Asignaturas',     value: totalCourses,   color: 'text-blue-600 bg-blue-50 border-blue-200' },
          { icon: TrendingUp,    label: 'Asistencia Prom.', value: `${avgAttendance}%`, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
          { icon: GraduationCap, label: 'Sesión Activa',   value: session.isActive ? 'Sí' : 'No', color: session.isActive ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-slate-500 bg-slate-50 border-slate-200' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className={`rounded-2xl p-5 flex flex-col gap-2 border ${color}`}>
            <Icon className="w-6 h-6 opacity-70" />
            <div className="text-headline-md font-bold">{value}</div>
            <div className="text-label-sm opacity-70">{label}</div>
          </div>
        ))}
      </div>

      {/* Accesos rápidos a módulos críticos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Link
          href="/admin/incapacities"
          className="flex items-center justify-between gap-4 p-5 rounded-2xl bg-surface-container-lowest border border-amber-300 shadow-card hover:border-amber-500 transition-all"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <FileHeart className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-on-surface text-label-lg">Incapacidades</div>
              <div className="text-body-sm text-on-surface-variant">
                {pendingIncapacities > 0
                  ? `${pendingIncapacities} solicitud(es) pendiente(s) de evaluación`
                  : `${incapacities.length} solicitudes registradas en el sistema`}
              </div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-amber-700 shrink-0" />
        </Link>

        <Link
          href="/admin/database"
          className="flex items-center justify-between gap-4 p-5 rounded-2xl bg-surface-container-lowest border border-violet-300 shadow-card hover:border-violet-500 transition-all"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-violet-100 text-violet-800 flex items-center justify-center shrink-0">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-on-surface text-label-lg">Modelo de Datos / BD</div>
              <div className="text-body-sm text-on-surface-variant">
                Esquema relacional, diccionario de datos y registros sincronizados
              </div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-violet-700 shrink-0" />
        </Link>
      </div>

      {/* Semáforo de Permanencia */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-card border border-outline-variant/20 mb-8">
        <h2 className="text-headline-sm text-on-surface font-bold mb-5 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Semáforo de Permanencia Institucional
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl p-5 bg-emerald-50 border border-emerald-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-4 h-4 rounded-full bg-emerald-500" />
              <span className="text-label-lg text-emerald-700 font-bold">Verde — Estable</span>
            </div>
            <div className="text-headline-lg text-emerald-700 font-bold">{verde}</div>
            <p className="text-body-sm text-emerald-600 mt-1">Asistencia ≥ 75%</p>
            {/* Barra de proporción */}
            <div className="mt-3 h-2 bg-emerald-200 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${totalStudents > 0 ? (verde / totalStudents * 100) : 0}%` }} />
            </div>
          </div>

          <div className="rounded-xl p-5 bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-4 h-4 rounded-full bg-amber-500" />
              <span className="text-label-lg text-amber-700 font-bold">Amarillo — Alerta</span>
            </div>
            <div className="text-headline-lg text-amber-700 font-bold">{ambar}</div>
            <p className="text-body-sm text-amber-600 mt-1">Asistencia 60% – 74%</p>
            <div className="mt-3 h-2 bg-amber-200 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${totalStudents > 0 ? (ambar / totalStudents * 100) : 0}%` }} />
            </div>
          </div>

          <div className="rounded-xl p-5 bg-red-50 border border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-4 h-4 rounded-full bg-red-500" />
              <span className="text-label-lg text-red-700 font-bold">Rojo — En Riesgo</span>
            </div>
            <div className="text-headline-lg text-red-700 font-bold">{rojo}</div>
            <p className="text-body-sm text-red-600 mt-1">Asistencia &lt; 60%</p>
            <div className="mt-3 h-2 bg-red-200 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${totalStudents > 0 ? (rojo / totalStudents * 100) : 0}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Estudiantes en riesgo */}
      {rojo > 0 && (
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-card border border-red-200">
          <h2 className="text-headline-sm text-on-surface font-bold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Estudiantes en Riesgo de Pérdida de Cupo
          </h2>
          <div className="space-y-2">
            {atRiskStudents.map(({ student: s, metrics }) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-red-50 border border-red-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-red-200 flex items-center justify-center text-label-md text-red-700 font-bold">
                    {s.avatarInitials}
                  </div>
                  <div>
                    <div className="text-label-lg text-on-surface font-semibold">{s.name}</div>
                    <div className="text-body-sm text-on-surface-variant">{s.code} • {s.program}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-headline-sm text-red-600 font-bold">{metrics.percentage}%</div>
                  <div className="text-label-sm text-red-500">Asistencia</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick summary if no risk students */}
      {rojo === 0 && (
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-card border border-emerald-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
          </div>
          <div>
            <div className="text-headline-sm text-on-surface font-bold">Sin alertas críticas</div>
            <p className="text-body-sm text-on-surface-variant">Ningún estudiante se encuentra en riesgo de pérdida de cupo por inasistencia.</p>
          </div>
        </div>
      )}
    </div>
  );
}
