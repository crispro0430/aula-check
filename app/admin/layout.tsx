'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CheckCircle2, LayoutDashboard, BookOpen, Users, LogOut, Shield, GraduationCap } from 'lucide-react';
import { useAulaCheckStore } from '@/lib/store';

const NAV_ITEMS = [
  { label: 'Dashboard',     href: '/admin',           icon: LayoutDashboard },
  { label: 'Asignaturas',   href: '/admin/courses',   icon: BookOpen },
  { label: 'Profesores',    href: '/admin/teachers',  icon: GraduationCap },
  { label: 'Estudiantes',   href: '/admin/students',  icon: Users },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const clearCurrentUser = useAulaCheckStore((s) => s.clearCurrentUser);

  function handleLogout() {
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
            <div className="w-9 h-9 rounded-lg bg-violet-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:flex flex-col leading-none">
              <span className="text-label-lg text-violet-700 font-bold tracking-tight">Aula Check</span>
              <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">Coordinación Académica</span>
            </div>
          </div>

          {/* Nav (desktop) */}
          <nav className="hidden md:flex items-center gap-1 bg-surface-container px-1 py-1 rounded-xl shadow-card">
            {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-label-lg transition-all duration-150 ${
                    active
                      ? 'bg-surface-container-lowest text-violet-700 font-semibold shadow-card'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-200">
              <Shield className="w-3.5 h-3.5 text-violet-600" />
              <span className="text-label-sm text-violet-700 font-semibold">Administrador</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold text-label-md shadow-card">
              CA
            </div>
            <button
              onClick={handleLogout}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-red-50 hover:text-error transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="md:hidden border-t border-outline-variant/20 flex">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex-1 flex flex-col items-center gap-1 py-2 text-label-sm transition-colors ${
                  active ? 'text-violet-700 font-semibold' : 'text-on-surface-variant'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 pt-16 md:pt-16">
        {children}
      </main>
    </div>
  );
}
