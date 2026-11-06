'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CheckCircle2, BookOpen, Monitor, Radio, FileText, Bell, HelpCircle, LogOut, FileHeart } from 'lucide-react';
import { useAulaCheckStore } from '@/lib/store';

const NAV_ITEMS = [
  { label: 'Apertura',   href: '/teacher/setup',     icon: BookOpen },
  { label: 'Proyector',  href: '/teacher/projector',  icon: Monitor  },
  { label: 'En Vivo',    href: '/teacher/live',       icon: Radio    },
  { label: 'Cierre',     href: '/teacher/summary',    icon: FileText },
  { label: 'Incapacidades', href: '/teacher/incapacities', icon: FileHeart },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const session          = useAulaCheckStore((s) => s.session);
  const clearCurrentUser = useAulaCheckStore((s) => s.clearCurrentUser);
  const pendingIncapacities = useAulaCheckStore(
    (s) => s.incapacities.filter((i) => i.status === 'Pendiente').length,
  );

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
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-low shadow-card">
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
                    <span className="ml-0.5 min-w-5 h-5 px-1.5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center" aria-label={`${pendingIncapacities} pendientes`}>
                      {pendingIncapacities}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors">
              <Bell className="w-4.5 h-4.5" />
            </button>
            <button className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors">
              <HelpCircle className="w-4.5 h-4.5" />
            </button>
            <div className="w-px h-6 bg-outline-variant/50 mx-1" />
            <div className="hidden md:flex flex-col text-right">
              <span className="text-label-md text-on-surface font-semibold leading-tight">Dr. Alejandro Morales</span>
              <span className="text-body-sm text-on-surface-variant">Ing. y Arq. de Software</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center text-white font-bold text-label-md shadow-card">
              AM
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
      <main className="flex-1 pt-16 lg:pt-16">
        {children}
      </main>
    </div>
  );
}
