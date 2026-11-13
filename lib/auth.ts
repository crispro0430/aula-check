import crypto from 'crypto';
import { promisify } from 'util';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import type { UserRole } from '@/lib/types';

export const SESSION_COOKIE_NAME = 'aula_check_session';
/** Vigencia máxima de la cookie y del token firmado (7 días). */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
export const DEFAULT_INSTITUTIONAL_PASSWORD = '123456';
/** Clave de demostración: solo se acepta fuera de producción (SEC-02). */
export const MASTER_DEMO_PASSWORD = 'AulaCheck2026*';

const DEV_FALLBACK_SECRET = 'aula-check-dev-only-secret-do-not-use-in-production';
let warnedAboutDevSecret = false;

/**
 * Obtiene el secreto HMAC de sesión. En producción `AUTH_SECRET` (>= 32 caracteres)
 * es obligatorio: nunca se firman cookies con un secreto público del repositorio.
 */
function getSessionSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'AUTH_SECRET no está configurado (mínimo 32 caracteres). Defínelo en las variables de entorno.',
    );
  }
  if (!warnedAboutDevSecret) {
    warnedAboutDevSecret = true;
    console.warn(
      '[auth] AUTH_SECRET ausente o menor a 32 caracteres: usando secreto de desarrollo (no apto para producción).',
    );
  }
  return secret || DEV_FALLBACK_SECRET;
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  code?: string;
  department?: string;
  title?: string;
  program?: string;
}

export function isValidInstitutionalEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return false;
  return (
    normalized.endsWith('@universidad.edu.co') ||
    normalized.endsWith('.edu.co') ||
    normalized.endsWith('.edu')
  );
}

// ─── Hash de contraseñas (scrypt) con verificación dual transitoria ──────────

const scryptAsync = promisify(crypto.scrypt) as (
  password: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number,
) => Promise<Buffer>;

const SCRYPT_PREFIX = '$scrypt$';
const SCRYPT_KEYLEN = 64;

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function safeEqualStrings(a: string, b: string): boolean {
  return safeEqual(Buffer.from(a, 'utf-8'), Buffer.from(b, 'utf-8'));
}

