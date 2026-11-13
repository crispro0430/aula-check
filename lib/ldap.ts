import {
  AlreadyExistsError,
  Attribute,
  Change,
  Client,
  InvalidCredentialsError,
  NoSuchObjectError,
  type Entry,
} from 'ldapts';
import type { UserRole } from '@/lib/types';

export const LDAP_TIMEOUT_MS = 3000;

export interface LdapDirectoryUser {
  dn: string;
  uid?: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  code?: string;
  department?: string;
  title?: string;
  phone?: string;
}

export type LdapAuthResult =
  | { status: 'disabled' }
  | { status: 'authenticated'; user: LdapDirectoryUser }
  | { status: 'account_disabled'; message: string }
  | { status: 'invalid_credentials'; message: string }
  | { status: 'unavailable'; reason: string };

export interface LdapSyncResult {
  ok: boolean;
  reason?: string;
}

export interface LdapPullUsersResult {
  ok: boolean;
  users: LdapDirectoryUser[];
  reason?: string;
}

export interface UpsertLdapUserInput {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  isActive?: boolean;
  code?: string;
  department?: string;
  title?: string;
  phone?: string;
}

export interface SyncLdapCourseGroupInput {
  code: string;
  name: string;
  teacherEmail?: string | null;
  studentEmails?: string[];
}

interface LdapConfig {
  url: string;
  baseDn: string;
  bindDn: string;
  bindPassword: string;
}

const ROLE_TO_OU: Record<UserRole, { ou: string; description: string }> = {
  admin: {
    ou: 'coordinacion',
    description: 'Coordinadores y Superadministradores Academicos de Aula Check',
  },
  teacher: {
    ou: 'docentes',
    description: 'Profesores Titulares de Asignaturas en Aula Check',
  },
  student: {
    ou: 'estudiantes',
    description: 'Estudiantes Matriculados en Aula Check',
  },
};

const USER_ATTRIBUTES = [
  'dn',
  'cn',
  'sn',
  'givenName',
  'displayName',
  'mail',
  'uid',
  'ou',
  'title',
  'department',
  'employeeNumber',
  'telephoneNumber',
  'description',
];

/**
 * Escapa caracteres especiales de filtros LDAP según RFC 4515 para prevenir LDAP Injection.
 * Orden obligatorio: backslash (\) primero para no re-escapar los códigos hexadecimales generados.
 */
export function escapeLdapFilter(input: string): string {
  return input
    .replace(/\\/g, '\\5c')
    .replace(/\*/g, '\\2a')
    .replace(/\(/g, '\\28')
    .replace(/\)/g, '\\29')
    .replace(/\0/g, '\\00');
}

/**
 * Escapa valores utilizados dentro de RDNs según RFC 4514 para prevenir DN Injection.
 */
export function escapeLdapRdn(input: string): string {
  let escaped = input
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/\+/g, '\\+')
    .replace(/"/g, '\\"')
    .replace(/</g, '\\<')
    .replace(/>/g, '\\>')
    .replace(/;/g, '\\;')
    .replace(/=/g, '\\=')
    .replace(/\0/g, '\\00');

  if (escaped.startsWith(' ') || escaped.startsWith('#')) {
    escaped = `\\${escaped}`;
  }
  if (escaped.endsWith(' ') && !escaped.endsWith('\\ ')) {
    escaped = `${escaped.slice(0, -1)}\\ `;
  }
  return escaped;
}

/**
 * Deduce el rol institucional en Aula Check a partir de la Unidad Organizativa (OU) del DN.
 */
export function detectRoleFromDn(dn: string): UserRole {
  const normalizedDn = dn.toLowerCase();
  if (normalizedDn.includes('ou=coordinacion')) {
    return 'admin';
  }
  if (normalizedDn.includes('ou=docentes')) {
    return 'teacher';
  }
  return 'student';
}

function getLdapConfig(): LdapConfig | null {
  if (process.env.LDAP_ENABLED !== 'true') {
    return null;
  }

  const url = process.env.LDAP_URL?.trim();
  const baseDn = process.env.LDAP_BASE_DN?.trim() || 'dc=aulacheck,dc=edu,dc=co';
  const bindDn = process.env.LDAP_BIND_DN?.trim() || `cn=admin,${baseDn}`;
  const bindPassword = process.env.LDAP_BIND_PASSWORD ?? '';

  if (!url || !bindPassword) {
    return null;
  }

  return { url, baseDn, bindDn, bindPassword };
}

