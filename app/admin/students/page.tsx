'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Users, Search, AlertTriangle, CheckCircle2,
  FileText, Download, Printer, X, Eye, EyeOff,
  Calendar, Award, ShieldAlert, BookOpen, Plus, RefreshCw,
  Trash2, UserCheck, UserX, Server
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAulaCheckStore } from '@/lib/store';
import { getSemaforoLabel, getSemaforoLevel } from '@/lib/utils';
import type { Student } from '@/lib/types';
import { computeStudentMetrics, getStudentAttendanceHistory } from '@/lib/student-history';

const STUDENT_PROGRAMS = [
  'Ingeniería de Sistemas',
  'Desarrollo y Administración de Aplicaciones',
  'Ingeniería de Software',
  'Ingeniería Industrial',
  'Administración de Empresas',
  'Contaduría Pública',
] as const;

function slugifyToken(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function generateStudentInstitutionalEmail(fullName: string, existingEmails: Set<string>): string {
  const stopWords = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'san', 'santa']);
  const tokens = fullName
    .trim()
    .split(/\s+/)
    .map(slugifyToken)
    .filter((t) => t.length > 0 && !stopWords.has(t));

  if (tokens.length === 0) return '';
  const firstName = tokens[0];
  const firstLastName =
    tokens.length === 1
      ? ''
      : tokens.length === 2
      ? tokens[1]
      : tokens[2];

  const baseLocal = firstLastName ? `${firstName}.${firstLastName}` : firstName;
  let candidate = `${baseLocal}@universidad.edu.co`;
  let counter = 2;
  while (existingEmails.has(candidate)) {
    candidate = `${baseLocal}${counter}@universidad.edu.co`;
    counter++;
  }
  return candidate;
}

function generateUniqueStudentCode(existingCodes: Set<string>): string {
  const prefix = '20262';
  for (let attempt = 0; attempt < 100; attempt++) {
    const suffix = Math.floor(1000 + Math.random() * 9000).toString();
    const candidate = `${prefix}${suffix}`;
    if (!existingCodes.has(candidate)) {
      return candidate;
    }
  }
  return `${prefix}${Date.now().toString().slice(-4)}`;
}

