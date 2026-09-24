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

  const showBack = pathname !== '/student/check-in';

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
      </header>

      {/* ── Content (centrado, max-w-md = móvil) ── */}
      <main className="w-full max-w-md flex-1 flex flex-col pt-16 px-4 pb-8">
        {children}
      </main>
    </div>
  );
}
