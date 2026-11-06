'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  CheckCircle2,
  LayoutDashboard,
  BookOpen,
  Users,
  LogOut,
  Shield,
  GraduationCap,
  FileHeart,
  Database,
} from 'lucide-react';
import { useAulaCheckStore } from '@/lib/store';
import type { UserRole } from '@/lib/types';
import InstitutionalHelpButton from '@/components/InstitutionalHelpModal';

const NAV_ITEMS = [
  { label: 'Dashboard',           href: '/admin',              icon: LayoutDashboard },
  { label: 'Asignaturas',         href: '/admin/courses',      icon: BookOpen },
  { label: 'Profesores',          href: '/admin/teachers',     icon: GraduationCap },
  { label: 'Estudiantes',         href: '/admin/students',     icon: Users },
  { label: 'Incapacidades',       href: '/admin/incapacities', icon: FileHeart },
  { label: 'Modelo de Datos / BD', href: '/admin/database',    icon: Database },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const currentUser      = useAulaCheckStore((s) => s.currentUser);
  const setCurrentUser   = useAulaCheckStore((s) => s.setCurrentUser);
  const clearCurrentUser = useAulaCheckStore((s) => s.clearCurrentUser);
  const pendingIncapacities = useAulaCheckStore(
    (s) => s.incapacities.filter((i) => i.status === 'Pendiente').length,
  );

  // Protección de ruta /admin: Si es Estudiante o Docente, redirigir a su panel correspondiente
  useEffect(() => {
    let cancelled = false;
    async function verifyAdminAccess() {
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
              department?: string;
            };
          };
          if (!cancelled && data.user) {
            setCurrentUser(data.user.role, data.user.name, data.user.email, {
              id: data.user.id,
              department: data.user.department,
            });
            if (data.user.role === 'student') {
              router.replace('/student/check-in?unauthorized=admin');
              return;
            }
            if (data.user.role === 'teacher') {
              router.replace('/teacher/setup?unauthorized=admin');
              return;
            }
          }
        }
      } catch {
        // Fallback local
      }

      if (!cancelled && currentUser) {
        if (currentUser.role === 'student') {
          router.replace('/student/check-in?unauthorized=admin');
        } else if (currentUser.role === 'teacher') {
          router.replace('/teacher/setup?unauthorized=admin');
        }
      }
    }
    void verifyAdminAccess();
    return () => {
      cancelled = true;
    };
  }, [currentUser, router, setCurrentUser]);

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Continuar limpieza local
    }
    clearCurrentUser();
    router.push('/');
  }

  const rawAdminName =
    currentUser?.role === 'admin' ? currentUser.name : 'Coordinación';
  const cleanedAdminName = rawAdminName.replace(/\s*\([^)]*\)/g, '').trim();
  const adminName =
    cleanedAdminName.toLowerCase().startsWith('coordinación') ? 'Coordinación' : cleanedAdminName || 'Coordinación';
  const adminEmail =
    currentUser?.role === 'admin'
      ? currentUser.email
      : 'admin@universidad.edu.co';

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* ── Top Bar ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface-container-lowest border-b border-outline-variant/20 shadow-header">
        <div className="max-w-[1440px] w-full mx-auto pl-4 sm:pl-6 h-16 flex items-center justify-between gap-2">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-white" />
            </div>
            <div className="hidden sm:flex flex-col leading-none">
              <span className="text-sm text-violet-700 font-bold tracking-tight">Aula Check</span>
              <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">Coordinación</span>
            </div>
          </div>

          {/* Nav (desktop) */}
          <nav className="hidden lg:flex items-center gap-0.5 bg-surface-container p-1 rounded-xl shadow-card min-w-0 overflow-x-auto">
            {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs xl:text-sm whitespace-nowrap transition-all duration-150 ${
                    active
                      ? 'bg-surface-container-lowest text-violet-700 font-semibold shadow-card'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {label}
                  {href === '/admin/incapacities' && pendingIncapacities > 0 && (
                    <span
                      className="ml-0.5 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center"
                      aria-label={`${pendingIncapacities} pendientes`}
                    >
                      {pendingIncapacities}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Actions: Guía + Perfil Compacto + Cerrar Sesión */}
          <div className="flex items-center gap-3 pr-4 sm:pr-6 shrink-0">
            <InstitutionalHelpButton defaultTab="coordinacion" />

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold text-xs shadow-card shrink-0">
                CA
              </div>
              <div className="hidden md:flex flex-col leading-tight">
                <span className="text-xs font-semibold text-slate-800 flex items-center gap-1 whitespace-nowrap">
                  <Shield className="w-3 h-3 text-violet-600 shrink-0" />
                  {adminName}
                </span>
                <span
                  className="text-[11px] text-gray-500 truncate max-w-[140px] font-mono"
                  title={adminEmail}
                >
                  {adminEmail}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-200 transition whitespace-nowrap shrink-0"
              title="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="lg:hidden border-t border-outline-variant/20 flex overflow-x-auto">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex-1 min-w-[84px] flex flex-col items-center gap-1 py-2 text-label-sm text-center transition-colors ${
                  active ? 'text-violet-700 font-semibold' : 'text-on-surface-variant'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {href === '/admin/incapacities' && pendingIncapacities > 0 && (
                  <span className="absolute top-1 right-3 w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {pendingIncapacities}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 pt-32 lg:pt-16">
        {children}
      </main>
    </div>
  );
}
