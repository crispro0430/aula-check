'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  CheckCircle2,
  BookOpen,
  Monitor,
  Radio,
  FileText,
  LogOut,
  FileHeart,
  ShieldAlert,
} from 'lucide-react';
import { useAulaCheckStore } from '@/lib/store';
import type { UserRole } from '@/lib/types';
import InstitutionalHelpButton from '@/components/InstitutionalHelpModal';

const NAV_ITEMS = [
  { label: 'Apertura',      href: '/teacher/setup',        icon: BookOpen },
  { label: 'Proyector',     href: '/teacher/projector',    icon: Monitor  },
  { label: 'En Vivo',       href: '/teacher/live',         icon: Radio    },
  { label: 'Cierre',        href: '/teacher/summary',      icon: FileText },
  { label: 'Incapacidades', href: '/teacher/incapacities', icon: FileHeart },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const session          = useAulaCheckStore((s) => s.session);
  const currentUser      = useAulaCheckStore((s) => s.currentUser);
  const setCurrentUser   = useAulaCheckStore((s) => s.setCurrentUser);
  const clearCurrentUser = useAulaCheckStore((s) => s.clearCurrentUser);
  const courses          = useAulaCheckStore((s) => s.courses);
  const incapacities     = useAulaCheckStore((s) => s.incapacities);

  const [authBanner, setAuthBanner] = useState<string | null>(null);

  // Hidratar usuario desde /api/auth/me y proteger la ruta /teacher
  useEffect(() => {
    let cancelled = false;
    async function verifySession() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = (await res.json()) as {
            authenticated: boolean;
            user?: {
              id: string;
              name: string;
              email: string;
              role: UserRole;
              code?: string;
              department?: string;
              title?: string;
            };
          };
          if (!cancelled && data.user) {
            setCurrentUser(data.user.role, data.user.name, data.user.email, {
              id: data.user.id,
              code: data.user.code,
              department: data.user.department,
              title: data.user.title,
            });
            if (data.user.role === 'student') {
              router.replace('/student/check-in?unauthorized=teacher');
              return;
            }
          }
        }
      } catch {
        // Fallback a estado local
      }

      if (!cancelled && currentUser && currentUser.role === 'student') {
        setAuthBanner('Acceso no autorizado: Los estudiantes no pueden acceder al panel docente.');
        router.replace('/student/check-in?unauthorized=teacher');
      }
    }
    void verifySession();
    return () => {
      cancelled = true;
    };
  }, [currentUser, router, setCurrentUser]);

  // Calcular incapacidades pendientes únicamente de las materias asignadas a este docente
  const rawTeacherName = currentUser?.role === 'teacher' ? currentUser.name : 'Prof. Dr. Alejandro Morales';
  const activeTeacherName = rawTeacherName.replace(/\s*\([^)]*\)/g, '').trim() || 'Prof. Dr. Alejandro Morales';
  const activeTeacherEmail = currentUser?.role === 'teacher' ? currentUser.email : 'alejandro.morales@universidad.edu.co';
  const teacherInitials =
    activeTeacherName
      .replace(/^Prof\.|^Dr\.|^Dra\.|^Ing\./gi, '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0] ?? '')
      .join('')
      .toUpperCase() || 'AM';

  const myCourseCodes = new Set(
    courses
      .filter((c) => c.teacher.toLowerCase() === activeTeacherName.toLowerCase())
      .map((c) => c.code.toUpperCase()),
  );

  const pendingIncapacities = incapacities.filter(
    (i) => i.status === 'Pendiente' && myCourseCodes.has(i.courseCode.toUpperCase()),
  ).length;

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Continuar limpieza local
    }
    clearCurrentUser();
    router.push('/');
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* ── Top Bar ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface-container-lowest shadow-header">
        <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary-container flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:flex flex-col leading-none">
              <span className="text-label-lg text-primary font-bold tracking-tight">Aula Check</span>
              <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">Módulo Docente</span>
            </div>
          </div>

          {/* Session info pill */}
          {session.isActive && (
            <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-low shadow-card">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              <span className="text-label-sm text-primary font-semibold">{session.courseCode}</span>
              <span className="text-outline-variant">•</span>
              <span className="text-label-sm text-on-surface-variant">{session.room.split('-')[1] ?? session.room}</span>
              <span className="text-outline-variant">•</span>
              <span className="text-label-sm font-mono text-on-surface font-bold tracking-widest">PIN: {session.pin}</span>
            </div>
          )}

          {/* Nav (desktop) */}
          <nav className="hidden lg:flex items-center gap-1 bg-surface-container px-1 py-1 rounded-xl shadow-card">
            {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-label-lg transition-all duration-150 ${
                    active
                      ? 'bg-surface-container-lowest text-primary font-semibold shadow-card'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  {href === '/teacher/incapacities' && pendingIncapacities > 0 && (
                    <span
                      className="ml-0.5 min-w-5 h-5 px-1.5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center"
                      aria-label={`${pendingIncapacities} pendientes`}
                    >
                      {pendingIncapacities}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Actions: Guía + Perfil + Botón Cerrar Sesión */}
          <div className="flex items-center gap-2.5 shrink-0">
            <InstitutionalHelpButton defaultTab="docentes" />
            <div className="hidden xl:flex flex-col text-right">
              <span className="text-label-md text-on-surface font-semibold leading-tight whitespace-nowrap">
                {activeTeacherName}
              </span>
              <span className="text-xs text-on-surface-variant font-mono whitespace-nowrap">
                {activeTeacherEmail}
              </span>
            </div>
            <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center text-white font-bold text-label-md shadow-card shrink-0">
              {teacherInitials}
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-on-surface-variant hover:bg-red-50 hover:text-error border border-outline-variant/40 whitespace-nowrap shrink-0 transition-colors"
              title="Cerrar sesión institucional"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Cerrar Sesión</span>
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="lg:hidden border-t border-outline-variant/20 flex">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex-1 flex flex-col items-center gap-1 py-2 text-label-sm transition-colors ${
                  active ? 'text-primary font-semibold' : 'text-on-surface-variant'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {href === '/teacher/incapacities' && pendingIncapacities > 0 && (
                  <span className="absolute top-1 right-2 w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {pendingIncapacities}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 pt-28 lg:pt-16">
        {authBanner && (
          <div className="max-w-4xl mx-auto mt-4 px-4">
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-center gap-2 text-body-sm font-semibold">
              <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
              {authBanner}
            </div>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
