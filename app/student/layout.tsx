'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CheckCircle2, ArrowLeft, LogOut, ShieldAlert } from 'lucide-react';
import { useAulaCheckStore } from '@/lib/store';
import { useServerContextSync } from '@/lib/use-server-context';
import type { UserRole } from '@/lib/types';
import { useBrowserValue } from '@/lib/use-browser-value';
import InstitutionalHelpButton from '@/components/InstitutionalHelpModal';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Materias, estudiantes y perfil reales desde PostgreSQL
  useServerContextSync();
  const router   = useRouter();
  const currentUser      = useAulaCheckStore((s) => s.currentUser);
  const setCurrentUser   = useAulaCheckStore((s) => s.setCurrentUser);
  const clearCurrentUser = useAulaCheckStore((s) => s.clearCurrentUser);
  // Se re-evalúa en cada render (incluido el cambio de ruta) sin setState en efectos.
  const hasUnauthorizedParam = useBrowserValue(
    () => new URLSearchParams(window.location.search).has('unauthorized'),
    false,
  );
  const unauthorizedAlert = hasUnauthorizedParam
    ? 'Acceso no autorizado: Tu cuenta de estudiante solo tiene permisos para el Portal Estudiantil.'
    : null;

  // Hidratar sesión desde /api/auth/me si existe cookie activa
  useEffect(() => {
    let cancelled = false;
    async function hydrateUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          authenticated: boolean;
          user?: {
            id: string;
            name: string;
            email: string;
            role: UserRole;
            code?: string;
            program?: string;
          };
        };
        if (!cancelled && data.user && data.user.role === 'student') {
          setCurrentUser('student', data.user.name, data.user.email, {
            id: data.user.id,
            code: data.user.code,
            program: data.user.program,
          });
        }
      } catch {
        // Fallback local
      }
    }
    void hydrateUser();
    return () => {
      cancelled = true;
    };
  }, [setCurrentUser]);

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Continuar limpieza local
    }
    clearCurrentUser();
    router.push('/');
  }

  const showBack = pathname !== '/student/check-in' && pathname !== '/student/incapacities';
  const pendingMine = useAulaCheckStore((s) => {
    const me = s.currentUser
      ? s.students.find(
          (st) =>
            st.email.toLowerCase() === s.currentUser?.email.toLowerCase() ||
            st.name.toLowerCase() === s.currentUser?.name.toLowerCase() ||
            st.code === s.currentUser?.code,
        )
      : undefined;
    const myId = me?.id ?? s.currentUser?.code ?? '2021815001';
    return s.incapacities.filter(
      (i) => (i.studentId === myId || i.studentId === me?.code) && i.status === 'Pendiente',
    ).length;
  });

  const STUDENT_TABS = [
    { href: '/student/check-in',     label: 'Asistencia' },
    { href: '/student/incapacities', label: 'Mis Incapacidades' },
  ] as const;

  const rawStudentName =
    currentUser?.role === 'student' ? currentUser.name : 'Juan David Pérez';
  const displayStudentName = rawStudentName.replace(/\s*\([^)]*\)/g, '').trim() || 'Juan David Pérez';
  const displayStudentEmail =
    currentUser?.role === 'student' ? currentUser.email : 'juan.perez@universidad.edu.co';

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] flex flex-col items-center">
      {/* ── Top Bar iOS Translúcida ── */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/75 backdrop-blur-2xl border-b border-black/[0.06]">
        <div className="h-15 max-w-md mx-auto px-4 flex items-center justify-between gap-2">
          {/* Left: Back or Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            {showBack ? (
              <button
                onClick={() => router.back()}
                className="touch-target w-9 h-9 -ml-1.5 rounded-full flex items-center justify-center text-[#1d1d1f] hover:bg-black/[0.05] active:scale-95 transition-all"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-[#0071e3] flex items-center justify-center shadow-[0_4px_12px_-2px_rgba(0,113,227,0.4)]">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="flex flex-col leading-none">
              <span className="text-sm text-[#1d1d1f] font-semibold tracking-tight">Aula Check</span>
              <span className="text-[11px] text-[#6e6e73]">Portal Estudiantil</span>
            </div>
          </div>

          {/* Right: Guía + User info + Logout */}
          <div className="flex items-center gap-2 min-w-0">
            <InstitutionalHelpButton compact defaultTab="estudiantes" />
            <div className="flex flex-col text-right min-w-0 max-w-[110px] sm:max-w-[160px]">
              <span className="text-xs text-[#1d1d1f] font-semibold leading-tight truncate">
                {displayStudentName}
              </span>
              <span className="text-[11px] text-[#6e6e73] font-mono truncate">
                {displayStudentEmail}
              </span>
            </div>
            <div className="w-7 h-7 rounded-full bg-[#0071e3] flex items-center justify-center text-white font-semibold text-xs shrink-0">
              {displayStudentName.charAt(0)}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Cerrar sesión"
              className="touch-target h-8 px-2.5 rounded-full flex items-center gap-1 text-xs font-medium text-[#d70015] hover:bg-[#ff3b30]/10 border border-[#ff3b30]/20 transition-all active:scale-[0.98] whitespace-nowrap shrink-0"
              title="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>

        {/* ── Control Segmentado estilo iOS ── */}
        <div className="max-w-md mx-auto px-4 pb-2.5">
          <nav
            className="bg-[#e6e6e8]/80 p-1 rounded-[14px] flex gap-1"
            aria-label="Secciones del portal estudiantil"
          >
            {STUDENT_TABS.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex-1 inline-flex items-center justify-center min-h-[36px] text-center py-1.5 px-3 rounded-[10px] text-xs font-semibold transition-all active:scale-[0.98] ${
                    active
                      ? 'bg-white text-[#1d1d1f] shadow-[0_1px_4px_rgba(0,0,0,0.08)]'
                      : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                  }`}
                >
                  {label}
                  {href === '/student/incapacities' && pendingMine > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-[#c93400] text-white text-[11px] font-bold">
                      {pendingMine}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ── Content (centrado, max-w-md = móvil) ── */}
      <main className="w-full max-w-md flex-1 flex flex-col pt-32 px-4 pb-8">
        {unauthorizedAlert && (
          <div className="mt-3 p-3.5 rounded-2xl bg-[#ff3b30]/10 border border-[#ff3b30]/20 text-[#1d1d1f] text-xs font-semibold flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-[#d70015] shrink-0 mt-0.5" />
            <span>{unauthorizedAlert}</span>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
