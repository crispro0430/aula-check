'use client';

import { useEffect } from 'react';
import { useAulaCheckStore } from '@/lib/store';

interface ServerContextPayload {
  courses?: Array<{
    id: string;
    code: string;
    name: string;
    room: string;
    schedule: string;
    teacherName: string;
    enrolledStudentCodes: string[];
  }>;
  students?: Array<{
    id: string;
    code: string;
    name: string;
    email: string;
    program: string;
    isActive?: boolean;
  }>;
  teachers?: Array<{
    id: string;
    name: string;
    email: string;
    department: string;
    title: string;
    phone?: string | null;
    isActive?: boolean;
  }>;
}

/**
 * Hidrata el store local con las asignaturas, estudiantes y docente REALES del usuario
 * autenticado (GET /api/me/context). Así un docente o estudiante creado en PostgreSQL
 * ve sus materias en /teacher/setup, la consola en vivo y /student/incapacities.
 * Se re-ejecuta cuando cambia el usuario activo; ante errores conserva el estado local.
 */
export function useServerContextSync(): void {
  const userEmail = useAulaCheckStore((s) => s.currentUser?.email ?? '');
  const mergeRemoteDirectory = useAulaCheckStore((s) => s.mergeRemoteDirectory);
  const mergeRemoteCourses = useAulaCheckStore((s) => s.mergeRemoteCourses);

  useEffect(() => {
    if (!userEmail) return;
    let cancelled = false;

    fetch('/api/me/context', { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<ServerContextPayload>) : null))
      .then((data) => {
        if (cancelled || !data) return;
        mergeRemoteDirectory({ students: data.students, teachers: data.teachers });
        if (data.courses) mergeRemoteCourses(data.courses);
      })
      .catch(() => {
        // Sin red: se mantiene el estado local
      });

    return () => {
      cancelled = true;
    };
  }, [userEmail, mergeRemoteDirectory, mergeRemoteCourses]);
}
