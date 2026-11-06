'use client';

import { useState, useEffect, Suspense, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  GraduationCap,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Wifi,
  Shield,
  AlertCircle,
  Lock,
  Mail,
  Eye,
  EyeOff,
  UserCheck,
} from 'lucide-react';
import { useAulaCheckStore } from '@/lib/store';
import type { UserRole } from '@/lib/types';
import InstitutionalHelpButton from '@/components/InstitutionalHelpModal';

function AulaCheckLogo({ centered = false }: { centered?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${centered ? 'justify-center' : ''}`}>
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0f2557] to-indigo-700 flex items-center justify-center shadow-elevated">
        <CheckCircle2 className="w-7 h-7 text-white" />
      </div>
      <div className={centered ? 'text-left' : ''}>
        <div className="text-headline-sm font-bold text-[#0f2557] tracking-tight leading-none">
          Aula Check
        </div>
        <div className="text-label-sm text-indigo-700/80 uppercase tracking-wider mt-0.5 font-semibold">
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-indigo-50/30 to-slate-100 flex flex-col">
      {/* ── Header ── */}
      <header className="w-full bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-header">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <AulaCheckLogo />
          <div className="flex items-center gap-2.5">
            <InstitutionalHelpButton defaultTab="coordinacion" />
            <Link
              href="/comercial"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-amber-400 text-slate-950 font-semibold text-xs sm:text-sm shadow-2xs hover:bg-amber-300 transition-all whitespace-nowrap"
            >
              🚀 <span className="hidden sm:inline">Ver Presentación Comercial</span>
              <span className="sm:hidden">Comercial</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Content: Tarjeta Central Única de Login Institucional Unificado ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md animate-fade-in">
          <div className="bg-white rounded-3xl shadow-elevated border border-slate-200/80 overflow-hidden">
            {/* Banda superior institucional azul marino / índigo */}
            <div className="h-2 w-full bg-gradient-to-r from-[#0f2557] via-indigo-600 to-blue-600" />

            <div className="p-7 sm:p-8">
              {/* Logo y Títulos */}
              <div className="text-center mb-6">
                <div className="mb-4 flex justify-center">
                  <AulaCheckLogo centered />
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-800 text-xs font-bold mb-3">
                  <Lock className="w-3.5 h-3.5 text-indigo-600" />
                  Single Sign-On Universitario
                </div>
                <h1 className="text-headline-md sm:text-headline-lg text-[#0f2557] font-bold tracking-tight">
                  Portal Institucional Unificado
                </h1>
                <p className="text-body-md text-slate-600 mt-1.5">
                  Ingresa con tu correo institucional y contraseña asignada
                </p>
              </div>

              {/* Alerta de Error */}
              {errorMsg && (
                <div
                  className="mb-5 flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-body-sm animate-fade-in"
                  role="alert"
                >
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold text-red-950">No se pudo iniciar sesión</p>
                    <p className="text-red-800 mt-0.5">{errorMsg}</p>
                  </div>
                </div>
              )}

              {/* Formulario Único */}
              <form onSubmit={handleLogin} noValidate className="space-y-4">
                <div>
                  <label
                    htmlFor="institutional-email"
                    className="block text-label-lg font-semibold text-slate-800 mb-1.5"
                  >
                    Correo institucional
                  </label>
                  <div className="relative">
                    <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                      className="w-full h-12 pl-11 pr-4 rounded-xl border-2 border-slate-200 bg-slate-50/60 focus:bg-white text-slate-900 text-body-md focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="institutional-password"
                    className="block text-label-lg font-semibold text-slate-800 mb-1.5"
                  >
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                      className="w-full h-12 pl-11 pr-11 rounded-xl border-2 border-slate-200 bg-slate-50/60 focus:bg-white text-slate-900 text-body-md focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 p-1 rounded-lg transition-colors"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 mt-2 rounded-xl bg-gradient-to-r from-[#0f2557] to-indigo-700 hover:from-[#163172] hover:to-indigo-800 text-white font-bold text-label-lg flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-card disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Autenticando...</span>
                    </>
                  ) : (
                    <>
                      <span>Ingresar al Portal Institucional</span>
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>

              {/* ── Acordeón de Acceso Rápido (Demostración) ── */}
              <div className="mt-6 pt-5 border-t border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setDemoOpen((prev) => !prev)}
                  aria-expanded={demoOpen}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/80 text-xs font-semibold text-slate-700 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span aria-hidden>🔑</span>
                    <span>Credenciales de demostración rápida</span>
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${
                      demoOpen ? 'rotate-180 text-indigo-600' : ''
                    }`}
                  />
                </button>

                {demoOpen && (
                  <div className="mt-2.5 grid grid-cols-1 gap-2 animate-fade-in">
                    <button
                      type="button"
                      onClick={() => fillDemoCredentials('admin@universidad.edu.co', '123456')}
                      className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-violet-200 bg-violet-50/70 hover:bg-violet-100/80 text-left transition-colors group"
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <Shield className="w-4 h-4 text-violet-700 shrink-0" />
                        <span className="min-w-0">
                          <span className="block text-xs font-bold text-violet-950">
                            Coordinador (Superadmin)
                          </span>
                          <span className="block text-[11px] font-mono text-violet-700 truncate">
                            admin@universidad.edu.co / 123456
                          </span>
                        </span>
                      </span>
                      <span className="text-[11px] font-bold text-violet-700 group-hover:translate-x-0.5 transition-transform shrink-0">
                        Usar →
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        fillDemoCredentials('alejandro.morales@universidad.edu.co', '123456')
                      }
                      className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100/80 text-left transition-colors group"
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <UserCheck className="w-4 h-4 text-blue-700 shrink-0" />
                        <span className="min-w-0">
                          <span className="block text-xs font-bold text-blue-950">
                            Docente Titular
                          </span>
                          <span className="block text-[11px] font-mono text-blue-700 truncate">
                            alejandro.morales@universidad.edu.co / 123456
                          </span>
                        </span>
                      </span>
                      <span className="text-[11px] font-bold text-blue-700 group-hover:translate-x-0.5 transition-transform shrink-0">
                        Usar →
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fillDemoCredentials('juan.perez@universidad.edu.co', '123456')}
                      className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/80 text-left transition-colors group"
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <GraduationCap className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span className="min-w-0">
                          <span className="block text-xs font-bold text-emerald-950">
                            Estudiante
                          </span>
                          <span className="block text-[11px] font-mono text-emerald-700 truncate">
                            juan.perez@universidad.edu.co / 123456
                          </span>
                        </span>
                      </span>
                      <span className="text-[11px] font-bold text-emerald-700 group-hover:translate-x-0.5 transition-transform shrink-0">
                        Usar →
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className="text-body-sm text-slate-500 text-center mt-5">
            Detección automática de perfil académico • Periodo 2026-2
          </p>
        </div>
      </main>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-on-surface-variant">
          Cargando portal institucional...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
