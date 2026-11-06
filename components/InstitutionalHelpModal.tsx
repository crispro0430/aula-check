'use client';

import { useState, useEffect } from 'react';
import {
  HelpCircle,
  BookOpen,
  X,
  Shield,
  GraduationCap,
  Users,
  Database,
  QrCode,
  FileCheck2,
  CheckCircle2,
  Lock,
  Layers,
  Server,
  FileJson,
  Sparkles,
} from 'lucide-react';

type TabKey = 'coordinacion' | 'docentes' | 'estudiantes' | 'arquitectura';

interface HelpTab {
  key: TabKey;
  label: string;
  shortLabel: string;
  icon: typeof Shield;
}

const TABS: HelpTab[] = [
  {
    key: 'coordinacion',
    label: 'Coordinación (Superadmin)',
    shortLabel: 'Coordinación',
    icon: Shield,
  },
  {
    key: 'docentes',
    label: 'Docentes',
    shortLabel: 'Docentes',
    icon: Users,
  },
  {
    key: 'estudiantes',
    label: 'Estudiantes',
    shortLabel: 'Estudiantes',
    icon: GraduationCap,
  },
  {
    key: 'arquitectura',
    label: 'Arquitectura & BD',
    shortLabel: 'Arquitectura & BD',
    icon: Database,
  },
];

