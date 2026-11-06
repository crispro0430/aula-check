'use client';

import { useState, useMemo } from 'react';
import {
  GraduationCap, Search, Plus, Mail, BookOpen, Users,
  Phone, Building2, CheckCircle2, X, PlusCircle, Trash2,
  Calendar, Award
} from 'lucide-react';
import { useAulaCheckStore } from '@/lib/store';
import type { Teacher, AdminCourse } from '@/lib/types';

interface NewTeacherFormData {
  name: string;
  email: string;
  department: string;
  title: string;
  phone: string;
}

const DEFAULT_FORM: NewTeacherFormData = {
  name: '',
  email: '',
  department: 'Escuela de Ingeniería de Sistemas y Computación',
  title: 'Profesor(a) Asistente',
  phone: '',
};

export default function AdminTeachersPage() {
  const teachers = useAulaCheckStore((s) => s.teachers);
  const courses  = useAulaCheckStore((s) => s.courses);
  const addTeacher = useAulaCheckStore((s) => s.addTeacher);
  const assignCourseToTeacher = useAulaCheckStore((s) => s.assignCourseToTeacher);

  const [search, setSearch] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [newTeacherModal, setNewTeacherModal] = useState(false);
  const [formData, setFormData] = useState<NewTeacherFormData>(DEFAULT_FORM);
  const [courseToAssign, setCourseToAssign] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  function handleCreateTeacher(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) return;

    const names = formData.name.trim().split(' ');
    const initials = (names[0]?.[0] || 'P') + (names[1]?.[0] || 'D');

    addTeacher({
      name: formData.name.trim(),
      email: formData.email.trim(),
      department: formData.department.trim(),
      title: formData.title.trim(),
      phone: formData.phone.trim() || '+57 (2) 321-2100',
      avatarInitials: initials.toUpperCase(),
    });

    void fetch('/api/admin/teachers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.name.trim(),
        email: formData.email.trim(),
        department: formData.department.trim(),
        title: formData.title.trim(),
        phone: formData.phone.trim() || '+57 (2) 321-2100',
      }),
    }).catch(() => {
      // Fallback silencioso a store local
    });

    showToast(`Profesor(a) ${formData.name} registrado(a) con éxito`);
    setNewTeacherModal(false);
    setFormData(DEFAULT_FORM);
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
            Supervisa el equipo académico, sus asignaturas a cargo y los cupos estudiantiles bajo su responsabilidad.
          </p>
        </div>

        <button
          onClick={() => setNewTeacherModal(true)}
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
          <div className="text-headline-md font-bold text-blue-700">{totalAssignedCourses}</div>
          <div className="text-label-sm text-on-surface-variant">Grupos Asignados</div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30 shadow-card">
          <div className="text-headline-md font-bold text-emerald-700">{totalStudentsServed}</div>
          <div className="text-label-sm text-on-surface-variant">Estudiantes Atendidos</div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30 shadow-card">
          <div className="text-headline-md font-bold text-on-surface">100%</div>
          <div className="text-label-sm text-on-surface-variant">Cobertura Académica</div>
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

      {/* Teachers Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredTeachers.map(({ teacher, assigned, totalStudents }) => (
          <div
            key={teacher.id}
            className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/30 shadow-card hover:shadow-elevated transition-all flex flex-col justify-between"
          >
            <div>
              {/* Header */}
              <div className="flex items-start gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white flex items-center justify-center font-bold text-headline-sm shadow-card shrink-0">
                  {teacher.avatarInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-headline-sm font-bold text-on-surface leading-tight truncate">
                      {teacher.name}
                    </h3>
                  </div>
                  <div className="text-body-sm text-violet-700 font-medium truncate">
                    {teacher.title}
                  </div>
                  <div className="flex items-center gap-1.5 text-body-xs text-on-surface-variant mt-1 truncate">
                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{teacher.department}</span>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-1.5 mb-4 text-body-sm text-on-surface-variant bg-surface-container-low/60 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-violet-600 shrink-0" />
                  <span className="truncate">{teacher.email}</span>
                </div>
                {teacher.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-violet-600 shrink-0" />
                    <span>{teacher.phone}</span>
                  </div>
                )}
              </div>

              {/* Assigned Courses Section */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-violet-600" />
                    Materias Asignadas ({assigned.length})
                  </span>
                  <span className="text-label-xs text-on-surface-variant">
                    {totalStudents} alumnos totales
                  </span>
                </div>

                {assigned.length > 0 ? (
                  <div className="space-y-2">
                    {assigned.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container border border-outline-variant/30 text-body-sm"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-on-surface">{c.name}</span>
                          <span className="ml-2 font-mono text-label-xs px-2 py-0.5 rounded bg-violet-100 text-violet-700 font-bold">
                            {c.code}
                          </span>
                          <div className="text-body-xs text-on-surface-variant mt-0.5">
                            {c.schedule} • {c.room}
                          </div>
                        </div>
                        <span className="text-label-xs font-semibold text-on-surface-variant whitespace-nowrap ml-2">
                          {c.students} cupos
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-lg border border-dashed border-outline-variant/40 text-center text-body-xs text-on-surface-variant">
                    Sin materias asignadas actualmente en este período.
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-outline-variant/20 flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-label-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Docente Activo
              </span>

              <button
                onClick={() => setSelectedTeacher(teacher)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 font-semibold text-label-sm transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                Gestionar Materias
              </button>
            </div>
          </div>
        ))}

        {filteredTeachers.length === 0 && (
          <div className="col-span-full bg-surface-container-lowest rounded-2xl p-12 text-center border border-outline-variant/30 shadow-card">
            <GraduationCap className="w-12 h-12 text-on-surface-variant/40 mx-auto mb-3" />
            <div className="text-headline-sm font-bold text-on-surface mb-1">
              No se encontraron docentes
            </div>
            <p className="text-body-md text-on-surface-variant max-w-md mx-auto mb-4">
              No hay profesores que coincidan con el término de búsqueda.
            </p>
            <button
              onClick={() => setNewTeacherModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white font-semibold text-label-md"
            >
              <Plus className="w-4 h-4" />
              Registrar Profesor
            </button>
          </div>
        )}
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
              <div>
                <label className="text-label-md text-on-surface block mb-1 font-semibold">
                  Nombre Completo <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej. Prof. Dra. Marcela Valencia"
                  className="w-full h-11 px-3 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-body-md focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-600/10"
                />
              </div>

              <div>
                <label className="text-label-md text-on-surface block mb-1 font-semibold">
                  Correo Institucional <span className="text-error">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="nombre.apellido@universidad.edu.co"
                  className="w-full h-11 px-3 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-body-md focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-600/10"
                />
              </div>

              <div>
                <label className="text-label-md text-on-surface block mb-1 font-semibold">
                  Título Académico
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ej. Ph.D. en Ciencias de la Computación"
                  className="w-full h-11 px-3 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-body-md focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-600/10"
                />
              </div>

              <div>
                <label className="text-label-md text-on-surface block mb-1 font-semibold">
                  Departamento o Escuela
                </label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full h-11 px-3 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-body-md focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-600/10"
                />
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
                  className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-label-md transition-all active:scale-[0.98] shadow-card"
                >
                  Registrar Docente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
