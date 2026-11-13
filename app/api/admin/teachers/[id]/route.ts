import { NextRequest } from 'next/server';
import { authorize, errorDetails, safeJson } from '@/lib/api';
import prisma from '@/lib/prisma';
import { deleteLdapUser, setLdapUserStatus, upsertLdapUser } from '@/lib/ldap';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = authorize(request, ['admin']);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      isActive?: boolean;
      name?: string;
      email?: string;
      department?: string;
      title?: string;
      phone?: string;
    };

    const existing = await prisma.teacher.findFirst({
      where: {
        OR: [
          { id },
          ...(body.email ? [{ email: body.email.trim().toLowerCase() }] : []),
          ...(body.name ? [{ name: body.name.trim() }] : []),
        ],
      },
    });

    if (existing) {
      const nextIsActive =
        typeof body.isActive === 'boolean' ? body.isActive : !existing.isActive;
      const updated = await prisma.teacher.update({
        where: { id: existing.id },
        data: { isActive: nextIsActive },
      });

      try {
        const ldapRes = await setLdapUserStatus(updated.email, updated.isActive);
        if (!ldapRes.ok && ldapRes.reason !== 'LDAP_DISABLED') {
          console.warn(
            `[PATCH /api/admin/teachers/[id]] Sync estado LDAP: ${ldapRes.reason}`,
          );
        }
      } catch (ldapErr) {
        console.warn('[PATCH /api/admin/teachers/[id]] Sync LDAP falló:', ldapErr);
      }

      return safeJson({ teacher: updated });
    }

    if (body.name && body.email) {
      const created = await prisma.teacher.create({
        data: {
          id,
          name: body.name.trim(),
          email: body.email.trim().toLowerCase(),
          department: body.department?.trim() || 'Facultad de Ingeniería y Tecnologías',
          title: body.title?.trim() || 'Profesor(a) Titular (Ph.D. / Doctorado)',
          phone: body.phone?.trim() || '+57 (2) 321-2100',
          isActive: typeof body.isActive === 'boolean' ? body.isActive : false,
        },
      });

      try {
        await upsertLdapUser({
          name: created.name,
          email: created.email,
          role: 'teacher',
          isActive: created.isActive,
          department: created.department,
          title: created.title,
          phone: created.phone ?? undefined,
        });
      } catch (ldapErr) {
        console.warn('[PATCH /api/admin/teachers/[id]] Upsert LDAP falló:', ldapErr);
      }

      return safeJson({ teacher: created });
    }

    return safeJson(
      { error: 'Docente no encontrado en la base de datos.' },
      { status: 404 },
    );
  } catch (error) {
    console.error('[PATCH /api/admin/teachers/[id]] Error:', error);
    return safeJson(
      {
        error: 'No se pudo actualizar el estado del docente.',
        ...errorDetails(error),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = authorize(request, ['admin']);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const url = new URL(request.url);
    const emailParam = url.searchParams.get('email')?.trim().toLowerCase();

    const existing = await prisma.teacher.findFirst({
      where: {
        OR: [
          { id },
          ...(emailParam ? [{ email: emailParam }] : []),
        ],
      },
    });

    const targetEmail = existing?.email || emailParam;

    if (existing) {
      await prisma.teacher.delete({
        where: { id: existing.id },
      });
    }

    if (targetEmail) {
      try {
        const ldapRes = await deleteLdapUser(targetEmail);
        if (!ldapRes.ok && ldapRes.reason !== 'LDAP_DISABLED') {
          console.warn(`[DELETE /api/admin/teachers/[id]] Delete LDAP: ${ldapRes.reason}`);
        }
      } catch (ldapErr) {
        console.warn('[DELETE /api/admin/teachers/[id]] Delete LDAP falló:', ldapErr);
      }
    }

    return safeJson({
      success: true,
      deletedId: existing?.id ?? id,
    });
  } catch (error) {
    console.error('[DELETE /api/admin/teachers/[id]] Error:', error);
    return safeJson(
      {
        error: 'No se pudo eliminar el docente de la base de datos.',
        ...errorDetails(error),
      },
      { status: 500 },
    );
  }
}
