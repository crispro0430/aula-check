'use client';

import { useState } from 'react';
import { X, FileText, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { useAulaCheckStore } from '@/lib/store';

interface JustificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId?: string;
}

export default function JustificationModal({ isOpen, onClose, studentId }: JustificationModalProps) {
  const submitJustification = useAulaCheckStore((s) => s.submitJustification);

  const [reason, setReason] = useState<'Médico' | 'Laboral' | 'Fuerza Mayor'>('Médico');
  const [comments, setComments] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    submitJustification(studentId || '', reason, comments);
    setLoading(false);
    setSubmitted(true);
  }

  function handleClose() {
    setSubmitted(false);
    setComments('');
    onClose();
  }

  return (
    <div
      role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-md overflow-y-auto animate-fade-in"
      onClick={handleClose}
    >
      <div
        className="bg-white/90 backdrop-blur-3xl rounded-[28px] w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] border border-black/[0.08] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-black/[0.06] bg-white/60 flex items-center justify-between gap-3 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#0071e3]/10 text-[#0071e3] text-[11px] font-semibold uppercase tracking-wider">
            <FileText className="w-3.5 h-3.5" />
            Art. 42 Reglamento Estudiantil
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="touch-target w-8 h-8 rounded-full flex items-center justify-center bg-black/[0.05] text-[#6e6e73] hover:text-[#1d1d1f] transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-[#34c759]/15 text-[#248a3d] flex items-center justify-center mb-4 animate-success-pop">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-lg text-[#1d1d1f] font-bold tracking-tight mb-2">
              Justificación Radicada
            </h3>
            <p className="text-sm text-[#6e6e73] mb-4 leading-relaxed">
              Tu solicitud por motivo <strong className="text-[#1d1d1f]">{reason}</strong> fue registrada en el sistema bajo el Artículo 42.
            </p>
            <div className="w-full p-3.5 rounded-2xl bg-black/[0.03] text-xs text-[#6e6e73] mb-6 text-left border border-black/[0.06]">
              <div className="flex items-center gap-1.5 font-semibold text-[#0071e3] mb-1">
                <ShieldCheck className="w-4 h-4 text-[#248a3d]" />
                Protección Institucional
              </div>
              Una vez el docente apruebe la justificación en su consola, tu estado se actualizará a <strong className="text-[#1d1d1f]">Justificado</strong> y no sumará faltas a tu semáforo de permanencia.
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-full h-11 rounded-full bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#006edb] active:scale-[0.98] text-white font-semibold text-sm transition-all"
            >
              Entendido
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <h2 className="text-lg text-[#1d1d1f] font-bold tracking-tight">
                  Radicar Justificación
                </h2>
                <p className="text-xs text-[#6e6e73] mt-0.5">
                  Registra tu causa de inasistencia para evaluación docente.
                </p>
              </div>

              {/* Motivo */}
              <div>
                <label className="text-xs text-[#1d1d1f] font-semibold block mb-2">
                  Motivo de la inasistencia <span className="text-[#d70015]">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Médico', 'Laboral', 'Fuerza Mayor'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setReason(opt)}
                      className={`py-2 px-2 text-xs font-semibold rounded-xl border transition-all active:scale-[0.98] text-center ${
                        reason === opt
                          ? 'bg-[#0071e3] text-white border-[#0071e3] shadow-xs'
                          : 'bg-black/[0.03] text-[#6e6e73] border-black/[0.08] hover:text-[#1d1d1f]'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="text-xs text-[#1d1d1f] font-semibold block mb-1.5">
                  Detalle u observaciones <span className="text-[#d70015]">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Indica brevemente la razón o soporte médico/laboral..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-black/[0.03] focus:bg-white text-[#1d1d1f] text-sm placeholder:text-[#6e6e73] focus:outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/30 transition-all resize-none"
                />
              </div>

              {/* Hint Art 42 */}
              <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#ff9500]/10 border border-[#ff9500]/25 text-[#1d1d1f]">
                <AlertCircle className="w-4 h-4 text-[#c93400] shrink-0 mt-0.5" />
                <p className="text-xs text-[#6e6e73] leading-snug">
                  El docente recibirá la notificación en su consola para aprobar la justificación y proteger tu cupo académico.
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="px-6 py-4 border-t border-black/[0.06] bg-white/60 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={handleClose}
                className="h-10 px-4 rounded-full bg-black/[0.05] hover:bg-black/[0.08] text-[#1d1d1f] font-semibold text-xs transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !comments.trim()}
                className="h-10 px-5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#006edb] active:scale-[0.98] text-white font-semibold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? 'Enviando...' : 'Confirmar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
