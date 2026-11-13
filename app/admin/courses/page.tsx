'use client';

import { useState, useMemo } from 'react';
import {
  BookOpen, Plus, Edit2, Trash2, MapPin, User, Clock, Users,
  Search, CheckCircle2, AlertCircle, X, Save, UserPlus,
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

    const courseCode = formData.code.trim().toUpperCase();
    const editingCourse = editingId ? courses.find((c) => c.id === editingId) : null;
    const enrolledEmails = (editingCourse?.enrolledStudentIds ?? [])
      .map((eid) => students.find((s) => s.id === eid || s.code === eid)?.email)
      .filter((e): e is string => Boolean(e));

    void fetch('/api/admin/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingId || undefined,
        code: courseCode,
        name: formData.name.trim(),
        room: formData.room.trim(),
        schedule: formData.schedule.trim(),
        teacherName: teacherValue || undefined,
        studentEmails: enrolledEmails,
      }),
    }).catch(() => {
      // Fallback silencioso a store local
    });
    setModalOpen(false);
  }

  function handleDelete(id: string) {
    const targetCourse = courses.find((c) => c.id === id);
    void fetch(
      `/api/admin/courses/${encodeURIComponent(id)}?code=${encodeURIComponent(targetCourse?.code || '')}`,
      { method: 'DELETE' },
    ).catch(() => {
      // Fallback silencioso a store local
    });
    deleteCourse(id);
    setDeleteConfirmId(null);
    showToast('Asignatura eliminada del catálogo');
  }

  function handleEnrollStudent() {
    if (!selectedStudentToEnroll || !managingStudentsCourseId) return;
    enrollStudentInCourse(managingStudentsCourseId, selectedStudentToEnroll);
    const st = students.find((s) => s.id === selectedStudentToEnroll || s.code === selectedStudentToEnroll);
    const courseObj = courses.find((c) => c.id === managingStudentsCourseId);

    if (courseObj && st) {
      void fetch('/api/admin/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: courseObj.id,
          courseCode: courseObj.code,
          courseName: courseObj.name,
          room: courseObj.room,
          schedule: courseObj.schedule,
          teacherName: courseObj.teacher || undefined,
          studentId: st.id,
          studentCode: st.code,
          studentEmail: st.email,
          studentName: st.name,
          studentProgram: st.program,
        }),
      }).catch(() => {
        // Fallback silencioso a store local
      });
    }

    showToast(`Estudiante ${st?.name || ''} matriculado en ${currentManagingCourse?.code}`);
    setSelectedStudentToEnroll('');
  }

  function handleUnenrollStudent(studentId: string, studentCode: string, studentName: string) {
    if (!managingStudentsCourseId) return;
    const st = students.find((s) => s.id === studentId || s.code === studentCode);
    const courseObj = courses.find((c) => c.id === managingStudentsCourseId);

    unenrollStudentFromCourse(managingStudentsCourseId, studentId);
    if (studentCode && studentCode !== studentId) {
      unenrollStudentFromCourse(managingStudentsCourseId, studentCode);
    }

    if (courseObj) {
      void fetch('/api/admin/enrollments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: courseObj.id,
          courseCode: courseObj.code,
          studentId,
          studentCode,
          studentEmail: st?.email,
        }),
      }).catch(() => {
        // Fallback silencioso a store local
      });
    }

    showToast(`Estudiante ${studentName} dado de baja de la materia`);
  }

  const totalStudents = courses.reduce((acc, c) => acc + (c.enrolledStudentIds?.length ?? c.students), 0);
  const uniqueTeachers = Array.from(new Set(courses.map((c) => c.teacher).filter(Boolean))).length;

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#1d1d1f]/90 backdrop-blur-xl text-white px-4 py-3 rounded-2xl shadow-lg animate-slide-up">
          <CheckCircle2 className="w-4 h-4 text-[#34c759] shrink-0" />
          <span className="text-xs font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#0071e3]/10 text-[#0071e3] text-[11px] font-semibold uppercase tracking-wider mb-2">
            Catálogo Académico
          </span>
          <h1 className="text-2xl sm:text-3xl text-[#1d1d1f] font-bold tracking-tight">
            Gestión de Asignaturas y Salones
          </h1>
          <p className="text-sm text-[#86868b] mt-1">
            Crea, edita o administra las materias, docentes asignados y los estudiantes matriculados en cada grupo.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#006edb] active:scale-[0.98] text-white font-semibold text-xs sm:text-sm transition-all shadow-[0_6px_18px_-4px_rgba(0,113,227,0.45)] shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nueva Asignatura
        </button>
      </div>

      {/* Stats bar (Liquid Glass) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/75 backdrop-blur-2xl border border-black/[0.06] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] rounded-2xl p-4">
          <div className="text-2xl font-bold text-[#0071e3]">{courses.length}</div>
          <div className="text-xs text-[#86868b] font-medium mt-0.5">Asignaturas Activas</div>
        </div>
        <div className="bg-white/75 backdrop-blur-2xl border border-black/[0.06] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] rounded-2xl p-4">
          <div className="text-2xl font-bold text-[#1d1d1f]">{uniqueTeachers}</div>
          <div className="text-xs text-[#86868b] font-medium mt-0.5">Docentes Asignados</div>
        </div>
        <div className="bg-white/75 backdrop-blur-2xl border border-black/[0.06] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] rounded-2xl p-4">
          <div className="text-2xl font-bold text-[#34c759]">{totalStudents}</div>
          <div className="text-xs text-[#86868b] font-medium mt-0.5">Estudiantes Matriculados</div>
        </div>
        <div className="bg-white/75 backdrop-blur-2xl border border-black/[0.06] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] rounded-2xl p-4">
          <div className="text-2xl font-bold text-[#1d1d1f]">2026-2</div>
          <div className="text-xs text-[#86868b] font-medium mt-0.5">Período Vigente</div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white/75 backdrop-blur-2xl border border-black/[0.06] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] rounded-2xl p-4 mb-6 flex items-center gap-3">
        <Search className="w-4 h-4 text-[#86868b] shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código (ej. SIS401), nombre de materia, docente o salón..."
          className="flex-1 bg-transparent text-[#1d1d1f] text-sm placeholder:text-[#86868b] focus:outline-none"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="text-[#86868b] hover:text-[#1d1d1f] text-xs px-2 py-1 rounded-md bg-black/[0.05]"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Courses List (Bento Grid Apple) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredCourses.map((c) => {
          const enrolledCount = c.enrolledStudentIds?.length ?? c.students;
          return (
            <div
              key={c.id}
              className="bg-white/75 backdrop-blur-2xl border border-black/[0.06] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] rounded-[28px] p-6 hover:-translate-y-0.5 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <span className="px-2.5 py-1 rounded-full bg-[#0071e3]/10 text-[#0071e3] font-semibold text-xs font-mono">
                    {c.code}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(c)}
                      className="p-1.5 rounded-full text-[#86868b] hover:text-[#0071e3] hover:bg-[#0071e3]/10 transition-colors"
                      title="Editar asignatura"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(c.id)}
                      className="p-1.5 rounded-full text-[#86868b] hover:text-[#ff3b30] hover:bg-[#ff3b30]/10 transition-colors"
                      title="Eliminar asignatura"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="text-base font-bold text-[#1d1d1f] tracking-tight mb-2 leading-snug">
                  {c.name}
                </h3>

                <div className="space-y-2 mt-4 text-xs text-[#86868b]">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-[#0071e3] shrink-0" />
                    {c.teacher && c.teacher.trim() !== '' ? (
                      <span className="truncate text-[#1d1d1f] font-medium">{c.teacher}</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#ff9500]/12 text-[#1d1d1f] border border-[#ff9500]/25">
                        Sin docente asignado
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-[#0071e3] shrink-0" />
                    <span className="truncate">{c.room}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-[#0071e3] shrink-0" />
                    <span>{c.schedule}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-[#0071e3] shrink-0" />
                    <span className="font-medium text-[#1d1d1f]">{enrolledCount} estudiantes matriculados</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-black/[0.06] flex flex-wrap items-center justify-between gap-2">
                <button
                  onClick={() => setManagingStudentsCourseId(c.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0071e3]/10 hover:bg-[#0071e3]/15 text-[#0071e3] font-semibold text-xs transition-all active:scale-[0.98]"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Estudiantes ({enrolledCount})</span>
                </button>
                <button
                  onClick={() => handleOpenEdit(c)}
                  className="text-xs text-[#0071e3] font-semibold hover:underline"
                >
                  Editar detalles
                </button>
              </div>
            </div>
          );
        })}

        {filteredCourses.length === 0 && (
          <div className="col-span-full bg-white/75 backdrop-blur-2xl border border-black/[0.06] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] rounded-2xl p-12 text-center">
            <BookOpen className="w-10 h-10 text-[#86868b]/40 mx-auto mb-2" />
            <div className="text-sm font-bold text-[#1d1d1f]">
              No se encontraron asignaturas
            </div>
            <p className="text-xs text-[#86868b] max-w-md mx-auto mt-1 mb-4">
              No hay materias que coincidan con la búsqueda o el catálogo está vacío.
            </p>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0071e3] text-white font-semibold text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Crear Asignatura
            </button>
          </div>
        )}
      </div>

      {/* ── Modal: Gestionar Estudiantes Matriculados (Cristal Templado Apple) ── */}
      {currentManagingCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="bg-white/90 backdrop-blur-3xl border border-black/[0.08] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] rounded-[28px] max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="p-6 border-b border-black/[0.06] flex items-start justify-between gap-4 bg-white/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#0071e3] text-white flex items-center justify-center font-bold shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-[#1d1d1f] tracking-tight">
                      Estudiantes Matriculados
                    </h2>
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-[#0071e3]/10 text-[#0071e3] font-semibold">
                      {currentManagingCourse.code}
                    </span>
                  </div>
                  <p className="text-xs text-[#86868b]">
                    {currentManagingCourse.name} • {currentManagingCourse.teacher && currentManagingCourse.teacher.trim() !== '' ? currentManagingCourse.teacher : 'Sin docente asignado'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setManagingStudentsCourseId(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-black/[0.05] text-[#86868b] hover:text-[#1d1d1f] shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="bg-black/[0.02] rounded-2xl p-4 border border-black/[0.06]">
                <h3 className="text-sm font-bold text-[#1d1d1f] mb-1 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[#0071e3]" />
                  Matricular Estudiante del Catálogo Institucional
                </h3>
                <p className="text-xs text-[#86868b] mb-3">
                  Selecciona a un estudiante registrado en la universidad para incorporarlo a esta asignatura.
                </p>

                <div className="space-y-3">
                  <div className="w-full">
                    <select
                      value={selectedStudentToEnroll}
                      onChange={(e) => setSelectedStudentToEnroll(e.target.value)}
                      className="w-full h-11 px-3.5 pr-8 rounded-xl border border-black/[0.08] bg-white text-[#1d1d1f] text-xs focus:outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/30 truncate"
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
                      className="w-full sm:w-auto h-10 px-5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#006edb] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs inline-flex items-center justify-center gap-2 transition-all"
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
                  <h3 className="text-sm font-bold text-[#1d1d1f] flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-[#0071e3]" />
                    Lista de Alumnos Matriculados ({enrolledStudentList.length})
                  </h3>
                  <span className="text-xs text-[#86868b]">
                    {enrolledStudentList.length} cupos ocupados
                  </span>
                </div>

                {enrolledStudentList.length > 0 ? (
                  <div className="border border-black/[0.06] rounded-2xl overflow-hidden bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-black/[0.02] text-[11px] uppercase text-[#86868b] font-semibold border-b border-black/[0.06]">
                        <tr>
                          <th className="py-2.5 px-3">Estudiante</th>
                          <th className="py-2.5 px-3">Código</th>
                          <th className="py-2.5 px-3 text-center">Asistencia</th>
                          <th className="py-2.5 px-3 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/[0.05]">
                        {enrolledStudentList.map((st) => (
                          <tr key={st.id} className="hover:bg-black/[0.02]">
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center font-bold text-[11px] shrink-0">
                                  {st.avatarInitials}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-[#1d1d1f] truncate">
                                    {st.name}
                                  </div>
                                  <div className="text-[11px] text-[#86868b] truncate">
                                    {st.program}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-[#86868b]">
                              {st.code}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                  st.attendanceRate >= 75
                                    ? 'bg-[#34c759]/12 text-[#1d1d1f]'
                                    : st.attendanceRate >= 60
                                    ? 'bg-[#ff9500]/12 text-[#1d1d1f]'
                                    : 'bg-[#ff3b30]/12 text-[#1d1d1f]'
                                }`}
                              >
                                {st.attendanceRate}%
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={() => handleUnenrollStudent(st.id, st.code, st.name)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[#ff3b30] hover:bg-[#ff3b30]/10 text-[11px] font-semibold transition-colors"
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
                  <div className="p-8 rounded-2xl border border-dashed border-black/[0.08] text-center text-xs text-[#86868b]">
                    No hay estudiantes matriculados en este grupo. Utiliza el selector superior para asignar alumnos.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-black/[0.06] flex items-center justify-between bg-white/60 shrink-0">
              <span className="text-xs text-[#86868b]">
                Las modificaciones en matrícula se sincronizan en vivo con el control de asistencia.
              </span>
              <button
                onClick={() => setManagingStudentsCourseId(null)}
                className="px-5 py-2 rounded-full bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#006edb] active:scale-[0.98] text-white font-semibold text-xs transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Create / Edit Course (Cristal Templado Apple) ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-md overflow-y-auto animate-fade-in">
          <div className="bg-white/90 backdrop-blur-3xl border border-black/[0.08] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] rounded-[28px] max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
            <div className="px-6 py-5 border-b border-black/[0.06] bg-white/60 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#0071e3]/10 flex items-center justify-center text-[#0071e3]">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-[#1d1d1f] tracking-tight">
                  {editingId ? 'Editar Asignatura' : 'Nueva Asignatura'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-black/[0.05] text-[#86868b] hover:text-[#1d1d1f] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="text-xs text-[#1d1d1f] block mb-1.5 font-semibold">
                    Nombre de la Asignatura <span className="text-[#ff3b30]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => handleCourseNameChange(e.target.value)}
                    placeholder="Ej. Estructuras de Datos"
                    className="w-full h-11 px-3.5 rounded-xl border border-black/[0.08] bg-black/[0.03] focus:bg-white text-[#1d1d1f] text-sm focus:outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/30 transition-all"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="text-xs text-[#1d1d1f] block mb-1.5 font-semibold">
                    Código <span className="text-[#ff3b30]">*</span>
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
                      className="w-full h-11 px-2.5 rounded-xl border border-black/[0.08] bg-black/[0.03] focus:bg-white text-[#1d1d1f] text-xs uppercase font-mono font-bold focus:outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/30 transition-all"
                    />
                    <button
                      type="button"
                      onClick={handleRefreshCourseCode}
                      className="h-11 w-10 shrink-0 rounded-xl border border-black/[0.08] bg-white hover:bg-black/[0.03] text-[#0071e3] flex items-center justify-center transition-all active:scale-[0.98]"
                      title="Generar nuevo código único"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-[#1d1d1f] block mb-1.5 font-semibold">
                  Profesor Asignado
                </label>
                <select
                  value={formData.teacher || ''}
                  onChange={(e) => setFormData({ ...formData, teacher: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-xl border border-black/[0.08] bg-black/[0.03] focus:bg-white text-[#1d1d1f] text-sm focus:outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/30 transition-all"
                >
                  <option value="">-- Sin asignar (Por definir) --</option>
                  {teachers.map((t) => (
                    <option key={t.id || t.email} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="text-xs text-[#1d1d1f] block mb-1.5 font-semibold">
                    Salón Habitual <span className="text-[#ff3b30]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.room}
                    onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                    placeholder="Ej. Edificio G-401 / Lab B-204"
                    className="w-full h-11 px-3.5 rounded-xl border border-black/[0.08] bg-black/[0.03] focus:bg-white text-[#1d1d1f] text-sm focus:outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/30 transition-all"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="text-xs text-[#1d1d1f] block mb-1.5 font-semibold">
                    Cupos Estimados
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="150"
                    value={formData.students}
                    onChange={(e) => setFormData({ ...formData, students: Number(e.target.value) })}
                    className="w-full h-11 px-3.5 rounded-xl border border-black/[0.08] bg-black/[0.03] focus:bg-white text-[#1d1d1f] text-sm focus:outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/30 transition-all"
                  />
                </div>
              </div>

              {/* Selector de Horarios Avanzado */}
              <div className="rounded-2xl border border-black/[0.06] bg-black/[0.02] p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs text-[#1d1d1f] font-semibold flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#0071e3]" />
                    Horario Semanal
                  </label>
                  <span className="font-mono text-xs font-semibold text-[#0071e3] bg-[#0071e3]/10 px-2.5 py-0.5 rounded-full">
                    {formData.schedule}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-[#86868b] block mb-1.5 font-medium">
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
                          className={`py-2 rounded-xl text-xs font-semibold transition-all border ${
                            active
                              ? 'bg-[#0071e3] text-white border-[#0071e3] shadow-xs'
                              : 'bg-white text-[#86868b] border-black/[0.08] hover:text-[#1d1d1f]'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] text-[#86868b] block mb-1 font-medium">
                      Hora inicio
                    </label>
                    <select
                      value={startTime}
                      onChange={(e) => handleStartTimeChange(e.target.value)}
                      className="w-full h-10 px-2.5 rounded-xl border border-black/[0.08] bg-white text-[#1d1d1f] text-xs font-medium focus:outline-none focus:border-[#0071e3]"
                    >
                      {TIME_SLOTS.map((slot) => (
                        <option key={`start-${slot.value}`} value={slot.value}>
                          {slot.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-[#86868b] block mb-1 font-medium">
                      Hora fin
                    </label>
                    <select
                      value={endTime}
                      onChange={(e) => handleEndTimeChange(e.target.value)}
                      className="w-full h-10 px-2.5 rounded-xl border border-black/[0.08] bg-white text-[#1d1d1f] text-xs font-medium focus:outline-none focus:border-[#0071e3]"
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
              </div>

              <div className="px-6 py-4 border-t border-black/[0.06] bg-white/60 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-10 px-4 rounded-full bg-black/[0.05] hover:bg-black/[0.08] text-[#1d1d1f] text-xs font-semibold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#006edb] active:scale-[0.98] text-white font-semibold text-xs transition-all"
                >
                  <Save className="w-3.5 h-3.5" />
                  {editingId ? 'Guardar Cambios' : 'Crear Asignatura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Confirm Delete (Cristal Templado Apple) ── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-md overflow-y-auto animate-fade-in">
          <div className="bg-white/90 backdrop-blur-3xl border border-black/[0.08] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] rounded-[28px] max-w-sm w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
            <div className="px-6 py-5 border-b border-black/[0.06] bg-white/60 flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 rounded-2xl bg-[#ff3b30]/12 flex items-center justify-center text-[#ff3b30] shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#1d1d1f] tracking-tight">
                ¿Eliminar esta asignatura?
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <p className="text-xs text-[#86868b] leading-relaxed">
                Esta materia dejará de estar disponible en el selector de apertura de sesiones para los docentes.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-black/[0.06] bg-white/60 flex items-center justify-end gap-2 shrink-0">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-full bg-black/[0.05] hover:bg-black/[0.08] text-[#1d1d1f] text-xs font-semibold transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 rounded-full bg-[#ff3b30] hover:brightness-95 active:scale-[0.98] text-white text-xs font-semibold transition-all"
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
