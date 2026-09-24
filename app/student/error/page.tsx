'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { XCircle, RefreshCw, ArrowLeft, AlertTriangle, Clock, Wifi, FileText } from 'lucide-react';
import { useAulaCheckStore } from '@/lib/store';
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

      <h1 className="text-headline-lg-mobile text-on-surface font-bold text-center mb-2 tracking-tight">
        {config.title}
      </h1>
      <p className="text-body-md text-on-surface-variant text-center max-w-sm mb-6 leading-relaxed">
        {config.description}
      </p>

      {/* ── Error Code ── */}
      <div className="px-4 py-2 rounded-xl bg-surface-container text-label-sm font-mono text-on-surface-variant mb-8">
        Error: {errorType.toUpperCase()} • {new Date().toLocaleTimeString('es-CO')}
      </div>

      {/* ── Tip card ── */}
      <div className="w-full bg-surface-container-low rounded-2xl p-4 mb-6 flex items-start gap-3 border border-outline-variant/30">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <div className="text-label-lg text-on-surface font-semibold mb-1">¿Qué hacer?</div>
          <p className="text-body-sm text-on-surface-variant">{config.tip}</p>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="w-full flex flex-col gap-3">
        <button
          onClick={() => router.push('/student/check-in')}
          className="w-full h-12 rounded-xl bg-primary-container text-white font-bold text-label-lg flex items-center justify-center gap-2 hover:bg-primary transition-colors active:scale-[0.98] shadow-card"
        >
          <RefreshCw className="w-4 h-4" />
          Intentar nuevamente
        </button>

        <button
          onClick={() => setShowJustifyModal(true)}
          className="w-full h-12 rounded-xl bg-amber-50 text-amber-900 border border-amber-300 font-semibold text-label-lg flex items-center justify-center gap-2 hover:bg-amber-100 transition-colors active:scale-[0.98]"
        >
          <FileText className="w-4 h-4 text-amber-700" />
          Radicar Justificación de Inasistencia (Art. 42)
        </button>

        <button
          onClick={() => router.push('/')}
          className="w-full h-12 rounded-xl bg-surface-container text-on-surface font-semibold text-label-lg flex items-center justify-center gap-2 hover:bg-surface-container-high transition-colors"
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
        <p className="text-body-sm text-on-surface-variant">
          Si el problema persiste, contacta a la mesa de ayuda institucional.
        </p>
        <p className="text-label-sm text-primary font-semibold mt-1">
          soporte@universidad.edu.co
        </p>
      </div>
    </div>
  );
}
