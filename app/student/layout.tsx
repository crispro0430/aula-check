'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CheckCircle2, ArrowLeft, GraduationCap, LogOut } from 'lucide-react';
import { useAulaCheckStore } from '@/lib/store';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const currentUser      = useAulaCheckStore((s) => s.currentUser);
  const clearCurrentUser = useAulaCheckStore((s) => s.clearCurrentUser);

  function handleLogout() {
    clearCurrentUser();
    router.push('/');
  }

  const showBack = pathname !== '/student/check-in' && pathname !== '/student/incapacities';
  const pendingMine = useAulaCheckStore((s) => {
    const me = s.currentUser
      ? s.students.find(
          (st) =>
            st.email.toLowerCase() === s.currentUser?.email.toLowerCase() ||
            st.name.toLowerCase() === s.currentUser?.name.toLowerCase(),
        )
      : undefined;
    const myId = me?.id ?? '2021815001';
    return s.incapacities.filter((i) => i.studentId === myId && i.status === 'Pendiente').length;
  });

  const STUDENT_TABS = [
    { href: '/student/check-in',     label: '✅ Asistencia' },
    { href: '/student/incapacities', label: '📄 Mis Incapacidades / Excusas' },
  ] as const;

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center">
      {/* ── Top Bar ── */}
      <header className="fixed top-0 inset-x-0 z-50 bg-surface/90 backdrop-blur-xl shadow-header">
        <div className="h-16 max-w-md mx-auto px-4 flex items-center justify-between gap-3">
          {/* Left: Back or Logo */}
          <div className="flex items-center gap-2">
            {showBack ? (
              <button
                onClick={() => router.back()}
                className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container active:scale-95 transition-all"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="flex flex-col leading-none">
              <span className="text-label-lg text-primary font-bold tracking-tight">Aula Check</span>
              <span className="text-label-sm text-on-surface-variant">Portal Estudiantil</span>
            </div>
          </div>

          {/* Right: User info */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col text-right">
              <span className="text-label-md text-on-surface font-semibold leading-tight">
                {currentUser?.name ?? 'Estudiante'}
              </span>
              <span className="text-label-sm text-on-surface-variant">Ing. Sistemas</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-white font-bold text-label-md shrink-0">
              {currentUser?.name?.charAt(0) ?? 'E'}
            </div>
            <button
              onClick={handleLogout}
              className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-red-50 hover:text-error transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Pestañas del portal estudiantil ── */}
        <nav className="max-w-md mx-auto px-4 pb-2 flex gap-1" aria-label="Secciones del portal estudiantil">
          {STUDENT_TABS.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex-1 text-center py-2 px-2 rounded-lg text-label-md font-semibold transition-all ${
                  active
                    ? 'bg-primary-container text-white shadow-card'
                    : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {label}
                {href === '/student/incapacities' && pendingMine > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {pendingMine}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* ── Content (centrado, max-w-md = móvil) ── */}
      <main className="w-full max-w-md flex-1 flex flex-col pt-28 px-4 pb-8">
        {children}
      </main>
    </div>
  );
}