export default function AdminStudentsPage() {
  const students = useAulaCheckStore((s) => s.students);
  const teachers = useAulaCheckStore((s) => s.teachers);
  const courses = useAulaCheckStore((s) => s.courses);
  const addStudent = useAulaCheckStore((s) => s.addStudent);
  const toggleStudentActive = useAulaCheckStore((s) => s.toggleStudentActive);
  const deleteStudent = useAulaCheckStore((s) => s.deleteStudent);
  const enrollStudentInCourse = useAulaCheckStore((s) => s.enrollStudentInCourse);
  const mergeRemoteDirectory = useAulaCheckStore((s) => s.mergeRemoteDirectory);

  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState<'all' | 'verde' | 'ambar' | 'rojo'>('all');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [newStudentModal, setNewStudentModal] = useState(false);
  const [emailManuallyEdited, setEmailManuallyEdited] = useState(false);
  const [showStudentPassword, setShowStudentPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncingLdap, setIsSyncingLdap] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [deleteConfirmedCheck, setDeleteConfirmedCheck] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [remoteStudentEmails, setRemoteStudentEmails] = useState<string[]>([]);
  const [remoteStudentCodes, setRemoteStudentCodes] = useState<string[]>([]);
  const [studentForm, setStudentForm] = useState({
    name: '',
    code: '',
    email: '',
    password: '123456',
    program: STUDENT_PROGRAMS[0] as string,
    courseId: courses[0]?.id || '',
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadRemoteStudents() {
      try {
        const res = await fetch('/api/admin/students');
        if (!res.ok) return;
        const data = (await res.json()) as {
          students?: Array<{
            id: string;
            code: string;
            email: string;
            isActive?: boolean;
          }>;
        };
        if (cancelled || !Array.isArray(data.students)) return;
        setRemoteStudentEmails(data.students.map((s) => s.email.trim().toLowerCase()));
        setRemoteStudentCodes(data.students.map((s) => s.code.trim()));
        data.students.forEach((remote) => {
          if (typeof remote.isActive === 'boolean') {
            toggleStudentActive(remote.code || remote.id, remote.isActive);
          }
        });
      } catch {
        // Fallback local
      }
    }
    void loadRemoteStudents();
    return () => {
      cancelled = true;
    };
  }, [toggleStudentActive]);

  const existingStudentCodes = useMemo(
    () =>
      new Set([
        ...students.map((s) => s.code.trim()),
        ...remoteStudentCodes,
      ]),
    [students, remoteStudentCodes],
  );
  const existingStudentEmails = useMemo(
    () =>
      new Set([
        ...students.map((s) => s.email.trim().toLowerCase()),
        ...teachers.map((t) => t.email.trim().toLowerCase()),
        ...remoteStudentEmails,
      ]),
    [students, teachers, remoteStudentEmails],
  );

  function openNewStudentModal() {
    setEmailManuallyEdited(false);
    setShowStudentPassword(false);
    setFormError(null);
    setStudentForm({
      name: '',
      code: generateUniqueStudentCode(existingStudentCodes),
      email: '',
      password: '123456',
      program: STUDENT_PROGRAMS[0],
      courseId: courses[0]?.id || '',
    });
    setNewStudentModal(true);
  }

  function handleStudentNameChange(newName: string) {
    setFormError(null);
    setStudentForm((prev) => {
      const nextEmail = emailManuallyEdited
        ? prev.email
        : generateStudentInstitutionalEmail(newName, existingStudentEmails);
      return {
        ...prev,
        name: newName,
        email: nextEmail,
      };
    });
  }

  function regenerateStudentCode() {
    setFormError(null);
    setStudentForm((prev) => ({
      ...prev,
      code: generateUniqueStudentCode(existingStudentCodes),
    }));
  }

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }

  async function handleCreateStudent(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const code = studentForm.code.trim();
    const name = studentForm.name.trim();
    const email = studentForm.email.trim().toLowerCase();
    const program = studentForm.program.trim();

    if (!name || !code || !email) return;

    if (existingStudentCodes.has(code)) {
      setFormError(`El código estudiantil "${code}" ya existe. Haz clic en 🔄 para generar uno nuevo.`);
      return;
    }
    if (existingStudentEmails.has(email)) {
      setFormError(`El correo institucional "${email}" ya se encuentra asignado a otro usuario.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: code,
          code,
          name,
          email,
          password: studentForm.password.trim() || '123456',
          program,
        }),
      });

      if (res.status === 409) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        setFormError(
          errData.error ||
            'El correo institucional o el código estudiantil ya se encuentra registrado.',
        );
        setIsSubmitting(false);
        return;
      }
    } catch {
      // Continuar con registro local si está sin conexión
    } finally {
      setIsSubmitting(false);
    }

    addStudent({
      name,
      code,
      email,
      program,
    });

    if (studentForm.courseId) {
      enrollStudentInCourse(studentForm.courseId, code);
      const targetCourse = courses.find((c) => c.id === studentForm.courseId);
      if (targetCourse) {
        void fetch('/api/admin/enrollments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courseId: targetCourse.id,
            courseCode: targetCourse.code,
            courseName: targetCourse.name,
            room: targetCourse.room,
            schedule: targetCourse.schedule,
            teacherName: targetCourse.teacher || undefined,
            studentId: code,
            studentCode: code,
            studentEmail: email,
            studentName: name,
            studentProgram: program,
          }),
        }).catch(() => {
          // Fallback silencioso
        });
      }
    }

    showToast(`Estudiante ${name} registrado(a) con éxito`);
    setNewStudentModal(false);
    setEmailManuallyEdited(false);
    setStudentForm({
      name: '',
      code: generateUniqueStudentCode(existingStudentCodes),
      email: '',
      password: '123456',
      program: STUDENT_PROGRAMS[0],
      courseId: courses[0]?.id || '',
    });
  }

  async function handleToggleStudentStatus(student: Student) {
    const currentActive = student.isActive !== false;
    const nextActive = !currentActive;
    toggleStudentActive(student.id, nextActive);
    showToast(
      nextActive
        ? `Cuenta de ${student.name} reactivada exitosamente`
        : `Cuenta de ${student.name} inhabilitada (asistencias y matrículas conservadas)`,
    );

    try {
      await fetch(`/api/admin/students/${encodeURIComponent(student.code || student.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive: nextActive,
          code: student.code,
          name: student.name,
          email: student.email,
          program: student.program,
        }),
      });
    } catch {
      // Estado ya actualizado en store
    }
  }

  async function handleConfirmDeleteStudent() {
    if (!studentToDelete || !deleteConfirmedCheck) return;
    setIsDeleting(true);
    const target = studentToDelete;

    try {
      await fetch(
        `/api/admin/students/${encodeURIComponent(target.code || target.id)}?email=${encodeURIComponent(target.email)}`,
        {
          method: 'DELETE',
        },
      );
    } catch {
      // Fallback local
    } finally {
      setIsDeleting(false);
    }

    deleteStudent(target.id);
    if (selectedStudent?.id === target.id) {
      setSelectedStudent(null);
    }
    setStudentToDelete(null);
    setDeleteConfirmedCheck(false);
    showToast(`Estudiante ${target.name} (${target.code}) eliminado definitivamente`);
  }

  async function handleSyncLdap() {
    setIsSyncingLdap(true);
    try {
      const res = await fetch('/api/admin/ldap/sync', { method: 'POST' });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        counts?: { coordinators: number; teachers: number; students: number; total: number };
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
      };

      if (!res.ok || !data.success) {
        showToast(
          data.error ||
            'OpenLDAP no disponible en este momento (timeout 3000ms). Operando con Supabase.',
        );
        return;
      }

      mergeRemoteDirectory({
        students: data.students,
        teachers: data.teachers,
      });
      if (Array.isArray(data.students)) {
        setRemoteStudentEmails(data.students.map((s) => s.email.trim().toLowerCase()));
        setRemoteStudentCodes(data.students.map((s) => s.code.trim()));
      }
      const c = data.counts ?? { coordinators: 0, teachers: 0, students: 0, total: 0 };
      showToast(
        `Sincronización LDAP OK: ${c.total} usuarios (${c.students} est., ${c.teachers} doc., ${c.coordinators} coord.)`,
      );
    } catch {
      showToast('No se pudo conectar con /api/admin/ldap/sync.');
    } finally {
      setIsSyncingLdap(false);
    }
  }

  const studentsWithMetrics = useMemo(() => {
    return students.map((s) => ({
      student: s,
      metrics: computeStudentMetrics(s),
    }));
  }, [students]);

  const filteredStudents = useMemo(() => {
    return studentsWithMetrics.filter(({ student, metrics }) => {
      const matchesFilter = filterLevel === 'all' || metrics.level === filterLevel;
      const term = search.toLowerCase().trim();
      const matchesSearch =
        !term ||
        student.name.toLowerCase().includes(term) ||
        student.code.includes(term) ||
        student.email.toLowerCase().includes(term);
      return matchesFilter && matchesSearch;
    });
  }, [studentsWithMetrics, filterLevel, search]);

  const counts = useMemo(() => {
    let verde = 0;
    let ambar = 0;
    let rojo = 0;
    studentsWithMetrics.forEach(({ metrics }) => {
      if (metrics.level === 'verde') verde++;
      else if (metrics.level === 'ambar') ambar++;
      else if (metrics.level === 'rojo') rojo++;
    });
    return { all: studentsWithMetrics.length, verde, ambar, rojo };
  }, [studentsWithMetrics]);

  const selectedStudentCourses = useMemo(() => {
    if (!selectedStudent) return [];
    return courses.filter(
      (c) =>
        c.enrolledStudentIds?.includes(selectedStudent.id) ||
        c.enrolledStudentIds?.includes(selectedStudent.code)
    );
  }, [selectedStudent, courses]);

  const primaryCourse = selectedStudentCourses[0] || null;

  const studentHistory = useMemo(() => {
    if (!selectedStudent) return [];
    return getStudentAttendanceHistory(
      selectedStudent,
      primaryCourse?.code || 'G401',
      primaryCourse?.name || 'Arquitectura de Software'
    );
  }, [selectedStudent, primaryCourse]);

  const totalSesiones = studentHistory.length;
  const asistencias = studentHistory.filter((s) => s.status.toLowerCase().includes('presente')).length;
  const faltas = studentHistory.filter(
    (s) => s.status.toLowerCase().includes('ausente') || s.status.toLowerCase().includes('falta')
  ).length;
  const justificadas = studentHistory.filter((s) => s.status.toLowerCase().includes('justificado')).length;
  const porcentaje = totalSesiones > 0 ? Math.round(((asistencias + justificadas) / totalSesiones) * 100) : 100;
  const semaforoLevel = getSemaforoLevel(porcentaje);

  function handleDownloadExpediente(student: Student) {
    const expStudentCourses = courses.filter(
      (c) =>
        c.enrolledStudentIds?.includes(student.id) ||
        c.enrolledStudentIds?.includes(student.code)
    );
    const expPrimary = expStudentCourses[0] || null;
    const history = getStudentAttendanceHistory(
      student,
      expPrimary?.code || 'G401',
      expPrimary?.name || 'Arquitectura de Software'
    );
    const expTotalSesiones = history.length;
    const expAsistencias = history.filter((s) => s.status.toLowerCase().includes('presente')).length;
    const expFaltas = history.filter(
      (s) => s.status.toLowerCase().includes('ausente') || s.status.toLowerCase().includes('falta')
    ).length;
    const expJustificadas = history.filter((s) => s.status.toLowerCase().includes('justificado')).length;
    const expPorcentaje = expTotalSesiones > 0 ? Math.round(((expAsistencias + expJustificadas) / expTotalSesiones) * 100) : 100;
    const expSemaforoLevel = getSemaforoLevel(expPorcentaje);
    const semaforoText =
      expSemaforoLevel === 'verde'
        ? 'Verde (Estable)'
        : expSemaforoLevel === 'ambar'
        ? 'Amarillo (Alerta / Acompañamiento)'
        : 'Rojo (Riesgo de Pérdida de Cupo)';

    const wb = XLSX.utils.book_new();

    const data: (string | number)[][] = [
      ['UNIVERSIDAD DEL VALLE — COORDINACIÓN ACADÉMICA'],
      ['EXPEDIENTE ESTUDIANTIL OFICIAL DE ASISTENCIA Y PERMANENCIA'],
      [],
      ['Período Académico:', '2026-2'],
      ['Fecha de Emisión:', new Date().toLocaleDateString('es-CO')],
      ['Estudiante:', student.name],
      ['Código Estudiantil:', student.code],
      ['Programa Académico:', student.program],
      ['Correo Institucional:', student.email],
      ['Asignaturas Matriculadas:', expStudentCourses.map(c => `${c.name} (${c.code})`).join('; ') || 'Ninguna registrada'],
      ['Total Sesiones Programadas:', expTotalSesiones],
      ['Sesiones Asistidas:', expAsistencias],
      ['Inasistencias Justificadas:', expJustificadas],
      ['Inasistencias Injustificadas:', expFaltas],
      ['Porcentaje Acumulado:', `${expPorcentaje}%`],
      ['Diagnóstico Semáforo:', semaforoText],
      ['Puntos de Participación (⭐):', student.points || 0],
      [],
      ['HISTORIAL DETALLADO SESIÓN POR SESIÓN (PERÍODO 2026-2)'],
      ['Fecha', 'Asignatura y Grupo', 'Tema Impartido', 'Estado Asistencia', 'Observaciones de Registro'],
    ];

    history.forEach((h) => {
      data.push([
        h.date,
        `${h.courseName} (${h.courseCode})`,
        h.topic,
        h.status.toLowerCase().includes('presente')
          ? 'PRESENTE'
          : h.status.toLowerCase().includes('justificado')
          ? 'JUSTIFICADO'
          : 'AUSENTE',
        h.notes || '-',
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
      { wch: 14 },
      { wch: 36 },
      { wch: 45 },
      { wch: 20 },
      { wch: 40 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Expediente');
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `Expediente_${student.code}_2026-2_${dateStr}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#0071e3]/10 text-[#0071e3] text-[11px] font-semibold uppercase tracking-wider mb-2">
            Expedientes Académicos
          </span>
          <h1 className="text-2xl sm:text-3xl text-[#1d1d1f] font-bold tracking-tight">
            Directorio de Estudiantes y Permanencia
          </h1>
          <p className="text-sm text-[#86868b] mt-1">
            Supervisa el semáforo institucional de permanencia, alertas tempranas de deserción y expedientes individuales de asistencia.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => void handleSyncLdap()}
            disabled={isSyncingLdap}
            className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-full bg-[#1d1d1f] hover:bg-black active:scale-[0.98] text-white font-semibold text-xs sm:text-sm shadow-sm transition-all disabled:opacity-60"
            title="Importar y reconciliar usuarios desde OpenLDAP hacia Supabase"
          >
            <Server className={`w-4 h-4 text-[#34c759] ${isSyncingLdap ? 'animate-pulse' : ''}`} />
            {isSyncingLdap ? 'Sincronizando…' : 'Sincronizar LDAP'}
          </button>
          <button
            onClick={openNewStudentModal}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#006edb] active:scale-[0.98] text-white font-semibold text-xs sm:text-sm shadow-[0_6px_18px_-4px_rgba(0,113,227,0.45)] transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nuevo Estudiante
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className="mb-6 flex items-center gap-2.5 p-4 rounded-2xl bg-[#34c759]/12 border border-[#34c759]/25 text-[#1d1d1f] text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-[#34c759] shrink-0" />
          {toastMessage}
        </div>
      )}

      {/* Filter and Search Bar (Liquid Glass + iOS Segmented Control) */}
      <div className="bg-white/75 backdrop-blur-2xl border border-black/[0.06] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] rounded-2xl p-4 sm:p-5 mb-6 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        {/* Search */}
        <div className="flex-1 flex items-center gap-2.5 px-3.5 h-10 rounded-xl bg-black/[0.03] border border-black/[0.08] focus-within:bg-white focus-within:border-[#0071e3] focus-within:ring-2 focus-within:ring-[#0071e3]/30 transition-all">
          <Search className="w-4 h-4 text-[#86868b] shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar estudiante por nombre, código (ej. 2021815001) o correo..."
            className="w-full bg-transparent text-[#1d1d1f] text-sm placeholder:text-[#86868b] focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-[#86868b] hover:text-[#1d1d1f] text-xs px-2 py-0.5 rounded-md bg-black/[0.05]"
            >
              Borrar
            </button>
          )}
        </div>

        {/* Semáforo Segmented Control */}
        <div className="inline-flex items-center gap-1 bg-black/[0.05] p-1 rounded-xl overflow-x-auto">
          <button
            onClick={() => setFilterLevel('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
              filterLevel === 'all'
                ? 'bg-white text-[#1d1d1f] shadow-[0_1px_4px_rgba(0,0,0,0.08)]'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            Todos ({counts.all})
          </button>
          <button
            onClick={() => setFilterLevel('verde')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
              filterLevel === 'verde'
                ? 'bg-white text-[#1d1d1f] shadow-[0_1px_4px_rgba(0,0,0,0.08)]'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#34c759]" />
            Estable ({counts.verde})
          </button>
          <button
            onClick={() => setFilterLevel('ambar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
              filterLevel === 'ambar'
                ? 'bg-white text-[#1d1d1f] shadow-[0_1px_4px_rgba(0,0,0,0.08)]'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#ff9500]" />
            Alerta ({counts.ambar})
          </button>
          <button
            onClick={() => setFilterLevel('rojo')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
              filterLevel === 'rojo'
                ? 'bg-white text-[#1d1d1f] shadow-[0_1px_4px_rgba(0,0,0,0.08)]'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#ff3b30]" />
            En Riesgo ({counts.rojo})
          </button>
        </div>
      </div>

      {/* Students Table (Liquid Glass) */}
      <div className="bg-white/75 backdrop-blur-2xl border border-black/[0.06] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-black/[0.06] bg-black/[0.02] text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">
                <th className="py-3.5 px-5">Estudiante</th>
                <th className="py-3.5 px-4">Código</th>
                <th className="py-3.5 px-4">Programa</th>
                <th className="py-3.5 px-4 text-center">Estado</th>
                <th className="py-3.5 px-5 text-center">Asistencia Acumulada</th>
                <th className="py-3.5 px-4 text-center">Semáforo</th>
                <th className="py-3.5 px-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05] text-sm text-[#1d1d1f]">
              {filteredStudents.map(({ student: s, metrics }) => {
                const { level, percentage } = metrics;
                const isStudentActive = s.isActive !== false;
                return (
                  <tr
                    key={s.id}
                    className={`hover:bg-black/[0.02] transition-colors ${
                      !isStudentActive ? 'opacity-60 bg-black/[0.015]' : ''
                    }`}
                  >
                    {/* Student Info */}
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            !isStudentActive
                              ? 'bg-black/[0.06] text-[#86868b]'
                              : level === 'verde'
                              ? 'bg-[#34c759]/12 text-[#34c759]'
                              : level === 'ambar'
                              ? 'bg-[#ff9500]/12 text-[#ff9500]'
                              : 'bg-[#ff3b30]/12 text-[#ff3b30]'
                          }`}
                        >
                          {s.avatarInitials}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-[#1d1d1f] truncate">
                            {s.name}
                          </div>
                          <div className="text-xs text-[#86868b] truncate">
                            {s.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Code */}
                    <td className="py-4 px-4 font-mono text-xs text-[#1d1d1f] font-medium whitespace-nowrap">
                      {s.code}
                    </td>

                    {/* Program & Enrolled Courses */}
                    <td className="py-4 px-4 text-xs text-[#86868b]">
                      <div className="truncate max-w-[180px] text-[#1d1d1f] font-medium">{s.program}</div>
                      {(() => {
                        const studentEnrolled = courses.filter(
                          (c) => c.enrolledStudentIds?.includes(s.id) || c.enrolledStudentIds?.includes(s.code)
                        );
                        return (
                          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#0071e3] font-medium">
                            <BookOpen className="w-3.5 h-3.5 text-[#0071e3] shrink-0" />
                            <span>
                              {studentEnrolled.length} {studentEnrolled.length === 1 ? 'materia inscrita' : 'materias inscritas'}
                            </span>
                          </div>
                        );
                      })()}
                    </td>

                    {/* Estado Institucional */}
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      {isStudentActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#34c759]/12 text-[#1d1d1f] border border-[#34c759]/25">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#34c759]" />
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-black/[0.05] text-[#86868b] border border-black/[0.08]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#86868b]" />
                          Inhabilitado
                        </span>
                      )}
                    </td>

                    {/* Progress Bar & Rate */}
                    <td className="py-4 px-5">
                      <div className="w-36 mx-auto">
                        <div className="flex items-center justify-between text-xs mb-1 font-semibold">
                          <span className="text-[#1d1d1f]">
                            {percentage}%
                          </span>
                          <span className="text-[11px] text-[#86868b] font-normal">
                            meta 75%
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-black/[0.06] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              level === 'verde'
                                ? 'bg-[#34c759]'
                                : level === 'ambar'
                                ? 'bg-[#ff9500]'
                                : 'bg-[#ff3b30]'
                            }`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Semáforo Badge */}
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      {level === 'verde' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#34c759]/12 text-[#1d1d1f] border border-[#34c759]/25">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#34c759]" />
                          Estable
                        </span>
                      )}
                      {level === 'ambar' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#ff9500]/12 text-[#1d1d1f] border border-[#ff9500]/25">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ff9500]" />
                          Alerta
                        </span>
                      )}
                      {level === 'rojo' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#ff3b30]/12 text-[#1d1d1f] border border-[#ff3b30]/25">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ff3b30]" />
                          Riesgo Cupo
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedStudent(s)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0071e3]/10 text-[#0071e3] hover:bg-[#0071e3]/15 font-semibold text-xs transition-all active:scale-[0.98]"
                          title="Ver expediente académico"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Expediente</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleToggleStudentStatus(s)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-[0.98] ${
                            isStudentActive
                              ? 'bg-[#ff9500]/10 text-[#1d1d1f] border-[#ff9500]/25 hover:bg-[#ff9500]/18'
                              : 'bg-[#34c759]/12 text-[#1d1d1f] border-[#34c759]/25 hover:bg-[#34c759]/20'
                          }`}
                          title={
                            isStudentActive
                              ? 'Inhabilitar acceso institucional sin perder asistencias'
                              : 'Reactivar acceso institucional'
                          }
                        >
                          {isStudentActive ? (
                            <>
                              <UserX className="w-3.5 h-3.5 text-[#ff9500]" />
                              <span>Inhabilitar</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5 text-[#34c759]" />
                              <span>Reactivar</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setStudentToDelete(s);
                            setDeleteConfirmedCheck(false);
                          }}
                          className="p-1.5 rounded-full text-[#ff3b30] hover:bg-[#ff3b30]/10 transition-colors"
                          title="Eliminar estudiante definitivamente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-[#86868b]">
                    <Users className="w-10 h-10 mx-auto text-[#86868b]/40 mb-2" />
                    <p className="text-sm font-semibold text-[#1d1d1f]">
                      No se encontraron estudiantes
                    </p>
                    <p className="text-xs text-[#86868b] mt-0.5">
                      Prueba con otro término de búsqueda o cambia el filtro de semáforo.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal / Vista de Detalle ("Ver Expediente") ── */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="bg-white/90 backdrop-blur-3xl border border-black/[0.08] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] rounded-[28px] max-w-3xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="p-6 border-b border-black/[0.06] flex items-start justify-between gap-4 shrink-0 bg-white/60">
              <div className="flex items-center gap-4">
                <div
                  className={`w-13 h-13 rounded-2xl flex items-center justify-center font-bold text-base shrink-0 ${
                    semaforoLevel === 'verde'
                      ? 'bg-[#34c759] text-white'
                      : semaforoLevel === 'ambar'
                      ? 'bg-[#ff9500] text-white'
                      : 'bg-[#ff3b30] text-white'
                  }`}
                >
                  {selectedStudent.avatarInitials}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-[#1d1d1f] tracking-tight">
                      {selectedStudent.name}
                    </h2>
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-[#0071e3]/10 text-[#0071e3] font-semibold">
                      {selectedStudent.code}
                    </span>
                  </div>
                  <p className="text-xs text-[#86868b] mt-0.5">
                    {selectedStudent.program} • {selectedStudent.email} • Período 2026-2
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedStudent(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-black/[0.05] text-[#86868b] hover:text-[#1d1d1f] transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {/* Semáforo and Performance Overview */}
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
                  semaforoLevel === 'verde'
                    ? 'bg-[#34c759]/10 border-[#34c759]/25 text-[#1d1d1f]'
                    : semaforoLevel === 'ambar'
                    ? 'bg-[#ff9500]/10 border-[#ff9500]/25 text-[#1d1d1f]'
                    : 'bg-[#ff3b30]/10 border-[#ff3b30]/25 text-[#1d1d1f]'
                }`}
              >
                <div className="flex items-center gap-3">
                  {semaforoLevel === 'verde' ? (
                    <CheckCircle2 className="w-6 h-6 text-[#34c759] shrink-0" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-[#ff3b30] shrink-0" />
                  )}
                  <div>
                    <div className="text-sm font-bold">
                      {getSemaforoLabel(semaforoLevel)}
                    </div>
                    <div className="text-xs text-[#86868b] mt-0.5">
                      {porcentaje >= 75
                        ? 'El estudiante cumple con el umbral mínimo del 75% reglamentario.'
                        : porcentaje >= 60
                        ? 'Se recomienda citar a tutoría académica y seguimiento docente.'
                        : 'Acción prioritaria: estudiante en riesgo de reprobación por inasistencia.'}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-2xl font-bold text-[#1d1d1f]">
                    {porcentaje}%
                  </div>
                  <div className="text-[11px] text-[#86868b]">Tasa Acumulada</div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-white/75 rounded-2xl p-3.5 border border-black/[0.06] text-center">
                  <Calendar className="w-4 h-4 text-[#0071e3] mx-auto mb-1" />
                  <div className="text-lg font-bold text-[#1d1d1f]">
                    {totalSesiones}
                  </div>
                  <div className="text-[11px] text-[#86868b]">Sesiones Totales</div>
                </div>
                <div className="bg-white/75 rounded-2xl p-3.5 border border-black/[0.06] text-center">
                  <CheckCircle2 className="w-4 h-4 text-[#34c759] mx-auto mb-1" />
                  <div className="text-lg font-bold text-[#34c759]">
                    {asistencias}
                  </div>
                  <div className="text-[11px] text-[#86868b]">Asistencias</div>
                </div>
                <div className="bg-white/75 rounded-2xl p-3.5 border border-black/[0.06] text-center">
                  <FileText className="w-4 h-4 text-[#0071e3] mx-auto mb-1" />
                  <div className="text-lg font-bold text-[#0071e3]">
                    {justificadas}
                  </div>
                  <div className="text-[11px] text-[#86868b]">Justificadas</div>
                </div>
                <div className="bg-white/75 rounded-2xl p-3.5 border border-black/[0.06] text-center">
                  <ShieldAlert className="w-4 h-4 text-[#ff3b30] mx-auto mb-1" />
                  <div className="text-lg font-bold text-[#ff3b30]">
                    {faltas}
                  </div>
                  <div className="text-[11px] text-[#86868b]">Faltas</div>
                </div>
                <div className="bg-white/75 rounded-2xl p-3.5 border border-black/[0.06] text-center">
                  <Award className="w-4 h-4 text-[#ff9500] mx-auto mb-1" />
                  <div className="text-lg font-bold text-[#ff9500]">
                    {selectedStudent.points || 0}
                  </div>
                  <div className="text-[11px] text-[#86868b]">Participaciones</div>
                </div>
              </div>

              {/* Justification Notice if any */}
              {selectedStudent.justification && (
                <div className="p-4 rounded-2xl bg-[#0071e3]/[0.05] border border-[#0071e3]/20">
                  <h4 className="text-xs font-bold text-[#1d1d1f] mb-1 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#0071e3]" />
                    Justificación Radicada
                  </h4>
                  <p className="text-xs text-[#86868b]">
                    <strong className="text-[#1d1d1f]">Motivo:</strong> {selectedStudent.justification.reason} —{' '}
                    {selectedStudent.justification.comments}
                  </p>
                  <span className="inline-block mt-2 text-[11px] px-2.5 py-0.5 rounded-full bg-[#0071e3]/12 text-[#0071e3] font-semibold">
                    {selectedStudent.justification.status === 'aprobada' ? 'Aprobada por Docente/Coordinación' : 'Pendiente de Revisión'}
                  </span>
                </div>
              )}

              {/* Asignaturas Matriculadas */}
              <div className="bg-black/[0.02] rounded-2xl p-4 border border-black/[0.06]">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-[#1d1d1f] flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#0071e3]" />
                    Asignaturas Matriculadas ({selectedStudentCourses.length})
                  </h4>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#0071e3]/10 text-[#0071e3] font-mono">
                    Período 2026-2
                  </span>
                </div>

                {selectedStudentCourses.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {selectedStudentCourses.map((c) => (
                      <div
                        key={c.id}
                        className="p-3.5 rounded-2xl bg-white border border-black/[0.06] flex flex-col justify-between"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className="font-semibold text-xs text-[#1d1d1f] leading-tight">
                            {c.name}
                          </span>
                          <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-[#0071e3]/10 text-[#0071e3] font-semibold shrink-0">
                            {c.code}
                          </span>
                        </div>
                        <div className="text-xs text-[#86868b] space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-[#1d1d1f]">Docente:</span>
                            <span className="truncate">{c.teacher || 'Sin docente asignado'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span>📍 {c.room}</span>
                            <span>•</span>
                            <span>🕒 {c.schedule}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-white/60 border border-dashed border-black/[0.08] text-center text-xs text-[#86868b]">
                    El estudiante no tiene asignaturas matriculadas actualmente.
                  </div>
                )}
              </div>

              {/* Detailed Session History Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-[#1d1d1f] flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#0071e3]" />
                    Historial de Clases y Asistencia
                  </h3>
                  <span className="text-xs text-[#86868b] font-medium">
                    {totalSesiones} sesiones auditadas
                  </span>
                </div>
                <div className="border border-black/[0.06] rounded-2xl overflow-hidden bg-white/80">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-black/[0.02] text-[11px] uppercase text-[#86868b] font-semibold border-b border-black/[0.06]">
                      <tr>
                        <th className="py-2.5 px-3">Fecha</th>
                        <th className="py-2.5 px-3">Asignatura</th>
                        <th className="py-2.5 px-3">Tema de Clase</th>
                        <th className="py-2.5 px-3 text-center">Estado</th>
                        <th className="py-2.5 px-3">Observación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.05]">
                      {studentHistory.map((row, idx) => (
                        <tr key={idx} className="hover:bg-black/[0.02]">
                          <td className="py-2.5 px-3 font-mono text-[11px] text-[#86868b] whitespace-nowrap">
                            {row.date}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-[#1d1d1f] whitespace-nowrap">
                            {row.courseName}
                          </td>
                          <td className="py-2.5 px-3 text-[#86868b]">
                            {row.topic}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            {row.status.toLowerCase().includes('presente') ? (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#34c759]/12 text-[#1d1d1f] border border-[#34c759]/25">
                                Presente
                              </span>
                            ) : row.status.toLowerCase().includes('justificado') ? (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#0071e3]/12 text-[#0071e3] border border-[#0071e3]/25">
                                Justificado
                              </span>
                            ) : (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#ff3b30]/12 text-[#1d1d1f] border border-[#ff3b30]/25">
                                Ausente
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-[#86868b]">
                            {row.notes}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-6 border-t border-black/[0.06] flex flex-wrap items-center justify-between gap-3 bg-white/60 shrink-0">
              <span className="text-xs text-[#86868b]">
                Expediente institucional auditable Período 2026-2 derivado de las {totalSesiones} sesiones de clase.
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-black/[0.08] bg-white hover:bg-black/[0.03] text-[#1d1d1f] font-semibold text-xs transition-all"
                >
                  <Printer className="w-3.5 h-3.5 text-[#86868b]" />
                  Imprimir
                </button>
                <button
                  onClick={() => handleDownloadExpediente(selectedStudent)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#006edb] active:scale-[0.98] text-white font-semibold text-xs transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar Excel (.xlsx)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Dar de Alta Nuevo Estudiante (Cristal Templado Apple) ── */}
      {newStudentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-md overflow-y-auto animate-fade-in"
          onClick={() => setNewStudentModal(false)}
        >
          <div
            className="bg-white/90 backdrop-blur-3xl border border-black/[0.08] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] rounded-[28px] w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-black/[0.06] flex items-center justify-between shrink-0 bg-white/60">
              <h2 className="text-lg font-bold text-[#1d1d1f] tracking-tight">Registrar Nuevo Estudiante</h2>
              <button
                type="button"
                onClick={() => setNewStudentModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-black/[0.05] text-[#86868b] hover:text-[#1d1d1f] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateStudent} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-2xl bg-[#ff3b30]/10 border border-[#ff3b30]/20 text-[#1d1d1f] text-xs font-medium flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#ff3b30] shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Nombre completo <span className="text-[#ff3b30]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={studentForm.name}
                  onChange={(e) => handleStudentNameChange(e.target.value)}
                  placeholder="Ej. Carlos Andrés Gómez Restrepo"
                  className="w-full h-11 px-3.5 rounded-xl border border-black/[0.08] bg-black/[0.03] focus:bg-white text-[#1d1d1f] text-sm focus:outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/30 transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#1d1d1f]">
                    Código estudiantil <span className="text-[#ff3b30]">*</span>
                  </label>
                  <span className="text-[11px] text-[#0071e3] font-medium">
                    Autogenerado (2026-2)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={studentForm.code}
                    onChange={(e) =>
                      setStudentForm((f) => ({ ...f, code: e.target.value.replace(/\D/g, '') }))
                    }
                    placeholder="Ej. 202621048"
                    className="flex-1 h-11 px-3.5 rounded-xl border border-black/[0.08] bg-black/[0.03] focus:bg-white text-[#1d1d1f] text-sm font-mono focus:outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/30 transition-all"
                  />
                  <button
                    type="button"
                    onClick={regenerateStudentCode}
                    className="h-11 px-3.5 rounded-xl border border-black/[0.08] bg-white hover:bg-black/[0.03] text-[#0071e3] font-semibold text-xs inline-flex items-center gap-1.5 transition-all active:scale-[0.98] shrink-0"
                    title="Generar nuevo código único"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#1d1d1f]">
                    Correo institucional <span className="text-[#ff3b30]">*</span>
                  </label>
                  <span className="text-[11px] text-[#86868b]">
                    Editable
                  </span>
                </div>
                <input
                  type="email"
                  required
                  value={studentForm.email}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEmailManuallyEdited(val.trim().length > 0);
                    setStudentForm((f) => ({ ...f, email: val }));
                  }}
                  placeholder="carlos.gomez@universidad.edu.co"
                  className="w-full h-11 px-3.5 rounded-xl border border-black/[0.08] bg-black/[0.03] focus:bg-white text-[#1d1d1f] text-sm focus:outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/30 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Programa académico <span className="text-[#ff3b30]">*</span>
                </label>
                <select
                  required
                  value={studentForm.program}
                  onChange={(e) => setStudentForm((f) => ({ ...f, program: e.target.value }))}
                  className="w-full h-11 px-3.5 rounded-xl border border-black/[0.08] bg-black/[0.03] focus:bg-white text-[#1d1d1f] text-sm focus:outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/30 transition-all"
                >
                  {STUDENT_PROGRAMS.map((prog) => (
                    <option key={prog} value={prog}>
                      {prog}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Contraseña inicial institucional <span className="text-[#ff3b30]">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showStudentPassword ? 'text' : 'password'}
                    required
                    value={studentForm.password}
                    onChange={(e) => setStudentForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="123456"
                    className="w-full h-11 pl-3.5 pr-10 rounded-xl border border-black/[0.08] bg-black/[0.03] focus:bg-white text-[#1d1d1f] text-sm font-mono focus:outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/30 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStudentPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#1d1d1f] p-1"
                    aria-label={showStudentPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showStudentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">
                  Matricular en asignatura inicial
                </label>
                <select
                  value={studentForm.courseId}
                  onChange={(e) => setStudentForm((f) => ({ ...f, courseId: e.target.value }))}
                  className="w-full h-11 px-3.5 rounded-xl border border-black/[0.08] bg-black/[0.03] focus:bg-white text-[#1d1d1f] text-sm focus:outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/30 transition-all"
                >
                  <option value="">— Sin matrícula inicial —</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
              </div>
              <div className="px-6 py-4 border-t border-black/[0.06] bg-white/60 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setNewStudentModal(false)}
                  className="h-10 px-4 rounded-full bg-black/[0.05] hover:bg-black/[0.08] text-[#1d1d1f] font-semibold text-xs transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-10 px-5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#006edb] active:scale-[0.98] disabled:opacity-50 text-white font-semibold text-xs transition-all"
                >
                  {isSubmitting ? 'Validando...' : 'Guardar Estudiante'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal de Doble Confirmación para Eliminar Estudiante (Cristal Templado Apple) ── */}
      {studentToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-md overflow-y-auto animate-fade-in"
          onClick={() => {
            setStudentToDelete(null);
            setDeleteConfirmedCheck(false);
          }}
        >
          <div
            className="bg-white/90 backdrop-blur-3xl border border-black/[0.08] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] rounded-[28px] max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-black/[0.06] bg-white/60 flex items-start gap-3 shrink-0">
              <div className="w-11 h-11 rounded-2xl bg-[#ff3b30]/12 text-[#ff3b30] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-[#1d1d1f] tracking-tight">
                  Eliminar Estudiante Definitivamente
                </h3>
                <p className="text-xs text-[#86868b] mt-0.5">
                  Acción destructiva e irreversible en PostgreSQL / Supabase
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="p-3.5 rounded-2xl bg-[#ff3b30]/[0.06] border border-[#ff3b30]/20 text-xs text-[#1d1d1f] space-y-1.5">
                <p className="font-semibold">
                  Estás a punto de eliminar a {studentToDelete.name} ({studentToDelete.code}).
                </p>
                <p className="text-[#86868b] leading-relaxed">
                  Se borrarán en cascada sus matrículas activas, historial de registros de asistencia e incapacidades radicadas. Si solo deseas bloquear temporalmente su ingreso, utiliza el botón <strong className="text-[#1d1d1f]">Inhabilitar</strong>.
                </p>
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-black/[0.03] border border-black/[0.06] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={deleteConfirmedCheck}
                  onChange={(e) => setDeleteConfirmedCheck(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-black/20 text-[#ff3b30] focus:ring-[#ff3b30]"
                />
                <span className="text-xs text-[#1d1d1f] font-medium leading-snug">
                  Confirmo que comprendo el impacto y deseo eliminar permanentemente este registro estudiantil.
                </span>
              </label>
            </div>

            <div className="px-6 py-4 border-t border-black/[0.06] bg-white/60 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setStudentToDelete(null);
                  setDeleteConfirmedCheck(false);
                }}
                className="px-4 py-2 rounded-full bg-black/[0.05] hover:bg-black/[0.08] text-[#1d1d1f] text-xs font-semibold transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!deleteConfirmedCheck || isDeleting}
                onClick={() => void handleConfirmDeleteStudent()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#ff3b30] hover:brightness-95 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeleting ? 'Eliminando...' : 'Confirmar Eliminación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
