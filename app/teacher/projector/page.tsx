'use client';

import React, { useEffect, useState, memo } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { RefreshCw, Radio, Users, Clock, ChevronRight, Wifi } from 'lucide-react';
import { useAulaCheckStore } from '@/lib/store';
import { formatTime } from '@/lib/utils';

// ─── Componente QR Memorizado (Cero parpadeo / Cero re-renders en cada segundo) ──
const StaticQRCode = memo(function StaticQRCode({ pin, course, baseUrl }: { pin: string; course: string; baseUrl: string }) {
  return (
    <QRCodeSVG
      level="M"
      size={240}
      value={`${baseUrl}/student/check-in?pin=${pin}&course=${encodeURIComponent(course)}`}
      bgColor="#ffffff"
      fgColor="#00236f"
      marginSize={2}
    />
  );
});

function PinDigit({ digit }: { digit: string }) {
  return (
    <div className="w-16 h-20 flex items-center justify-center rounded-2xl bg-white/10 border-2 border-white/20 backdrop-blur-sm">
      <span className="text-5xl font-bold text-white tracking-wider font-mono">{digit}</span>
    </div>
  );
}

function CountdownRing({ seconds, total }: { seconds: number; total: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const progress = (seconds / total) * circumference;
  const color = seconds > total * 0.5 ? '#4edea3' : seconds > total * 0.25 ? '#ffb95f' : '#ef4444';

  return (
    <svg width="88" height="88" viewBox="0 0 88 88">
      <circle cx="44" cy="44" r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
      <circle
        cx="44"
        cy="44"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeDasharray={circumference}
        strokeDashoffset={circumference - progress}
        strokeLinecap="round"
        transform="rotate(-90 44 44)"
        style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease' }}
      />
      <text x="44" y="50" textAnchor="middle" fill="white" fontSize="18" fontWeight="700" fontFamily="monospace">
        {seconds}s
      </text>
    </svg>
  );
}

export default function ProjectorPage() {
  const router = useRouter();
  const session       = useAulaCheckStore((s) => s.session);
  const regeneratePin = useAulaCheckStore((s) => s.regeneratePin);

  const PIN_REFRESH_INTERVAL = 30;
  const [countdown, setCountdown] = useState(() => {
    if (!session.pinExpiresAt) return PIN_REFRESH_INTERVAL;
    return Math.max(0, Math.ceil((session.pinExpiresAt - Date.now()) / 1000));
  });
  const [currentTime, setCurrentTime] = useState('');
  const [baseUrl, setBaseUrl] = useState('');

  // Obtener el origen dinámico (funciona en Vercel, localhost, etc.)
  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  // Reloj en vivo — sin dependencias, se registra una sola vez
  useEffect(() => {
    const tick = () => setCurrentTime(formatTime(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Temporizador basado en timestamp real (mantiene tiempo al cambiar pestaña) ──
  useEffect(() => {
    if (!session.isActive) return;

    // Si la sesión no tiene pinExpiresAt o ya expiró al montar:
    if (!session.pinExpiresAt || session.pinExpiresAt <= Date.now()) {
      regeneratePin();
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil(((session.pinExpiresAt || Date.now()) - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) {
        regeneratePin();
      }
    }, 500);

    return () => clearInterval(interval);
  }, [session.pinExpiresAt, session.isActive, regeneratePin]);

  // Botón manual de renovación
  function refreshPin() {
    regeneratePin();
  }

  if (!session.isActive) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface gap-4 px-4">
        <p className="text-headline-sm text-on-surface-variant">No hay sesión activa.</p>
        <button
          onClick={() => router.push('/teacher/setup')}
          className="px-6 py-3 rounded-xl bg-primary-container text-white font-semibold"
        >
          Ir a Apertura
        </button>
      </div>
    );
  }

  const pinDigits = session.pin.split('');

  return (
    <div className="min-h-screen projector-bg flex flex-col">
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between px-8 py-4 bg-black/20 backdrop-blur-sm">
        <div>
          <div className="text-white/60 text-label-sm uppercase tracking-widest">UT-02 — Proyección en Aula</div>
          <div className="text-white text-headline-sm font-bold">{session.course}</div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-white/60 text-label-sm">Hora actual</div>
            <div className="text-white font-mono text-headline-md font-bold">{currentTime}</div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10">
            <Radio className="w-4 h-4 text-secondary-fixed-dim animate-pulse" />
            <span className="text-white text-label-md font-semibold">{session.room}</span>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">

          {/* ── QR Code ── */}
          <div className="flex flex-col items-center">
            <div className="text-white/80 text-label-lg uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-secondary-fixed-dim animate-pulse" />
              Escanea con tu cámara
            </div>
            <div className="p-5 bg-white rounded-3xl shadow-modal qr-glow">
              <StaticQRCode pin={session.pin} course={session.course} baseUrl={baseUrl} />
            </div>
            <p className="text-white/60 text-body-sm mt-3 text-center max-w-xs">
              Abre la app Aula Check o escanea con la cámara de tu teléfono
            </p>
          </div>

          {/* ── PIN Display ── */}
          <div className="flex flex-col items-center gap-6">
            <div>
              <div className="text-white/80 text-label-lg uppercase tracking-widest mb-2 text-center">
                ── O ingresa el PIN manualmente ──
              </div>
            </div>

            {/* PIN Digits */}
            <div className="flex gap-3">
              {pinDigits.map((digit, i) => (
                <PinDigit key={i} digit={digit} />
              ))}
            </div>

            {/* Countdown + Refresh */}
            <div className="flex flex-col items-center gap-3">
              <CountdownRing seconds={countdown} total={PIN_REFRESH_INTERVAL} />
              <button
                onClick={refreshPin}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-label-lg font-semibold transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Renovar PIN ahora
              </button>
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <Users className="w-5 h-5 text-secondary-fixed-dim mx-auto mb-1" />
                <div className="text-white font-bold text-headline-sm">12</div>
                <div className="text-white/60 text-label-sm">Estudiantes</div>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <Clock className="w-5 h-5 text-tertiary-fixed-dim mx-auto mb-1" />
                <div className="text-white font-bold text-headline-sm">{session.tolerance}m</div>
                <div className="text-white/60 text-label-sm">Tolerancia</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom CTA ── */}
      <div className="flex justify-center pb-6 px-4">
        <button
          onClick={() => router.push('/teacher/live')}
          className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-secondary-fixed-dim text-on-surface font-bold text-label-lg shadow-modal hover:bg-secondary-fixed transition-colors"
        >
          <Radio className="w-5 h-5" />
          Ir a Consola en Vivo
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
