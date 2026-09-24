'use client';

import { useState, useMemo } from 'react';
import {
  Users, Search, AlertTriangle, CheckCircle2,
  FileText, Download, Printer, X, Eye,
  Calendar, Award, ShieldAlert, BookOpen
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAulaCheckStore } from '@/lib/store';
import { getSemaforoLabel } from '@/lib/utils';
import type { Student } from '@/lib/types';
import { computeStudentMetrics } from '@/lib/student-history';

export default function AdminStudentsPage() {
  const students = useAulaCheckStore((s) => s.students);

  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState<'all' | 'verde' | 'ambar' | 'rojo'>('all');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

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

  // Selected student's metrics
  const selectedMetrics = useMemo(() => {
    if (!selectedStudent) return null;
    return computeStudentMetrics(selectedStudent);
  }, [selectedStudent]);

  // Handle Export Student Expediente to XLSX
  function handleDownloadExpediente(student: Student) {
    const metrics = computeStudentMetrics(student);
    const semaforoText =
      metrics.level === 'verde'
        ? 'Verde (Estable)'
        : metrics.level === 'ambar'
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
      ['Total Sesiones Programadas:', metrics.totalSessions],
      ['Sesiones Asistidas:', metrics.attended],
      ['Inasistencias Justificadas:', metrics.justified],
      ['Inasistencias Injustificadas:', metrics.absent],
      ['Porcentaje Acumulado:', `${metrics.percentage}%`],
      ['Diagnóstico Semáforo:', semaforoText],
      ['Puntos de Participación (⭐):', student.points || 0],
      [],
      ['HISTORIAL DETALLADO SESIÓN POR SESIÓN (PERÍODO 2026-2)'],
      ['Fecha', 'Asignatura y Grupo', 'Tema Impartido', 'Estado Asistencia', 'Observaciones de Registro'],
    ];

    metrics.history.forEach((h) => {
      data.push([
        h.date,
        `${h.courseName} (${h.courseCode})`,
        h.topic,
        h.status === 'presente' || h.status === 'presente_manual'
          ? 'PRESENTE'
          : h.status === 'justificado'
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
      <div className="mb-8">
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
                <th className="py-4 px-6">Estudiante</th>
                <th className="py-4 px-4">Código</th>
                <th className="py-4 px-4">Programa</th>
                <th className="py-4 px-6 text-center">Asistencia Acumulada</th>
                <th className="py-4 px-4 text-center">Semáforo</th>
                <th className="py-4 px-6 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20 text-body-md text-on-surface">
              {filteredStudents.map(({ student: s, metrics }) => {
                const { level, percentage } = metrics;
                return (
                  <tr
                    key={s.id}
                    className="hover:bg-surface-container-low/60 transition-colors"
                  >
                    {/* Student Info */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-label-md shrink-0 ${
                            level === 'verde'
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
                    <td className="py-4 px-4 font-mono text-label-sm text-on-surface font-medium">
                      {s.code}
                    </td>

                    {/* Program */}
                    <td className="py-4 px-4 text-body-sm text-on-surface-variant">
                      {s.program}
                    </td>

                    {/* Progress Bar & Rate */}
                    <td className="py-4 px-6">
                      <div className="w-44 mx-auto">
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
                    <td className="py-4 px-4 text-center">
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

                    {/* Action */}
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => setSelectedStudent(s)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 hover:text-violet-900 font-semibold text-label-sm transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        Ver Expediente
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-on-surface-variant">
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
      {selectedStudent && selectedMetrics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-surface-container-lowest rounded-2xl max-w-3xl w-full my-8 shadow-elevated border border-outline-variant/30 flex flex-col max-h-[90vh] animate-scale-in">
            {/* Modal Header */}
            <div className="p-6 border-b border-outline-variant/20 flex items-start justify-between gap-4 shrink-0 bg-surface-container-low/50 rounded-t-2xl">
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-headline-sm shrink-0 shadow-card ${
                    selectedMetrics.level === 'verde'
                      ? 'bg-emerald-600 text-white'
                      : selectedMetrics.level === 'ambar'
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
                  selectedMetrics.level === 'verde'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : selectedMetrics.level === 'ambar'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  {selectedMetrics.level === 'verde' ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
                  )}
                  <div>
                    <div className="text-label-lg font-bold">
                      {getSemaforoLabel(selectedMetrics.level)}
                    </div>
                    <div className="text-body-sm opacity-80">
                      {selectedMetrics.percentage >= 75
                        ? 'El estudiante cumple con el umbral mínimo del 75% reglamentario.'
                        : selectedMetrics.percentage >= 60
                        ? 'Se recomienda citar a tutoría académica y seguimiento docente.'
                        : 'Acción prioritaria: estudiante en riesgo de reprobación por inasistencia.'}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-headline-md font-bold">
                    {selectedMetrics.percentage}%
                  </div>
                  <div className="text-label-xs opacity-75">Tasa Acumulada</div>
                </div>
              </div>

              {/* Stats Grid - Mathematically derived from history */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-surface-container-low rounded-xl p-3 border border-outline-variant/20 text-center">
                  <Calendar className="w-5 h-5 text-violet-600 mx-auto mb-1" />
                  <div className="text-headline-sm font-bold text-on-surface">
                    {selectedMetrics.totalSessions}
                  </div>
                  <div className="text-label-xs text-on-surface-variant">Sesiones Totales</div>
                </div>
                <div className="bg-surface-container-low rounded-xl p-3 border border-outline-variant/20 text-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                  <div className="text-headline-sm font-bold text-emerald-600">
                    {selectedMetrics.attended}
                  </div>
                  <div className="text-label-xs text-on-surface-variant">Asistencias</div>
                </div>
                <div className="bg-surface-container-low rounded-xl p-3 border border-outline-variant/20 text-center">
                  <FileText className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                  <div className="text-headline-sm font-bold text-purple-600">
                    {selectedMetrics.justified}
                  </div>
                  <div className="text-label-xs text-on-surface-variant">Justificadas</div>
                </div>
                <div className="bg-surface-container-low rounded-xl p-3 border border-outline-variant/20 text-center">
                  <ShieldAlert className="w-5 h-5 text-red-600 mx-auto mb-1" />
                  <div className="text-headline-sm font-bold text-red-600">
                    {selectedMetrics.absent}
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

              {/* Detailed Session History Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-headline-sm font-bold text-on-surface flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-violet-600" />
                    Historial de Clases y Asistencia
                  </h3>
                  <span className="text-label-sm text-on-surface-variant font-medium">
                    {selectedMetrics.history.length} sesiones auditadas
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
                      {selectedMetrics.history.map((row, idx) => (
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
                            {row.status === 'presente' || row.status === 'presente_manual' ? (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-label-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Presente
                              </span>
                            ) : row.status === 'justificado' ? (
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
                Expediente institucional auditable Período 2026-2 derivado de las {selectedMetrics.totalSessions} sesiones de clase.
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
    </div>
  );
}
