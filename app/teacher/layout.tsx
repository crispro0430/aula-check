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
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
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
  const session            = useAulaCheckStore((s) => s.session);
  const currentUser        = useAulaCheckStore((s) => s.currentUser);
  const setCurrentUser     = useAulaCheckStore((s) => s.setCurrentUser);
  const clearCurrentUser   = useAulaCheckStore((s) => s.clearCurrentUser);
  const courses            = useAulaCheckStore((s) => s.courses);
  const incapacities       = useAulaCheckStore((s) => s.incapacities);
  const isSidebarCollapsed = useAulaCheckStore((s) => s.isSidebarCollapsed);
  const toggleSidebar      = useAulaCheckStore((s) => s.toggleSidebar);

  const [authBanner, setAuthBanner] = useState<string | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Cerrar el drawer móvil al cambiar de ruta
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

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

  const currentNavItem =
    NAV_ITEMS.find((item) => item.href === pathname) || NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-surface flex">
      {/* ── Sidebar Desktop (Colapsable w-64 / w-20) ── */}
      <aside
        className={`hidden lg:flex flex-col fixed top-0 left-0 bottom-0 z-40 bg-surface-container-lowest border-r border-outline-variant/20 shadow-card transition-all duration-300 ${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Brand Header */}
        <div
          className={`h-16 flex items-center border-b border-outline-variant/20 px-4 ${
            isSidebarCollapsed ? 'justify-center' : 'gap-3'
          }`}
        >
          <div className="w-9 h-9 rounded-xl bg-primary-container flex items-center justify-center shrink-0 shadow-card">
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
          {!isSidebarCollapsed && (
            <div className="flex flex-col leading-none overflow-hidden">
              <span className="text-sm font-bold text-primary tracking-tight truncate">
                Aula Check
              </span>
              <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mt-0.5 truncate">
                Módulo Docente
              </span>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto overflow-x-visible">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = pathname === href;
            const showBadge = href === '/teacher/incapacities' && pendingIncapacities > 0;

            return (
              <div key={href} className="relative group">
                <Link
                  href={href}
                  className={`flex items-center rounded-xl transition-all duration-200 ${
                    isSidebarCollapsed
                      ? 'justify-center h-11 w-full px-0'
                      : 'gap-3 px-3.5 py-2.5'
                  } ${
                    active
                      ? 'bg-primary text-white font-semibold shadow-card'
                      : 'text-on-surface-variant hover:text-primary hover:bg-blue-50/70'
                  }`}
                >
                  <div className="relative flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                    {isSidebarCollapsed && showBadge && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
                        {pendingIncapacities}
                      </span>
                    )}
                  </div>

                  {!isSidebarCollapsed && (
                    <>
                      <span className="text-xs font-medium truncate flex-1">{label}</span>
                      {showBadge && (
                        <span
                          className={`min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                            active
                              ? 'bg-white text-primary'
                              : 'bg-amber-500 text-white'
                          }`}
                        >
                          {pendingIncapacities}
                        </span>
                      )}
                    </>
                  )}
                </Link>

                {/* Tooltip Flotante en Modo Colapsado */}
                {isSidebarCollapsed && (
                  <div className="pointer-events-none fixed left-20 ml-2 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium whitespace-nowrap opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 shadow-elevated z-50 flex items-center gap-2 -mt-9">
                    <span>{label}</span>
                    {showBadge && (
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                        {pendingIncapacities}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Collapse Button Footer */}
        <div className="p-3 border-t border-outline-variant/20">
          <button
            type="button"
            onClick={toggleSidebar}
            className={`w-full flex items-center rounded-xl py-2.5 px-3 text-xs font-medium text-on-surface-variant hover:text-primary hover:bg-blue-50/70 transition-all duration-200 ${
              isSidebarCollapsed ? 'justify-center' : 'justify-between'
            }`}
            title={isSidebarCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
          >
            {!isSidebarCollapsed && <span>Colapsar menú</span>}
            {isSidebarCollapsed ? (
              <ChevronRight className="w-4 h-4 shrink-0" />
            ) : (
              <ChevronLeft className="w-4 h-4 shrink-0" />
            )}
          </button>
        </div>
      </aside>

      {/* ── Mobile Drawer Sidebar ── */}
      {mobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <aside className="relative w-72 max-w-[82vw] bg-surface-container-lowest h-full shadow-2xl flex flex-col z-10 animate-fade-in">
            <div className="h-16 px-4 flex items-center justify-between border-b border-outline-variant/20">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary-container flex items-center justify-center text-white shadow-card">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="flex flex-col leading-none">
                  <span className="text-sm font-bold text-primary">Aula Check</span>
                  <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mt-0.5">
                    Módulo Docente
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container"
                aria-label="Cerrar menú"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
              {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
                const active = pathname === href;
                const showBadge = href === '/teacher/incapacities' && pendingIncapacities > 0;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all ${
                      active
                        ? 'bg-primary text-white font-semibold shadow-card'
                        : 'text-on-surface-variant hover:text-primary hover:bg-blue-50/70'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className="flex-1 truncate">{label}</span>
                    {showBadge && (
                      <span
                        className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${
                          active ? 'bg-white text-primary' : 'bg-amber-500 text-white'
                        }`}
                      >
                        {pendingIncapacities}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* ── Main Content Wrapper ── */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        {/* ── Clean Top Header ── */}
        <header className="sticky top-0 z-30 h-16 bg-surface-container-lowest/95 backdrop-blur-md border-b border-outline-variant/20 flex items-center justify-between gap-3 pl-4 sm:pl-6">
          {/* Left: Hamburger (mobile) + Current Page Title + Active Session Pill */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-xl text-on-surface-variant hover:text-primary hover:bg-blue-50 transition-colors shrink-0"
              aria-label="Abrir menú de navegación"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 min-w-0">
              <div className="hidden sm:flex w-8 h-8 rounded-lg bg-blue-50 text-primary items-center justify-center shrink-0">
                <currentNavItem.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                  {currentNavItem.label}
                </h2>
                <p className="hidden sm:block text-[11px] text-gray-500 truncate leading-none mt-0.5">
                  Gestión Docente de Asistencia y Permanencia
                </p>
              </div>
            </div>

            {session.isActive && (
              <div className="hidden xl:flex items-center gap-2 ml-3 px-3 py-1 rounded-full bg-surface-container-low border border-outline-variant/30">
                <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                <span className="text-xs text-primary font-semibold">{session.courseCode}</span>
                <span className="text-outline-variant">•</span>
                <span className="text-xs font-mono text-on-surface font-bold tracking-widest">
                  PIN: {session.pin}
                </span>
              </div>
            )}
          </div>

          {/* Right: Guía + Perfil Compacto + Cerrar Sesión */}
          <div className="flex items-center gap-3 pr-4 sm:pr-6 shrink-0">
            <InstitutionalHelpButton defaultTab="docentes" />

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-white font-bold text-xs shadow-card shrink-0">
                {teacherInitials}
              </div>
              <div className="hidden md:flex flex-col leading-tight">
                <span className="text-xs font-semibold text-slate-800 whitespace-nowrap">
                  {activeTeacherName}
                </span>
                <span
                  className="text-[11px] text-gray-500 truncate max-w-[140px] font-mono"
                  title={activeTeacherEmail}
                >
                  {activeTeacherEmail}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-200 transition whitespace-nowrap shrink-0"
              title="Cerrar sesión institucional"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </header>

        {/* ── Page Content ── */}
        <main className="flex-1 min-w-0">
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
    </div>
  );
}