export default function InstitutionalHelpButton({
  compact = false,
  defaultTab = 'coordinacion',
}: {
  compact?: boolean;
  defaultTab?: TabKey;
}) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-950 font-medium transition-all shadow-2xs ${
          compact ? 'h-8 px-2.5 text-xs' : 'h-9 px-3 text-xs sm:text-sm'
        }`}
        title="Guía y Documentación Institucional"
      >
        <HelpCircle className="w-4 h-4 text-indigo-600 shrink-0" />
        <span className={compact ? 'sr-only sm:not-sr-only' : 'hidden md:inline'}>
          Guía y Documentación
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-950/40 backdrop-blur-xs animate-fade-in"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="institutional-help-title"
        >
          <div
            className="w-full max-w-3xl bg-white rounded-2xl border border-slate-200/90 shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h2
                    id="institutional-help-title"
                    className="text-base font-semibold text-slate-900 tracking-tight leading-snug"
                  >
                    Guía y Documentación Institucional
                  </h2>
                  <p className="text-xs text-slate-500">
                    Manual operativo y arquitectura técnica de Aula Check
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Cerrar guía"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ── Segmented Tabs (Apple / Vercel Style) ── */}
            <div className="px-6 pt-3 pb-2 border-b border-slate-100 bg-white overflow-x-auto">
              <div
                className="inline-flex min-w-full sm:min-w-0 p-1 rounded-xl bg-slate-100/80 border border-slate-200/60 gap-1"
                role="tablist"
              >
                {TABS.map(({ key, label, shortLabel, icon: Icon }) => {
                  const isActive = activeTab === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveTab(key)}
                      className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                        isActive
                          ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span className="hidden sm:inline">{label}</span>
                      <span className="sm:hidden">{shortLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Body ── */}
            <div className="p-6 overflow-y-auto space-y-4 bg-white text-slate-700 text-sm">
              {activeTab === 'coordinacion' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 space-y-2">
                      <div className="flex items-center gap-2 text-slate-900 font-semibold">
                        <Users className="w-4 h-4 text-indigo-600" />
                        <span>Gestión de Usuarios y Catálogo</span>
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-600 list-disc pl-4">
                        <li>
                          Alta de <strong>Estudiantes</strong> y <strong>Docentes</strong> con asignación de correo institucional y contraseña inicial.
                        </li>
                        <li>
                          Creación de <strong>Asignaturas</strong>, definición de horarios, aulas y vinculación del profesor titular.
                        </li>
                        <li>
                          Matrícula directa de estudiantes por grupo con actualización inmediata de cupos.
                        </li>
                      </ul>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 space-y-2">
                      <div className="flex items-center gap-2 text-slate-900 font-semibold">
                        <Shield className="w-4 h-4 text-indigo-600" />
                        <span>Auditoría y Override de Incapacidades</span>
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-600 list-disc pl-4">
                        <li>
                          Supervisión consolidada de todas las solicitudes médicas y laborales de la institución.
                        </li>
                        <li>
                          Potestad de <strong>Reevaluación (Override)</strong> para aprobar o rechazar solicitudes por encima del dictamen inicial.
                        </li>
                        <li>
                          Ajuste automático del registro en base de datos y recálculo inmediato del Semáforo de Permanencia.
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 flex items-start gap-3">
                    <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-slate-600 space-y-1">
                      <p className="font-semibold text-slate-900">
                         Monitoreo de Permanencia Estudiantil
                      </p>
                      <p>
                        El directorio clasifica automáticamente a los alumnos en estado Estable (≥75%), Alerta (60%–74%) o Riesgo (&lt;60%) y permite exportar expedientes individuales en formato Excel oficial.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'docentes' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 space-y-2">
                      <div className="flex items-center gap-2 text-slate-900 font-semibold">
                        <QrCode className="w-4 h-4 text-indigo-600" />
                        <span>Apertura y Proyección Dinámica</span>
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-600 list-disc pl-4">
                        <li>
                          Configura la asignatura, el margen de tolerancia y el tema de la sesión antes de proyectar.
                        </li>
                        <li>
                          El código QR y el PIN de 6 dígitos se sincronizan en tiempo real con Supabase y se renuevan periódicamente.
                        </li>
                        <li>
                          El PIN en pantalla sirve como respaldo inmediato para alumnos con inconvenientes de cámara.
                        </li>
                      </ul>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 space-y-2">
                      <div className="flex items-center gap-2 text-slate-900 font-semibold">
                        <FileCheck2 className="w-4 h-4 text-indigo-600" />
                        <span>Incapacidades y Cierre de Clase</span>
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-600 list-disc pl-4">
                        <li>
                          Bandeja filtrada estrictamente por las asignaturas a cargo del docente autenticado.
                        </li>
                        <li>
                          Revisión de soportes adjuntos y aprobación o rechazo directo con observación académica.
                        </li>
                        <li>
                          Registro de puntos de participación en vivo, validación por contingencia y descarga de acta en Excel.
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'estudiantes' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 space-y-2">
                      <div className="flex items-center gap-2 text-slate-900 font-semibold">
                        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                        <span>Registro de Asistencia (QR / PIN)</span>
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-600 list-disc pl-4">
                        <li>
                          Escanea el código QR proyectado en el aula desde tu dispositivo móvil o ingresa el PIN de 6 dígitos.
                        </li>
                        <li>
                          Recibe al instante tu comprobante digital verificado y consulta tu porcentaje en el Semáforo de Permanencia.
                        </li>
                      </ul>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 space-y-2">
                      <div className="flex items-center gap-2 text-slate-900 font-semibold">
                        <FileCheck2 className="w-4 h-4 text-indigo-600" />
                        <span>Radicación de Incapacidades</span>
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-600 list-disc pl-4">
                        <li>
                          Selecciona la asignatura, la fecha de la inasistencia, el tipo de excusa y adjunta el soporte en PDF, PNG o JPG.
                        </li>
                        <li>
                          Consulta en tiempo real el estado de cada solicitud (Pendiente, Aprobada o Rechazada) y los comentarios del revisor.
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'arquitectura' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 space-y-1.5">
                      <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs">
                        <Server className="w-4 h-4 text-indigo-600" />
                        <span>Motor Relacional</span>
                      </div>
                      <p className="text-xs text-slate-600">
                        PostgreSQL alojado en Supabase gestionado mediante Prisma ORM con conexión tipada y singleton en servidor.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 space-y-1.5">
                      <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs">
                        <Layers className="w-4 h-4 text-indigo-600" />
                        <span>Integridad Referencial</span>
                      </div>
                      <p className="text-xs text-slate-600">
                        Siete entidades normalizadas: <code className="font-mono text-[11px]">Student</code>, <code className="font-mono text-[11px]">Teacher</code>, <code className="font-mono text-[11px]">Coordinator</code>, <code className="font-mono text-[11px]">Course</code>, <code className="font-mono text-[11px]">Enrollment</code>, <code className="font-mono text-[11px]">AttendanceSession</code>, <code className="font-mono text-[11px]">AttendanceRecord</code> e <code className="font-mono text-[11px]">Incapacity</code>.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 space-y-1.5">
                      <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs">
                        <FileJson className="w-4 h-4 text-indigo-600" />
                        <span>Diccionario de Datos</span>
                      </div>
                      <p className="text-xs text-slate-600">
                        Exportación directa del esquema y métricas de tablas en formato JSON o vista de impresión desde el módulo de Base de Datos.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/40 flex items-center justify-between gap-3 text-xs text-slate-600">
                    <span className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>
                        Autenticación unificada mediante cookies HTTP-only firmadas con HMAC-SHA256 y detección automática de rol.
                      </span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs text-slate-500">
              <span>Aula Check • Sistema Institucional de Asistencia</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