function createLdapClient(url: string): Client {
  return new Client({
    url,
    timeout: LDAP_TIMEOUT_MS,
    connectTimeout: LDAP_TIMEOUT_MS,
    tlsOptions: url.startsWith('ldaps://')
      ? { rejectUnauthorized: process.env.LDAP_TLS_REJECT_UNAUTHORIZED !== 'false' }
      : undefined,
  });
}

function getEntryString(entry: Entry, attributeNames: string[]): string | undefined {
  for (const attr of attributeNames) {
    const raw = entry[attr];
    if (typeof raw === 'string' && raw.trim()) {
      return raw.trim();
    }
    if (Array.isArray(raw) && raw.length > 0) {
      const first = raw[0];
      if (typeof first === 'string' && first.trim()) {
        return first.trim();
      }
      if (Buffer.isBuffer(first)) {
        const decoded = first.toString('utf-8').trim();
        if (decoded) return decoded;
      }
    }
    if (Buffer.isBuffer(raw)) {
      const decoded = raw.toString('utf-8').trim();
      if (decoded) return decoded;
    }
  }
  return undefined;
}

function isInvalidCredentialsError(error: unknown): boolean {
  if (error instanceof InvalidCredentialsError) {
    return true;
  }
  if (typeof error === 'object' && error !== null) {
    const record = error as { code?: unknown; name?: unknown };
    if (record.code === 49 || record.name === 'InvalidCredentialsError') {
      return true;
    }
  }
  return false;
}

function isNoSuchObjectError(error: unknown): boolean {
  if (error instanceof NoSuchObjectError) {
    return true;
  }
  if (typeof error === 'object' && error !== null) {
    const record = error as { code?: unknown; name?: unknown };
    if (record.code === 32 || record.name === 'NoSuchObjectError') {
      return true;
    }
  }
  return false;
}

function isAlreadyExistsError(error: unknown): boolean {
  if (error instanceof AlreadyExistsError) {
    return true;
  }
  if (typeof error === 'object' && error !== null) {
    const record = error as { code?: unknown; name?: unknown };
    if (record.code === 68 || record.name === 'AlreadyExistsError') {
      return true;
    }
  }
  return false;
}

function splitFullName(fullName: string, fallbackUid: string): {
  cn: string;
  sn: string;
  givenName: string;
} {
  const cleaned = fullName.trim() || fallbackUid;
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const givenName = parts[0] || cleaned;
  const sn = parts.length > 1 ? parts[parts.length - 1] : cleaned;
  return { cn: cleaned, sn, givenName };
}

function mapEntryToDirectoryUser(entry: Entry, forcedRole?: UserRole): LdapDirectoryUser | null {
  if (!entry.dn) return null;
  const uid = getEntryString(entry, ['uid']);
  const rawMail = getEntryString(entry, ['mail']);
  const email = (
    rawMail || (uid ? `${uid}@universidad.edu.co` : '')
  ).toLowerCase();

  if (!email) return null;

  const role = forcedRole ?? detectRoleFromDn(entry.dn);
  const name =
    getEntryString(entry, ['cn', 'displayName']) ??
    (uid ? uid.replace(/[._-]+/g, ' ') : email.split('@')[0]);
  const description = getEntryString(entry, ['description'])?.toUpperCase();
  const isActive = description !== 'DISABLED';

  return {
    dn: entry.dn,
    uid,
    email,
    name,
    role,
    isActive,
    code: getEntryString(entry, ['employeeNumber']),
    department: getEntryString(entry, ['ou', 'department']),
    title: getEntryString(entry, ['title']),
    phone: getEntryString(entry, ['telephoneNumber']),
  };
}

/**
 * Ejecuta una operación administrativa LDAP bajo timeout estricto de 3000ms
 * y garantiza el cierre del socket al finalizar.
 */
