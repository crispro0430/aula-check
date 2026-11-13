import { NextResponse, type NextRequest } from 'next/server';

/**
 * Proxy (antes "middleware" en Next.js ≤ 15): chequeo OPTIMISTA de sesión para las
 * páginas protegidas por rol. No verifica la firma (eso ocurre en cada route handler
 * con `requireSession`), solo evita mostrar paneles a visitantes sin sesión o con un
 * rol distinto, y conserva el destino original en `?next=` (p. ej. un QR de check-in).
 */
const SESSION_COOKIE_NAME = 'aula_check_session';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const ROLE_BY_PREFIX: Array<[prefix: string, role: 'admin' | 'teacher' | 'student']> = [
  ['/admin', 'admin'],
  ['/teacher', 'teacher'],
  ['/student', 'student'],
];

const HOME_BY_ROLE = {
  admin: '/admin',
  teacher: '/teacher/setup',
  student: '/student/check-in',
} as const;

function readUnverifiedPayload(token: string | undefined): { role?: string; iat?: number } | null {
  if (!token) return null;
  const [payload] = token.split('.');
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as { role?: string; iat?: number };
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const match = ROLE_BY_PREFIX.find(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!match) return NextResponse.next();

  const payload = readUnverifiedPayload(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  const isFresh =
    typeof payload?.iat === 'number' && Date.now() - payload.iat <= SESSION_MAX_AGE_MS;

  if (!payload || !isFresh) {
    const loginUrl = new URL('/', request.url);
    loginUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  const role = payload.role;
  if (role !== match[1]) {
    const home =
      role === 'admin' || role === 'teacher' || role === 'student' ? HOME_BY_ROLE[role] : '/';
    return NextResponse.redirect(new URL(home, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/teacher/:path*', '/student/:path*'],
};
