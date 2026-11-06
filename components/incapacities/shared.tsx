'use client';

import { X, FileText, Download, ImageOff } from 'lucide-react';
import type { Incapacity, IncapacityStatus, IncapacityType } from '@/lib/types';

export const INCAPACITY_TYPES: readonly IncapacityType[] = ['Médica', 'Laboral', 'Fuerza Mayor'] as const;

const STATUS_STYLES: Record<IncapacityStatus, { cls: string; icon: string }> = {
  Pendiente: { cls: 'bg-amber-100 text-amber-800 border-amber-300', icon: '⏳' },
  Aprobada:  { cls: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: '✅' },
  Rechazada: { cls: 'bg-red-100 text-red-800 border-red-300', icon: '❌' },
};

export function IncapacityStatusBadge({ status }: { status: IncapacityStatus }) {
  const { cls, icon } = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-bold whitespace-nowrap ${cls}`}>
      <span aria-hidden>{icon}</span>
      {status}
    </span>
  );
}

export const TYPE_ICON: Record<IncapacityType, string> = {
  'Médica': '🩺',
  'Laboral': '💼',
  'Fuerza Mayor': '⚠️',
};

export function formatDate(iso: string): string {
  // Fechas "YYYY-MM-DD" se interpretan en hora local para evitar desfases de zona horaria.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + 'T12:00:00') : new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isPdf(inc: Incapacity): boolean {
  return inc.fileDataUrl.startsWith('data:application/pdf') || inc.fileName.toLowerCase().endsWith('.pdf');
}

/** Modal que previsualiza el soporte adjunto (imagen o PDF) de una incapacidad. */
export function SupportPreviewModal({ incapacity, onClose }: { incapacity: Incapacity | null; onClose: () => void }) {
  if (!incapacity) return null;
  const hasData = incapacity.fileDataUrl.length > 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={`Soporte adjunto: ${incapacity.fileName}`}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-5 h-5 text-blue-700 shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-slate-900 truncate">{incapacity.fileName || 'Sin archivo'}</p>
              <p className="text-xs text-slate-500 truncate">
                {incapacity.studentName} • {incapacity.courseCode} • Falta del {formatDate(incapacity.date)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {hasData && (
              <a
                href={incapacity.fileDataUrl}
                download={incapacity.fileName}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold text-blue-700 hover:bg-blue-50"
              >
                <Download className="w-4 h-4" /> Descargar
              </a>
            )}
            <button onClick={onClose} className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-slate-100" aria-label="Cerrar">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-slate-100 p-4 flex items-center justify-center min-h-[300px]">
          {!hasData ? (
            <div className="flex flex-col items-center gap-2 text-slate-500 text-center p-8">
              <ImageOff className="w-10 h-10" />
              <p className="font-semibold">Vista previa no disponible</p>
              <p className="text-sm">El archivo superaba el límite de almacenamiento local; solo se registró su nombre.</p>
            </div>
          ) : isPdf(incapacity) ? (
            <iframe src={incapacity.fileDataUrl} title={incapacity.fileName} className="w-full h-[70vh] rounded-lg bg-white" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={incapacity.fileDataUrl} alt={`Soporte ${incapacity.fileName}`} className="max-w-full max-h-[70vh] rounded-lg shadow-lg bg-white" />
          )}
        </div>
      </div>
    </div>
  );
}

