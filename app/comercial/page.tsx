'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  CheckCircle2, Clock, ShieldCheck, TrendingUp, Building2, Presentation, GraduationCap,
  ArrowRight, X, QrCode, KeyRound, Palette, Sparkles, Send, PlayCircle, BarChart3, FileHeart,
} from 'lucide-react';

// ─── Datos de la landing ─────────────────────────────────────────────────────

const VALUE_PROPS = [
  {
    icon: Clock,
    metric: 'Hasta 15 min',
    title: 'ahorrados por clase',
    text: 'El llamado a lista en papel desaparece: los estudiantes registran su asistencia con QR o PIN en segundos mientras el docente inicia la clase.',
  },
  {
    icon: ShieldCheck,
    metric: '0 firmas falsas',
    title: 'fraude eliminado',
    text: 'Token dinámico rotativo cada 30 s, validación de presencia en el aula y trazabilidad completa de cada registro con comprobante digital.',
  },
  {
    icon: TrendingUp,
    metric: 'Alerta temprana',
    title: 'contra la deserción',
    text: 'El Semáforo de Permanencia (verde / ámbar / rojo) identifica a los estudiantes en riesgo antes de que pierdan el cupo.',
  },
] as const;

const AUDIENCES = [
  {
    icon: Building2,
    who: 'Rectorías y Coordinación Académica',
    pitch: 'Retención y auditoría',
    accentBg: 'bg-[#0071e3]/10 text-[#0071e3]',
    bullets: [
      'Dashboard institucional de asistencia en tiempo real',
      'Semáforo de Permanencia para planes de retención',
      'Expedientes auditables y exportables (Excel)',
      'Modelo de datos relacional sobre PostgreSQL',
    ],
  },
  {
    icon: Presentation,
    who: 'Docentes',
    pitch: 'Agilidad en el aula',
    accentBg: 'bg-[#5856d6]/10 text-[#5856d6]',
    bullets: [
      'Apertura de sesión en 3 clics con QR proyectable',
      'Monitoreo en vivo y puntos de participación',
      'Validación manual de contingencia',
      'Bandeja de incapacidades con aprobación en 1 clic',
    ],
  },
  {
    icon: GraduationCap,
    who: 'Estudiantes',
    pitch: 'Transparencia y autogestión',
    accentBg: 'bg-[#34c759]/12 text-[#248a3d]',
    bullets: [
      'Registro desde el celular sin instalar apps',
      'Comprobante digital de cada asistencia',
      'Radicación de incapacidades con soporte adjunto',
      'Estado de solicitudes y semáforo en tiempo real',
    ],
  },
] as const;

const FEEDBACK_IMPROVEMENTS = [
  {
    icon: QrCode,
    title: 'Tiempo de QR ampliado + PIN manual de respaldo',
    before: 'El QR expiraba demasiado rápido y, si la cámara del celular fallaba, el estudiante quedaba sin registro.',
    after: 'Ventana de escaneo ampliada con tolerancia configurable y PIN de 6 dígitos como respaldo cuando falla la cámara.',
  },
  {
    icon: KeyRound,
    title: 'Validación de presencia con token dinámico rotativo',
    before: 'Un código estático podía compartirse por WhatsApp y registrar asistencia desde fuera del aula.',
    after: 'Token que rota automáticamente cada 30 segundos y solo es visible en el proyector del salón.',
  },
  {
    icon: Palette,
    title: 'Nueva paleta de alto contraste institucional',
    before: 'Colores de bajo contraste difíciles de leer en proyectores y a plena luz del día.',
    after: 'Paleta institucional de alto contraste (WCAG AA) con estados de color + ícono + texto.',
  },
] as const;

// ─── Modal de contacto comercial ─────────────────────────────────────────────

interface DemoRequest {
  name: string;
  institution: string;
  role: string;
  email: string;
  students: string;
  message: string;
}

const EMPTY_REQUEST: DemoRequest = { name: '', institution: '', role: 'Rectoría', email: '', students: '1.000 - 5.000', message: '' };

function DemoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState<DemoRequest>(EMPTY_REQUEST);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  function update<K extends keyof DemoRequest>(key: K, value: DemoRequest[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.name.trim() || !form.institution.trim()) return setError('Completa tu nombre y la institución.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError('Ingresa un correo válido.');
    setError('');
    try {
      const prev = JSON.parse(localStorage.getItem('aula-check-demo-requests') ?? '[]') as DemoRequest[];
      localStorage.setItem('aula-check-demo-requests', JSON.stringify([...prev, { ...form, createdAt: new Date().toISOString() }]));
    } catch {
      // almacenamiento no disponible: la solicitud igual se confirma en pantalla
    }
    setSent(true);
  }

  function handleClose() {
    setSent(false);
    setForm(EMPTY_REQUEST);
    setError('');
    onClose();
  }

  const input =
    'w-full h-11 px-3.5 rounded-xl border border-black/[0.08] bg-[#f5f5f7]/90 text-sm text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:bg-white focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10 transition-all';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-title"
      onClick={handleClose}
    >
      <div
        className="bg-white/90 backdrop-blur-3xl border border-black/[0.08] rounded-[28px] w-full max-w-lg shadow-[0_24px_60px_rgba(0,0,0,0.18)] relative max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/[0.05] hover:bg-black/[0.1] flex items-center justify-center text-[#1d1d1f] active:scale-[0.96] transition-all"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>

        {sent ? (
          <div className="p-8 sm:p-10 text-center overflow-y-auto">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#34c759]/15 border border-[#34c759]/25 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-[#248a3d]" />
            </div>
            <h3 id="demo-title" className="text-2xl font-bold tracking-tight text-[#1d1d1f]">¡Solicitud recibida!</h3>
            <p className="text-sm sm:text-base text-[#707070] mt-2 leading-relaxed">
              Gracias, <strong className="text-[#1d1d1f]">{form.name}</strong>. El equipo comercial de TELEBIT contactará a{' '}
              <strong className="text-[#1d1d1f]">{form.institution}</strong> en menos de 24 horas hábiles en{' '}
              <strong className="text-[#1d1d1f]">{form.email}</strong>.
            </p>
            <button
              onClick={handleClose}
              className="mt-6 h-11 px-7 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white text-sm font-semibold shadow-sm shadow-[#0071e3]/20 active:scale-[0.98] transition-all"
            >
              Entendido
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0" noValidate>
            <div className="px-6 sm:px-7 pt-6 pb-4 border-b border-black/[0.06] shrink-0 pr-14">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0071e3]">Contacto comercial</span>
              <h3 id="demo-title" className="text-xl sm:text-2xl font-bold tracking-tight text-[#1d1d1f] mt-0.5">
                Solicitar Demo Institucional
              </h3>
              <p className="text-xs sm:text-sm text-[#6e6e73] mt-1">
                Agenda una presentación personalizada de 30 minutos para tu universidad.
              </p>
            </div>

            <div className="p-6 sm:p-7 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <label className="block text-xs font-semibold text-[#1d1d1f]">
                  Nombre completo
                  <input className={input + ' mt-1.5'} value={form.name} onChange={(e) => update('name', e.target.value)} />
                </label>
                <label className="block text-xs font-semibold text-[#1d1d1f]">
                  Institución
                  <input className={input + ' mt-1.5'} value={form.institution} onChange={(e) => update('institution', e.target.value)} />
                </label>
                <label className="block text-xs font-semibold text-[#1d1d1f]">
                  Cargo
                  <select className={input + ' mt-1.5'} value={form.role} onChange={(e) => update('role', e.target.value)}>
                    <option>Rectoría</option>
                    <option>Vicerrectoría Académica</option>
                    <option>Coordinación de Programa</option>
                    <option>Bienestar Universitario</option>
                    <option>TI / Sistemas</option>
                    <option>Docente</option>
                  </select>
                </label>
                <label className="block text-xs font-semibold text-[#1d1d1f]">
                  N.º de estudiantes
                  <select className={input + ' mt-1.5'} value={form.students} onChange={(e) => update('students', e.target.value)}>
                    <option>Menos de 1.000</option>
                    <option>1.000 - 5.000</option>
                    <option>5.000 - 20.000</option>
                    <option>Más de 20.000</option>
                  </select>
                </label>
              </div>
              <label className="block text-xs font-semibold text-[#1d1d1f]">
                Correo institucional
                <input
                  type="email"
                  className={input + ' mt-1.5'}
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="nombre@universidad.edu.co"
                />
              </label>
              <label className="block text-xs font-semibold text-[#1d1d1f]">
                Mensaje (opcional)
                <textarea
                  rows={3}
                  className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-[#f5f5f7]/90 text-sm text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:bg-white focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10 resize-none transition-all"
                  value={form.message}
                  onChange={(e) => update('message', e.target.value)}
                />
              </label>
              {error && (
                <p className="text-xs font-semibold text-[#d70015] bg-[#ff3b30]/10 border border-[#ff3b30]/20 rounded-xl px-3 py-2" role="alert">
                  {error}
                </p>
              )}
            </div>

            <div className="px-6 sm:px-7 py-4 border-t border-black/[0.06] bg-[#fafafc]/80 shrink-0">
              <button
                type="submit"
                className="w-full h-11 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-sm shadow-[#0071e3]/20 active:scale-[0.98] transition-all"
              >
                <Send className="w-4 h-4" /> Enviar solicitud
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function ComercialPage() {
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] relative overflow-x-hidden selection:bg-[#0071e3]/15 selection:text-[#0071e3]">
      {/* Iluminación radial sutil superior */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,113,227,0.10),transparent)]"
      />

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-white/75 backdrop-blur-2xl border-b border-black/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/comercial" className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-[12px] bg-[#0071e3] flex items-center justify-center shadow-sm shadow-[#0071e3]/20">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </span>
            <span className="leading-none">
              <span className="block text-sm font-semibold tracking-tight text-[#1d1d1f]">Aula Check</span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6e6e73] mt-0.5">by TELEBIT</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-[#6e6e73]">
            <a href="#valor" className="hover:text-[#1d1d1f] transition-colors">Propuesta de valor</a>
            <a href="#clientes" className="hover:text-[#1d1d1f] transition-colors">Para quién</a>
            <a href="#mejoras" className="hover:text-[#1d1d1f] transition-colors">Mejoras</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="hidden sm:inline-flex h-9 px-4 rounded-full text-xs font-semibold text-[#1d1d1f] bg-black/[0.04] hover:bg-black/[0.08] items-center active:scale-[0.98] transition-all"
            >
              Ingresar
            </Link>
            <button
              onClick={() => setDemoOpen(true)}
              className="h-9 px-4 rounded-full text-xs font-semibold bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-sm shadow-[#0071e3]/20 active:scale-[0.98] transition-all"
            >
              Solicitar Demo
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative">
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-20 md:pt-20 md:pb-28 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 backdrop-blur-xl border border-black/[0.06] text-xs font-medium text-[#1d1d1f] shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-[#0071e3]" /> Asistencia inteligente para educación superior
            </span>
            <h1 className="mt-5 text-4xl sm:text-5xl md:text-[54px] font-bold leading-[1.05] tracking-[-0.03em] text-[#1d1d1f]">
              Cada minuto de clase cuenta.{' '}
              <span className="text-[#0071e3]">Cada estudiante también.</span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-[#6e6e73] max-w-xl leading-relaxed">
              Aula Check ahorra <strong className="font-semibold text-[#1d1d1f]">hasta 15 minutos por clase</strong>, elimina el{' '}
              <strong className="font-semibold text-[#1d1d1f]">fraude de firmas en papel</strong> y previene la{' '}
              <strong className="font-semibold text-[#1d1d1f]">deserción estudiantil</strong> con el Semáforo de Permanencia.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setDemoOpen(true)}
                className="h-12 px-7 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#0071e3]/20 active:scale-[0.98] transition-all"
              >
                Solicitar Demo Institucional <ArrowRight className="w-4 h-4" />
              </button>
              <Link
                href="/#roles"
                className="h-12 px-7 rounded-full bg-white/80 backdrop-blur-xl border border-black/[0.08] text-[#1d1d1f] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-white shadow-sm active:scale-[0.98] transition-all"
              >
                <PlayCircle className="w-4 h-4 text-[#0071e3]" /> Probar Plataforma en Vivo
              </Link>
            </div>
          </div>

          {/* Tarjeta interactiva de demostración en vivo */}
          <div className="relative">
            <div className="bg-white/80 backdrop-blur-2xl border border-black/[0.06] rounded-[28px] p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.06)]">
              <div className="flex items-center justify-between gap-3 mb-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#6e6e73]">
                  G401 • Arquitectura de Software
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#34c759]/12 text-[#248a3d] border border-[#34c759]/25 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34c759] animate-pulse" /> EN VIVO
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl bg-[#34c759]/[0.08] border border-[#34c759]/15 p-3.5">
                  <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#248a3d]">28</div>
                  <div className="text-[11px] font-semibold text-[#248a3d]/80 mt-0.5">Presentes</div>
                </div>
                <div className="rounded-2xl bg-[#ff9500]/[0.08] border border-[#ff9500]/20 p-3.5">
                  <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#b25000]">3</div>
                  <div className="text-[11px] font-semibold text-[#b25000]/80 mt-0.5">Tardanzas</div>
                </div>
                <div className="rounded-2xl bg-[#ff3b30]/[0.08] border border-[#ff3b30]/15 p-3.5">
                  <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#d70015]">1</div>
                  <div className="text-[11px] font-semibold text-[#d70015]/80 mt-0.5">Ausentes</div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-[#f5f5f7] border border-black/[0.06] p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73]">PIN dinámico</div>
                  <div className="font-mono text-2xl sm:text-3xl font-bold tracking-[0.26em] text-[#1d1d1f] mt-0.5">
                    482 917
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73]">Rota en</div>
                  <div className="font-mono text-xl sm:text-2xl font-bold text-[#0071e3] mt-0.5">00:24</div>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex justify-between text-xs font-medium text-[#6e6e73] mb-2">
                  <span>Semáforo de Permanencia del grupo</span>
                  <span className="font-semibold text-[#1d1d1f]">87%</span>
                </div>
                <div className="h-2.5 rounded-full bg-black/[0.06] overflow-hidden flex gap-0.5 p-0.5">
                  <div className="bg-[#34c759] w-[70%] rounded-full" />
                  <div className="bg-[#ff9500] w-[20%] rounded-full" />
                  <div className="bg-[#ff3b30] w-[10%] rounded-full" />
                </div>
              </div>
            </div>

            <div className="mt-4 sm:mt-0 sm:absolute sm:-bottom-5 sm:-left-4 inline-flex items-center gap-2 rounded-full bg-white/90 backdrop-blur-xl border border-black/[0.06] text-[#1d1d1f] shadow-[0_12px_30px_rgba(0,0,0,0.08)] px-4 py-2 text-xs font-semibold">
              <Clock className="w-4 h-4 text-[#0071e3]" /> Lista tomada en 42 s
            </div>
          </div>
        </div>
      </section>

      {/* ── Propuesta de valor ── */}
      <section id="valor" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 scroll-mt-16">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0071e3]">Propuesta de valor</span>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-[-0.025em] text-[#1d1d1f]">
            Menos papeleo, más aprendizaje y retención
          </h2>
        </div>
        <div className="mt-10 sm:mt-12 grid md:grid-cols-3 gap-5">
          {VALUE_PROPS.map(({ icon: Icon, metric, title, text }) => (
            <div
              key={metric}
              className="bg-white/80 backdrop-blur-2xl border border-black/[0.06] rounded-[28px] p-7 shadow-[0_8px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.06)] transition-all"
            >
              <div className="w-11 h-11 rounded-2xl bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </div>
              <div className="mt-5 text-2xl sm:text-3xl font-bold tracking-tight text-[#1d1d1f]">{metric}</div>
              <div className="text-sm font-semibold text-[#0071e3] mt-0.5">{title}</div>
              <p className="mt-3 text-sm text-[#707070] leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Cliente objetivo ── */}
      <section id="clientes" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 scroll-mt-16">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0071e3]">Cliente objetivo</span>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-[-0.025em] text-[#1d1d1f]">
            Una plataforma, tres ganadores
          </h2>
        </div>
        <div className="mt-10 sm:mt-12 grid md:grid-cols-3 gap-5">
          {AUDIENCES.map(({ icon: Icon, who, pitch, accentBg, bullets }) => (
            <div
              key={who}
              className="bg-white/80 backdrop-blur-2xl border border-black/[0.06] rounded-[28px] p-7 shadow-[0_8px_30px_rgba(0,0,0,0.03)] flex flex-col"
            >
              <div className="flex items-start gap-3.5 pb-5 border-b border-black/[0.06]">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${accentBg}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight text-[#1d1d1f] leading-snug">{who}</h3>
                  <p className="text-xs font-semibold text-[#0071e3] mt-0.5">{pitch}</p>
                </div>
              </div>
              <ul className="pt-5 space-y-3 flex-1">
                {bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-[#1d1d1f]">
                    <CheckCircle2 className="w-4 h-4 text-[#248a3d] shrink-0 mt-0.5" />
                    <span className="leading-snug">{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── Mejoras por feedback (Antes vs. Ahora) ── */}
      <section id="mejoras" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 scroll-mt-16">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0071e3]">
            Escuchamos a nuestros usuarios
          </span>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-[-0.025em] text-[#1d1d1f]">
            Mejoras aplicadas por feedback
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#6e6e73]">
            Resultado directo de las entrevistas con docentes, estudiantes y coordinadores.
          </p>
        </div>

        <div className="mt-10 sm:mt-12 space-y-5">
          {FEEDBACK_IMPROVEMENTS.map(({ icon: Icon, title, before, after }, idx) => (
            <div
              key={title}
              className="bg-white/80 backdrop-blur-2xl border border-black/[0.06] rounded-[28px] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.03)]"
            >
              <div className="flex items-center gap-3 px-6 py-4 bg-[#fafafc] border-b border-black/[0.06]">
                <span className="w-7 h-7 rounded-full bg-[#0071e3] text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <Icon className="w-4 h-4 text-[#0071e3] shrink-0" />
                <h3 className="font-semibold text-sm sm:text-base text-[#1d1d1f] tracking-tight">{title}</h3>
              </div>
              <div className="grid md:grid-cols-2">
                <div className="p-6 bg-[#ff3b30]/[0.04] border-b md:border-b-0 md:border-r border-black/[0.06]">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#ff3b30]/12 text-[#d70015]">
                    ✕ Antes
                  </span>
                  <p className="mt-3 text-sm text-[#707070] leading-relaxed">{before}</p>
                </div>
                <div className="p-6 bg-[#34c759]/[0.05]">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#34c759]/15 text-[#248a3d]">
                    ✓ Ahora
                  </span>
                  <p className="mt-3 text-sm text-[#1d1d1f] font-medium leading-relaxed">{after}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 grid sm:grid-cols-3 gap-4 text-center">
          {[
            { icon: BarChart3, k: 'Reportes', v: 'Exportables a Excel' },
            { icon: FileHeart, k: 'Incapacidades', v: 'Flujo 100% digital' },
            { icon: ShieldCheck, k: 'Datos', v: 'PostgreSQL + Prisma' },
          ].map(({ icon: Icon, k, v }) => (
            <div
              key={k}
              className="bg-white/80 backdrop-blur-2xl border border-black/[0.06] rounded-[28px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)]"
            >
              <Icon className="w-5 h-5 text-[#0071e3] mx-auto" />
              <div className="mt-2 text-sm font-semibold text-[#1d1d1f]">{k}</div>
              <div className="text-xs text-[#6e6e73] mt-0.5">{v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
        <div className="bg-white/80 backdrop-blur-2xl border border-black/[0.06] rounded-[28px] p-8 sm:p-12 shadow-[0_16px_40px_rgba(0,0,0,0.04)] flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0071e3]">Despliegue institucional</span>
            <h2 className="mt-2 text-2xl sm:text-3xl md:text-4xl font-bold tracking-[-0.025em] text-[#1d1d1f]">
              ¿Listo para modernizar tu universidad?
            </h2>
            <p className="mt-2 text-sm sm:text-base text-[#6e6e73]">
              Implementación en menos de 2 semanas. Sin hardware adicional.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0 w-full md:w-auto">
            <button
              onClick={() => setDemoOpen(true)}
              className="h-12 px-7 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white font-semibold text-sm shadow-lg shadow-[#0071e3]/20 active:scale-[0.98] transition-all"
            >
              Solicitar Demo Institucional
            </button>
            <Link
              href="/#roles"
              className="h-12 px-7 rounded-full bg-[#f5f5f7] hover:bg-black/[0.06] border border-black/[0.08] text-[#1d1d1f] font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            >
              <PlayCircle className="w-4 h-4 text-[#0071e3]" /> Probar Plataforma en Vivo
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-black/[0.06] bg-white/60 backdrop-blur-xl text-[#6e6e73] text-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>© 2026 TELEBIT — Aula Check. Sistema Institucional de Asistencia.</span>
          <Link href="/" className="touch-target inline-flex items-center min-h-[32px] text-[#1d1d1f] hover:text-[#0071e3] font-semibold transition-colors">
            Ir al selector de roles →
          </Link>
        </div>
      </footer>

      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
}
