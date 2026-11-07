'use client';

import { useState, useEffect, Suspense, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  GraduationCap,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Shield,
  AlertCircle,
  Lock,
  Mail,
  Eye,
  EyeOff,
  UserCheck,
  QrCode,
  Activity,
  FileHeart,
  Database,
  Sparkles,
} from 'lucide-react';
import { useAulaCheckStore } from '@/lib/store';
import type { UserRole } from '@/lib/types';
import InstitutionalHelpButton from '@/components/InstitutionalHelpModal';

function AulaCheckLogo({ centered = false }: { centered?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${centered ? 'justify-center' : ''}`}>
      <div className="w-10 h-10 rounded-2xl bg-[#0071e3] flex items-center justify-center shadow-[0_6px_16px_-4px_rgba(0,113,227,0.45)]">
        <CheckCircle2 className="w-5 h-5 text-white" />
      </div>
      <div className={centered ? 'text-left' : ''}>
        <div className="text-base font-semibold text-[#1d1d1f] tracking-tight leading-none">
          Aula Check
        </div>
        <div className="text-[11px] text-[#86868b] tracking-tight mt-0.5 font-medium">
          Sistema Institucional
        </div>
      </div>
    </div>
  );
}

function isValidDomain(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return false;
  return (
    normalized.endsWith('@universidad.edu.co') ||
    normalized.endsWith('.edu.co') ||
    normalized.endsWith('.edu')
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setCurrentUser = useAulaCheckStore((s) => s.setCurrentUser);
  const teachers = useAulaCheckStore((s) => s.teachers);
  const students = useAulaCheckStore((s) => s.students);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const unauthorizedParam = searchParams.get('unauthorized');

  useEffect(() => {
    if (unauthorizedParam) {
      setErrorMsg(
        'Acceso restringido: Tu sesión actual no cuenta con permisos para esa sección. Ingresa con una cuenta autorizada.',
      );
    }
  }, [unauthorizedParam]);

  function fillDemoCredentials(demoEmail: string, demoPassword: string) {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setErrorMsg(null);
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanEmail || !isValidDomain(cleanEmail)) {
      setErrorMsg('Ingresa un correo institucional válido (@universidad.edu.co o .edu)');
      return;
    }

    if (!cleanPass) {
      setErrorMsg('Credenciales inválidas. Verifica tu correo y contraseña');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPass,
        }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        authenticated?: boolean;
        error?: string;
        redirectTo?: string;
        user?: {
          id: string;
          name: string;
          email: string;
          role: UserRole;
          code?: string;
          department?: string;
          title?: string;
          program?: string;
        };
      };

      if (!res.ok || !data.user) {
        setErrorMsg(
          res.status === 403
            ? data.error || 'Cuenta institucional inhabilitada. Comunícate con Coordinación Académica'
            : res.status === 400
            ? data.error || 'Ingresa un correo institucional válido (@universidad.edu.co o .edu)'
            : 'Credenciales inválidas. Verifica tu correo y contraseña',
        );
        setLoading(false);
        return;
      }

      const matchedLocalTeacher = teachers.find((t) => t.email.toLowerCase() === cleanEmail);
      const matchedLocalStudent = students.find((s) => s.email.toLowerCase() === cleanEmail);
      if (matchedLocalTeacher?.isActive === false || matchedLocalStudent?.isActive === false) {
        setErrorMsg('Cuenta institucional inhabilitada. Comunícate con Coordinación Académica');
        setLoading(false);
        return;
      }

      setCurrentUser(data.user.role, data.user.name, data.user.email, {
        id: data.user.id,
        code: data.user.code,
        department: data.user.department,
        title: data.user.title,
        program: data.user.program,
      });

      const destination =
        data.redirectTo ||
        (data.user.role === 'admin'
          ? '/admin'
          : data.user.role === 'teacher'
          ? '/teacher/setup'
          : '/student/check-in');

      setLoading(false);
      router.push(destination);
    } catch {
      // Respaldo (Fallback) offline en caso de desconexión de red
      if (cleanPass !== '123456' && cleanPass !== 'AulaCheck2026*') {
        setErrorMsg('Credenciales inválidas. Verifica tu correo y contraseña');
        setLoading(false);
        return;
      }

      if (
        cleanEmail === 'admin@universidad.edu.co' ||
        cleanEmail === 'coordinacion.academica@universidad.edu.co' ||
        cleanEmail === 'coordinacion@universidad.edu.co'
      ) {
        setCurrentUser('admin', 'Coordinación Académica', cleanEmail, {
          id: 'coord-admin',
          department: 'Escuela de Ingeniería de Sistemas y Computación',
        });
        setLoading(false);
        router.push('/admin');
        return;
      }

      const localTeacher = teachers.find((t) => t.email.toLowerCase() === cleanEmail);
      if (localTeacher) {
        if (localTeacher.isActive === false) {
          setErrorMsg('Cuenta institucional inhabilitada. Comunícate con Coordinación Académica');
          setLoading(false);
          return;
        }
        setCurrentUser('teacher', localTeacher.name, localTeacher.email, {
          id: localTeacher.id,
          department: localTeacher.department,
          title: localTeacher.title,
        });
        setLoading(false);
        router.push('/teacher/setup');
        return;
      }

      const localStudent = students.find((s) => s.email.toLowerCase() === cleanEmail);
      if (localStudent) {
        if (localStudent.isActive === false) {
          setErrorMsg('Cuenta institucional inhabilitada. Comunícate con Coordinación Académica');
          setLoading(false);
          return;
        }
        setCurrentUser('student', localStudent.name, localStudent.email, {
          id: localStudent.id,
          code: localStudent.code,
          program: localStudent.program,
        });
        setLoading(false);
        router.push('/student/check-in');
        return;
      }

      setErrorMsg('Credenciales inválidas. Verifica tu correo y contraseña');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] apple-hero-glow flex flex-col">
      {/* ── Header Translúcido estilo macOS Sequoia ── */}
      <header className="sticky top-0 z-40 w-full bg-white/75 backdrop-blur-2xl border-b border-black/[0.06]">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 h-14 flex items-center justify-between">
          <AulaCheckLogo />
          <div className="flex items-center gap-2.5">
            <InstitutionalHelpButton defaultTab="coordinacion" />
            <Link
              href="/comercial"
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-black/[0.05] hover:bg-black/[0.08] text-[#1d1d1f] font-medium text-xs transition-all active:scale-[0.98] whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#0071e3]" />
              <span className="hidden sm:inline">Presentación Comercial</span>
              <span className="sm:hidden">Comercial</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Content: Hero Apple + Login Liquid Glass + Bento Grid ── */}
      <main className="flex-1 flex flex-col items-center px-4 sm:px-6 pt-10 sm:pt-14 pb-20">
        {/* 1. Hero Section */}
        <section className="max-w-3xl mx-auto text-center mb-9 sm:mb-11 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 backdrop-blur-xl border border-black/[0.07] shadow-[0_2px_10px_-2px_rgba(0,0,0,0.04)] text-xs font-medium text-[#1d1d1f] mb-5">
            <span className="w-2 h-2 rounded-full bg-[#0071e3]" />
            <span>Aula Check • Plataforma Institucional de Asistencia y Permanencia</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold text-[#1d1d1f] tracking-tight leading-[1.08]">
            Gestión académica precisa.{' '}
            <span className="text-[#0071e3]">Diseñada para fluir.</span>
          </h1>

          <p className="text-sm sm:text-lg text-[#86868b] max-w-2xl mx-auto mt-4 leading-relaxed font-normal">
            Integración de asistencia biométrica por QR dinámico, semáforo de permanencia en
            tiempo real y flujo institucional de excusas médicas.
          </p>
        </section>

        {/* 2. Tarjeta Flotante de Login Unificado (Liquid Glassmorphism) */}
        <section className="w-full max-w-md animate-fade-in">
          <div className="bg-white/75 backdrop-blur-2xl border border-black/[0.06] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] rounded-3xl p-7 sm:p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0071e3]/10 text-[#0071e3] text-[11px] font-semibold tracking-tight mb-2.5">
                <Lock className="w-3 h-3" />
                Single Sign-On Universitario
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#1d1d1f] tracking-tight">
                Portal Institucional Unificado
              </h2>
              <p className="text-xs sm:text-sm text-[#86868b] mt-1">
                Ingresa con tu correo institucional y contraseña asignada
              </p>
            </div>

            {/* Alerta de Error */}
            {errorMsg && (
              <div
                className="mb-5 flex items-start gap-3 p-3.5 rounded-2xl bg-[#ff3b30]/10 border border-[#ff3b30]/20 text-[#1d1d1f] text-xs animate-fade-in"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 text-[#ff3b30] shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-[#1d1d1f]">No se pudo iniciar sesión</p>
                  <p className="text-[#86868b] mt-0.5 leading-relaxed">{errorMsg}</p>
                </div>
              </div>
            )}

            {/* Formulario Único */}
            <form onSubmit={handleLogin} noValidate className="space-y-4">
              <div>
                <label
                  htmlFor="institutional-email"
                  className="block text-xs font-semibold text-[#1d1d1f] mb-1.5"
                >
                  Correo institucional
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="institutional-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="usuario@universidad.edu.co"
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-black/[0.08] bg-black/[0.03] focus:bg-white text-[#1d1d1f] placeholder:text-[#86868b] text-sm focus:outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/30 transition-all"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="institutional-password"
                  className="block text-xs font-semibold text-[#1d1d1f] mb-1.5"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="institutional-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="Ingresa tu contraseña"
                    className="w-full h-11 pl-10 pr-10 rounded-xl border border-black/[0.08] bg-black/[0.03] focus:bg-white text-[#1d1d1f] placeholder:text-[#86868b] text-sm focus:outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/30 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#1d1d1f] p-1 rounded-lg transition-colors"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 mt-1 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#006edb] active:scale-[0.98] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-[0_8px_20px_-6px_rgba(0,113,227,0.55)] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Autenticando...</span>
                  </>
                ) : (
                  <>
                    <span>Ingresar al Portal Institucional</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* ── Acordeón de Acceso Rápido (Demostración) ── */}
            <div className="mt-6 pt-5 border-t border-black/[0.06]">
              <button
                type="button"
                onClick={() => setDemoOpen((prev) => !prev)}
                aria-expanded={demoOpen}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-black/[0.03] hover:bg-black/[0.05] border border-black/[0.06] text-xs font-medium text-[#1d1d1f] transition-all"
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden>🔑</span>
                  <span>Credenciales de demostración rápida</span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-[#86868b] transition-transform duration-200 ${
                    demoOpen ? 'rotate-180 text-[#0071e3]' : ''
                  }`}
                />
              </button>

              {demoOpen && (
                <div className="mt-2.5 grid grid-cols-1 gap-2 animate-fade-in">
                  <button
                    type="button"
                    onClick={() => fillDemoCredentials('admin@universidad.edu.co', '123456')}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-black/[0.06] bg-white/80 hover:bg-white text-left transition-all active:scale-[0.98] group"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-[#0071e3]/10 flex items-center justify-center shrink-0">
                        <Shield className="w-3.5 h-3.5 text-[#0071e3]" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-[#1d1d1f]">
                          Coordinador (Superadmin)
                        </span>
                        <span className="block text-[11px] font-mono text-[#86868b] truncate">
                          admin@universidad.edu.co / 123456
                        </span>
                      </span>
                    </span>
                    <span className="text-[11px] font-semibold text-[#0071e3] group-hover:translate-x-0.5 transition-transform shrink-0">
                      Usar →
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      fillDemoCredentials('alejandro.morales@universidad.edu.co', '123456')
                    }
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-black/[0.06] bg-white/80 hover:bg-white text-left transition-all active:scale-[0.98] group"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-[#0071e3]/10 flex items-center justify-center shrink-0">
                        <UserCheck className="w-3.5 h-3.5 text-[#0071e3]" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-[#1d1d1f]">
                          Docente Titular
                        </span>
                        <span className="block text-[11px] font-mono text-[#86868b] truncate">
                          alejandro.morales@universidad.edu.co / 123456
                        </span>
                      </span>
                    </span>
                    <span className="text-[11px] font-semibold text-[#0071e3] group-hover:translate-x-0.5 transition-transform shrink-0">
                      Usar →
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fillDemoCredentials('juan.perez@universidad.edu.co', '123456')}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-black/[0.06] bg-white/80 hover:bg-white text-left transition-all active:scale-[0.98] group"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-[#34c759]/12 flex items-center justify-center shrink-0">
                        <GraduationCap className="w-3.5 h-3.5 text-[#34c759]" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-[#1d1d1f]">
                          Estudiante
                        </span>
                        <span className="block text-[11px] font-mono text-[#86868b] truncate">
                          juan.perez@universidad.edu.co / 123456
                        </span>
                      </span>
                    </span>
                    <span className="text-[11px] font-semibold text-[#0071e3] group-hover:translate-x-0.5 transition-transform shrink-0">
                      Usar →
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <p className="text-xs text-[#86868b] text-center mt-4">
            Detección automática de perfil académico • Periodo 2026-2
          </p>
        </section>

        {/* 3. Sección Bento Grid de Características (Pilares Tecnológicos) */}
        <section className="w-full max-w-5xl mx-auto mt-14 sm:mt-16">
          <div className="text-center mb-7">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#86868b]">
              Arquitectura Institucional
            </p>
            <h3 className="text-lg sm:text-xl font-bold text-[#1d1d1f] tracking-tight mt-1">
              Cuatro pilares diseñados con precisión
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1 */}
            <div className="bg-white/75 backdrop-blur-2xl border border-black/[0.06] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] rounded-2xl p-5 flex flex-col justify-between hover:-translate-y-0.5 transition-all">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center mb-4">
                  <QrCode className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-semibold text-[#1d1d1f] tracking-tight">
                  Asistencia en tiempo real
                </h4>
                <p className="text-xs text-[#86868b] mt-1.5 leading-relaxed">
                  Código QR dinámico con rotación criptográfica cada 60 segundos y PIN de respaldo
                  para registro instantáneo en aula.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-black/[0.05] flex items-center justify-between text-[11px] font-medium text-[#0071e3]">
                <span>QR + PIN sincrónico</span>
                <span>60s</span>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-white/75 backdrop-blur-2xl border border-black/[0.06] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] rounded-2xl p-5 flex flex-col justify-between hover:-translate-y-0.5 transition-all">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#34c759]/12 text-[#34c759] flex items-center justify-center mb-4">
                  <Activity className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-semibold text-[#1d1d1f] tracking-tight">
                  Semáforo de Permanencia
                </h4>
                <p className="text-xs text-[#86868b] mt-1.5 leading-relaxed">
                  Monitoreo preventivo de asistencia acumulada para detectar alertas tempranas y
                  acompañar la retención estudiantil.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-black/[0.05] flex items-center gap-1.5 text-[11px] font-medium text-[#86868b]">
                <span className="w-2 h-2 rounded-full bg-[#34c759]" />
                <span className="w-2 h-2 rounded-full bg-[#ff9500]" />
                <span className="w-2 h-2 rounded-full bg-[#ff3b30]" />
                <span className="ml-1">Preventivo en vivo</span>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-white/75 backdrop-blur-2xl border border-black/[0.06] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] rounded-2xl p-5 flex flex-col justify-between hover:-translate-y-0.5 transition-all">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#ff9500]/12 text-[#ff9500] flex items-center justify-center mb-4">
                  <FileHeart className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-semibold text-[#1d1d1f] tracking-tight">
                  Incapacidades en dos niveles
                </h4>
                <p className="text-xs text-[#86868b] mt-1.5 leading-relaxed">
                  Evaluación primaria por el docente titular y supervisión con facultad de
                  reevaluación (override) desde Coordinación.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-black/[0.05] flex items-center justify-between text-[11px] font-medium text-[#ff9500]">
                <span>Trazabilidad y auditoría</span>
                <span>2 niveles</span>
              </div>
            </div>

            {/* Card 4 */}
            <div className="bg-white/75 backdrop-blur-2xl border border-black/[0.06] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] rounded-2xl p-5 flex flex-col justify-between hover:-translate-y-0.5 transition-all">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center mb-4">
                  <Database className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-semibold text-[#1d1d1f] tracking-tight">
                  Arquitectura PostgreSQL
                </h4>
                <p className="text-xs text-[#86868b] mt-1.5 leading-relaxed">
                  Persistencia relacional segura en Supabase con Prisma ORM, integridad referencial
                  e inhabilitación lógica institucional.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-black/[0.05] flex items-center justify-between text-[11px] font-medium text-[#0071e3]">
                <span>Supabase + Prisma</span>
                <span>ACID</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center text-sm text-[#86868b]">
          Cargando portal institucional...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