async function withAdminLdapClient<T>(
  operationName: string,
  fn: (client: Client, config: LdapConfig) => Promise<T>,
  onUnavailable: (reason: string) => T,
): Promise<T> {
  const config = getLdapConfig();
  if (!config) {
    return onUnavailable(
      process.env.LDAP_ENABLED === 'true' ? 'LDAP_MISCONFIGURED' : 'LDAP_DISABLED',
    );
  }

  const client = createLdapClient(config.url);
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const execute = async (): Promise<T> => {
    try {
      await client.bind(config.bindDn, config.bindPassword);
      return await fn(client, config);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'LDAP_CONNECTION_ERROR';
      console.warn(`[LDAP:${operationName}] Operación no disponible (${reason}).`);
      return onUnavailable(reason);
    } finally {
      await client.unbind().catch(() => {});
    }
  };

  const guardTimeout = new Promise<T>((resolve) => {
    timeoutHandle = setTimeout(() => {
      console.warn(
        `[LDAP:${operationName}] Timeout estricto de ${LDAP_TIMEOUT_MS}ms superado.`,
      );
      resolve(onUnavailable('LDAP_TIMEOUT_EXCEEDED'));
    }, LDAP_TIMEOUT_MS + 100);
  });

  try {
    return await Promise.race([execute(), guardTimeout]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    void client.unbind().catch(() => {});
  }
}

async function ensureOrganizationalUnit(
  client: Client,
  ouName: string,
  baseDn: string,
  description: string,
): Promise<void> {
  const ouDn = `ou=${escapeLdapRdn(ouName)},${baseDn}`;
  try {
    await client.search(ouDn, {
      scope: 'base',
      filter: '(objectClass=organizationalUnit)',
      attributes: ['ou'],
      timeLimit: Math.ceil(LDAP_TIMEOUT_MS / 1000),
    });
  } catch (error) {
    if (!isNoSuchObjectError(error)) {
      throw error;
    }
    try {
      await client.add(ouDn, {
        objectClass: ['top', 'organizationalUnit'],
        ou: ouName,
        description,
      });
    } catch (addError) {
      if (!isAlreadyExistsError(addError)) {
        throw addError;
      }
    }
  }
}

async function findUserEntryByEmail(
  client: Client,
  baseDn: string,
  email: string,
): Promise<Entry | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const localPart = normalizedEmail.split('@')[0] ?? normalizedEmail;
  const escapedEmail = escapeLdapFilter(normalizedEmail);
  const escapedUid = escapeLdapFilter(localPart);

  const { searchEntries } = await client.search(baseDn, {
    scope: 'sub',
    filter: `(&(objectClass=inetOrgPerson)(|(mail=${escapedEmail})(uid=${escapedUid})))`,
    sizeLimit: 2,
    timeLimit: Math.ceil(LDAP_TIMEOUT_MS / 1000),
    attributes: USER_ATTRIBUTES,
  });

  return searchEntries[0] ?? null;
}

/**
 * Autentica un usuario institucional contra OpenLDAP/Active Directory.
 * - Respeta timeout estricto de 3000 ms para no colgar Serverless Functions en Vercel.
 * - Rechaza cuentas marcadas como DISABLED (HTTP 403).
 * - Rechaza de inmediato contraseñas inválidas (status: 'invalid_credentials').
 * - Permite fallback transparente a PostgreSQL cuando LDAP está deshabilitado o inalcanzable.
 */
