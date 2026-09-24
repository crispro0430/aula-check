import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { SemaforoLevel, AttendanceStatus } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Calcula el nivel del Semáforo de Permanencia basado en asistencia acumulada */
export function getSemaforoLevel(attendanceRate: number): SemaforoLevel {
  if (attendanceRate >= 75) return 'verde';
  if (attendanceRate >= 60) return 'ambar';
  return 'rojo';
}

/** Retorna texto descriptivo del semáforo */
export function getSemaforoLabel(level: SemaforoLevel): string {
  switch (level) {
    case 'verde': return 'En permanencia estable';
    case 'ambar': return 'En riesgo de reprobación';
    case 'rojo': return 'Peligro de pérdida de cupo';
  }
}

/** Formatea una hora a HH:MM */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

/** Formatea una fecha a DD/MM/YYYY */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Retorna clases de color para el estado de asistencia */
export function getStatusClasses(status: AttendanceStatus): { bg: string; text: string; dot: string } {
  switch (status) {
    case 'presente':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' };
    case 'presente_manual':
      return { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' };
    case 'justificado':
      return { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-600' };
    case 'tardanza':
      return { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' };
    case 'ausente':
      return { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' };
    case 'pendiente':
    default:
      return { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400' };
  }
}

/** Retorna etiqueta en español del estado */
export function getStatusLabel(status: AttendanceStatus): string {
  switch (status) {
    case 'presente': return 'Presente';
    case 'presente_manual': return 'Presente (Manual)';
    case 'justificado': return 'Justificado';
    case 'tardanza': return 'Tardanza';
    case 'ausente': return 'Ausente';
    case 'pendiente': return 'Pendiente';
  }
}
