'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, Users, ChevronRight, BookOpen, BarChart3, CheckCircle2, Wifi, Shield } from 'lucide-react';
import { useAulaCheckStore } from '@/lib/store';

// ─── Componente Logo ─────────────────────────────────────────────────────────

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

// ─── Role Card ───────────────────────────────────────────────────────────────

function RoleCard({
  role, icon: Icon, title, description, features, color, onClick,
}: {
  role: 'teacher' | 'student' | 'admin';
  icon: React.ElementType;
  title: string;
  description: string;
  features: string[];
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative w-full text-left bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/40 shadow-card hover:shadow-elevated transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99]"
    >
      {/* Decorative glow */}
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none ${color}`} />

      <div className="relative flex items-start gap-4">
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-card flex-shrink-0 ${color}`}>
          <Icon className="w-8 h-8 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-headline-sm text-on-surface font-bold">{title}</h2>
            <ChevronRight className="w-5 h-5 text-on-surface-variant group-hover:text-primary transition-colors group-hover:translate-x-0.5 transition-transform" />
          </div>
          <p className="text-body-sm text-on-surface-variant mb-4">{description}</p>
          <ul className="space-y-1.5">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-body-sm text-on-surface-variant">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-container flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </button>
  );
}

// ─── Page Principal ───────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const setCurrentUser = useAulaCheckStore((s) => s.setCurrentUser);

  const [teacherEmail, setTeacherEmail] = useState('alejandro.morales@universidad.edu.co');
  const [studentEmail, setStudentEmail] = useState('juan.perez@universidad.edu.co');
  const [adminEmail, setAdminEmail]     = useState('coordinacion.academica@universidad.edu.co');
  const [activeTab, setActiveTab]       = useState<'teacher' | 'student' | 'admin'>('teacher');

  function handleLogin(role: 'teacher' | 'student' | 'admin') {
    if (role === 'teacher') {
      setCurrentUser('teacher', 'Prof. Dr. Alejandro Morales', teacherEmail);
      router.push('/teacher/setup');
    } else if (role === 'student') {
      setCurrentUser('student', 'Juan David Pérez', studentEmail);
      router.push('/student/check-in');
    } else {
      setCurrentUser('admin', 'Coordinación Académica', adminEmail);
      router.push('/admin');
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* ── Header ── */}
      <header className="w-full bg-surface-container-lowest border-b border-outline-variant/30 shadow-header">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <AulaCheckLogo />
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container shadow-card">
            <Wifi className="w-3.5 h-3.5 text-secondary animate-pulse" />
            <span className="text-label-sm text-primary font-semibold">Periodo 2026-2</span>
            <span className="text-outline-variant">•</span>
            <span className="text-label-sm text-on-surface-variant">Universidad del Valle</span>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl animate-fade-in">
          {/* Eyebrow */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-label-sm text-primary font-semibold">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              Autenticación Universitaria
            </span>
          </div>

          <h1 className="text-headline-xl text-on-surface font-bold text-center tracking-tight mb-2">
            Selecciona tu rol
          </h1>
          <p className="text-body-lg text-on-surface-variant text-center mb-8 max-w-md mx-auto">
            Ingresa con tu correo <span className="text-primary font-semibold">@universidad.edu.co</span> y accede a tu panel.
          </p>

          {/* ── Tab Selector ── */}
          <div className="bg-surface-container rounded-xl p-1 flex mb-6 shadow-card">
            {(['teacher', 'student', 'admin'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
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
            <div className="animate-scale-in">
              <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-card border border-outline-variant/30">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-headline-sm text-on-surface font-bold">Panel Docente</div>
                    <div className="text-body-sm text-on-surface-variant">Gestión de asistencia y participación</div>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="text-label-lg text-on-surface block mb-1.5">Correo institucional</label>
                  <input
                    type="email"
                    value={teacherEmail}
                    onChange={(e) => setTeacherEmail(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border-2 border-outline-variant bg-white text-on-surface text-body-lg focus:outline-none focus:border-primary-container focus:ring-4 focus:ring-primary-container/10 transition-all"
                    placeholder="nombre@universidad.edu.co"
                  />
                </div>
                <div className="mb-5">
                  <label className="text-label-lg text-on-surface block mb-1.5">Contraseña</label>
                  <input
                    type="password"
                    defaultValue="••••••••"
                    className="w-full h-12 px-4 rounded-xl border-2 border-outline-variant bg-white text-on-surface text-body-lg focus:outline-none focus:border-primary-container focus:ring-4 focus:ring-primary-container/10 transition-all"
                  />
                </div>
                <button
                  onClick={() => handleLogin('teacher')}
                  className="w-full h-12 rounded-xl bg-primary-container text-white font-semibold text-label-lg flex items-center justify-center gap-2 hover:bg-primary transition-colors active:scale-[0.98] shadow-card"
                >
                  <GraduationCap className="w-5 h-5" />
                  Ingresar como Docente
                  <ChevronRight className="w-4 h-4" />
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
            </div>
          )}

          {activeTab === 'student' && (
            <div className="animate-scale-in">
              <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-card border border-outline-variant/30">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-headline-sm text-on-surface font-bold">Portal Estudiantil</div>
                    <div className="text-body-sm text-on-surface-variant">Registro de asistencia y semáforo</div>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="text-label-lg text-on-surface block mb-1.5">Correo institucional</label>
                  <input
                    type="email"
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border-2 border-outline-variant bg-white text-on-surface text-body-lg focus:outline-none focus:border-secondary focus:ring-4 focus:ring-secondary/10 transition-all"
                    placeholder="nombre@universidad.edu.co"
                  />
                </div>
                <div className="mb-5">
                  <label className="text-label-lg text-on-surface block mb-1.5">Contraseña</label>
                  <input
                    type="password"
                    defaultValue="••••••••"
                    className="w-full h-12 px-4 rounded-xl border-2 border-outline-variant bg-white text-on-surface text-body-lg focus:outline-none focus:border-secondary focus:ring-4 focus:ring-secondary/10 transition-all"
                  />
                </div>
                <button
                  onClick={() => handleLogin('student')}
                  className="w-full h-12 rounded-xl bg-secondary text-white font-semibold text-label-lg flex items-center justify-center gap-2 hover:bg-secondary/90 transition-colors active:scale-[0.98] shadow-card"
                >
                  <GraduationCap className="w-5 h-5" />
                  Ingresar como Estudiante
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'admin' && (
            <div className="animate-scale-in">
              <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-card border border-outline-variant/30">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-headline-sm text-on-surface font-bold">Coordinación Académica</div>
                    <div className="text-body-sm text-on-surface-variant">Gestión de cursos, docentes y expedientes</div>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="text-label-lg text-on-surface block mb-1.5">Correo institucional</label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border-2 border-outline-variant bg-white text-on-surface text-body-lg focus:outline-none focus:border-violet-600 focus:ring-4 focus:ring-violet-600/10 transition-all"
                    placeholder="coordinacion@universidad.edu.co"
                  />
                </div>
                <div className="mb-5">
                  <label className="text-label-lg text-on-surface block mb-1.5">Contraseña de Administrador</label>
                  <input
                    type="password"
                    defaultValue="••••••••"
                    className="w-full h-12 px-4 rounded-xl border-2 border-outline-variant bg-white text-on-surface text-body-lg focus:outline-none focus:border-violet-600 focus:ring-4 focus:ring-violet-600/10 transition-all"
                  />
                </div>
                <button
                  onClick={() => handleLogin('admin')}
                  className="w-full h-12 rounded-xl bg-violet-600 text-white font-semibold text-label-lg flex items-center justify-center gap-2 hover:bg-violet-700 transition-colors active:scale-[0.98] shadow-card"
                >
                  <Shield className="w-5 h-5" />
                  Ingresar como Coordinación / Administrador
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Direct coordinator access quick link */}
          <div className="mt-4 text-center">
            <button
              onClick={() => handleLogin('admin')}
              className="inline-flex items-center gap-1.5 text-label-md text-violet-700 hover:text-violet-900 font-semibold underline underline-offset-4 decoration-violet-300 hover:decoration-violet-600 transition-colors"
            >
              <Shield className="w-4 h-4" />
              Ingresar como Coordinación / Administrador
            </button>
          </div>

          {/* Footer note */}
          <p className="text-body-sm text-on-surface-variant text-center mt-6">
            Acceso exclusivo para la comunidad universitaria • Periodo académico 2026-2
          </p>
        </div>
      </main>
    </div>
  );
}