export async function authenticateWithLDAP(
  email: string,
  password: string,
): Promise<LdapAuthResult> {
  if (process.env.LDAP_ENABLED !== 'true') {
    return { status: 'disabled' };
  }

  const ldapUrl = process.env.LDAP_URL?.trim();
  const baseDn = process.env.LDAP_BASE_DN?.trim() || 'dc=aulacheck,dc=edu,dc=co';
  const bindDn = process.env.LDAP_BIND_DN?.trim();
  const bindPassword = process.env.LDAP_BIND_PASSWORD;

  if (!ldapUrl) {
    console.warn('[LDAP] LDAP_ENABLED=true pero falta LDAP_URL. Activando fallback PostgreSQL.');
    return { status: 'unavailable', reason: 'LDAP_URL_NOT_CONFIGURED' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const cleanPassword = password;
  if (!normalizedEmail || !cleanPassword) {
    return { status: 'invalid_credentials', message: 'Credenciales vacías.' };
  }

  const localPart = normalizedEmail.split('@')[0] ?? normalizedEmail;
  const escapedEmail = escapeLdapFilter(normalizedEmail);
  const escapedUid = escapeLdapFilter(localPart);

  const client = createLdapClient(ldapUrl);

  const executeAuth = async (): Promise<LdapAuthResult> => {
    try {
      if (bindDn && bindPassword) {
        await client.bind(bindDn, bindPassword);
      }

      const searchFilter = `(&(objectClass=inetOrgPerson)(|(mail=${escapedEmail})(uid=${escapedUid})))`;
      const { searchEntries } = await client.search(baseDn, {
        scope: 'sub',
        filter: searchFilter,
        sizeLimit: 2,
        timeLimit: Math.ceil(LDAP_TIMEOUT_MS / 1000),
        attributes: USER_ATTRIBUTES,
      });

      const userEntry = searchEntries[0];
      if (!userEntry || !userEntry.dn) {
        return { status: 'unavailable', reason: 'USER_NOT_FOUND_IN_LDAP' };
      }

      const mappedUser = mapEntryToDirectoryUser(userEntry);
      if (!mappedUser) {
        return { status: 'unavailable', reason: 'LDAP_ENTRY_INCOMPLETE' };
      }

      if (!mappedUser.isActive) {
        return {
          status: 'account_disabled',
          message: 'Cuenta institucional inhabilitada. Comunícate con Coordinación Académica',
        };
      }

      try {
        await client.bind(userEntry.dn, cleanPassword);
      } catch (bindError) {
        if (isInvalidCredentialsError(bindError)) {
          return {
            status: 'invalid_credentials',
            message: 'Credenciales inválidas. Verifica tu correo y contraseña',
          };
        }
        throw bindError;
      }

      return {
        status: 'authenticated',
        user: mappedUser,
      };
    } catch (error) {
      if (isInvalidCredentialsError(error)) {
        return {
          status: 'invalid_credentials',
          message: 'Credenciales inválidas. Verifica tu correo y contraseña',
        };
      }
      const reason = error instanceof Error ? error.message : 'LDAP_CONNECTION_ERROR';
      console.warn(`[LDAP] Servidor no disponible (${reason}). Conmutando a fallback PostgreSQL.`);
      return { status: 'unavailable', reason };
    } finally {
      await client.unbind().catch(() => {});
    }
  };

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const hardTimeoutPromise = new Promise<LdapAuthResult>((resolve) => {
    timeoutHandle = setTimeout(() => {
      console.warn(`[LDAP] Timeout estricto de ${LDAP_TIMEOUT_MS}ms superado. Activando fallback PostgreSQL.`);
      resolve({ status: 'unavailable', reason: 'LDAP_TIMEOUT_EXCEEDED' });
    }, LDAP_TIMEOUT_MS + 100);
  });

  try {
    return await Promise.race([executeAuth(), hardTimeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    void client.unbind().catch(() => {});
  }
}

/**
 * Crea o actualiza una entrada `inetOrgPerson` en OpenLDAP dentro de
 * `ou=coordinacion`, `ou=docentes` o `ou=estudiantes`.
 */
export async function upsertLdapUser(input: UpsertLdapUserInput): Promise<LdapSyncResult> {
  const email = input.email.trim().toLowerCase();
  if (!email) {
    return { ok: false, reason: 'EMAIL_REQUIRED' };
  }

  return withAdminLdapClient<LdapSyncResult>(
    'upsertLdapUser',
    async (client, config) => {
      const uid = email.split('@')[0] || email;
      const { cn, sn, givenName } = splitFullName(input.name, uid);
      const statusLabel = input.isActive === false ? 'DISABLED' : 'ACTIVE';
      const roleMeta = ROLE_TO_OU[input.role];

      await ensureOrganizationalUnit(client, roleMeta.ou, config.baseDn, roleMeta.description);

      const existing = await findUserEntryByEmail(client, config.baseDn, email);

      if (existing?.dn) {
        const changes: Change[] = [
          new Change({
            operation: 'replace',
            modification: new Attribute({ type: 'cn', values: [cn] }),
          }),
          new Change({
            operation: 'replace',
            modification: new Attribute({ type: 'sn', values: [sn] }),
          }),
          new Change({
            operation: 'replace',
            modification: new Attribute({ type: 'givenName', values: [givenName] }),
          }),
          new Change({
            operation: 'replace',
            modification: new Attribute({ type: 'mail', values: [email] }),
          }),
          new Change({
            operation: 'replace',
            modification: new Attribute({ type: 'uid', values: [uid] }),
          }),
          new Change({
            operation: 'replace',
            modification: new Attribute({ type: 'description', values: [statusLabel] }),
          }),
        ];

        if (input.password?.trim()) {
          changes.push(
            new Change({
              operation: 'replace',
              modification: new Attribute({
                type: 'userPassword',
                values: [input.password.trim()],
              }),
            }),
          );
        }
        if (input.department?.trim()) {
          changes.push(
            new Change({
              operation: 'replace',
              modification: new Attribute({ type: 'ou', values: [input.department.trim()] }),
            }),
          );
        }
        if (input.title?.trim()) {
          changes.push(
            new Change({
              operation: 'replace',
              modification: new Attribute({ type: 'title', values: [input.title.trim()] }),
            }),
          );
        }
        if (input.code?.trim()) {
          changes.push(
            new Change({
              operation: 'replace',
              modification: new Attribute({
                type: 'employeeNumber',
                values: [input.code.trim()],
              }),
            }),
          );
        }
        if (input.phone?.trim()) {
          changes.push(
            new Change({
              operation: 'replace',
              modification: new Attribute({
                type: 'telephoneNumber',
                values: [input.phone.trim()],
              }),
            }),
          );
        }

        await client.modify(existing.dn, changes);
        return { ok: true };
      }

      const targetDn = `uid=${escapeLdapRdn(uid)},ou=${roleMeta.ou},${config.baseDn}`;
      const entryAttributes: Record<string, string | string[]> = {
        objectClass: ['top', 'person', 'organizationalPerson', 'inetOrgPerson'],
        uid,
        cn,
        sn,
        givenName,
        mail: email,
        userPassword: input.password?.trim() || '123456',
        description: statusLabel,
      };

      if (input.department?.trim()) entryAttributes.ou = input.department.trim();
      if (input.title?.trim()) entryAttributes.title = input.title.trim();
      if (input.code?.trim()) entryAttributes.employeeNumber = input.code.trim();
      if (input.phone?.trim()) entryAttributes.telephoneNumber = input.phone.trim();

      await client.add(targetDn, entryAttributes);
      return { ok: true };
    },
    (reason) => ({ ok: false, reason }),
  );
}

/**
 * Actualiza el estado (`description: ACTIVE | DISABLED`) de un usuario en OpenLDAP.
 * Los usuarios marcados como `DISABLED` quedan bloqueados en `authenticateWithLDAP`.
 */
export async function setLdapUserStatus(
  email: string,
  isActive: boolean,
): Promise<LdapSyncResult> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    return { ok: false, reason: 'EMAIL_REQUIRED' };
  }

  return withAdminLdapClient<LdapSyncResult>(
    'setLdapUserStatus',
    async (client, config) => {
      const existing = await findUserEntryByEmail(client, config.baseDn, cleanEmail);
      if (!existing?.dn) {
        return { ok: false, reason: 'USER_NOT_FOUND_IN_LDAP' };
      }

      const statusLabel = isActive ? 'ACTIVE' : 'DISABLED';
      await client.modify(existing.dn, [
        new Change({
          operation: 'replace',
          modification: new Attribute({ type: 'description', values: [statusLabel] }),
        }),
      ]);

      return { ok: true };
    },
    (reason) => ({ ok: false, reason }),
  );
}

/**
 * Elimina definitivamente la entrada del usuario en OpenLDAP (`client.del(dn)`).
 */
export async function deleteLdapUser(email: string): Promise<LdapSyncResult> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    return { ok: false, reason: 'EMAIL_REQUIRED' };
  }

  return withAdminLdapClient<LdapSyncResult>(
    'deleteLdapUser',
    async (client, config) => {
      const existing = await findUserEntryByEmail(client, config.baseDn, cleanEmail);
      if (!existing?.dn) {
        return { ok: true };
      }

      await client.del(existing.dn);
      return { ok: true };
    },
    (reason) => ({ ok: false, reason }),
  );
}

