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
    color: 'from-violet-600 to-indigo-700',
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
    color: 'from-blue-600 to-cyan-600',
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
    color: 'from-emerald-600 to-teal-600',
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

  const input = 'w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/40';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="demo-title" onClick={handleClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl relative max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <button onClick={handleClose} className="absolute top-3 right-3 w-9 h-9 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-600" aria-label="Cerrar">
          <X className="w-5 h-5" />
        </button>
        {sent ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-9 h-9 text-emerald-600" />
            </div>
            <h3 id="demo-title" className="text-2xl font-bold text-slate-900">¡Solicitud recibida!</h3>
            <p className="text-slate-600 mt-2">
              Gracias, <strong>{form.name}</strong>. El equipo comercial de TELEBIT contactará a <strong>{form.institution}</strong> en
              menos de 24 horas hábiles en <strong>{form.email}</strong>.
            </p>
            <button onClick={handleClose} className="mt-6 h-11 px-6 rounded-xl bg-blue-700 text-white font-bold hover:bg-blue-800">Entendido</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-3" noValidate>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Contacto comercial</span>
              <h3 id="demo-title" className="text-2xl font-bold text-slate-900">Solicitar Demo Institucional</h3>
              <p className="text-sm text-slate-600">Agenda una presentación personalizada de 30 minutos para tu universidad.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm font-semibold text-slate-800">Nombre completo
                <input className={input + ' mt-1'} value={form.name} onChange={(e) => update('name', e.target.value)} />
              </label>
              <label className="block text-sm font-semibold text-slate-800">Institución
                <input className={input + ' mt-1'} value={form.institution} onChange={(e) => update('institution', e.target.value)} />
              </label>
              <label className="block text-sm font-semibold text-slate-800">Cargo
                <select className={input + ' mt-1'} value={form.role} onChange={(e) => update('role', e.target.value)}>
                  <option>Rectoría</option><option>Vicerrectoría Académica</option><option>Coordinación de Programa</option><option>Bienestar Universitario</option><option>TI / Sistemas</option><option>Docente</option>
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-800">N.º de estudiantes
                <select className={input + ' mt-1'} value={form.students} onChange={(e) => update('students', e.target.value)}>
                  <option>Menos de 1.000</option><option>1.000 - 5.000</option><option>5.000 - 20.000</option><option>Más de 20.000</option>
                </select>
              </label>
            </div>
            <label className="block text-sm font-semibold text-slate-800">Correo institucional
              <input type="email" className={input + ' mt-1'} value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="nombre@universidad.edu.co" />
            </label>
            <label className="block text-sm font-semibold text-slate-800">Mensaje (opcional)
              <textarea rows={3} className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600/40 resize-none" value={form.message} onChange={(e) => update('message', e.target.value)} />
            </label>
            {error && <p className="text-sm text-red-700 font-semibold" role="alert">{error}</p>}
            <button type="submit" className="w-full h-12 rounded-xl bg-blue-700 text-white font-bold flex items-center justify-center gap-2 hover:bg-blue-800">
              <Send className="w-4 h-4" /> Enviar solicitud
            </button>
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
    <div className="min-h-screen bg-white text-slate-900">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/comercial" className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-white" /></span>
            <span className="leading-none">
              <span className="block text-white font-bold">Aula Check</span>
              <span className="block text-[11px] uppercase tracking-wider text-blue-300">by TELEBIT</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-300">
            <a href="#valor" className="hover:text-white">Propuesta de valor</a>
            <a href="#clientes" className="hover:text-white">Para quién</a>
            <a href="#mejoras" className="hover:text-white">Mejoras</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/" className="hidden sm:inline-flex h-10 px-4 rounded-xl text-sm font-bold text-white border border-white/20 hover:bg-white/10 items-center">Ingresar</Link>
            <button onClick={() => setDemoOpen(true)} className="h-10 px-4 rounded-xl text-sm font-bold bg-amber-400 text-slate-950 hover:bg-amber-300">Solicitar Demo</button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 text-white">
        <div className="absolute -top-24 -right-24 w-[28rem] h-[28rem] bg-blue-500/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-20 w-[24rem] h-[24rem] bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-6 py-20 md:py-28 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-sm font-semibold text-blue-100">
              <Sparkles className="w-4 h-4 text-amber-300" /> Asistencia inteligente para educación superior
            </span>
            <h1 className="mt-5 text-4xl md:text-6xl font-extrabold leading-[1.05] tracking-tight">
              Cada minuto de clase cuenta.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-emerald-300">Cada estudiante también.</span>
            </h1>
            <p className="mt-5 text-lg text-blue-100/90 max-w-xl">
              Aula Check ahorra <strong className="text-white">hasta 15 minutos por clase</strong>, elimina el
              <strong className="text-white"> fraude de firmas en papel</strong> y previene la
              <strong className="text-white"> deserción estudiantil</strong> con el Semáforo de Permanencia.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button onClick={() => setDemoOpen(true)} className="h-14 px-7 rounded-2xl bg-amber-400 text-slate-950 font-extrabold text-lg flex items-center justify-center gap-2 hover:bg-amber-300 shadow-xl shadow-amber-500/20 transition-transform hover:-translate-y-0.5">
                Solicitar Demo Institucional <ArrowRight className="w-5 h-5" />
              </button>
              <Link href="/#roles" className="h-14 px-7 rounded-2xl border-2 border-white/40 text-white font-bold text-lg flex items-center justify-center gap-2 hover:bg-white/10">
                <PlayCircle className="w-5 h-5" /> Probar Plataforma en Vivo
              </Link>
            </div>
          </div>

          {/* Mock visual */}
          <div className="relative">
            <div className="rounded-3xl bg-white text-slate-900 p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-slate-500">G401 • Arquitectura de Software</span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-800"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> EN VIVO</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl bg-emerald-50 p-3"><div className="text-3xl font-extrabold text-emerald-700">28</div><div className="text-xs font-semibold text-emerald-900">Presentes</div></div>
                <div className="rounded-2xl bg-amber-50 p-3"><div className="text-3xl font-extrabold text-amber-700">3</div><div className="text-xs font-semibold text-amber-900">Tardanzas</div></div>
                <div className="rounded-2xl bg-red-50 p-3"><div className="text-3xl font-extrabold text-red-700">1</div><div className="text-xs font-semibold text-red-900">Ausentes</div></div>
              </div>
              <div className="mt-4 rounded-2xl bg-slate-900 text-white p-4 flex items-center justify-between">
                <div><div className="text-xs text-slate-400">PIN dinámico</div><div className="font-mono text-3xl font-extrabold tracking-[0.3em]">482 917</div></div>
                <div className="text-right"><div className="text-xs text-slate-400">Rota en</div><div className="text-2xl font-bold text-amber-300">00:24</div></div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1"><span>Semáforo de Permanencia del grupo</span><span>87%</span></div>
                <div className="h-3 rounded-full bg-slate-100 overflow-hidden flex">
                  <div className="bg-emerald-500 w-[70%]" /><div className="bg-amber-400 w-[20%]" /><div className="bg-red-500 w-[10%]" />
                </div>
              </div>
            </div>
            <div className="absolute -bottom-5 -left-5 rounded-2xl bg-white text-slate-900 shadow-xl px-4 py-3 flex items-center gap-2 text-sm font-bold">
              <Clock className="w-5 h-5 text-blue-700" /> Lista tomada en 42 s
            </div>
          </div>
        </div>
      </section>

      {/* ── Propuesta de valor ── */}
      <section id="valor" className="max-w-6xl mx-auto px-6 py-20 scroll-mt-16">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-sm font-bold uppercase tracking-wider text-blue-700">Propuesta de valor</span>
          <h2 className="mt-2 text-3xl md:text-4xl font-extrabold">Menos papeleo, más aprendizaje y retención</h2>
        </div>
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {VALUE_PROPS.map(({ icon: Icon, metric, title, text }) => (
            <div key={metric} className="rounded-3xl border-2 border-slate-200 p-7 hover:border-blue-600 hover:shadow-xl transition-all">
              <div className="w-12 h-12 rounded-2xl bg-blue-700 flex items-center justify-center"><Icon className="w-6 h-6 text-white" /></div>
              <div className="mt-5 text-3xl font-extrabold text-slate-950">{metric}</div>
              <div className="text-lg font-bold text-blue-700">{title}</div>
              <p className="mt-3 text-slate-700">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Cliente objetivo ── */}
      <section id="clientes" className="bg-slate-50 py-20 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-sm font-bold uppercase tracking-wider text-blue-700">Cliente objetivo</span>
            <h2 className="mt-2 text-3xl md:text-4xl font-extrabold">Una plataforma, tres ganadores</h2>
          </div>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {AUDIENCES.map(({ icon: Icon, who, pitch, color, bullets }) => (
              <div key={who} className="rounded-3xl bg-white shadow-lg overflow-hidden flex flex-col">
                <div className={`bg-gradient-to-br ${color} p-6 text-white`}>
                  <Icon className="w-9 h-9" />
                  <h3 className="mt-3 text-xl font-extrabold">{who}</h3>
                  <p className="text-white/90 font-semibold">{pitch}</p>
                </div>
                <ul className="p-6 space-y-3 flex-1">
                  {bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-slate-800">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" /> {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Mejoras por feedback (Antes vs. Ahora) ── */}
      <section id="mejoras" className="max-w-6xl mx-auto px-6 py-20 scroll-mt-16">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-sm font-bold uppercase tracking-wider text-blue-700">Escuchamos a nuestros usuarios</span>
          <h2 className="mt-2 text-3xl md:text-4xl font-extrabold">Mejoras aplicadas por feedback</h2>
          <p className="mt-3 text-slate-600">Resultado directo de las entrevistas con docentes, estudiantes y coordinadores.</p>
        </div>
        <div className="mt-12 space-y-6">
          {FEEDBACK_IMPROVEMENTS.map(({ icon: Icon, title, before, after }, idx) => (
            <div key={title} className="rounded-3xl border-2 border-slate-200 overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 bg-slate-950 text-white">
                <span className="w-8 h-8 rounded-full bg-amber-400 text-slate-950 font-extrabold flex items-center justify-center">{idx + 1}</span>
                <Icon className="w-5 h-5 text-blue-300" />
                <h3 className="font-bold text-lg">{title}</h3>
              </div>
              <div className="grid md:grid-cols-2">
                <div className="p-6 bg-red-50 border-b md:border-b-0 md:border-r border-red-100">
                  <span className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider px-2 py-1 rounded bg-red-200 text-red-900">✕ Antes</span>
                  <p className="mt-3 text-red-950">{before}</p>
                </div>
                <div className="p-6 bg-emerald-50">
                  <span className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider px-2 py-1 rounded bg-emerald-200 text-emerald-900">✓ Ahora</span>
                  <p className="mt-3 text-emerald-950 font-medium">{after}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-10 grid sm:grid-cols-3 gap-4 text-center">
          {[
            { icon: BarChart3, k: 'Reportes', v: 'Exportables a Excel' },
            { icon: FileHeart, k: 'Incapacidades', v: 'Flujo 100% digital' },
            { icon: ShieldCheck, k: 'Datos', v: 'PostgreSQL + Prisma' },
          ].map(({ icon: Icon, k, v }) => (
            <div key={k} className="rounded-2xl bg-slate-50 p-5">
              <Icon className="w-6 h-6 text-blue-700 mx-auto" />
              <div className="mt-2 font-extrabold">{k}</div>
              <div className="text-sm text-slate-600">{v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="bg-gradient-to-r from-blue-800 to-indigo-800 text-white">
        <div className="max-w-6xl mx-auto px-6 py-16 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h2 className="text-3xl md:text-4xl font-extrabold">¿Listo para modernizar tu universidad?</h2>
            <p className="mt-2 text-blue-100 text-lg">Implementación en menos de 2 semanas. Sin hardware adicional.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <button onClick={() => setDemoOpen(true)} className="h-14 px-7 rounded-2xl bg-amber-400 text-slate-950 font-extrabold text-lg hover:bg-amber-300">
              Solicitar Demo Institucional
            </button>
            <Link href="/#roles" className="h-14 px-7 rounded-2xl bg-white text-blue-800 font-extrabold text-lg flex items-center justify-center gap-2 hover:bg-blue-50">
              <PlayCircle className="w-5 h-5" /> Probar Plataforma en Vivo
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-slate-950 text-slate-400 text-sm">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row justify-between gap-2">
          <span>© 2026 TELEBIT — Aula Check. Sistema Institucional de Asistencia.</span>
          <Link href="/" className="hover:text-white font-semibold">Ir al selector de roles →</Link>
        </div>
      </footer>

      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
}

