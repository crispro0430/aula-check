import { NextResponse, after, type NextRequest } from 'next/server';
import { requireSession, type AuthenticatedUser } from '@/lib/auth';
import type { UserRole } from '@/lib/types';

/** Claves que jamás deben salir del servidor en una respuesta JSON. */
const SENSITIVE_KEYS = new Set(['password', 'userPassword']);

/**
 * Elimina recursivamente campos sensibles (p. ej. `password`) antes de serializar.
 * Defensa en profundidad frente a `include`/`findMany` de Prisma sin `select`.
 */
export function stripSensitive<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (key, value: unknown) => (SENSITIVE_KEYS.has(key) ? undefined : value)),
  ) as T;
}

/** `NextResponse.json` que nunca expone contraseñas. */
export function safeJson<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(stripSensitive(data), init);
}

/** Detalle técnico del error solo en desarrollo (SEC-06). */
export function errorDetails(error: unknown): { details?: string } {
  if (process.env.NODE_ENV !== 'development') return {};
  return { details: error instanceof Error ? error.message : 'Unknown error' };
}

export type AuthorizedRequest =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; response: NextResponse };

/**
 * Atajo para route handlers: valida la cookie firmada y el rol.
 * Uso: `const auth = authorize(request, ['admin']); if (!auth.ok) return auth.response;`
 */
export function authorize(
  request: NextRequest,
  allowedRoles?: readonly UserRole[],
): AuthorizedRequest {
  const check = requireSession(request, allowedRoles);
  if (check.ok) return { ok: true, user: check.user };
  return {
    ok: false,
    response: NextResponse.json({ error: check.error }, { status: check.status }),
  };
}

/** Detecta violaciones de unicidad de Prisma (P2002) sin importar el runtime de Prisma. */
export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/**
 * Ejecuta una tarea después de enviar la respuesta HTTP (`after` de Next.js),
 * de modo que el envío de correos nunca bloquee ni tumbe la petición. En plataformas
 * serverless (Vercel) `after` mantiene viva la función hasta que la tarea termina.
 */
export function runInBackground(label: string, task: () => Promise<unknown>): void {
  after(async () => {
    try {
      await task();
    } catch (error) {
      console.error(`[background:${label}]`, error);
    }
  });
}
