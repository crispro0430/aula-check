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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-container-lowest rounded-2xl w-full max-w-md p-6 shadow-modal border border-outline-variant/30 relative">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 animate-success-pop">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-headline-sm text-on-surface font-bold mb-2">
              Justificación Radicada
            </h3>
            <p className="text-body-md text-on-surface-variant mb-4">
              Tu solicitud por motivo <strong>{reason}</strong> fue registrada en el sistema bajo el Artículo 42.
            </p>
            <div className="w-full p-3 rounded-xl bg-surface-container-low text-label-sm text-on-surface-variant mb-6 text-left border border-outline-variant/20">
              <div className="flex items-center gap-1.5 font-semibold text-primary mb-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Protección Institucional
              </div>
              Una vez el docente apruebe la justificación en su consola, tu estado se actualizará a <strong>Justificado</strong> y no sumará faltas a tu semáforo de permanencia.
            </div>
            <button
              onClick={handleClose}
              className="w-full h-12 rounded-xl bg-primary-container text-white font-semibold text-label-lg hover:bg-primary transition-colors"
            >
              Entendido
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-fixed text-primary text-label-sm font-bold uppercase tracking-wider mb-2">
                <FileText className="w-3.5 h-3.5" />
                Art. 42 Reglamento Estudiantil
              </div>
              <h2 className="text-headline-sm text-on-surface font-bold">
                Radicar Justificación
              </h2>
              <p className="text-body-sm text-on-surface-variant">
                Registra tu causa de inasistencia para evaluación docente.
              </p>
            </div>

            {/* Motivo */}
            <div>
              <label className="text-label-md text-on-surface font-semibold block mb-2">
                Motivo de la inasistencia <span className="text-error">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['Médico', 'Laboral', 'Fuerza Mayor'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setReason(opt)}
                    className={`py-2 px-2 text-label-sm font-semibold rounded-xl border transition-all text-center ${
                      reason === opt
                        ? 'bg-primary-container text-white border-primary shadow-sm'
                        : 'bg-surface-container-low text-on-surface-variant border-outline-variant/40 hover:bg-surface-container'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Observaciones */}
            <div>
              <label className="text-label-md text-on-surface font-semibold block mb-1.5">
                Detalle u observaciones <span className="text-error">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Indica brevemente la razón o soporte médico/laboral..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-body-md placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
              />
            </div>

            {/* Hint Art 42 */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200/60 text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-label-sm leading-snug">
                El docente recibirá la notificación en su consola para aprobar la justificación y proteger tu cupo académico.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 h-11 rounded-xl bg-surface-container text-on-surface font-semibold text-label-md hover:bg-surface-container-high transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !comments.trim()}
                className="flex-1 h-11 rounded-xl bg-primary-container text-white font-semibold text-label-md hover:bg-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-card"
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
