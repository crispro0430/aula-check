'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { XCircle, RefreshCw, ArrowLeft, AlertTriangle, Clock, Wifi, FileText } from 'lucide-react';
import { useAulaCheckStore } from '@/lib/store';
import { normalizeSpaces } from '@/lib/utils';
import JustificationModal from '@/components/JustificationModal';

const ERROR_CONFIGS = {
  wrong_pin: {
    title: 'PIN Incorrecto',
    description: 'El PIN ingresado no coincide con el de la sesión activa. Verifica el código proyectado en el tablero e intenta nuevamente.',
    icon: XCircle,
    color: 'text-error',
    bg: 'bg-error-container',
    tip: 'Asegúrate de ver el PIN actualizado en el proyector. Se renueva cada 30 segundos.',
  },
  expired: {
    title: 'PIN Expirado',
    description: 'El PIN que ingresaste ya no es válido. Los PINs se renuevan automáticamente para mayor seguridad.',
    icon: Clock,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    tip: 'Espera a que el docente proyecte el nuevo PIN y vuelve a intentarlo.',
  },
  session_inactive: {
    title: 'Sin sesión activa',
    description: 'El docente aún no ha iniciado la sesión de clase o ya fue cerrada.',
    icon: Wifi,
    color: 'text-on-surface-variant',
    bg: 'bg-surface-container',
    tip: 'Espera a que el docente abra la sesión y aparezca el QR o PIN en el proyector.',
  },
  already_registered: {
    title: 'Ya registrado',
    description: 'Tu asistencia ya fue confirmada en esta sesión.',
    icon: AlertTriangle,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    tip: 'Si crees que esto es un error, contacta al docente.',
  },
};

export default function ErrorPage() {
  const router     = useRouter();
  const lastCheckIn = useAulaCheckStore((s) => s.lastCheckIn);
  const [showJustifyModal, setShowJustifyModal] = useState(false);

  const errorType   = (lastCheckIn.errorType as keyof typeof ERROR_CONFIGS) ?? 'wrong_pin';
  const config      = ERROR_CONFIGS[errorType] ?? ERROR_CONFIGS.wrong_pin;
  const Icon        = config.icon;

  // Si no hay error registrado, redirigir
  useEffect(() => {
    if (!lastCheckIn.result || lastCheckIn.result !== 'error') {
      router.replace('/student/check-in');
    }
  }, [lastCheckIn, router]);

  return (
    <div className="flex flex-col items-center py-8 animate-fade-in">

      {/* ── Error Icon ── */}
      <div className={`relative w-24 h-24 rounded-full ${config.bg} flex items-center justify-center mb-5 animate-scale-in`}>
        {/* Pulse ring */}
        <div className={`absolute inset-0 rounded-full ${config.bg} animate-ping opacity-30`} />
        <Icon className={`w-12 h-12 ${config.color} relative z-10`} />
      </div>

      <h1 className="text-2xl text-[#1d1d1f] font-bold text-center mb-2 tracking-tight">
        {config.title}
      </h1>
      <p className="text-xs sm:text-sm text-[#6e6e73] text-center max-w-sm mb-6 leading-relaxed">
        {config.description}
      </p>

      {/* ── Error Code ── */}
      <div className="px-4 py-2 rounded-full bg-black/[0.05] text-[11px] font-mono text-[#6e6e73] mb-7" suppressHydrationWarning>
        Error: {errorType.toUpperCase()} • {normalizeSpaces(new Date().toLocaleTimeString('es-CO'))}
      </div>

      {/* ── Tip card ── */}
      <div className="w-full bg-white/80 backdrop-blur-2xl rounded-[28px] p-5 mb-6 flex items-start gap-3 border border-black/[0.06] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)]">
        <AlertTriangle className="w-5 h-5 text-[#c93400] shrink-0 mt-0.5" />
        <div>
          <div className="text-xs text-[#1d1d1f] font-bold mb-1">¿Qué hacer?</div>
          <p className="text-xs text-[#6e6e73] leading-relaxed">{config.tip}</p>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="w-full flex flex-col gap-3">
        <button
          onClick={() => router.push('/student/check-in')}
          className="w-full h-11 rounded-full bg-[#0071e3] hover:bg-[#0077ed] active:scale-[0.98] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-[0_6px_18px_-4px_rgba(0,113,227,0.45)]"
        >
          <RefreshCw className="w-4 h-4" />
          Intentar nuevamente
        </button>

        <button
          onClick={() => setShowJustifyModal(true)}
          className="w-full h-11 rounded-full bg-[#ff9500]/12 text-[#b64400] border border-[#ff9500]/25 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-[#ff9500]/18 transition-all active:scale-[0.98]"
        >
          <FileText className="w-4 h-4 text-[#c93400]" />
          Radicar Justificación de Inasistencia (Art. 42)
        </button>

        <button
          onClick={() => router.push('/')}
          className="w-full h-11 rounded-full bg-black/[0.05] hover:bg-black/[0.08] active:scale-[0.98] text-[#1d1d1f] font-semibold text-sm flex items-center justify-center gap-2 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio
        </button>
      </div>

      {/* ── Modal de Justificación ── */}
      <JustificationModal
        isOpen={showJustifyModal}
        onClose={() => setShowJustifyModal(false)}
      />

      {/* ── Bottom info ── */}
      <div className="mt-8 text-center">
        <p className="text-xs text-[#6e6e73]">
          Si el problema persiste, contacta a la mesa de ayuda institucional.
        </p>
        <p className="text-xs text-[#0066cc] font-semibold mt-1">
          soporte@universidad.edu.co
        </p>
      </div>
    </div>
  );
}
