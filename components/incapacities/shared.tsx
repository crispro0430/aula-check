'use client';

import { X, FileText, Download, ImageOff } from 'lucide-react';
import type { Incapacity, IncapacityStatus, IncapacityType } from '@/lib/types';

export const INCAPACITY_TYPES: readonly IncapacityType[] = ['Médica', 'Laboral', 'Fuerza Mayor'] as const;

const STATUS_STYLES: Record<IncapacityStatus, { cls: string; dot: string }> = {
  Pendiente: { cls: 'bg-[#ff9500]/12 text-[#1d1d1f] border-[#ff9500]/25', dot: 'bg-[#ff9500]' },
  Aprobada:  { cls: 'bg-[#34c759]/12 text-[#1d1d1f] border-[#34c759]/25', dot: 'bg-[#34c759]' },
  Rechazada: { cls: 'bg-[#ff3b30]/12 text-[#1d1d1f] border-[#ff3b30]/25', dot: 'bg-[#ff3b30]' },
};

export function IncapacityStatusBadge({ status }: { status: IncapacityStatus }) {
  const { cls, dot } = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
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

/**
 * Solo se renderizan soportes Base64 de tipo PDF o imagen rasterizada (SEC-05):
 * bloquea `data:text/html`, `javascript:` o SVG con scripts en el iframe/enlace.
 */
const SAFE_SUPPORT_DATA_URL = /^data:(application\/pdf|image\/(png|jpeg|jpg|webp));base64,/i;
/** Los soportes demo locales son SVG; dentro de <img> un SVG nunca ejecuta scripts. */
const DEMO_SVG_DATA_URL = /^data:image\/svg\+xml[;,]/i;

function isSafeSupportDataUrl(value: string | undefined): value is string {
  return Boolean(value && (SAFE_SUPPORT_DATA_URL.test(value) || DEMO_SVG_DATA_URL.test(value)));
}

function isPdf(inc: Incapacity): boolean {
  return inc.fileDataUrl.toLowerCase().startsWith('data:application/pdf');
}

/** Modal que previsualiza el soporte adjunto (imagen o PDF) de una incapacidad. */
export function SupportPreviewModal({ incapacity, onClose }: { incapacity: Incapacity | null; onClose: () => void }) {
  if (!incapacity) return null;
  const hasData = isSafeSupportDataUrl(incapacity.fileDataUrl);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/35 backdrop-blur-md overflow-y-auto animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={`Soporte adjunto: ${incapacity.fileName}`}
      onClick={onClose}
    >
      <div
        className="bg-white/90 backdrop-blur-3xl border border-black/[0.08] rounded-[28px] w-full max-w-3xl max-h-[90vh] flex flex-col shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-black/[0.06] bg-white/60 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-[#1d1d1f] truncate">{incapacity.fileName || 'Sin archivo'}</p>
              <p className="text-xs text-[#86868b] truncate">
                {incapacity.studentName} • {incapacity.courseCode} • Falta del {formatDate(incapacity.date)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasData && (
              <a
                href={incapacity.fileDataUrl}
                download={incapacity.fileName}
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#0071e3] bg-[#0071e3]/10 hover:bg-[#0071e3]/15 transition-all active:scale-[0.98]"
              >
                <Download className="w-3.5 h-3.5" /> Descargar
              </a>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-black/[0.05] text-[#86868b] hover:text-[#1d1d1f] transition-colors" aria-label="Cerrar">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-[#f5f5f7] p-5 flex items-center justify-center min-h-[300px]">
          {!hasData ? (
            <div className="flex flex-col items-center gap-2 text-[#86868b] text-center p-8">
              <ImageOff className="w-10 h-10 text-[#86868b]/50" />
              <p className="font-semibold text-sm text-[#1d1d1f]">Vista previa no disponible</p>
              <p className="text-xs text-[#86868b]">El archivo superaba el límite de almacenamiento local; solo se registró su nombre.</p>
            </div>
          ) : isPdf(incapacity) ? (
            <iframe
              src={incapacity.fileDataUrl}
              title={incapacity.fileName}
              referrerPolicy="no-referrer"
              className="w-full h-[68vh] rounded-2xl border border-black/[0.06] bg-white" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={incapacity.fileDataUrl} alt={`Soporte ${incapacity.fileName}`} className="max-w-full max-h-[68vh] rounded-2xl shadow-lg border border-black/[0.06] bg-white" />
          )}
        </div>
      </div>
    </div>
  );
}

