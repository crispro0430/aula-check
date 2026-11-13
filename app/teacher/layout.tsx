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
import { useServerContextSync } from '@/lib/use-server-context';
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
  // Materias, estudiantes y perfil reales desde PostgreSQL
  useServerContextSync();
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
  const [drawerPathname, setDrawerPathname] = useState(pathname);

  // Cerrar el drawer móvil al cambiar de ruta (ajuste de estado durante el render,
  // patrón recomendado por React en lugar de setState dentro de useEffect)
  if (drawerPathname !== pathname) {
    setDrawerPathname(pathname);
    setMobileDrawerOpen(false);
  }

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
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] flex">
      {/* ── Sidebar Desktop Translúcido estilo macOS Sequoia (w-64 / w-20) ── */}
      <aside
        className={`hidden lg:flex flex-col fixed top-0 left-0 bottom-0 z-40 bg-[#f5f5f7]/85 backdrop-blur-xl border-r border-black/[0.06] transition-[width] duration-300 ease-apple ${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Brand Header */}
        <div
          className={`h-16 flex items-center border-b border-black/[0.06] px-4 ${
            isSidebarCollapsed ? 'justify-center' : 'gap-3'
          }`}
        >
          <div className="w-9 h-9 rounded-xl bg-[#0071e3] flex items-center justify-center shrink-0 shadow-[0_4px_12px_-2px_rgba(0,113,227,0.4)]">
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
          {!isSidebarCollapsed && (
            <div className="flex flex-col leading-none overflow-hidden">
              <span className="text-sm font-semibold text-[#1d1d1f] tracking-tight truncate">
                Aula Check
              </span>
              <span className="text-[10px] font-medium text-[#86868b] uppercase tracking-wider mt-0.5 truncate">
                Módulo Docente
              </span>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className={`flex-1 py-4 px-3 space-y-1 ${isSidebarCollapsed ? 'overflow-visible' : 'overflow-y-auto overflow-x-hidden'}`}>
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
                      ? 'bg-black/[0.06] text-[#1d1d1f] font-semibold'
                      : 'text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.03]'
                  }`}
                >
                  <div className="relative flex items-center justify-center shrink-0">
                    <Icon
                      className={`w-5 h-5 transition-colors ${
                        active ? 'text-[#0071e3]' : 'text-[#86868b] group-hover:text-[#1d1d1f]'
                      }`}
                    />
                    {isSidebarCollapsed && showBadge && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#ff9500] text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-[#f5f5f7]">
                        {pendingIncapacities}
                      </span>
                    )}
                  </div>

                  {!isSidebarCollapsed && (
                    <>
                      <span className="text-xs truncate flex-1">{label}</span>
                      {showBadge && (
                        <span className="min-w-5 h-5 px-1.5 rounded-full text-[10px] font-semibold flex items-center justify-center bg-[#ff9500] text-white">
                          {pendingIncapacities}
                        </span>
                      )}
                    </>
                  )}
                </Link>

                {/* Tooltip Flotante en Modo Colapsado */}
                {isSidebarCollapsed && (
                  <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 rounded-xl bg-[#1d1d1f]/90 backdrop-blur-xl text-white text-xs font-medium whitespace-nowrap opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 shadow-lg z-50 flex items-center gap-2">
                    <span>{label}</span>
                    {showBadge && (
                      <span className="px-1.5 py-0.5 rounded-full bg-[#ff9500] text-white text-[10px] font-bold leading-none">
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
        <div className="p-3 border-t border-black/[0.06]">
          <button
            type="button"
            onClick={toggleSidebar}
            className={`w-full flex items-center rounded-xl py-2.5 px-3 text-xs font-medium text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.04] transition-all duration-200 ${
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
            className="fixed inset-0 bg-black/35 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <aside className="relative w-72 max-w-[82vw] bg-white/90 backdrop-blur-3xl h-full shadow-2xl border-r border-black/[0.08] flex flex-col z-10 animate-fade-in">
            <div className="h-16 px-4 flex items-center justify-between border-b border-black/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#0071e3] flex items-center justify-center text-white shadow-sm">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="flex flex-col leading-none">
                  <span className="text-sm font-semibold text-[#1d1d1f]">Aula Check</span>
                  <span className="text-[10px] font-medium text-[#86868b] uppercase tracking-wider mt-0.5">
                    Módulo Docente
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="p-2 rounded-xl text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.05]"
                aria-label="Cerrar menú"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
                const active = pathname === href;
                const showBadge = href === '/teacher/incapacities' && pendingIncapacities > 0;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all ${
                      active
                        ? 'bg-black/[0.06] text-[#1d1d1f] font-semibold'
                        : 'text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.03]'
                    }`}
                  >
                    <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-[#0071e3]' : ''}`} />
                    <span className="flex-1 truncate">{label}</span>
                    {showBadge && (
                      <span className="min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center bg-[#ff9500] text-white">
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
        className={`flex-1 flex flex-col min-w-0 transition-[padding] duration-300 ease-apple ${
          isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        {/* ── Clean Top Header Translúcido ── */}
        <header className="sticky top-0 z-30 h-16 bg-white/75 backdrop-blur-2xl border-b border-black/[0.06] flex items-center justify-between gap-3 pl-4 sm:pl-6">
          {/* Left: Hamburger (mobile) + Current Page Title + Active Session Pill */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-xl text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.05] transition-colors shrink-0"
              aria-label="Abrir menú de navegación"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 min-w-0">
              <div className="hidden sm:flex w-8 h-8 rounded-xl bg-[#0071e3]/10 text-[#0071e3] items-center justify-center shrink-0">
                <currentNavItem.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-semibold text-[#1d1d1f] tracking-tight truncate">
                  {currentNavItem.label}
                </h2>
                <p className="hidden sm:block text-[11px] text-[#86868b] truncate leading-none mt-0.5">
                  Gestión Docente de Asistencia y Permanencia
                </p>
              </div>
            </div>

            {session.isActive && (
              <div className="hidden xl:flex items-center gap-2 ml-3 px-3 py-1 rounded-full bg-black/[0.04] border border-black/[0.06]">
                <span className="w-2 h-2 rounded-full bg-[#34c759] animate-pulse" />
                <span className="text-xs text-[#0071e3] font-semibold">{session.courseCode}</span>
                <span className="text-[#86868b]">•</span>
                <span className="text-xs font-mono text-[#1d1d1f] font-semibold tracking-widest">
                  PIN: {session.pin}
                </span>
              </div>
            )}
          </div>

          {/* Right: Guía + Perfil Compacto + Cerrar Sesión */}
          <div className="flex items-center gap-3 pr-4 sm:pr-6 shrink-0">
            <InstitutionalHelpButton defaultTab="docentes" />

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#0071e3] flex items-center justify-center text-white font-semibold text-xs shrink-0">
                {teacherInitials}
              </div>
              <div className="hidden md:flex flex-col leading-tight">
                <span className="text-xs font-semibold text-[#1d1d1f] whitespace-nowrap">
                  {activeTeacherName}
                </span>
                <span
                  className="text-[11px] text-[#86868b] truncate max-w-[140px] font-mono"
                  title={activeTeacherEmail}
                >
                  {activeTeacherEmail}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#ff3b30] hover:bg-[#ff3b30]/10 px-2.5 sm:px-3 py-1.5 rounded-full border border-[#ff3b30]/20 transition-all active:scale-[0.98] whitespace-nowrap shrink-0"
              title="Cerrar sesión institucional"
              aria-label="Cerrar sesión institucional"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Cerrar Sesión</span>
            </button>
          </div>
        </header>

        {/* ── Page Content ── */}
        <main className="flex-1 min-w-0">
          {authBanner && (
            <div className="max-w-4xl mx-auto mt-4 px-4">
              <div className="p-4 rounded-2xl bg-[#ff3b30]/10 border border-[#ff3b30]/20 text-[#1d1d1f] flex items-center gap-2 text-xs font-semibold">
                <ShieldAlert className="w-5 h-5 text-[#ff3b30] shrink-0" />
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