/**
 * Sincroniza una asignatura como grupo `groupOfNames` dentro de
 * `ou=asignaturas,dc=aulacheck,dc=edu,dc=co` con los DNs de docente y estudiantes.
 */
export async function syncLdapCourseGroup(
  input: SyncLdapCourseGroupInput,
): Promise<LdapSyncResult> {
  const cleanCode = input.code.trim().toUpperCase();
  const cleanName = input.name.trim();
  if (!cleanCode || !cleanName) {
    return { ok: false, reason: 'COURSE_CODE_AND_NAME_REQUIRED' };
  }

  return withAdminLdapClient<LdapSyncResult>(
    'syncLdapCourseGroup',
    async (client, config) => {
      await ensureOrganizationalUnit(
        client,
        'asignaturas',
        config.baseDn,
        'Grupos de Asignaturas Academicas y Matriculas de Aula Check',
      );

      const candidateEmails = Array.from(
        new Set(
          [
            ...(input.teacherEmail ? [input.teacherEmail] : []),
            ...(input.studentEmails ?? []),
          ]
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean),
        ),
      );

      const memberDns: string[] = [];
      for (const memberEmail of candidateEmails) {
        const entry = await findUserEntryByEmail(client, config.baseDn, memberEmail);
        if (entry?.dn) {
          memberDns.push(entry.dn);
        }
      }

      // El objectClass groupOfNames exige al menos un atributo member en OpenLDAP
      if (memberDns.length === 0) {
        memberDns.push(config.bindDn);
      }

      const groupDn = `cn=${escapeLdapRdn(cleanCode)},ou=asignaturas,${config.baseDn}`;
      let exists = false;
      try {
        const { searchEntries } = await client.search(groupDn, {
          scope: 'base',
          filter: '(objectClass=groupOfNames)',
          attributes: ['cn'],
          timeLimit: Math.ceil(LDAP_TIMEOUT_MS / 1000),
        });
        exists = searchEntries.length > 0;
      } catch (error) {
        if (!isNoSuchObjectError(error)) {
          throw error;
        }
      }

      if (exists) {
        await client.modify(groupDn, [
          new Change({
            operation: 'replace',
            modification: new Attribute({ type: 'description', values: [cleanName] }),
          }),
          new Change({
            operation: 'replace',
            modification: new Attribute({ type: 'member', values: memberDns }),
          }),
        ]);
      } else {
        await client.add(groupDn, {
          objectClass: ['top', 'groupOfNames'],
          cn: cleanCode,
          description: cleanName,
          member: memberDns,
        });
      }

      return { ok: true };
    },
    (reason) => ({ ok: false, reason }),
  );
}

