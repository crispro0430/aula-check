'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  GraduationCap, Search, Plus, Mail, BookOpen,
  Phone, Building2, CheckCircle2, X, PlusCircle, Trash2,
  Eye, EyeOff, AlertTriangle, UserCheck, UserX
} from 'lucide-react';
import { useAulaCheckStore } from '@/lib/store';
import type { Teacher } from '@/lib/types';

const TEACHER_TITLES = [
  'Profesor(a) Titular (Ph.D. / Doctorado)',
  'Profesor(a) Asociado (M.Sc. / Magíster)',
  'Profesor(a) Asistente (Especialista)',
  'Docente Catedrático(a)',
  'Investigador(a) Principal',
] as const;

const TEACHER_DEPARTMENTS = [
  'Facultad de Ingeniería y Tecnologías',
  'Departamento de Ciencias de la Computación',
  'Departamento de Matemáticas y Ciencias Exactas',
  'Escuela de Negocios y Administración',
  'Coordinación de Ciencias Básicas',
] as const;

function normalizeAscii(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function generateTeacherInstitutionalEmail(fullName: string, existingEmails: Set<string>): string {
  const HONORIFICS = new Set(['prof', 'profa', 'dr', 'dra', 'ing', 'msc', 'phd', 'mg', 'esp', 'lic']);
  const STOP_WORDS = new Set(['de', 'del', 'la', 'las', 'los', 'y']);
  const tokens = fullName
    .trim()
    .split(/\s+/)
    .map((t) => normalizeAscii(t))
    .filter((t) => t.length > 0 && !HONORIFICS.has(t) && !STOP_WORDS.has(t));

  if (tokens.length === 0) return '';
  const firstName = tokens[0];
  let firstLastName = '';
  if (tokens.length === 2) {
    firstLastName = tokens[1];
  } else if (tokens.length >= 3) {
    firstLastName = tokens[2];
  }

  const localBase = firstLastName ? `${firstName}.${firstLastName}` : firstName;
  const domain = '@universidad.edu.co';
  let candidate = `${localBase}${domain}`;
  let suffix = 2;
  while (existingEmails.has(candidate.toLowerCase())) {
    candidate = `${localBase}${suffix}${domain}`;
    suffix++;
  }
  return candidate;
}

interface NewTeacherFormData {
  name: string;
  email: string;
  password: string;
  department: string;
  title: string;
  phone: string;
}

const DEFAULT_FORM: NewTeacherFormData = {
  name: '',
  email: '',
  password: '123456',
  department: TEACHER_DEPARTMENTS[0],
  title: TEACHER_TITLES[0],
  phone: '',
};

export default function AdminTeachersPage() {
  const teachers = useAulaCheckStore((s) => s.teachers);
  const students = useAulaCheckStore((s) => s.students);
  const courses  = useAulaCheckStore((s) => s.courses);
  const addTeacher = useAulaCheckStore((s) => s.addTeacher);
  const toggleTeacherActive = useAulaCheckStore((s) => s.toggleTeacherActive);
  const deleteTeacher = useAulaCheckStore((s) => s.deleteTeacher);
  const assignCourseToTeacher = useAulaCheckStore((s) => s.assignCourseToTeacher);

  const [search, setSearch] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [newTeacherModal, setNewTeacherModal] = useState(false);
  const [formData, setFormData] = useState<NewTeacherFormData>(DEFAULT_FORM);
  const [emailManuallyEdited, setEmailManuallyEdited] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState<Teacher | null>(null);
  const [deleteConfirmedCheck, setDeleteConfirmedCheck] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [remoteTeacherEmails, setRemoteTeacherEmails] = useState<string[]>([]);
  const [courseToAssign, setCourseToAssign] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sincronizar correos y estado isActive desde Supabase al montar
  useEffect(() => {
    let cancelled = false;
    async function loadRemoteTeachers() {
      try {
        const res = await fetch('/api/admin/teachers');
        if (!res.ok) return;
        const data = (await res.json()) as {
          teachers?: Array<{
            id: string;
            email: string;
            isActive?: boolean;
          }>;
        };
        if (cancelled || !Array.isArray(data.teachers)) return;
        setRemoteTeacherEmails(data.teachers.map((t) => t.email.trim().toLowerCase()));
        data.teachers.forEach((remote) => {
          if (typeof remote.isActive === 'boolean') {
            const match = teachers.find(
              (t) => t.id === remote.id || t.email.toLowerCase() === remote.email.toLowerCase(),
            );
            if (match) {
              toggleTeacherActive(match.id, remote.isActive);
            }
          }
        });
      } catch {
        // Fallback local
      }
    }
    void loadRemoteTeachers();
    return () => {
      cancelled = true;
    };
  }, [teachers, toggleTeacherActive]);

  const existingTeacherEmails = useMemo(
    () =>
      new Set([
        ...teachers.map((t) => t.email.trim().toLowerCase()),
        ...students.map((s) => s.email.trim().toLowerCase()),
        ...remoteTeacherEmails,
      ]),
    [teachers, students, remoteTeacherEmails]
  );

  function openNewTeacherModal() {
    setFormData(DEFAULT_FORM);
    setEmailManuallyEdited(false);
    setShowPassword(false);
    setFormError(null);
    setNewTeacherModal(true);
  }

  function handleTeacherNameChange(newName: string) {
    setFormError(null);
    setFormData((prev) => {
      const nextEmail = emailManuallyEdited
        ? prev.email
        : generateTeacherInstitutionalEmail(newName, existingTeacherEmails);
      return {
        ...prev,
        name: newName,
        email: nextEmail,
      };
    });
  }

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }

  // Correlate teachers with their assigned courses from courses catalog
  const teachersWithCourses = useMemo(() => {
    return teachers.map((teacher) => {
      const assigned = courses.filter((c) => c.teacher === teacher.name);
      const totalStudents = assigned.reduce((acc, c) => acc + (c.students || 0), 0);
      return {
        teacher,
        assigned,
        totalStudents,
      };
    });
  }, [teachers, courses]);

  // Filtered teachers list
  const filteredTeachers = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return teachersWithCourses;

    return teachersWithCourses.filter(({ teacher, assigned }) => {
      const matchesTeacher =
        teacher.name.toLowerCase().includes(term) ||
        teacher.email.toLowerCase().includes(term) ||
        teacher.department.toLowerCase().includes(term) ||
        teacher.title.toLowerCase().includes(term);

      const matchesCourses = assigned.some(
        (c) => c.name.toLowerCase().includes(term) || c.code.toLowerCase().includes(term)
      );

      return matchesTeacher || matchesCourses;
    });
  }, [teachersWithCourses, search]);

  // Total stats
  const totalAssignedCourses = courses.filter((c) => c.teacher && c.teacher !== 'Sin asignar').length;
  const totalStudentsServed = courses.reduce((acc, c) => acc + (c.students || 0), 0);
  const activeTeachersCount = teachers.filter((t) => t.isActive !== false).length;

  // Selected teacher's assigned courses (reactive to store changes)
  const currentTeacherCourses = useMemo(() => {
    if (!selectedTeacher) return [];
    return courses.filter((c) => c.teacher === selectedTeacher.name);
  }, [courses, selectedTeacher]);

  // Available courses not assigned to this teacher
  const unassignedOrOtherCourses = useMemo(() => {
    if (!selectedTeacher) return [];
    return courses.filter((c) => c.teacher !== selectedTeacher.name);
  }, [courses, selectedTeacher]);

  async function handleCreateTeacher(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const name = formData.name.trim();
    const email = formData.email.trim().toLowerCase();
    if (!name || !email) return;

    if (existingTeacherEmails.has(email)) {
      setFormError(`El correo institucional "${email}" ya está registrado en el sistema.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password: formData.password.trim() || '123456',
          department: formData.department.trim(),
          title: formData.title.trim(),
          phone: formData.phone.trim() || '+57 (2) 321-2100',
        }),
      });

      if (res.status === 409) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        setFormError(
          errData.error || 'El correo institucional ya está asignado a otro docente o usuario.',
        );
        setIsSubmitting(false);
        return;
      }
    } catch {
      // Fallback silencioso a store local
    } finally {
      setIsSubmitting(false);
    }

    const names = name.split(' ');
    const initials = (names[0]?.[0] || 'P') + (names[1]?.[0] || 'D');

    addTeacher({
      name,
      email,
      department: formData.department.trim(),
      title: formData.title.trim(),
      phone: formData.phone.trim() || '+57 (2) 321-2100',
      avatarInitials: initials.toUpperCase(),
      isActive: true,
    });

    showToast(`Profesor(a) ${name} registrado(a) con éxito`);
    setNewTeacherModal(false);
    setFormData(DEFAULT_FORM);
    setEmailManuallyEdited(false);
    setShowPassword(false);
  }

  async function handleToggleTeacherStatus(teacher: Teacher) {
    const currentActive = teacher.isActive !== false;
    const nextActive = !currentActive;
    toggleTeacherActive(teacher.id, nextActive);
    showToast(
      nextActive
        ? `Cuenta docente de ${teacher.name} reactivada`
        : `Cuenta docente de ${teacher.name} inhabilitada (asignaturas e historial conservados)`,
    );

    try {
      await fetch(`/api/admin/teachers/${encodeURIComponent(teacher.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive: nextActive,
          name: teacher.name,
          email: teacher.email,
          department: teacher.department,
          title: teacher.title,
          phone: teacher.phone,
        }),
      });
    } catch {
      // Ya actualizado en store local
    }
  }

  async function handleConfirmDeleteTeacher() {
    if (!teacherToDelete || !deleteConfirmedCheck) return;
    setIsDeleting(true);
    const target = teacherToDelete;

    try {
      await fetch(
        `/api/admin/teachers/${encodeURIComponent(target.id)}?email=${encodeURIComponent(target.email)}`,
        { method: 'DELETE' },
      );
    } catch {
      // Fallback local
    } finally {
      setIsDeleting(false);
    }

    deleteTeacher(target.id);
    if (selectedTeacher?.id === target.id) {
      setSelectedTeacher(null);
    }
    setTeacherToDelete(null);
    setDeleteConfirmedCheck(false);
    showToast(`Docente ${target.name} eliminado definitivamente del directorio`);
  }

  function handleAssignCourse() {
    if (!courseToAssign || !selectedTeacher) return;
    assignCourseToTeacher(courseToAssign, selectedTeacher.name);
    const courseObj = courses.find((c) => c.id === courseToAssign);
    showToast(`Materia ${courseObj?.code || ''} asignada a ${selectedTeacher.name}`);
    setCourseToAssign('');
  }

  function handleUnassignCourse(courseId: string, courseCode: string) {
    assignCourseToTeacher(courseId, 'Sin asignar');
    showToast(`Asignatura ${courseCode} desasignada`);
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-elevated border border-slate-700 animate-slide-up">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-label-md font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded bg-violet-100 text-violet-700 text-label-sm uppercase tracking-widest font-bold">
              Cuerpo Docente
            </span>
          </div>
          <h1 className="text-headline-xl text-violet-700 font-bold tracking-tight mb-1">
            Directorio de Profesores
          </h1>
          <p className="text-body-lg text-on-surface-variant">
            Supervisa el equipo académico, estado de sus cuentas, asignaturas a cargo y cupos estudiantiles.
          </p>
        </div>

        <button
          onClick={openNewTeacherModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-label-lg transition-all active:scale-[0.98] shadow-card shrink-0"
        >
          <Plus className="w-5 h-5" />
          Nuevo Docente
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30 shadow-card">
          <div className="text-headline-md font-bold text-violet-700">{teachers.length}</div>
          <div className="text-label-sm text-on-surface-variant">Docentes Registrados</div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30 shadow-card">
          <div className="text-headline-md font-bold text-emerald-700">{activeTeachersCount}</div>
          <div className="text-label-sm text-on-surface-variant">Cuentas Activas</div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30 shadow-card">
          <div className="text-headline-md font-bold text-blue-700">{totalAssignedCourses}</div>
          <div className="text-label-sm text-on-surface-variant">Grupos Asignados</div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30 shadow-card">
          <div className="text-headline-md font-bold text-on-surface">{totalStudentsServed}</div>
          <div className="text-label-sm text-on-surface-variant">Estudiantes Atendidos</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 shadow-card mb-6 flex items-center gap-3">
        <Search className="w-5 h-5 text-on-surface-variant shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar docente por nombre, correo, título o materia asignada..."
          className="flex-1 bg-transparent text-on-surface text-body-md placeholder:text-on-surface-variant/50 focus:outline-none"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="text-on-surface-variant hover:text-on-surface text-label-sm px-2 py-1 rounded-md hover:bg-surface-container"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Teachers Institutional Table */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/30 bg-surface-container-low text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">
                <th className="py-4 px-5">Docente</th>
                <th className="py-4 px-4">Título y Departamento</th>
                <th className="py-4 px-4">Materias Asignadas</th>
                <th className="py-4 px-4 text-center">Estado</th>
                <th className="py-4 px-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20 text-body-md text-on-surface">
              {filteredTeachers.map(({ teacher, assigned, totalStudents }) => {
                const isTeacherActive = teacher.isActive !== false;
                return (
                  <tr
                    key={teacher.id}
                    className={`hover:bg-surface-container-low/60 transition-colors ${
                      !isTeacherActive ? 'opacity-65 bg-slate-50/60' : ''
                    }`}
                  >
                    {/* Teacher Info */}
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-card ${
                            isTeacherActive
                              ? 'bg-gradient-to-br from-violet-600 to-indigo-700 text-white'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {teacher.avatarInitials}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-on-surface truncate">
                            {teacher.name}
                          </div>
                          <div className="flex items-center gap-1.5 text-body-xs text-on-surface-variant truncate mt-0.5">
                            <Mail className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                            <span className="truncate font-mono">{teacher.email}</span>
                          </div>
                          {teacher.phone && (
                            <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant/80 mt-0.5">
                              <Phone className="w-3 h-3 text-violet-500 shrink-0" />
                              <span>{teacher.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Title & Department */}
                    <td className="py-4 px-4">
                      <div className="text-xs font-semibold text-violet-700">
                        {teacher.title}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1">
                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate max-w-[220px]">{teacher.department}</span>
                      </div>
                    </td>

                    {/* Assigned Courses */}
                    <td className="py-4 px-4">
                      {assigned.length > 0 ? (
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap gap-1.5">
                            {assigned.map((c) => (
                              <span
                                key={c.id}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-violet-50 border border-violet-200 text-xs"
                              >
                                <span className="font-mono font-bold text-violet-700">{c.code}</span>
                                <span className="text-slate-700 truncate max-w-[140px]">{c.name}</span>
                              </span>
                            ))}
                          </div>
                          <div className="text-[11px] text-on-surface-variant">
                            {assigned.length} {assigned.length === 1 ? 'grupo activo' : 'grupos activos'} • {totalStudents} cupos
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-on-surface-variant italic">
                          Sin materias asignadas
                        </span>
                      )}
                    </td>

                    {/* Estado Badge */}
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      {isTeacherActive ? (
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

                    {/* Actions */}
                    <td className="py-4 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedTeacher(teacher)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-700 font-semibold text-xs transition-colors"
                          title="Gestionar asignaturas del docente"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Materias</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleToggleTeacherStatus(teacher)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                            isTeacherActive
                              ? 'bg-amber-50/70 text-amber-700 border-amber-200 hover:bg-amber-100'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }`}
                          title={
                            isTeacherActive
                              ? 'Inhabilitar cuenta docente sin perder cursos ni asistencias'
                              : 'Reactivar cuenta docente'
                          }
                        >
                          {isTeacherActive ? (
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
                            setTeacherToDelete(teacher);
                            setDeleteConfirmedCheck(false);
                          }}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
                          title="Eliminar docente definitivamente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredTeachers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-on-surface-variant">
                    <GraduationCap className="w-12 h-12 text-on-surface-variant/40 mx-auto mb-3" />
                    <div className="text-headline-sm font-bold text-on-surface mb-1">
                      No se encontraron docentes
                    </div>
                    <p className="text-body-md text-on-surface-variant max-w-md mx-auto mb-4">
                      No hay profesores que coincidan con el término de búsqueda.
                    </p>
                    <button
                      onClick={openNewTeacherModal}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white font-semibold text-label-md"
                    >
                      <Plus className="w-4 h-4" />
                      Registrar Profesor
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal: Gestionar Materias del Docente ── */}
      {selectedTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-surface-container-lowest rounded-2xl max-w-2xl w-full my-8 shadow-elevated border border-outline-variant/30 flex flex-col animate-scale-in">
            {/* Header */}
            <div className="p-6 border-b border-outline-variant/20 flex items-start justify-between gap-4 bg-surface-container-low/50 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-violet-600 text-white flex items-center justify-center font-bold text-headline-sm shadow-card">
                  {selectedTeacher.avatarInitials}
                </div>
                <div>
                  <h2 className="text-headline-sm font-bold text-on-surface">
                    {selectedTeacher.name}
                  </h2>
                  <p className="text-body-sm text-on-surface-variant">
                    {selectedTeacher.title} • {selectedTeacher.email}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedTeacher(null)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              {/* Assign Course Form */}
              <div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/30">
                <h3 className="text-label-lg font-bold text-on-surface mb-2 flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-violet-600" />
                  Asignar Nueva Asignatura a este Docente
                </h3>
                <p className="text-body-sm text-on-surface-variant mb-3">
                  Selecciona una asignatura del catálogo institucional para ponerla bajo la responsabilidad de {selectedTeacher.name}.
                </p>

                <div className="space-y-3">
                  <div className="w-full">
                    <label className="text-label-sm font-semibold text-on-surface-variant block mb-1.5">
                      Asignatura disponible para asignar
                    </label>
                    <div className="relative">
                      <select
                        value={courseToAssign}
                        onChange={(e) => setCourseToAssign(e.target.value)}
                        className="w-full h-11 px-3.5 pr-8 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface text-body-sm focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-600/10 truncate"
                      >
                        <option value="">-- Seleccionar asignatura del catálogo --</option>
                        {unassignedOrOtherCourses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} — {c.name} ({c.teacher ? `Docente actual: ${c.teacher}` : 'Sin asignar'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleAssignCourse}
                      disabled={!courseToAssign}
                      className="w-full sm:w-auto h-11 px-5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-label-md inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-card"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Asignar Materia a este Docente
                    </button>
                  </div>
                </div>
              </div>

              {/* Current Courses List */}
              <div>
                <h3 className="text-label-lg font-bold text-on-surface mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-violet-600" />
                  Asignaturas Actualmente a Cargo ({currentTeacherCourses.length})
                </h3>

                {currentTeacherCourses.length > 0 ? (
                  <div className="space-y-2.5">
                    {currentTeacherCourses.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-card"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-label-xs px-2 py-0.5 rounded bg-violet-100 text-violet-700 font-bold">
                              {c.code}
                            </span>
                            <span className="font-semibold text-on-surface">{c.name}</span>
                          </div>
                          <div className="text-body-xs text-on-surface-variant mt-1">
                            Aula: {c.room} • Horario: {c.schedule} • {c.students} estudiantes
                          </div>
                        </div>

                        <button
                          onClick={() => handleUnassignCourse(c.id, c.code)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-error hover:bg-red-50 text-label-xs font-semibold transition-colors"
                          title="Desasignar materia de este docente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Desasignar
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 rounded-xl border border-dashed border-outline-variant/40 text-center text-body-sm text-on-surface-variant">
                    Este docente no tiene asignaturas asignadas.
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-outline-variant/20 flex justify-end bg-surface-container-low/40 rounded-b-2xl">
              <button
                onClick={() => setSelectedTeacher(null)}
                className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-label-md transition-all active:scale-[0.98] shadow-card"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Nuevo Docente ── */}
      {newTeacherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-elevated border border-outline-variant/30 animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center text-violet-700">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <h2 className="text-headline-sm font-bold text-on-surface">
                  Registrar Nuevo Profesor
                </h2>
              </div>
              <button
                onClick={() => setNewTeacherModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTeacher} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="text-label-md text-on-surface block mb-1 font-semibold">
                  Nombre Completo <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => handleTeacherNameChange(e.target.value)}
                  placeholder="Ej. Marcela Patricia Valencia"
                  className="w-full h-11 px-3 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-body-md focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-600/10"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-label-md text-on-surface font-semibold">
                    Correo Institucional <span className="text-error">*</span>
                  </label>
                  <span className="text-[11px] font-medium text-violet-600 bg-violet-50 px-2 py-0.5 rounded-md">
                    Autogenerado (Editable)
                  </span>
                </div>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => {
                    setFormError(null);
                    setEmailManuallyEdited(true);
                    setFormData({ ...formData, email: e.target.value });
                  }}
                  placeholder="marcela.valencia@universidad.edu.co"
                  className="w-full h-11 px-3 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-body-md focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-600/10"
                />
              </div>

              <div>
                <label className="text-label-md text-on-surface block mb-1 font-semibold">
                  Contraseña Inicial Institucional <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="123456"
                    className="w-full h-11 pl-3 pr-10 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-body-md font-mono focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-600/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
                    title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-label-md text-on-surface block mb-1 font-semibold">
                  Título Académico
                </label>
                <select
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full h-11 px-3 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-body-md focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-600/10"
                >
                  {TEACHER_TITLES.map((titleOption) => (
                    <option key={titleOption} value={titleOption}>
                      {titleOption}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-label-md text-on-surface block mb-1 font-semibold">
                  Departamento o Escuela
                </label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full h-11 px-3 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-body-md focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-600/10"
                >
                  {TEACHER_DEPARTMENTS.map((deptOption) => (
                    <option key={deptOption} value={deptOption}>
                      {deptOption}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-label-md text-on-surface block mb-1 font-semibold">
                  Teléfono / Extensión
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+57 (2) 321-2100 Ext. 420"
                  className="w-full h-11 px-3 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-body-md focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-600/10"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => setNewTeacherModal(false)}
                  className="px-4 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container text-label-md font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold text-label-md transition-all active:scale-[0.98] shadow-card"
                >
                  {isSubmitting ? 'Validando...' : 'Registrar Docente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal de Doble Confirmación para Eliminar Docente ── */}
      {teacherToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => {
            setTeacherToDelete(null);
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
                  Eliminar Docente Definitivamente
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Acción destructiva e irreversible en PostgreSQL / Supabase
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50/80 border border-rose-200 text-xs text-rose-900 space-y-1.5 mb-4">
              <p className="font-semibold">
                Estás a punto de eliminar a {teacherToDelete.name} ({teacherToDelete.email}).
              </p>
              <p className="text-rose-800 leading-relaxed">
                Sus asignaturas quedarán sin docente titular asignado y se eliminarán sus sesiones abiertas asociadas. Si solo deseas restringir temporalmente su ingreso al portal, utiliza el botón <strong>Inhabilitar</strong>.
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
                Confirmo que comprendo el impacto y deseo eliminar permanentemente este registro docente.
              </span>
            </label>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setTeacherToDelete(null);
                  setDeleteConfirmedCheck(false);
                }}
                className="px-4 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!deleteConfirmedCheck || isDeleting}
                onClick={() => void handleConfirmDeleteTeacher()}
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