/** Genera un hash `$scrypt$<salt>$<hash>` (base64url) para almacenar en PostgreSQL. */
export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const derived = await scryptAsync(plain.trim(), salt, SCRYPT_KEYLEN);
  return `${SCRYPT_PREFIX}${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export function isHashedPassword(stored: string | null | undefined): boolean {
  return Boolean(stored?.startsWith(SCRYPT_PREFIX));
}

/**
 * Verifica la contraseña institucional.
 * - Hash scrypt: comparación en tiempo constante.
 * - Texto plano heredado: se acepta de forma transitoria (el login la migra a hash).
 * - La clave maestra de demostración solo se acepta fuera de producción.
 */
export async function verifyInstitutionalPassword(
  storedPassword: string | null | undefined,
  providedPassword: string,
): Promise<boolean> {
  const cleanProvided = providedPassword.trim();
  if (!cleanProvided) return false;

  if (storedPassword && isHashedPassword(storedPassword)) {
    const [saltB64, hashB64] = storedPassword.slice(SCRYPT_PREFIX.length).split('$');
    if (!saltB64 || !hashB64) return false;
    const expected = Buffer.from(hashB64, 'base64url');
    const derived = await scryptAsync(
      cleanProvided,
      Buffer.from(saltB64, 'base64url'),
      expected.length,
    );
    return safeEqual(derived, expected);
  }

  const effectiveStored = storedPassword || DEFAULT_INSTITUTIONAL_PASSWORD;
  if (safeEqualStrings(cleanProvided, effectiveStored)) return true;

  return (
    process.env.NODE_ENV !== 'production' &&
    effectiveStored === DEFAULT_INSTITUTIONAL_PASSWORD &&
    safeEqualStrings(cleanProvided, MASTER_DEMO_PASSWORD)
  );
}

// ─── Token de sesión firmado (HMAC-SHA256) ───────────────────────────────────

export function encodeSessionToken(user: AuthenticatedUser): string {
  const payload = Buffer.from(
    JSON.stringify({
      ...user,
      iat: Date.now(),
    }),
    'utf-8',
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

export function decodeSessionToken(token: string | undefined | null): AuthenticatedUser | null {
  if (!token || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');
  if (!safeEqualStrings(signature, expectedSig)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf-8'),
    ) as AuthenticatedUser & { iat?: number };
    if (!parsed.id || !parsed.email || !parsed.role) return null;
    if (parsed.role !== 'admin' && parsed.role !== 'teacher' && parsed.role !== 'student') {
      return null;
    }
    const now = Date.now();
    if (
      typeof parsed.iat !== 'number' ||
      parsed.iat > now + 60_000 ||
      now - parsed.iat > SESSION_MAX_AGE_SECONDS * 1000
    ) {
      return null;
    }
    return {
      id: parsed.id,
      name: parsed.name,
      email: parsed.email,
      role: parsed.role,
      code: parsed.code,
      department: parsed.department,
      title: parsed.title,
      program: parsed.program,
    };
  } catch {
    return null;
  }
}

/** Lee y valida la sesión firmada desde la cookie HTTP-only de la petición. */
export function getSessionUser(request: NextRequest): AuthenticatedUser | null {
  try {
    return decodeSessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  } catch (error) {
    // p. ej. AUTH_SECRET ausente en producción: falla cerrada (sin sesión).
    console.error('[auth] No se pudo validar la sesión:', error);
    return null;
  }
}

export type SessionCheck =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Exige una sesión válida y, opcionalmente, uno de los roles permitidos.
 * La identidad y el rol SIEMPRE provienen del token firmado, nunca del body (SEC-01).
 */
export function requireSession(
  request: NextRequest,
  allowedRoles?: readonly UserRole[],
): SessionCheck {
  const user = getSessionUser(request);
  if (!user) {
    return {
      ok: false,
      status: 401,
      error: 'Sesión no válida o expirada. Inicia sesión nuevamente.',
    };
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return {
      ok: false,
      status: 403,
      error: 'No autorizado: tu rol no tiene permisos para esta operación.',
    };
  }
  return { ok: true, user };
}

let seedPromise: Promise<void> | null = null;

/**
 * Semilla idempotente de usuarios institucionales (Docentes, Estudiantes, Coordinación y Cursos)
 * con contraseña por defecto ("123456") en PostgreSQL/Supabase.
 */
export async function ensureInstitutionalUsersSeeded(): Promise<void> {
  if (seedPromise) {
    return seedPromise;
  }

  seedPromise = (async () => {
    try {
      // 1. Coordinadores (Superadmin)
      await prisma.coordinator.upsert({
        where: { email: 'admin@universidad.edu.co' },
        update: { name: 'Coordinación Académica' },
        create: {
          id: 'coord-admin',
          name: 'Coordinación Académica',
          email: 'admin@universidad.edu.co',
          password: DEFAULT_INSTITUTIONAL_PASSWORD,
          department: 'Escuela de Ingeniería de Sistemas y Computación',
          role: 'ADMIN',
        },
      });

      await prisma.coordinator.upsert({
        where: { email: 'coordinacion.academica@universidad.edu.co' },
        update: {},
        create: {
          id: 'coord-1',
          name: 'Coordinación Académica',
          email: 'coordinacion.academica@universidad.edu.co',
          password: DEFAULT_INSTITUTIONAL_PASSWORD,
          department: 'Escuela de Ingeniería de Sistemas y Computación',
          role: 'ADMIN',
        },
      });

      await prisma.coordinator.upsert({
        where: { email: 'coordinacion@universidad.edu.co' },
        update: {},
        create: {
          id: 'coord-2',
          name: 'Coordinación Académica',
          email: 'coordinacion@universidad.edu.co',
          password: DEFAULT_INSTITUTIONAL_PASSWORD,
          department: 'Escuela de Ingeniería de Sistemas y Computación',
          role: 'ADMIN',
        },
      });

      // 2. Docentes
      const seedTeachers = [
        {
          id: 't1',
          name: 'Prof. Dr. Alejandro Morales',
          email: 'alejandro.morales@universidad.edu.co',
          department: 'Escuela de Ingeniería de Sistemas y Computación',
          title: 'Ph.D. en Ingeniería de Software',
          phone: '+57 (2) 321-2100 Ext. 401',
        },
        {
          id: 't2',
          name: 'Dra. Carolina Mendoza',
          email: 'carolina.mendoza@universidad.edu.co',
          department: 'Escuela de Ingeniería de Sistemas y Computación',
          title: 'Doctora en Ciencias de la Computación',
          phone: '+57 (2) 321-2100 Ext. 405',
        },
        {
          id: 't3',
          name: 'Ing. Carlos Eduardo Ruiz',
          email: 'carlos.ruiz@universidad.edu.co',
          department: 'Departamento de Telecomunicaciones y Redes',
          title: 'Magíster en Ciberseguridad y Redes',
          phone: '+57 (2) 321-2100 Ext. 412',
        },
        {
          id: 't4',
          name: 'Dra. Marcela Valencia',
          email: 'marcela.valencia@universidad.edu.co',
          department: 'Escuela de Ingeniería de Sistemas y Computación',
          title: 'Ph.D. en Inteligencia Artificial y Datos',
          phone: '+57 (2) 321-2100 Ext. 420',
        },
      ];

      let mainTeacherId = 't1';
      for (const t of seedTeachers) {
        const upserted = await prisma.teacher.upsert({
          where: { email: t.email },
          update: {},
          create: {
            ...t,
            password: DEFAULT_INSTITUTIONAL_PASSWORD,
          },
        });
        if (t.email === 'alejandro.morales@universidad.edu.co') {
          mainTeacherId = upserted.id;
        }
      }

      // 3. Asignaturas del profesor principal
      const seedCourses = [
        {
          id: 'c1',
          code: 'G401',
          name: 'Arquitectura de Software',
          room: 'Edificio de Ingeniería G-401',
          schedule: 'Lun/Mié 08:00 - 10:00',
          teacherId: mainTeacherId,
        },
        {
          id: 'c2',
          code: 'G402',
          name: 'Sistemas Distribuidos',
          room: 'Laboratorio de Cómputo B-204',
          schedule: 'Mar/Jue 10:00 - 12:00',
          teacherId: mainTeacherId,
        },
        {
          id: 'c3',
          code: 'G405',
          name: 'Taller de Grado',
          room: 'Sala de Proyectos A-110',
          schedule: 'Vie 14:00 - 18:00',
          teacherId: mainTeacherId,
        },
      ];

      for (const c of seedCourses) {
        await prisma.course.upsert({
          where: { code: c.code },
          update: { teacherId: c.teacherId },
          create: {
            ...c,
            period: '2026-2',
          },
        });
      }

      // 4. Estudiantes principales
      const seedStudents = [
        { id: '2021815001', code: '2021815001', name: 'Juan David Pérez',  email: 'juan.perez@universidad.edu.co',  program: 'Ing. de Sistemas' },
        { id: '1',          code: '2021815023', name: 'Valentina Torres',  email: 'v.torres@universidad.edu.co',    program: 'Ing. de Sistemas' },
        { id: '2',          code: '2020815041', name: 'Santiago Ríos',     email: 's.rios@universidad.edu.co',      program: 'Ing. de Sistemas' },
        { id: '3',          code: '2022815007', name: 'Mariana Ospina',    email: 'm.ospina@universidad.edu.co',    program: 'Ing. de Sistemas' },
        { id: '4',          code: '2021815088', name: 'Daniel Herrera',    email: 'd.herrera@universidad.edu.co',   program: 'Ing. de Sistemas' },
        { id: '5',          code: '2023815012', name: 'Isabella Vargas',   email: 'i.vargas@universidad.edu.co',    program: 'Ing. de Sistemas' },
        { id: '6',          code: '2020815065', name: 'Alejandro Muñoz',   email: 'a.munoz@universidad.edu.co',     program: 'Ing. de Sistemas' },
      ];

      for (const s of seedStudents) {
        await prisma.student.upsert({
          where: { code: s.code },
          update: {},
          create: {
            ...s,
            password: DEFAULT_INSTITUTIONAL_PASSWORD,
          },
        });
      }
    } catch (error) {
      console.error('[ensureInstitutionalUsersSeeded] Error:', error);
    }
  })();

  return seedPromise;
}

