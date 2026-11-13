'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useIsClient } from '@/lib/use-browser-value';
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
  PanelLeftClose,
  UserX,
  Trash2,
  Wand2,
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
  const mounted = useIsClient();

  function onClose() {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const modalContent = open ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/35 backdrop-blur-md overflow-y-auto animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="institutional-help-title"
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-white/90 backdrop-blur-3xl border border-black/[0.08] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] rounded-3xl overflow-hidden animate-scale-in my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header Fijo del Modal ── */}
        <div className="shrink-0 border-b border-black/[0.06] bg-white/60">
          <div className="px-6 pt-5 pb-3.5 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[#0071e3] text-white flex items-center justify-center shadow-[0_4px_12px_-2px_rgba(0,113,227,0.4)] shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2
                  id="institutional-help-title"
                  className="text-base sm:text-lg font-bold text-[#1d1d1f] tracking-tight leading-snug"
                >
                  Guía y Documentación Institucional
                </h2>
                <p className="text-xs text-[#86868b] mt-0.5">
                  Manual operativo de roles, automatización académica y arquitectura relacional de Aula Check
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-black/[0.05] text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.08] transition-colors shrink-0"
              aria-label="Cerrar guía y documentación"
              title="Cerrar (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Selector de Pestañas (Segmented Control estilo iOS) ── */}
          <div className="px-6 pb-3.5 overflow-x-auto">
            <div
              className="inline-flex min-w-full sm:min-w-0 p-1 rounded-xl bg-black/[0.05] gap-1"
              role="tablist"
              aria-label="Secciones de la documentación institucional"
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
                    className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-white text-[#1d1d1f] shadow-[0_1px_4px_rgba(0,0,0,0.08)]'
                        : 'text-[#86868b] hover:text-[#1d1d1f]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 text-[#0071e3] shrink-0" />
                    <span className="hidden sm:inline">{label}</span>
                    <span className="sm:hidden">{shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Cuerpo con Scroll Suave ── */}
        <div className="overflow-y-auto flex-1 p-6 space-y-4 text-[#1d1d1f] text-sm">
          {activeTab === 'coordinacion' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Card 1: Sidebar Colapsable */}
                <div className="p-4 rounded-2xl border border-black/[0.06] bg-white/75 space-y-2">
                  <div className="flex items-center gap-2 text-[#1d1d1f] font-semibold text-sm">
                    <PanelLeftClose className="w-4 h-4 text-[#0071e3] shrink-0" />
                    <span>Menú Lateral Colapsable (Sidebar)</span>
                  </div>
                  <p className="text-xs text-[#86868b] leading-relaxed">
                    Navegación vertical optimizada con estado persistente en memoria local. Permite alternar entre <strong className="text-[#1d1d1f]">Modo Expandido</strong> (<code className="font-mono text-[11px] bg-black/[0.04] text-[#1d1d1f] px-1 py-0.5 rounded">w-64</code> con etiquetas y contadores) y <strong className="text-[#1d1d1f]">Modo Colapsado</strong> (<code className="font-mono text-[11px] bg-black/[0.04] text-[#1d1d1f] px-1 py-0.5 rounded">w-20</code> con íconos centrados y tooltips flotantes), maximizando el área útil para tablas y analítica.
                  </p>
                </div>

                {/* Card 2: Creación Automatizada y Anticolisión */}
                <div className="p-4 rounded-2xl border border-black/[0.06] bg-white/75 space-y-2">
                  <div className="flex items-center gap-2 text-[#1d1d1f] font-semibold text-sm">
                    <Wand2 className="w-4 h-4 text-[#0071e3] shrink-0" />
                    <span>Registro Predictivo y Control de Homónimos</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-[#86868b] list-disc pl-4 leading-relaxed">
                    <li>
                      <strong className="text-[#1d1d1f]">Correos Anticolisión:</strong> Al escribir el nombre de un estudiante o docente, genera automáticamente su correo institucional (<code className="font-mono text-[11px] text-[#1d1d1f]">nombre.apellido@universidad.edu.co</code>) y, si detecta un homónimo existente, asigna la siguiente variante libre (<code className="font-mono text-[11px] text-[#1d1d1f]">nombre.apellido2@...</code>).
                    </li>
                    <li>
                      <strong className="text-[#1d1d1f]">Códigos y Horarios:</strong> Generación automática de códigos estudiantiles (<code className="font-mono text-[11px] text-[#1d1d1f]">20262XXXX</code>), códigos de asignatura (<code className="font-mono text-[11px] text-[#1d1d1f]">EDD-301</code>) y selector interactivo de días y franjas horarias.
                    </li>
                  </ul>
                </div>

                {/* Card 3: Inhabilitación (Soft Disable) */}
                <div className="p-4 rounded-2xl border border-black/[0.06] bg-white/75 space-y-2">
                  <div className="flex items-center gap-2 text-[#1d1d1f] font-semibold text-sm">
                    <UserX className="w-4 h-4 text-[#ff9500] shrink-0" />
                    <span>Inhabilitación Institucional (Soft Disable)</span>
                  </div>
                  <p className="text-xs text-[#86868b] leading-relaxed">
                    El botón <strong className="text-[#1d1d1f]">Inhabilitar / Reactivar</strong> cambia instantáneamente el estado (<code className="font-mono text-[11px] text-[#1d1d1f]">isActive</code>) del estudiante o profesor. Una cuenta inhabilitada tiene bloqueado el inicio de sesión (<code className="font-mono text-[11px] text-[#1d1d1f]">HTTP 403</code>), pero <strong className="text-[#1d1d1f]">conserva intactas todas sus asistencias, matrículas e historial académico</strong>.
                  </p>
                </div>

                {/* Card 4: Eliminación con Doble Confirmación */}
                <div className="p-4 rounded-2xl border border-black/[0.06] bg-white/75 space-y-2">
                  <div className="flex items-center gap-2 text-[#1d1d1f] font-semibold text-sm">
                    <Trash2 className="w-4 h-4 text-[#ff3b30] shrink-0" />
                    <span>Eliminación con Doble Confirmación</span>
                  </div>
                  <p className="text-xs text-[#86868b] leading-relaxed">
                    Para prevenir borrados accidentales, la eliminación definitiva (<code className="font-mono text-[11px] text-[#1d1d1f]">DELETE</code> en Supabase) está protegida por un <strong className="text-[#1d1d1f]">Modal de Doble Confirmación</strong> que informa el impacto en cascada y exige marcar una casilla de verificación explícita antes de habilitar el borrado.
                  </p>
                </div>
              </div>

              {/* Card 5: Potestad de Reevaluación (Override) en Incapacidades */}
              <div className="p-4 rounded-2xl border border-[#0071e3]/20 bg-[#0071e3]/[0.05] flex items-start gap-3">
                <Shield className="w-5 h-5 text-[#0071e3] shrink-0 mt-0.5" />
                <div className="text-xs text-[#86868b] space-y-1 leading-relaxed">
                  <p className="font-semibold text-[#1d1d1f]">
                    Potestad de Reevaluación (Override) en Incapacidades y Auditoría de Permanencia
                  </p>
                  <p>
                    Coordinación Académica supervisa la totalidad de las incapacidades radicadas y cuenta con autoridad de <strong className="text-[#1d1d1f]">Segundo Nivel (Override)</strong> para aprobar, rechazar o rectificar cualquier solicitud por encima del dictamen inicial del docente titular, actualizando en cascada los registros de asistencia (<code className="font-mono text-[11px] text-[#1d1d1f]">JUSTIFICADO</code>) y recalculando el Semáforo de Permanencia.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'docentes' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-black/[0.06] bg-white/75 space-y-2">
                  <div className="flex items-center gap-2 text-[#1d1d1f] font-semibold text-sm">
                    <QrCode className="w-4 h-4 text-[#0071e3] shrink-0" />
                    <span>Apertura de Sesión, QR Dinámico y PIN de Respaldo</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-[#86868b] list-disc pl-4 leading-relaxed">
                    <li>
                      <strong className="text-[#1d1d1f]">Inicio de Sesión Unificado:</strong> Al ingresar con su correo docente, el sistema redirige automáticamente al panel de configuración de clase y menú lateral colapsable.
                    </li>
                    <li>
                      <strong className="text-[#1d1d1f]">Proyección QR en Tiempo Real:</strong> Genera una sesión activa en PostgreSQL/Supabase con código QR dinámico y temporizador de rotación criptográfica.
                    </li>
                    <li>
                      <strong className="text-[#1d1d1f]">PIN de 6 Dígitos de Respaldo:</strong> Proyectado junto al QR para que cualquier estudiante con restricciones de cámara pueda registrar su asistencia sin fricción.
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl border border-black/[0.06] bg-white/75 space-y-2">
                  <div className="flex items-center gap-2 text-[#1d1d1f] font-semibold text-sm">
                    <FileCheck2 className="w-4 h-4 text-[#0071e3] shrink-0" />
                    <span>Evaluación de Primer Nivel en Incapacidades</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-[#86868b] list-disc pl-4 leading-relaxed">
                    <li>
                      <strong className="text-[#1d1d1f]">Bandeja Filtrada por Asignatura:</strong> El docente visualiza exclusivamente las excusas médicas, laborales o de fuerza mayor radicadas en los cursos donde es titular.
                    </li>
                    <li>
                      <strong className="text-[#1d1d1f]">Dictamen de Primer Nivel:</strong> Permite inspeccionar el soporte adjunto y emitir la decisión (<strong className="text-[#1d1d1f]">Aprobar</strong> o <strong className="text-[#1d1d1f]">Rechazar</strong>) junto con la observación académica.
                    </li>
                    <li>
                      <strong className="text-[#1d1d1f]">Control en Vivo y Cierre:</strong> Asignación de puntos de participación, registro manual por contingencia y exportación de actas en Excel (<code className="font-mono text-[11px] text-[#1d1d1f]">.xlsx</code>).
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'estudiantes' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-black/[0.06] bg-white/75 space-y-2">
                  <div className="flex items-center gap-2 text-[#1d1d1f] font-semibold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-[#34c759] shrink-0" />
                    <span>Check-in Móvil por Escaneo QR o PIN de Sesión</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-[#86868b] list-disc pl-4 leading-relaxed">
                    <li>
                      <strong className="text-[#1d1d1f]">Validación Cruzada en la Nube:</strong> Al escanear el código QR proyectado por el docente o digitar el PIN de 6 dígitos desde el celular, el estudiante valida su asistencia directamente contra la sesión activa en Supabase.
                    </li>
                    <li>
                      <strong className="text-[#1d1d1f]">Clasificación Automática:</strong> El sistema determina si la asistencia es <em>Presente</em> o <em>Tardanza</em> según los minutos de tolerancia configurados por el profesor.
                    </li>
                    <li>
                      <strong className="text-[#1d1d1f]">Comprobante Digital:</strong> Emite un recibo único de registro con hora exacta y código de verificación.
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl border border-black/[0.06] bg-white/75 space-y-2">
                  <div className="flex items-center gap-2 text-[#1d1d1f] font-semibold text-sm">
                    <FileCheck2 className="w-4 h-4 text-[#0071e3] shrink-0" />
                    <span>Radicación de Incapacidades con Soporte Adjunto</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-[#86868b] list-disc pl-4 leading-relaxed">
                    <li>
                      <strong className="text-[#1d1d1f]">Formulario de Radicación (Art. 42):</strong> Selección de asignatura matriculada, fecha de la ausencia, categoría (<em>Médica</em>, <em>Laboral</em> o <em>Fuerza Mayor</em>) y motivo detallado.
                    </li>
                    <li>
                      <strong className="text-[#1d1d1f]">Carga de Evidencia Documental:</strong> Adjunta certificados en formato PDF, PNG o JPG con previsualización integrada.
                    </li>
                    <li>
                      <strong className="text-[#1d1d1f]">Trazabilidad en Vivo:</strong> Seguimiento del estado (<em>Pendiente</em>, <em>Aprobada</em> o <em>Rechazada</em>), nombre del evaluador y comentarios de revisión.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'arquitectura' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="p-4 rounded-2xl border border-black/[0.06] bg-white/75 space-y-2">
                  <div className="flex items-center gap-2 text-[#1d1d1f] font-semibold text-xs">
                    <Server className="w-4 h-4 text-[#0071e3] shrink-0" />
                    <span>PostgreSQL (Supabase) + Prisma ORM</span>
                  </div>
                  <p className="text-xs text-[#86868b] leading-relaxed">
                    Persistencia relacional en la nube mediante cliente global tipado (<code className="font-mono text-[11px] text-[#1d1d1f]">lib/prisma.ts</code>) y sincronización híbrida con Zustand para respuesta instantánea y tolerancia a fallos de red.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-black/[0.06] bg-white/75 space-y-2">
                  <div className="flex items-center gap-2 text-[#1d1d1f] font-semibold text-xs">
                    <Layers className="w-4 h-4 text-[#0071e3] shrink-0" />
                    <span>Esquema e Integridad Referencial</span>
                  </div>
                  <p className="text-xs text-[#86868b] leading-relaxed">
                    Entidades normalizadas con borrado en cascada (<code className="font-mono text-[11px] text-[#1d1d1f]">onDelete: Cascade</code>) y control de estado (<code className="font-mono text-[11px] text-[#1d1d1f]">isActive</code>): <code className="font-mono text-[11px] text-[#1d1d1f]">Student</code>, <code className="font-mono text-[11px] text-[#1d1d1f]">Teacher</code>, <code className="font-mono text-[11px] text-[#1d1d1f]">Coordinator</code>, <code className="font-mono text-[11px] text-[#1d1d1f]">Course</code>, <code className="font-mono text-[11px] text-[#1d1d1f]">Enrollment</code>, <code className="font-mono text-[11px] text-[#1d1d1f]">AttendanceSession</code>, <code className="font-mono text-[11px] text-[#1d1d1f]">AttendanceRecord</code> e <code className="font-mono text-[11px] text-[#1d1d1f]">Incapacity</code>.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-black/[0.06] bg-white/75 space-y-2">
                  <div className="flex items-center gap-2 text-[#1d1d1f] font-semibold text-xs">
                    <FileJson className="w-4 h-4 text-[#0071e3] shrink-0" />
                    <span>Diccionario de Datos JSON</span>
                  </div>
                  <p className="text-xs text-[#86868b] leading-relaxed">
                    El módulo <strong className="text-[#1d1d1f]">Modelo de Datos / BD</strong> (<code className="font-mono text-[11px] text-[#1d1d1f]">/admin/database</code>) permite inspeccionar llaves primarias, foráneas, cardinalidades (<code className="font-mono text-[11px] text-[#1d1d1f]">1:N</code>, <code className="font-mono text-[11px] text-[#1d1d1f]">N:M</code>) y exportar el Diccionario de Datos completo en formato JSON.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-[#0071e3]/20 bg-[#0071e3]/[0.05] space-y-2">
                <div className="flex items-center gap-2 text-[#1d1d1f] font-semibold text-xs">
                  <Shield className="w-4 h-4 text-[#0071e3] shrink-0" />
                  <span>Autenticación Híbrida (LDAP / Directorio Activo + Fallback PostgreSQL)</span>
                </div>
                <p className="text-xs text-[#86868b] leading-relaxed">
                  Cuando <code className="font-mono text-[11px] text-[#1d1d1f]">LDAP_ENABLED=&quot;true&quot;</code>, el Portal Institucional Unificado valida primero contra <strong className="text-[#1d1d1f]">OpenLDAP</strong> (<code className="font-mono text-[11px] text-[#1d1d1f]">ou=coordinacion</code>, <code className="font-mono text-[11px] text-[#1d1d1f]">ou=docentes</code>, <code className="font-mono text-[11px] text-[#1d1d1f]">ou=estudiantes</code>) con límite estricto de <strong className="text-[#1d1d1f]">3000 ms</strong> y sanitización RFC 4515. Al autenticar exitosamente, ejecuta <strong className="text-[#1d1d1f]">Just-In-Time (JIT) Provisioning</strong> en Supabase (<code className="font-mono text-[11px] text-[#1d1d1f]">upsert</code> preservando relaciones e historial); si el servidor LDAP no responde por red o CG-NAT, conmuta automáticamente al respaldo en <strong className="text-[#1d1d1f]">PostgreSQL (Supabase)</strong> sin interrumpir el servicio.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl border border-black/[0.06] bg-white/75 flex items-center gap-3 text-xs text-[#86868b]">
                <Lock className="w-4 h-4 text-[#0071e3] shrink-0" />
                <span>
                  <strong className="text-[#1d1d1f]">Seguridad Institucional:</strong> Login Único (Single Sign-On) con detección automática de rol, bloqueo inmediato de cuentas inhabilitadas (<code className="font-mono text-[11px] text-[#1d1d1f]">403 Forbidden</code>) y sesiones firmadas con cookies HTTP-only (<code className="font-mono text-[11px] text-[#1d1d1f]">HMAC-SHA256</code>).
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer Fijo ── */}
        <div className="shrink-0 px-6 py-3.5 border-t border-black/[0.06] bg-white/60 flex items-center justify-between gap-4">
          <span className="text-xs text-[#86868b] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#0071e3] shrink-0" />
            <span>Aula Check • Sistema Institucional de Control de Asistencia y Permanencia</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#006edb] active:scale-[0.98] text-white text-xs font-semibold transition-all shrink-0"
          >
            Entendido / Cerrar
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-full border border-black/[0.08] bg-white/80 hover:bg-white text-[#1d1d1f] font-medium transition-all active:scale-[0.98] ${
          compact ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-xs'
        }`}
        title="Guía y Documentación Institucional"
      >
        <HelpCircle className="w-3.5 h-3.5 text-[#0071e3] shrink-0" />
        <span className={compact ? 'sr-only sm:not-sr-only whitespace-nowrap' : 'whitespace-nowrap'}>
          Guía y Documentación
        </span>
      </button>

      {mounted && modalContent ? createPortal(modalContent, document.body) : null}
    </>
  );
}
