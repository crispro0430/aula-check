'use client';

import { useState, useEffect, Suspense, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  GraduationCap,
  Users,
  ChevronRight,
  BookOpen,
  BarChart3,
  CheckCircle2,
  Wifi,
  Shield,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react';
import { useAulaCheckStore } from '@/lib/store';
import type { UserRole } from '@/lib/types';

function AulaCheckLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 rounded-xl bg-primary-container flex items-center justify-center shadow-elevated">
        <CheckCircle2 className="w-7 h-7 text-white" />
      </div>
      <div>
        <div className="text-headline-sm font-bold text-primary tracking-tight leading-none">Aula Check</div>
        <div className="text-label-sm text-on-surface-variant uppercase tracking-wider mt-0.5">Sistema Institucional</div>
      </div>
    </div>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setCurrentUser = useAulaCheckStore((s) => s.setCurrentUser);
  const teachers = useAulaCheckStore((s) => s.teachers);
  const students = useAulaCheckStore((s) => s.students);

  const [activeTab, setActiveTab] = useState<'teacher' | 'student' | 'admin'>('teacher');
  const [teacherEmail, setTeacherEmail] = useState('alejandro.morales@universidad.edu.co');
  const [studentEmail, setStudentEmail] = useState('juan.perez@universidad.edu.co');
  const [adminEmail, setAdminEmail] = useState('coordinacion.academica@universidad.edu.co');
  const [password, setPassword] = useState('123456');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const unauthorizedParam = searchParams.get('unauthorized');

  useEffect(() => {
    if (unauthorizedParam) {
      setErrorMsg(
        'Acceso restringido: Tu rol actual no tiene permisos para acceder a esa sección. Inicia sesión con una cuenta autorizada.',
      );
    }
  }, [unauthorizedParam]);

  function getActiveEmail(role: UserRole): string {
    if (role === 'teacher') return teacherEmail;
    if (role === 'student') return studentEmail;
    return adminEmail;
  }

  async function handleLogin(role: UserRole, e?: FormEvent) {
    if (e) e.preventDefault();
    setErrorMsg(null);

    const email = getActiveEmail(role).trim().toLowerCase();
    const cleanPass = password.trim();

    if (!email || !cleanPass) {
      setErrorMsg('Por favor ingresa tu correo institucional y tu contraseña.');
      return;
    }

    if (
      !email.endsWith('@universidad.edu.co') &&
      !email.endsWith('.edu.co') &&
      !email.endsWith('.edu')
    ) {
      setErrorMsg(
        'Dominio no válido: Solo se permite el acceso con correo institucional (@universidad.edu.co).',
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: cleanPass,
          roleRequested: role,
        }),
      });

      const data = (await res.json()) as {
        authenticated?: boolean;
        error?: string;
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
        setErrorMsg(data.error || 'Credenciales inválidas. Verifica tu correo y contraseña.');
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

      setLoading(false);
      if (data.user.role === 'teacher') {
        router.push('/teacher/setup');
      } else if (data.user.role === 'student') {
        router.push('/student/check-in');
      } else {
        router.push('/admin');
      }
    } catch {
      // Respaldo (Fallback) offline: validar contra el directorio local si la clave es 123456 o AulaCheck2026*
      if (cleanPass !== '123456' && cleanPass !== 'AulaCheck2026*') {
        setErrorMsg('Contraseña institucional incorrecta.');
        setLoading(false);
        return;
      }

      if (role === 'teacher') {
        const localTeacher = teachers.find((t) => t.email.toLowerCase() === email);
        if (!localTeacher) {
          setErrorMsg(`No se encontró un docente con el correo ${email}.`);
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
      } else if (role === 'student') {
        const localStudent = students.find((s) => s.email.toLowerCase() === email);
        if (!localStudent) {
          setErrorMsg(`No se encontró un estudiante con el correo ${email}.`);
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
      } else {
        setCurrentUser('admin', 'Coordinación Académica', email, {
          id: 'coord-1',
          department: 'Coordinación Académica',
        });
        setLoading(false);
        router.push('/admin');
      }
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* ── Header ── */}
      <header className="w-full bg-surface-container-lowest border-b border-outline-variant/30 shadow-header">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <AulaCheckLogo />
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container shadow-card">
              <Wifi className="w-3.5 h-3.5 text-secondary animate-pulse" />
              <span className="text-label-sm text-primary font-semibold">Periodo 2026-2</span>
              <span className="text-outline-variant">•</span>
              <span className="text-label-sm text-on-surface-variant">Universidad del Valle</span>
            </div>
            <Link
              href="/comercial"
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-amber-400 text-slate-950 font-bold text-label-lg shadow-card hover:bg-amber-300 hover:-translate-y-0.5 transition-all whitespace-nowrap"
            >
              🚀 <span className="hidden sm:inline">Ver Presentación Comercial</span>
              <span className="sm:hidden">Comercial</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <main id="roles" className="flex-1 flex flex-col items-center justify-center px-4 py-12 scroll-mt-4">
        <div className="w-full max-w-2xl animate-fade-in">
          {/* Eyebrow */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-label-sm text-primary font-semibold">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              Autenticación Universitaria con Credenciales
            </span>
          </div>

          <h1 className="text-headline-xl text-on-surface font-bold text-center tracking-tight mb-2">
            Selecciona tu rol
          </h1>
          <p className="text-body-lg text-on-surface-variant text-center mb-6 max-w-md mx-auto">
            Ingresa con tu correo <span className="text-primary font-semibold">@universidad.edu.co</span> y tu contraseña institucional.
          </p>

          {errorMsg && (
            <div
              className="mb-5 flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-body-sm"
              role="alert"
            >
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold">Error de autenticación</p>
                <p>{errorMsg}</p>
              </div>
            </div>
          )}

          {/* ── Tab Selector ── */}
          <div className="bg-surface-container rounded-xl p-1 flex mb-6 shadow-card">
            {(['teacher', 'student', 'admin'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                  setErrorMsg(null);
                }}
                className={`flex-1 py-2.5 px-3 rounded-lg text-label-md sm:text-label-lg font-semibold transition-all duration-200 ${
                  activeTab === tab
                    ? 'bg-surface-container-lowest text-primary shadow-card'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {tab === 'teacher' ? '👨‍🏫 Docente' : tab === 'student' ? '🎓 Estudiante' : '🛡️ Coordinación'}
              </button>
            ))}
          </div>

          {/* ── Forms ── */}
          {activeTab === 'teacher' && (
            <form onSubmit={(e) => handleLogin('teacher', e)} className="animate-scale-in">
              <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-card border border-outline-variant/30">
                <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-headline-sm text-on-surface font-bold">Panel Docente</div>
                      <div className="text-body-sm text-on-surface-variant">Gestión de asistencia, participación e incapacidades</div>
                    </div>
                  </div>
                  <select
                    aria-label="Seleccionar cuenta docente de prueba"
                    value={teacherEmail}
                    onChange={(e) => setTeacherEmail(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-outline-variant/60 bg-surface-container-low text-xs font-semibold text-on-surface"
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.email}>
                        {t.name} ({t.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="text-label-lg text-on-surface block mb-1.5">Correo institucional</label>
                  <input
                    type="email"
                    required
                    value={teacherEmail}
                    onChange={(e) => setTeacherEmail(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border-2 border-outline-variant bg-white text-on-surface text-body-lg focus:outline-none focus:border-primary-container focus:ring-4 focus:ring-primary-container/10 transition-all"
                    placeholder="nombre@universidad.edu.co"
                  />
                </div>
                <div className="mb-4">
                  <label className="text-label-lg text-on-surface block mb-1.5">Contraseña</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-12 pl-4 pr-11 rounded-xl border-2 border-outline-variant bg-white text-on-surface text-body-lg focus:outline-none focus:border-primary-container focus:ring-4 focus:ring-primary-container/10 transition-all"
                      placeholder="Ingresa tu contraseña"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                      aria-label="Mostrar u ocultar contraseña"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="mb-5 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-2 text-xs text-blue-900">
                  <KeyRound className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>
                    Clave institucional por defecto: <code className="font-mono font-bold">123456</code> (o{' '}
                    <code className="font-mono font-bold">AulaCheck2026*</code>)
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl bg-primary-container text-white font-semibold text-label-lg flex items-center justify-center gap-2 hover:bg-primary transition-colors active:scale-[0.98] shadow-card disabled:opacity-60"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <GraduationCap className="w-5 h-5" />
                      Ingresar como Docente
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    { icon: BookOpen, label: 'UT-01 Setup' },
                    { icon: BarChart3, label: 'UT-06 Live' },
                    { icon: CheckCircle2, label: 'UT-07 Cierre' },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-surface-container">
                      <Icon className="w-4 h-4 text-primary-container" />
                      <span className="text-label-sm text-on-surface-variant text-center">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </form>
          )}

          {activeTab === 'student' && (
            <form onSubmit={(e) => handleLogin('student', e)} className="animate-scale-in">
              <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-card border border-outline-variant/30">
                <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                      <GraduationCap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-headline-sm text-on-surface font-bold">Portal Estudiantil</div>
                      <div className="text-body-sm text-on-surface-variant">Registro de asistencia, semáforo e incapacidades</div>
                    </div>
                  </div>
                  <select
                    aria-label="Seleccionar cuenta estudiantil de prueba"
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-outline-variant/60 bg-surface-container-low text-xs font-semibold text-on-surface"
                  >
                    {students.map((s) => (
                      <option key={s.id} value={s.email}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="text-label-lg text-on-surface block mb-1.5">Correo institucional</label>
                  <input
                    type="email"
                    required
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border-2 border-outline-variant bg-white text-on-surface text-body-lg focus:outline-none focus:border-secondary focus:ring-4 focus:ring-secondary/10 transition-all"
                    placeholder="nombre@universidad.edu.co"
                  />
                </div>
                <div className="mb-4">
                  <label className="text-label-lg text-on-surface block mb-1.5">Contraseña</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-12 pl-4 pr-11 rounded-xl border-2 border-outline-variant bg-white text-on-surface text-body-lg focus:outline-none focus:border-secondary focus:ring-4 focus:ring-secondary/10 transition-all"
                      placeholder="Ingresa tu contraseña"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                      aria-label="Mostrar u ocultar contraseña"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="mb-5 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-900">
                  <KeyRound className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    Clave institucional por defecto: <code className="font-mono font-bold">123456</code> (o{' '}
                    <code className="font-mono font-bold">AulaCheck2026*</code>)
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl bg-secondary text-white font-semibold text-label-lg flex items-center justify-center gap-2 hover:bg-secondary/90 transition-colors active:scale-[0.98] shadow-card disabled:opacity-60"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <GraduationCap className="w-5 h-5" />
                      Ingresar como Estudiante
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'admin' && (
            <form onSubmit={(e) => handleLogin('admin', e)} className="animate-scale-in">
              <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-card border border-outline-variant/30">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-headline-sm text-on-surface font-bold">Coordinación Académica</div>
                    <div className="text-body-sm text-on-surface-variant">Gestión de cursos, docentes, estudiantes y auditoría</div>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="text-label-lg text-on-surface block mb-1.5">Correo institucional</label>
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border-2 border-outline-variant bg-white text-on-surface text-body-lg focus:outline-none focus:border-violet-600 focus:ring-4 focus:ring-violet-600/10 transition-all"
                    placeholder="coordinacion.academica@universidad.edu.co"
                  />
                </div>
                <div className="mb-4">
                  <label className="text-label-lg text-on-surface block mb-1.5">Contraseña de Coordinación</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-12 pl-4 pr-11 rounded-xl border-2 border-outline-variant bg-white text-on-surface text-body-lg focus:outline-none focus:border-violet-600 focus:ring-4 focus:ring-violet-600/10 transition-all"
                      placeholder="Ingresa tu contraseña"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                      aria-label="Mostrar u ocultar contraseña"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="mb-5 px-3 py-2 rounded-xl bg-violet-50 border border-violet-200 flex items-center gap-2 text-xs text-violet-900">
                  <Lock className="w-4 h-4 text-violet-700 shrink-0" />
                  <span>
                    Clave institucional por defecto: <code className="font-mono font-bold">123456</code> (o{' '}
                    <code className="font-mono font-bold">AulaCheck2026*</code>)
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl bg-violet-600 text-white font-semibold text-label-lg flex items-center justify-center gap-2 hover:bg-violet-700 transition-colors active:scale-[0.98] shadow-card disabled:opacity-60"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Shield className="w-5 h-5" />
                      Ingresar como Coordinación / Administrador
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Footer note */}
          <p className="text-body-sm text-on-surface-variant text-center mt-6">
            Acceso exclusivo para la comunidad universitaria • Periodo académico 2026-2
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
          Cargando autenticación institucional...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
