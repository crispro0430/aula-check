'use client';

import { useState, useMemo } from 'react';
import {
  BookOpen, Plus, Edit2, Trash2, MapPin, User, Clock, Users,
  Search, CheckCircle2, AlertCircle, X, Save, UserPlus, UserMinus,
  GraduationCap, RefreshCw
} from 'lucide-react';
import { useAulaCheckStore } from '@/lib/store';
import type { AdminCourse } from '@/lib/types';

const WEEK_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;

const TIME_SLOTS = [
  { value: '06:00', label: '06:00 AM' },
  { value: '07:00', label: '07:00 AM' },
  { value: '08:00', label: '08:00 AM' },
  { value: '09:00', label: '09:00 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '13:00', label: '01:00 PM' },
  { value: '14:00', label: '02:00 PM' },
  { value: '15:00', label: '03:00 PM' },
  { value: '16:00', label: '04:00 PM' },
  { value: '17:00', label: '05:00 PM' },
  { value: '18:00', label: '06:00 PM' },
  { value: '19:00', label: '07:00 PM' },
  { value: '20:00', label: '08:00 PM' },
  { value: '21:00', label: '09:00 PM' },
  { value: '22:00', label: '10:00 PM' },
] as const;

function buildScheduleString(days: string[], start: string, end: string): string {
  const orderedDays = WEEK_DAYS.filter((d) => days.includes(d));
  const dayPart = orderedDays.length > 0 ? orderedDays.join(' / ') : 'Lun';
  return `${dayPart} ${start} - ${end}`;
}

function parseScheduleString(schedule: string): {
  days: string[];
  startTime: string;
  endTime: string;
} {
  const matchedDays = WEEK_DAYS.filter((day) => schedule.includes(day));
  const timeMatch = schedule.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
  return {
    days: matchedDays.length > 0 ? [...matchedDays] : ['Lun', 'Mié'],
    startTime: timeMatch?.[1] || '08:00',
    endTime: timeMatch?.[2] || '10:00',
  };
}

function deriveCoursePrefix(courseName: string): string {
  const cleanWords = courseName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (cleanWords.length === 0) return 'SIS';
  if (cleanWords.length >= 3) {
    return `${cleanWords[0][0]}${cleanWords[1][0]}${cleanWords[2][0]}`;
  }
  const combined = cleanWords.join('');
  return (combined + 'XXX').slice(0, 3);
}

function generateUniqueCourseCode(
  courseName: string,
  existingCodes: Set<string>,
  forceNewDigits = false,
  currentCode = ''
): string {
  const prefix = deriveCoursePrefix(courseName);
  const existingDigitsMatch = currentCode.match(/-(\d{3})$/);

  if (!forceNewDigits && existingDigitsMatch) {
    const candidate = `${prefix}-${existingDigitsMatch[1]}`;
    if (!existingCodes.has(candidate.toUpperCase())) {
      return candidate;
    }
  }

  const preferredNumbers = [301, 302, 401, 402, 201, 202, 501, 502, 101, 102];
  if (!forceNewDigits) {
    for (const num of preferredNumbers) {
      const candidate = `${prefix}-${num}`;
      if (!existingCodes.has(candidate.toUpperCase())) {
        return candidate;
      }
    }
  }

  for (let i = 0; i < 200; i++) {
    const randomNum = Math.floor(100 + Math.random() * 800);
    const candidate = `${prefix}-${randomNum}`;
    if (!existingCodes.has(candidate.toUpperCase()) && candidate !== currentCode) {
      return candidate;
    }
  }
  return `${prefix}-${String(Date.now()).slice(-3)}`;
}

interface CourseFormData {
  code: string;
  name: string;
  room: string;
  teacher: string;
  schedule: string;
  students: number;
}

const DEFAULT_FORM: CourseFormData = {
  code: '',
  name: '',
  room: '',
  teacher: '',
  schedule: 'Lun / Mié 08:00 - 10:00',
  students: 25,
};

export default function AdminCoursesPage() {
  const courses = useAulaCheckStore((s) => s.courses);
  const students = useAulaCheckStore((s) => s.students);
  const teachers = useAulaCheckStore((s) => s.teachers);
  const addCourse = useAulaCheckStore((s) => s.addCourse);
  const updateCourse = useAulaCheckStore((s) => s.updateCourse);
  const deleteCourse = useAulaCheckStore((s) => s.deleteCourse);
  const enrollStudentInCourse = useAulaCheckStore((s) => s.enrollStudentInCourse);
  const unenrollStudentFromCourse = useAulaCheckStore((s) => s.unenrollStudentFromCourse);

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CourseFormData>(DEFAULT_FORM);
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>(['Lun', 'Mié']);
  const [startTime, setStartTime] = useState<string>('08:00');
  const [endTime, setEndTime] = useState<string>('10:00');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [managingStudentsCourseId, setManagingStudentsCourseId] = useState<string | null>(null);
  const [selectedStudentToEnroll, setSelectedStudentToEnroll] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const existingCourseCodes = useMemo(
    () =>
      new Set(
        courses
          .filter((c) => c.id !== editingId)
          .map((c) => c.code.toUpperCase())
      ),
    [courses, editingId]
  );

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }

  const filteredCourses = courses.filter(
    (c) =>
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.teacher && c.teacher.toLowerCase().includes(search.toLowerCase())) ||
      c.room.toLowerCase().includes(search.toLowerCase())
  );

  // Active course being managed for student enrollment
  const currentManagingCourse = courses.find((c) => c.id === managingStudentsCourseId) || null;
  const enrolledIds = currentManagingCourse?.enrolledStudentIds || [];
  const enrolledStudentList = students.filter(
    (s) => enrolledIds.includes(s.id) || enrolledIds.includes(s.code)
  );
  const availableStudentsToEnroll = students.filter(
    (s) => !enrolledIds.includes(s.id) && !enrolledIds.includes(s.code)
  );

  function handleOpenCreate() {
    setEditingId(null);
    const defaultDays = ['Lun', 'Mié'];
    const defaultStart = '08:00';
    const defaultEnd = '10:00';
    setSelectedDays(defaultDays);
    setStartTime(defaultStart);
    setEndTime(defaultEnd);
    setCodeManuallyEdited(false);
    const initialCode = generateUniqueCourseCode('Asignatura', existingCourseCodes, true);
    setFormData({
      ...DEFAULT_FORM,
      code: initialCode,
      schedule: buildScheduleString(defaultDays, defaultStart, defaultEnd),
    });
    setModalOpen(true);
  }

  function handleOpenEdit(course: AdminCourse) {
    setEditingId(course.id);
    const parsed = parseScheduleString(course.schedule || 'Lun / Mié 08:00 - 10:00');
    setSelectedDays(parsed.days);
    setStartTime(parsed.startTime);
    setEndTime(parsed.endTime);
    setCodeManuallyEdited(true);
    setFormData({
      code: course.code,
      name: course.name,
      room: course.room,
      teacher: course.teacher || '',
      schedule: buildScheduleString(parsed.days, parsed.startTime, parsed.endTime),
      students: course.students,
    });
    setModalOpen(true);
  }

  function handleCourseNameChange(newName: string) {
    setFormData((prev) => {
      const nextCode =
        codeManuallyEdited && prev.code.trim() !== ''
          ? prev.code
          : generateUniqueCourseCode(newName, existingCourseCodes, false, prev.code);
      return {
        ...prev,
        name: newName,
        code: nextCode,
      };
    });
  }

  function handleRefreshCourseCode() {
    setCodeManuallyEdited(false);
    setFormData((prev) => ({
      ...prev,
      code: generateUniqueCourseCode(prev.name || 'Materia', existingCourseCodes, true, prev.code),
    }));
  }

  function toggleDay(day: string) {
    setSelectedDays((prev) => {
      const exists = prev.includes(day);
      const next = exists
        ? prev.length > 1
          ? prev.filter((d) => d !== day)
          : prev
        : [...prev, day];
      const nextSchedule = buildScheduleString(next, startTime, endTime);
      setFormData((f) => ({ ...f, schedule: nextSchedule }));
      return next;
    });
  }

  function handleStartTimeChange(newStart: string) {
    setStartTime(newStart);
    const nextSchedule = buildScheduleString(selectedDays, newStart, endTime);
    setFormData((f) => ({ ...f, schedule: nextSchedule }));
  }

  function handleEndTimeChange(newEnd: string) {
    setEndTime(newEnd);
    const nextSchedule = buildScheduleString(selectedDays, startTime, newEnd);
    setFormData((f) => ({ ...f, schedule: nextSchedule }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim() || !formData.room.trim()) {
      return;
    }

    const teacherValue = formData.teacher ? formData.teacher.trim() : '';

    if (editingId) {
      updateCourse(editingId, {
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        room: formData.room.trim(),
        teacher: teacherValue,
        schedule: formData.schedule.trim(),
        students: Number(formData.students) || 0,
      });
      showToast(`Asignatura ${formData.code.toUpperCase()} actualizada con éxito`);
    } else {
      addCourse({
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        room: formData.room.trim(),
        teacher: teacherValue,
        schedule: formData.schedule.trim(),
        students: Number(formData.students) || 0,
        enrolledStudentIds: [],
      });
      showToast(`Nueva asignatura ${formData.code.toUpperCase()} creada con éxito`);
    }

    void fetch('/api/admin/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingId || undefined,
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        room: formData.room.trim(),
        schedule: formData.schedule.trim(),
        teacherName: teacherValue || undefined,
      }),
    }).catch(() => {
      // Fallback silencioso a store local
    });
    setModalOpen(false);
  }

  function handleDelete(id: string) {
    deleteCourse(id);
    setDeleteConfirmId(null);
    showToast('Asignatura eliminada del catálogo');
  }

  function handleEnrollStudent() {
    if (!selectedStudentToEnroll || !managingStudentsCourseId) return;
    enrollStudentInCourse(managingStudentsCourseId, selectedStudentToEnroll);
    const st = students.find((s) => s.id === selectedStudentToEnroll || s.code === selectedStudentToEnroll);
    showToast(`Estudiante ${st?.name || ''} matriculado en ${currentManagingCourse?.code}`);
    setSelectedStudentToEnroll('');
  }

  function handleUnenrollStudent(studentId: string, studentCode: string, studentName: string) {
    if (!managingStudentsCourseId) return;
    unenrollStudentFromCourse(managingStudentsCourseId, studentId);
    if (studentCode && studentCode !== studentId) {
      unenrollStudentFromCourse(managingStudentsCourseId, studentCode);
    }
    showToast(`Estudiante ${studentName} dado de baja de la materia`);
  }

  const totalStudents = courses.reduce((acc, c) => acc + (c.enrolledStudentIds?.length ?? c.students), 0);
  const uniqueTeachers = Array.from(new Set(courses.map((c) => c.teacher).filter(Boolean))).length;

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
              Catálogo Académico
            </span>
          </div>
          <h1 className="text-headline-xl text-violet-700 font-bold tracking-tight mb-1">
            Gestión de Asignaturas y Salones
          </h1>
          <p className="text-body-lg text-on-surface-variant">
            Crea, edita o administra las materias, docentes asignados y los estudiantes matriculados en cada grupo.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-label-lg transition-all active:scale-[0.98] shadow-card shrink-0"
        >
          <Plus className="w-5 h-5" />
          Nueva Asignatura
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30 shadow-card">
          <div className="text-headline-md font-bold text-violet-700">{courses.length}</div>
          <div className="text-label-sm text-on-surface-variant">Asignaturas Activas</div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30 shadow-card">
          <div className="text-headline-md font-bold text-blue-700">{uniqueTeachers}</div>
          <div className="text-label-sm text-on-surface-variant">Docentes Asignados</div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30 shadow-card">
          <div className="text-headline-md font-bold text-emerald-700">{totalStudents}</div>
          <div className="text-label-sm text-on-surface-variant">Estudiantes Matriculados</div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30 shadow-card">
          <div className="text-headline-md font-bold text-on-surface">2026-2</div>
          <div className="text-label-sm text-on-surface-variant">Período Vigente</div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 shadow-card mb-6 flex items-center gap-3">
        <Search className="w-5 h-5 text-on-surface-variant shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código (ej. SIS401), nombre de materia, docente o salón..."
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

      {/* Courses List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredCourses.map((c) => {
          const enrolledCount = c.enrolledStudentIds?.length ?? c.students;
          return (
            <div
              key={c.id}
              className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/30 shadow-card hover:shadow-elevated transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <span className="px-2.5 py-1 rounded-lg bg-violet-100 text-violet-700 font-bold text-label-sm font-mono">
                    {c.code}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(c)}
                      className="p-1.5 rounded-lg text-on-surface-variant hover:text-violet-700 hover:bg-violet-50 transition-colors"
                      title="Editar asignatura"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(c.id)}
                      className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-red-50 transition-colors"
                      title="Eliminar asignatura"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="text-headline-sm font-bold text-on-surface mb-2 leading-tight">
                  {c.name}
                </h3>

                <div className="space-y-2 mt-4 text-body-sm text-on-surface-variant">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-violet-600 shrink-0" />
                    {c.teacher && c.teacher.trim() !== '' ? (
                      <span className="truncate">{c.teacher}</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-label-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        Sin docente asignado
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-violet-600 shrink-0" />
                    <span className="truncate">{c.room}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-violet-600 shrink-0" />
                    <span>{c.schedule}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-violet-600 shrink-0" />
                    <span className="font-medium text-on-surface">{enrolledCount} estudiantes matriculados</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-outline-variant/20 flex flex-wrap items-center justify-between gap-2">
                <button
                  onClick={() => setManagingStudentsCourseId(c.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 font-semibold text-label-xs transition-colors"
                >
                  <Users className="w-3.5 h-3.5" />
                  👥 Gestionar Estudiantes ({enrolledCount})
                </button>
                <button
                  onClick={() => handleOpenEdit(c)}
                  className="text-label-sm text-violet-600 font-semibold hover:underline"
                >
                  Editar detalles
                </button>
              </div>
            </div>
          );
        })}

        {filteredCourses.length === 0 && (
          <div className="col-span-full bg-surface-container-lowest rounded-2xl p-12 text-center border border-outline-variant/30 shadow-card">
            <BookOpen className="w-12 h-12 text-on-surface-variant/40 mx-auto mb-3" />
            <div className="text-headline-sm font-bold text-on-surface mb-1">
              No se encontraron asignaturas
            </div>
            <p className="text-body-md text-on-surface-variant max-w-md mx-auto mb-4">
              No hay materias que coincidan con la búsqueda o el catálogo está vacío.
            </p>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white font-semibold text-label-md"
            >
              <Plus className="w-4 h-4" />
              Crear Asignatura
            </button>
          </div>
        )}
      </div>

      {/* ── Modal: Gestionar Estudiantes Matriculados ── */}
      {currentManagingCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-surface-container-lowest rounded-2xl max-w-2xl w-full my-8 shadow-elevated border border-outline-variant/30 flex flex-col max-h-[90vh] animate-scale-in">
            {/* Modal Header */}
            <div className="p-6 border-b border-outline-variant/20 flex items-start justify-between gap-4 bg-surface-container-low/50 rounded-t-2xl shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-violet-600 text-white flex items-center justify-center font-bold text-headline-sm shadow-card shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-headline-sm font-bold text-on-surface">
                      Estudiantes Matriculados
                    </h2>
                    <span className="font-mono text-label-xs px-2 py-0.5 rounded bg-violet-100 text-violet-700 font-bold">
                      {currentManagingCourse.code}
                    </span>
                  </div>
                  <p className="text-body-sm text-on-surface-variant">
                    {currentManagingCourse.name} • {currentManagingCourse.teacher && currentManagingCourse.teacher.trim() !== '' ? currentManagingCourse.teacher : 'Sin docente asignado'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setManagingStudentsCourseId(null)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Enrollment Form */}
              <div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/30">
                <h3 className="text-label-lg font-bold text-on-surface mb-1 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-violet-600" />
                  Matricular Estudiante del Catálogo Institucional
                </h3>
                <p className="text-body-sm text-on-surface-variant mb-3">
                  Selecciona a un estudiante registrado en la universidad para incorporarlo a esta asignatura.
                </p>

                <div className="space-y-3">
                  <div className="w-full">
                    <select
                      value={selectedStudentToEnroll}
                      onChange={(e) => setSelectedStudentToEnroll(e.target.value)}
                      className="w-full h-11 px-3.5 pr-8 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface text-body-sm focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-600/10 truncate"
                    >
                      <option value="">-- Seleccionar estudiante para matricular --</option>
                      {availableStudentsToEnroll.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code}) — {s.program}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleEnrollStudent}
                      disabled={!selectedStudentToEnroll}
                      className="w-full sm:w-auto h-11 px-5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-label-md inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-card"
                    >
                      <UserPlus className="w-4 h-4" />
                      Agregar a la materia
                    </button>
                  </div>
                </div>
              </div>

              {/* Enrolled Students Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-label-lg font-bold text-on-surface flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-violet-600" />
                    Lista de Alumnos Matriculados ({enrolledStudentList.length})
                  </h3>
                  <span className="text-label-xs text-on-surface-variant">
                    {enrolledStudentList.length} cupos ocupados
                  </span>
                </div>

                {enrolledStudentList.length > 0 ? (
                  <div className="border border-outline-variant/30 rounded-xl overflow-hidden shadow-card">
                    <table className="w-full text-left text-body-sm">
                      <thead className="bg-surface-container-low text-label-xs uppercase text-on-surface-variant font-bold border-b border-outline-variant/30">
                        <tr>
                          <th className="py-2.5 px-3">Estudiante</th>
                          <th className="py-2.5 px-3">Código</th>
                          <th className="py-2.5 px-3 text-center">Asistencia</th>
                          <th className="py-2.5 px-3 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/20">
                        {enrolledStudentList.map((st) => (
                          <tr key={st.id} className="hover:bg-surface-container-low/40">
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-label-xs shrink-0">
                                  {st.avatarInitials}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-on-surface truncate text-label-sm">
                                    {st.name}
                                  </div>
                                  <div className="text-body-xs text-on-surface-variant truncate">
                                    {st.program}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-label-xs text-on-surface-variant">
                              {st.code}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-label-xs font-semibold ${
                                  st.attendanceRate >= 75
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : st.attendanceRate >= 60
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-red-50 text-red-700'
                                }`}
                              >
                                {st.attendanceRate}%
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={() => handleUnenrollStudent(st.id, st.code, st.name)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-error hover:bg-red-50 text-label-xs font-semibold transition-colors"
                                title="Dar de baja / desmatricular de la materia"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Dar de baja
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 rounded-xl border border-dashed border-outline-variant/40 text-center text-body-sm text-on-surface-variant">
                    No hay estudiantes matriculados en este grupo. Utiliza el selector superior para asignar alumnos.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-outline-variant/20 flex items-center justify-between bg-surface-container-low/40 rounded-b-2xl shrink-0">
              <span className="text-body-xs text-on-surface-variant">
                Las modificaciones en matrícula se sincronizan en vivo con el control de asistencia.
              </span>
              <button
                onClick={() => setManagingStudentsCourseId(null)}
                className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-label-md transition-all active:scale-[0.98] shadow-card"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Create / Edit Course ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-elevated border border-outline-variant/30 animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center text-violet-700">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h2 className="text-headline-sm font-bold text-on-surface">
                  {editingId ? 'Editar Asignatura' : 'Nueva Asignatura'}
                </h2>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-label-md text-on-surface block mb-1 font-semibold">
                    Nombre de la Asignatura <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => handleCourseNameChange(e.target.value)}
                    placeholder="Ej. Estructuras de Datos"
                    className="w-full h-11 px-3 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-body-md focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-600/10"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="text-label-md text-on-surface block mb-1 font-semibold">
                    Código <span className="text-error">*</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      required
                      value={formData.code}
                      onChange={(e) => {
                        setCodeManuallyEdited(true);
                        setFormData({ ...formData, code: e.target.value.toUpperCase() });
                      }}
                      placeholder="EDD-301"
                      className="w-full h-11 px-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-body-sm uppercase font-mono font-bold focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-600/10"
                    />
                    <button
                      type="button"
                      onClick={handleRefreshCourseCode}
                      className="h-11 w-10 shrink-0 rounded-xl border border-outline-variant bg-surface-container-low hover:bg-violet-50 hover:border-violet-300 text-violet-700 flex items-center justify-center transition-colors"
                      title="Generar nuevo código único"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-label-md text-on-surface block mb-1 font-semibold">
                  Profesor Asignado
                </label>
                <select
                  value={formData.teacher || ''}
                  onChange={(e) => setFormData({ ...formData, teacher: e.target.value })}
                  className="w-full h-11 px-3 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-body-md focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-600/10"
                >
                  <option value="">-- Sin asignar (Por definir) --</option>
                  {teachers.map((t) => (
                    <option key={t.id || t.email} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-label-md text-on-surface block mb-1 font-semibold">
                    Salón Habitual <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.room}
                    onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                    placeholder="Ej. Edificio G-401 / Lab B-204"
                    className="w-full h-11 px-3 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-body-md focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-600/10"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="text-label-md text-on-surface block mb-1 font-semibold">
                    Cupos Estimados
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="150"
                    value={formData.students}
                    onChange={(e) => setFormData({ ...formData, students: Number(e.target.value) })}
                    className="w-full h-11 px-3 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-body-md focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-600/10"
                  />
                </div>
              </div>

              {/* Selector de Horarios Avanzado (Semanal / Franjas Horarias) */}
              <div className="rounded-xl border border-outline-variant/60 bg-surface-container-low/60 p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-label-md text-on-surface font-semibold flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-violet-600" />
                    Horario Semanal
                  </label>
                  <span className="font-mono text-xs font-semibold text-violet-700 bg-violet-100/80 px-2.5 py-0.5 rounded-md">
                    {formData.schedule}
                  </span>
                </div>

                {/* 1. Selector de Días (Multi-select de Badges/Chips) */}
                <div>
                  <span className="text-xs text-on-surface-variant block mb-1.5 font-medium">
                    Días de clase (selecciona uno o varios):
                  </span>
                  <div className="grid grid-cols-6 gap-1.5">
                    {WEEK_DAYS.map((day) => {
                      const active = selectedDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          className={`py-2 rounded-lg text-xs font-semibold transition-all border ${
                            active
                              ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-700'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Selector de Franja Horaria */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-xs text-on-surface-variant block mb-1 font-medium">
                      Hora inicio
                    </label>
                    <select
                      value={startTime}
                      onChange={(e) => handleStartTimeChange(e.target.value)}
                      className="w-full h-10 px-2.5 rounded-lg border border-outline-variant bg-white text-on-surface text-xs font-medium focus:outline-none focus:border-violet-600"
                    >
                      {TIME_SLOTS.map((slot) => (
                        <option key={`start-${slot.value}`} value={slot.value}>
                          {slot.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-on-surface-variant block mb-1 font-medium">
                      Hora fin
                    </label>
                    <select
                      value={endTime}
                      onChange={(e) => handleEndTimeChange(e.target.value)}
                      className="w-full h-10 px-2.5 rounded-lg border border-outline-variant bg-white text-on-surface text-xs font-medium focus:outline-none focus:border-violet-600"
                    >
                      {TIME_SLOTS.map((slot) => (
                        <option key={`end-${slot.value}`} value={slot.value}>
                          {slot.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container text-label-md font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-label-md transition-all active:scale-[0.98] shadow-card"
                >
                  <Save className="w-4 h-4" />
                  {editingId ? 'Guardar Cambios' : 'Crear Asignatura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Confirm Delete ── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest rounded-2xl p-6 max-w-sm w-full shadow-elevated border border-red-200 animate-scale-in">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600 mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-headline-sm font-bold text-on-surface mb-1">
              ¿Eliminar esta asignatura?
            </h3>
            <p className="text-body-sm text-on-surface-variant mb-5">
              Esta materia dejará de estar disponible en el selector de apertura de sesiones para los docentes.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container text-label-sm font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 rounded-xl bg-error text-white text-label-sm font-semibold hover:bg-red-700 transition-colors shadow-card"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