/**
 * Elimina el grupo `groupOfNames` de una asignatura en `ou=asignaturas`.
 */
export async function deleteLdapCourseGroup(code: string): Promise<LdapSyncResult> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) {
    return { ok: false, reason: 'COURSE_CODE_REQUIRED' };
  }

  return withAdminLdapClient<LdapSyncResult>(
    'deleteLdapCourseGroup',
    async (client, config) => {
      const groupDn = `cn=${escapeLdapRdn(cleanCode)},ou=asignaturas,${config.baseDn}`;
      try {
        await client.del(groupDn);
      } catch (error) {
        if (!isNoSuchObjectError(error)) {
          throw error;
        }
      }
      return { ok: true };
    },
    (reason) => ({ ok: false, reason }),
  );
}

/**
 * Escanea `ou=coordinacion`, `ou=docentes` y `ou=estudiantes` en OpenLDAP
 * para reconciliación masiva hacia PostgreSQL/Supabase.
 */
export async function pullAllUsersFromLdap(): Promise<LdapPullUsersResult> {
  return withAdminLdapClient<LdapPullUsersResult>(
    'pullAllUsersFromLdap',
    async (client, config) => {
      const ouTargets: Array<{ ou: string; role: UserRole }> = [
        { ou: 'coordinacion', role: 'admin' },
        { ou: 'docentes', role: 'teacher' },
        { ou: 'estudiantes', role: 'student' },
      ];

      const collected: LdapDirectoryUser[] = [];
      const seenEmails = new Set<string>();

      for (const target of ouTargets) {
        const searchBase = `ou=${target.ou},${config.baseDn}`;
        try {
          const { searchEntries } = await client.search(searchBase, {
            scope: 'sub',
            filter: '(objectClass=inetOrgPerson)',
            attributes: USER_ATTRIBUTES,
            timeLimit: Math.ceil(LDAP_TIMEOUT_MS / 1000),
          });

          for (const entry of searchEntries) {
            const mapped = mapEntryToDirectoryUser(entry, target.role);
            if (mapped && !seenEmails.has(mapped.email)) {
              seenEmails.add(mapped.email);
              collected.push(mapped);
            }
          }
        } catch (error) {
          if (!isNoSuchObjectError(error)) {
            throw error;
          }
        }
      }

      return { ok: true, users: collected };
    },
    (reason) => ({ ok: false, users: [], reason }),
  );
}
