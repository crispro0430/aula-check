'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Users, Search, AlertTriangle, CheckCircle2,
  FileText, Download, Printer, X, Eye, EyeOff,
  Calendar, Award, ShieldAlert, BookOpen, Plus, RefreshCw,
  Trash2, UserCheck, UserX
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
      : tokens[2]; // En nombres hispanos de 3 o 4 palabras (ej. Carlos Andrés Gómez Restrepo), el 3er token es el primer apellido

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

  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState<'all' | 'verde' | 'ambar' | 'rojo'>('all');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [newStudentModal, setNewStudentModal] = useState(false);
  const [emailManuallyEdited, setEmailManuallyEdited] = useState(false);
  const [showStudentPassword, setShowStudentPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  // Sincronizar códigos, correos y estado isActive desde Supabase al montar
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

    // Validación inmediata en memoria local
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
      await fetch(`/api/admin/students/${encodeURIComponent(target.code || target.id)}`, {
        method: 'DELETE',
      });
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

  // Map each student to their computed mathematical metrics
  const studentsWithMetrics = useMemo(() => {
    return students.map((s) => ({
      student: s,
      metrics: computeStudentMetrics(s),
    }));
  }, [students]);

  // Filtered list
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

  // Counts for tabs derived strictly from computed metrics
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

  // ─── Modal Fuente Única de Verdad: Historial y Métricas Calculadas ─────────
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

  // Handle Export Student Expediente to XLSX
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
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded bg-violet-100 text-violet-700 text-label-sm uppercase tracking-widest font-bold">
              Expedientes Académicos
            </span>
          </div>
          <h1 className="text-headline-xl text-violet-700 font-bold tracking-tight mb-1">
            Directorio de Estudiantes y Permanencia
          </h1>
          <p className="text-body-lg text-on-surface-variant">
            Supervisa el semáforo institucional de permanencia, alertas tempranas de deserción y expedientes individuales de asistencia.
          </p>
        </div>
        <button
          onClick={openNewStudentModal}
          className="inline-flex items-center justify-center gap-2 h-12 px-5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-label-lg shadow-card transition-all active:scale-[0.98] shrink-0"
        >
          <Plus className="w-5 h-5" />
          Nuevo Estudiante
        </button>
      </div>

      {toastMessage && (
        <div className="mb-6 flex items-center gap-2.5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-body-sm font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          {toastMessage}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-outline-variant/30 shadow-card mb-6 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        {/* Search */}
        <div className="flex-1 flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30">
          <Search className="w-5 h-5 text-on-surface-variant shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar estudiante por nombre, código (ej. 2021815001) o correo..."
            className="w-full bg-transparent text-on-surface text-body-md placeholder:text-on-surface-variant/50 focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-on-surface-variant hover:text-on-surface text-label-xs px-2 py-1 rounded bg-surface-container"
            >
              Borrar
            </button>
          )}
        </div>

        {/* Semáforo Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setFilterLevel('all')}
            className={`px-3 py-2 rounded-xl text-label-md font-semibold transition-all shrink-0 ${
              filterLevel === 'all'
                ? 'bg-violet-700 text-white shadow-card'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            Todos ({counts.all})
          </button>
          <button
            onClick={() => setFilterLevel('verde')}
            className={`px-3 py-2 rounded-xl text-label-md font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
              filterLevel === 'verde'
                ? 'bg-emerald-600 text-white shadow-card'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            Estable ({counts.verde})
          </button>
          <button
            onClick={() => setFilterLevel('ambar')}
            className={`px-3 py-2 rounded-xl text-label-md font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
              filterLevel === 'ambar'
                ? 'bg-amber-600 text-white shadow-card'
                : 'text-amber-700 hover:bg-amber-50'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            Alerta ({counts.ambar})
          </button>
          <button
            onClick={() => setFilterLevel('rojo')}
            className={`px-3 py-2 rounded-xl text-label-md font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
              filterLevel === 'rojo'
                ? 'bg-red-600 text-white shadow-card'
                : 'text-red-700 hover:bg-red-50'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
            En Riesgo ({counts.rojo})
          </button>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/30 bg-surface-container-low text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">
                <th className="py-4 px-5">Estudiante</th>
                <th className="py-4 px-4">Código</th>
                <th className="py-4 px-4">Programa</th>
                <th className="py-4 px-4 text-center">Estado</th>
                <th className="py-4 px-5 text-center">Asistencia Acumulada</th>
                <th className="py-4 px-4 text-center">Semáforo</th>
                <th className="py-4 px-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20 text-body-md text-on-surface">
              {filteredStudents.map(({ student: s, metrics }) => {
                const { level, percentage } = metrics;
                const isStudentActive = s.isActive !== false;
                return (
                  <tr
                    key={s.id}
                    className={`hover:bg-surface-container-low/60 transition-colors ${
                      !isStudentActive ? 'opacity-65 bg-slate-50/60' : ''
                    }`}
                  >
                    {/* Student Info */}
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-label-md shrink-0 ${
                            !isStudentActive
                              ? 'bg-slate-200 text-slate-600'
                              : level === 'verde'
                              ? 'bg-emerald-100 text-emerald-800'
                              : level === 'ambar'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {s.avatarInitials}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-on-surface truncate">
                            {s.name}
                          </div>
                          <div className="text-body-xs text-on-surface-variant truncate">
                            {s.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Code */}
                    <td className="py-4 px-4 font-mono text-label-sm text-on-surface font-medium whitespace-nowrap">
                      {s.code}
                    </td>

                    {/* Program & Enrolled Courses */}
                    <td className="py-4 px-4 text-body-sm text-on-surface-variant">
                      <div className="truncate max-w-[180px]">{s.program}</div>
                      {(() => {
                        const studentEnrolled = courses.filter(
                          (c) => c.enrolledStudentIds?.includes(s.id) || c.enrolledStudentIds?.includes(s.code)
                        );
                        return (
                          <div className="mt-1 flex items-center gap-1.5 text-label-xs text-violet-700 font-semibold">
                            <BookOpen className="w-3.5 h-3.5 text-violet-600 shrink-0" />
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
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          Inhabilitado
                        </span>
                      )}
                    </td>

                    {/* Progress Bar & Rate */}
                    <td className="py-4 px-5">
                      <div className="w-40 mx-auto">
                        <div className="flex items-center justify-between text-label-sm mb-1 font-bold">
                          <span
                            className={
                              level === 'verde'
                                ? 'text-emerald-700'
                                : level === 'ambar'
                                ? 'text-amber-700'
                                : 'text-red-700'
                            }
                          >
                            {percentage}%
                          </span>
                          <span className="text-body-xs text-on-surface-variant font-normal">
                            meta 75%
                          </span>
                        </div>
                        <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              level === 'verde'
                                ? 'bg-emerald-500'
                                : level === 'ambar'
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Semáforo Badge */}
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      {level === 'verde' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-label-sm font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Estable
                        </span>
                      )}
                      {level === 'ambar' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-label-sm font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          Alerta
                        </span>
                      )}
                      {level === 'rojo' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-label-sm font-semibold bg-red-50 text-red-700 border border-red-200 animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          Riesgo Cupo
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedStudent(s)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 font-semibold text-xs transition-colors"
                          title="Ver expediente académico"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Expediente</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleToggleStudentStatus(s)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                            isStudentActive
                              ? 'bg-amber-50/70 text-amber-700 border-amber-200 hover:bg-amber-100'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }`}
                          title={
                            isStudentActive
                              ? 'Inhabilitar acceso institucional sin perder asistencias'
                              : 'Reactivar acceso institucional'
                          }
                        >
                          {isStudentActive ? (
                            <>
                              <UserX className="w-3.5 h-3.5" />
                              <span>Inhabilitar</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5" />
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
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
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
                  <td colSpan={7} className="py-12 text-center text-on-surface-variant">
                    <Users className="w-10 h-10 mx-auto text-on-surface-variant/40 mb-2" />
                    <p className="text-body-lg font-medium text-on-surface">
                      No se encontraron estudiantes
                    </p>
                    <p className="text-body-sm text-on-surface-variant">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-surface-container-lowest rounded-2xl max-w-3xl w-full my-8 shadow-elevated border border-outline-variant/30 flex flex-col max-h-[90vh] animate-scale-in">
            {/* Modal Header */}
            <div className="p-6 border-b border-outline-variant/20 flex items-start justify-between gap-4 shrink-0 bg-surface-container-low/50 rounded-t-2xl">
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-headline-sm shrink-0 shadow-card ${
                    semaforoLevel === 'verde'
                      ? 'bg-emerald-600 text-white'
                      : semaforoLevel === 'ambar'
                      ? 'bg-amber-500 text-white'
                      : 'bg-red-600 text-white'
                  }`}
                >
                  {selectedStudent.avatarInitials}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-headline-sm font-bold text-on-surface">
                      {selectedStudent.name}
                    </h2>
                    <span className="font-mono text-label-sm px-2 py-0.5 rounded bg-violet-100 text-violet-700 font-semibold">
                      {selectedStudent.code}
                    </span>
                  </div>
                  <p className="text-body-sm text-on-surface-variant">
                    {selectedStudent.program} • {selectedStudent.email} • Período 2026-2
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedStudent(null)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Semáforo and Performance Overview */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                  semaforoLevel === 'verde'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : semaforoLevel === 'ambar'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  {semaforoLevel === 'verde' ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
                  )}
                  <div>
                    <div className="text-label-lg font-bold">
                      {getSemaforoLabel(semaforoLevel)}
                    </div>
                    <div className="text-body-sm opacity-80">
                      {porcentaje >= 75
                        ? 'El estudiante cumple con el umbral mínimo del 75% reglamentario.'
                        : porcentaje >= 60
                        ? 'Se recomienda citar a tutoría académica y seguimiento docente.'
                        : 'Acción prioritaria: estudiante en riesgo de reprobación por inasistencia.'}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-headline-md font-bold">
                    {porcentaje}%
                  </div>
                  <div className="text-label-xs opacity-75">Tasa Acumulada</div>
                </div>
              </div>

              {/* Stats Grid - Mathematically derived from history */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-surface-container-low rounded-xl p-3 border border-outline-variant/20 text-center">
                  <Calendar className="w-5 h-5 text-violet-600 mx-auto mb-1" />
                  <div className="text-headline-sm font-bold text-on-surface">
                    {totalSesiones}
                  </div>
                  <div className="text-label-xs text-on-surface-variant">Sesiones Totales</div>
                </div>
                <div className="bg-surface-container-low rounded-xl p-3 border border-outline-variant/20 text-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                  <div className="text-headline-sm font-bold text-emerald-600">
                    {asistencias}
                  </div>
                  <div className="text-label-xs text-on-surface-variant">Asistencias</div>
                </div>
                <div className="bg-surface-container-low rounded-xl p-3 border border-outline-variant/20 text-center">
                  <FileText className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                  <div className="text-headline-sm font-bold text-purple-600">
                    {justificadas}
                  </div>
                  <div className="text-label-xs text-on-surface-variant">Justificadas</div>
                </div>
                <div className="bg-surface-container-low rounded-xl p-3 border border-outline-variant/20 text-center">
                  <ShieldAlert className="w-5 h-5 text-red-600 mx-auto mb-1" />
                  <div className="text-headline-sm font-bold text-red-600">
                    {faltas}
                  </div>
                  <div className="text-label-xs text-on-surface-variant">Faltas</div>
                </div>
                <div className="bg-surface-container-low rounded-xl p-3 border border-outline-variant/20 text-center">
                  <Award className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                  <div className="text-headline-sm font-bold text-amber-600">
                    {selectedStudent.points || 0}
                  </div>
                  <div className="text-label-xs text-on-surface-variant">Participaciones</div>
                </div>
              </div>

              {/* Justification Notice if any */}
              {selectedStudent.justification && (
                <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
                  <h4 className="text-label-md font-bold text-purple-900 mb-1 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-700" />
                    Justificación Radicada
                  </h4>
                  <p className="text-body-sm text-purple-800">
                    <strong>Motivo:</strong> {selectedStudent.justification.reason} —{' '}
                    {selectedStudent.justification.comments}
                  </p>
                  <span className="inline-block mt-2 text-label-xs px-2.5 py-0.5 rounded-full bg-purple-200 text-purple-800 font-semibold">
                    {selectedStudent.justification.status === 'aprobada' ? 'Aprobada por Docente/Coordinación' : 'Pendiente de Revisión'}
                  </span>
                </div>
              )}

              {/* Asignaturas Matriculadas */}
              <div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/30">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-label-md font-bold text-on-surface flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-violet-600" />
                    Asignaturas Matriculadas ({selectedStudentCourses.length})
                  </h4>
                  <span className="text-label-xs font-semibold px-2 py-0.5 rounded bg-violet-100 text-violet-700 font-mono">
                    Período 2026-2
                  </span>
                </div>

                {selectedStudentCourses.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {selectedStudentCourses.map((c) => (
                      <div
                        key={c.id}
                        className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/20 flex flex-col justify-between shadow-card hover:border-violet-300 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className="font-semibold text-body-sm text-on-surface leading-tight">
                            {c.name}
                          </span>
                          <span className="font-mono text-label-xs px-2 py-0.5 rounded bg-violet-100 text-violet-700 font-bold shrink-0">
                            {c.code}
                          </span>
                        </div>
                        <div className="text-body-xs text-on-surface-variant space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-on-surface">Docente:</span>
                            <span className="truncate">{c.teacher || 'Sin docente asignado'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-on-surface-variant/80">
                            <span>📍 {c.room}</span>
                            <span>•</span>
                            <span>🕒 {c.schedule}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-surface-container-lowest border border-dashed border-outline-variant/30 text-center text-body-sm text-on-surface-variant italic">
                    El estudiante no tiene asignaturas matriculadas actualmente. Se puede matricular desde el catálogo de Gestión de Asignaturas.
                  </div>
                )}
              </div>

              {/* Detailed Session History Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-headline-sm font-bold text-on-surface flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-violet-600" />
                    Historial de Clases y Asistencia
                  </h3>
                  <span className="text-label-sm text-on-surface-variant font-medium">
                    {totalSesiones} sesiones auditadas
                  </span>
                </div>
                <div className="border border-outline-variant/30 rounded-xl overflow-hidden shadow-card">
                  <table className="w-full text-left text-body-sm">
                    <thead className="bg-surface-container-low text-label-xs uppercase text-on-surface-variant font-bold border-b border-outline-variant/30">
                      <tr>
                        <th className="py-2.5 px-3">Fecha</th>
                        <th className="py-2.5 px-3">Asignatura</th>
                        <th className="py-2.5 px-3">Tema de Clase</th>
                        <th className="py-2.5 px-3 text-center">Estado</th>
                        <th className="py-2.5 px-3">Observación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20">
                      {studentHistory.map((row, idx) => (
                        <tr key={idx} className="hover:bg-surface-container-low/40">
                          <td className="py-2.5 px-3 font-mono text-label-xs text-on-surface-variant whitespace-nowrap">
                            {row.date}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-on-surface whitespace-nowrap">
                            {row.courseName}
                          </td>
                          <td className="py-2.5 px-3 text-on-surface-variant">
                            {row.topic}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            {row.status.toLowerCase().includes('presente') ? (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-label-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Presente
                              </span>
                            ) : row.status.toLowerCase().includes('justificado') ? (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-label-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                Justificado
                              </span>
                            ) : (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-label-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                                Ausente
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-body-xs text-on-surface-variant">
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
            <div className="p-4 sm:p-6 border-t border-outline-variant/20 flex flex-wrap items-center justify-between gap-3 bg-surface-container-low/40 rounded-b-2xl">
              <span className="text-body-xs text-on-surface-variant">
                Expediente institucional auditable Período 2026-2 derivado de las {totalSesiones} sesiones de clase.
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest hover:bg-surface-container text-on-surface font-semibold text-label-md transition-colors"
                >
                  <Printer className="w-4 h-4 text-on-surface-variant" />
                  Imprimir
                </button>
                <button
                  onClick={() => handleDownloadExpediente(selectedStudent)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-label-md transition-all active:scale-[0.98] shadow-card"
                >
                  <Download className="w-4 h-4" />
                  Descargar Excel (.xlsx)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Dar de Alta Nuevo Estudiante ── */}
      {newStudentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setNewStudentModal(false)}
        >
          <div
            className="bg-surface-container-lowest rounded-2xl w-full max-w-md p-6 shadow-modal border border-outline-variant/30"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-headline-sm font-bold text-on-surface">Registrar Nuevo Estudiante</h2>
              <button
                onClick={() => setNewStudentModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateStudent} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}
              <div>
                <label className="block text-label-md font-semibold text-on-surface mb-1">
                  Nombre completo <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={studentForm.name}
                  onChange={(e) => handleStudentNameChange(e.target.value)}
                  placeholder="Ej. Carlos Andrés Gómez Restrepo"
                  className="w-full h-11 px-3.5 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-body-md focus:outline-none focus:border-violet-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-label-md font-semibold text-on-surface">
                    Código estudiantil <span className="text-error">*</span>
                  </label>
                  <span className="text-[11px] text-violet-700 font-medium">
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
                    className="flex-1 h-11 px-3.5 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-body-md font-mono focus:outline-none focus:border-violet-600"
                  />
                  <button
                    type="button"
                    onClick={regenerateStudentCode}
                    className="h-11 px-3.5 rounded-xl border border-outline-variant bg-surface-container-lowest hover:bg-violet-50 text-violet-700 font-semibold text-xs inline-flex items-center gap-1.5 transition-colors shrink-0"
                    title="Generar nuevo código único"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>🔄</span>
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-label-md font-semibold text-on-surface">
                    Correo institucional <span className="text-error">*</span>
                  </label>
                  <span className="text-[11px] text-on-surface-variant">
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
                  className="w-full h-11 px-3.5 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-body-md focus:outline-none focus:border-violet-600"
                />
              </div>

              <div>
                <label className="block text-label-md font-semibold text-on-surface mb-1">
                  Programa académico <span className="text-error">*</span>
                </label>
                <select
                  required
                  value={studentForm.program}
                  onChange={(e) => setStudentForm((f) => ({ ...f, program: e.target.value }))}
                  className="w-full h-11 px-3.5 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-body-md focus:outline-none focus:border-violet-600"
                >
                  {STUDENT_PROGRAMS.map((prog) => (
                    <option key={prog} value={prog}>
                      {prog}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-label-md font-semibold text-on-surface mb-1">
                  Contraseña inicial institucional <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showStudentPassword ? 'text' : 'password'}
                    required
                    value={studentForm.password}
                    onChange={(e) => setStudentForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="123456"
                    className="w-full h-11 pl-3.5 pr-10 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-body-md font-mono focus:outline-none focus:border-violet-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStudentPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-1"
                    aria-label={showStudentPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showStudentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-label-md font-semibold text-on-surface mb-1">
                  Matricular en asignatura inicial
                </label>
                <select
                  value={studentForm.courseId}
                  onChange={(e) => setStudentForm((f) => ({ ...f, courseId: e.target.value }))}
                  className="w-full h-11 px-3.5 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-body-md focus:outline-none focus:border-violet-600"
                >
                  <option value="">— Sin matrícula inicial —</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewStudentModal(false)}
                  className="h-11 px-4 rounded-xl bg-surface-container text-on-surface font-semibold text-label-md"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-11 px-5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold text-label-md shadow-card"
                >
                  {isSubmitting ? 'Validando...' : 'Guardar Estudiante'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal de Doble Confirmación para Eliminar Estudiante ── */}
      {studentToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => {
            setStudentToDelete(null);
            setDeleteConfirmedCheck(false);
          }}
        >
          <div
            className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-6 shadow-elevated border border-rose-200 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-headline-sm font-bold text-slate-900">
                  Eliminar Estudiante Definitivamente
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Acción destructiva e irreversible en PostgreSQL / Supabase
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50/80 border border-rose-200 text-xs text-rose-900 space-y-1.5 mb-4">
              <p className="font-semibold">
                Estás a punto de eliminar a {studentToDelete.name} ({studentToDelete.code}).
              </p>
              <p className="text-rose-800 leading-relaxed">
                Se borrarán en cascada sus matrículas activas, historial de registros de asistencia e incapacidades radicadas. Si solo deseas bloquear temporalmente su ingreso, utiliza el botón <strong>Inhabilitar</strong>.
              </p>
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-surface-container-low border border-outline-variant/40 cursor-pointer mb-5 select-none">
              <input
                type="checkbox"
                checked={deleteConfirmedCheck}
                onChange={(e) => setDeleteConfirmedCheck(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
              />
              <span className="text-xs text-slate-700 font-medium leading-snug">
                Confirmo que comprendo el impacto y deseo eliminar permanentemente este registro estudiantil.
              </span>
            </label>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setStudentToDelete(null);
                  setDeleteConfirmedCheck(false);
                }}
                className="px-4 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!deleteConfirmedCheck || isDeleting}
                onClick={() => void handleConfirmDeleteStudent()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-all shadow-card"
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
