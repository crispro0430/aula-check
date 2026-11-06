import crypto from 'crypto';
import prisma from '@/lib/prisma';
import type { UserRole } from '@/lib/types';

export const SESSION_COOKIE_NAME = 'aula_check_session';
export const DEFAULT_INSTITUTIONAL_PASSWORD = '123456';
export const MASTER_DEMO_PASSWORD = 'AulaCheck2026*';

const SESSION_SECRET =
  process.env.AUTH_SECRET || 'aula-check-telebit-institutional-secret-2026';

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

export function verifyInstitutionalPassword(
  storedPassword: string | null | undefined,
  providedPassword: string,
): boolean {
  const cleanProvided = providedPassword.trim();
  if (!cleanProvided) return false;
  const effectiveStored = storedPassword || DEFAULT_INSTITUTIONAL_PASSWORD;
  if (cleanProvided === effectiveStored) return true;
  // Si el usuario conserva la clave por defecto, permitir cualquiera de las dos claves institucionales estándar
  if (
    effectiveStored === DEFAULT_INSTITUTIONAL_PASSWORD &&
    (cleanProvided === DEFAULT_INSTITUTIONAL_PASSWORD || cleanProvided === MASTER_DEMO_PASSWORD)
  ) {
    return true;
  }
  return false;
}

export function encodeSessionToken(user: AuthenticatedUser): string {
  const payload = Buffer.from(
    JSON.stringify({
      ...user,
      iat: Date.now(),
    }),
    'utf-8',
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

export function decodeSessionToken(token: string | undefined | null): AuthenticatedUser | null {
  if (!token || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  if (signature !== expectedSig) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as AuthenticatedUser;
    if (!parsed.id || !parsed.email || !parsed.role) return null;
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
      // 1. Coordinadores
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

