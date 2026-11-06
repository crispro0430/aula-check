'use client';

import { useState, useRef, useEffect, KeyboardEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { QrCode, Hash, ChevronRight, Wifi, Clock, MapPin, User, AlertCircle, FileText, CheckCircle2, BookOpen, Mail, ShieldCheck } from 'lucide-react';
import { useAulaCheckStore } from '@/lib/store';
import JustificationModal from '@/components/JustificationModal';

const PIN_LENGTH = 6;

// ─── Acceso a "Mis Incapacidades / Excusas" ──────────────────────────────────

function IncapacitiesShortcut() {
  return (
    <Link
      href="/student/incapacities"
      className="flex items-center justify-between gap-3 p-4 rounded-2xl border-2 border-primary/30 bg-primary-fixed/30 hover:bg-primary-fixed/50 transition-colors shadow-card"
    >
      <span className="flex items-center gap-3 min-w-0">
        <span className="text-2xl" aria-hidden>📄</span>
        <span className="min-w-0">
          <span className="block font-bold text-primary">Mis Incapacidades / Excusas</span>
          <span className="block text-body-sm text-on-surface-variant">Radica soportes y consulta su estado en tiempo real</span>
        </span>
      </span>
      <ChevronRight className="w-5 h-5 text-primary shrink-0" />
    </Link>
  );
}

// ─── PIN Input Component ──────────────────────────────────────────────────────

function PinInput({
  onComplete,
  initialPin,
}: {
  onComplete: (pin: string) => void;
  initialPin?: string;
}) {
  const [digits, setDigits] = useState<string[]>(() => {
    if (initialPin && initialPin.length === PIN_LENGTH) {
      return initialPin.split('');
    }
    return Array(PIN_LENGTH).fill('');
  });
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (initialPin && initialPin.length === PIN_LENGTH) {
      setDigits(initialPin.split(''));
    }
  }, [initialPin]);

  function handleChange(idx: number, val: string) {
    const clean = val.replace(/\D/g, '').slice(-1);
    const next  = [...digits];
    next[idx]   = clean;
    setDigits(next);

    if (clean && idx < PIN_LENGTH - 1) {
      inputsRef.current[idx + 1]?.focus();
    }

    const full = next.join('');
    if (full.length === PIN_LENGTH && !next.includes('')) {
      onComplete(full);
    }
  }

  function handleKeyDown(idx: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LENGTH);
    const next   = Array(PIN_LENGTH).fill('');
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    if (pasted.length === PIN_LENGTH) {
      onComplete(pasted);
    } else {
      inputsRef.current[Math.min(pasted.length, PIN_LENGTH - 1)]?.focus();
    }
  }

  function clearPin() {
    setDigits(Array(PIN_LENGTH).fill(''));
    setShaking(false);
    inputsRef.current[0]?.focus();
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className={`flex gap-2 ${shaking ? 'animate-shake' : ''}`}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { inputsRef.current[i] = el; }}
            type="tel"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={i === 0 ? handlePaste : undefined}
            className={`pin-segment ${d ? 'filled' : ''}`}
            style={{ width: 48, height: 56 }}
            aria-label={`Dígito ${i + 1} del PIN`}
          />
        ))}
      </div>
      {digits.some(Boolean) && (
        <button onClick={clearPin} className="text-label-sm text-on-surface-variant underline underline-offset-2 hover:text-on-surface transition-colors">
          Limpiar
        </button>
      )}
    </div>
  );
}

// ─── Check-In Inner Content ───────────────────────────────────────────────────

function CheckInContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const session      = useAulaCheckStore((s) => s.session);
  const students     = useAulaCheckStore((s) => s.students);
  const checkIn      = useAulaCheckStore((s) => s.checkInStudent || s.checkIn);

  // ── Leer parámetros del QR ──
  const pinParam     = searchParams.get('pin');
  const codeParam    = searchParams.get('code');
  const nameParam    = searchParams.get('name');
  const roomParam    = searchParams.get('room');
  const sessionParam = searchParams.get('session');

  // Determinar si el estudiante llegó vía QR con parámetros completos
  const isQrFlow = !!(pinParam && codeParam && nameParam && sessionParam === 'active');

  // Si viene por QR, tratar la sesión como activa usando los parámetros de la URL
  const effectiveSession = isQrFlow
    ? {
        isActive: true,
        courseCode: codeParam!,
        course: nameParam!,
        room: roomParam || session.room,
        teacher: session.teacher,
        tolerance: session.tolerance,
        pin: session.pin, // PIN real del store (para validación)
      }
    : session;

  const [tab, setTab] = useState<'qr' | 'pin'>('pin');
  const [processing, setProcessing] = useState(false);
  const [showJustifyModal, setShowJustifyModal] = useState(false);
  const autoCheckedRef = useRef(false);

  // ── Estado del formulario para flujo QR ──
  const [studentCode, setStudentCode] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');

  async function handlePinComplete(pin: string, studentId?: string) {
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 600));
    const result = checkIn(pin, studentId);
    setProcessing(false);
    if (result.success) {
      router.push('/student/success');
    } else {
      router.push('/student/error');
    }
  }

  // Auto check-in si viene parámetro ?pin= en la URL Y la sesión del store está activa
  // (solo funciona si el celular comparte el mismo localStorage — caso mismo navegador)
  useEffect(() => {
    if (pinParam && pinParam.length === PIN_LENGTH && session.isActive && !isQrFlow && !autoCheckedRef.current) {
      autoCheckedRef.current = true;
      handlePinComplete(pinParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinParam, session.isActive]);

  // ── Formulario de confirmación QR ──
  function handleQrConfirm() {
    if (!pinParam) return;
    // Si seleccionó un estudiante del dropdown, usarlo
    const sid = selectedStudentId || studentCode || undefined;
    handlePinComplete(pinParam, sid);
  }

  const canConfirm = isQrFlow && pinParam && (selectedStudentId || studentCode.trim().length >= 5);

  // ════════════════════════════════════════════════════════════════════════════
  // ── FLUJO QR: Vista optimizada para escaneo móvil ──
  // ════════════════════════════════════════════════════════════════════════════
  if (isQrFlow) {
    return (
      <div className="flex flex-col gap-5 py-6 animate-fade-in">
        {/* ── Indicador "Validado vía QR" ── */}
        <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-200">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <span className="text-body-md text-emerald-700 font-semibold">PIN validado vía QR</span>
          <span className="font-mono text-label-lg text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-lg font-bold tracking-widest">
            {pinParam}
          </span>
        </div>

        {/* ── Tarjeta de materia identificada ── */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-card border border-outline-variant/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary-fixed/30 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-label-sm font-semibold bg-secondary-container text-on-secondary-container">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
              Clase activa detectada
            </span>
            <span className="text-label-sm text-primary font-bold px-2 py-0.5 rounded bg-primary-fixed">
              {effectiveSession.courseCode}
            </span>
          </div>
          <h2 className="text-headline-sm text-on-surface font-bold truncate flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary-container shrink-0" />
            {effectiveSession.course}
          </h2>
          {effectiveSession.room && (
            <div className="mt-2 flex items-center gap-2 text-body-sm text-on-surface-variant">
              <MapPin className="w-3.5 h-3.5 text-primary-container shrink-0" />
              {effectiveSession.room}
            </div>
          )}
        </div>

        {/* ── Formulario de datos del estudiante ── */}
        <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-card border border-outline-variant/20">
          <h3 className="text-headline-sm text-on-surface font-bold mb-1">
            Confirma tu identidad
          </h3>
          <p className="text-body-sm text-on-surface-variant mb-5">
            Ingresa tus datos para registrar la asistencia.
          </p>

          {/* ── Selector de estudiante (demo) ── */}
          <div className="space-y-4">
            <div>
              <label htmlFor="student-select" className="flex items-center gap-1.5 text-label-md text-on-surface font-semibold mb-1.5">
                <User className="w-4 h-4 text-primary-container" />
                Estudiante
              </label>
              <select
                id="student-select"
                value={selectedStudentId}
                onChange={(e) => {
                  setSelectedStudentId(e.target.value);
                  const s = students.find((st) => st.id === e.target.value);
                  if (s) {
                    setStudentCode(s.code);
                    setStudentEmail(s.email);
                  }
                }}
                className="w-full h-12 px-4 rounded-xl border border-outline-variant/40 bg-surface-container-low text-on-surface text-body-md focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
              >
                <option value="">— Selecciona tu nombre —</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="student-code" className="flex items-center gap-1.5 text-label-md text-on-surface font-semibold mb-1.5">
                <Hash className="w-4 h-4 text-primary-container" />
                Código Estudiantil
              </label>
              <input
                id="student-code"
                type="text"
                inputMode="numeric"
                placeholder="Ej. 2021815001"
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value.replace(/\D/g, ''))}
                className="w-full h-12 px-4 rounded-xl border border-outline-variant/40 bg-surface-container-low text-on-surface text-body-md font-mono placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
                maxLength={15}
              />
            </div>

            <div>
              <label htmlFor="student-email" className="flex items-center gap-1.5 text-label-md text-on-surface font-semibold mb-1.5">
                <Mail className="w-4 h-4 text-primary-container" />
                Correo Institucional
              </label>
              <input
                id="student-email"
                type="email"
                placeholder="correo@universidad.edu.co"
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-outline-variant/40 bg-surface-container-low text-on-surface text-body-md placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
              />
            </div>
          </div>

          {/* ── Botón Confirmar Asistencia ── */}
          <button
            onClick={handleQrConfirm}
            disabled={!canConfirm || processing}
            className="mt-6 w-full h-14 rounded-2xl bg-primary-container text-white font-bold text-label-lg flex items-center justify-center gap-2.5 hover:bg-primary-container/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-card active:scale-[0.98]"
          >
            {processing ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Verificando asistencia...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Confirmar Asistencia
              </>
            )}
          </button>
        </div>

        {/* ── Justificación Inasistencia (Art. 42) ── */}
        <div className="flex justify-center pt-2">
          <button
            onClick={() => setShowJustifyModal(true)}
            className="inline-flex items-center gap-1.5 text-label-sm text-on-surface-variant hover:text-primary transition-colors underline underline-offset-4"
          >
            <FileText className="w-4 h-4 text-primary" />
            ¿Inconveniente o inasistencia? Radicar justificación (Art. 42)
          </button>
        </div>

        <IncapacitiesShortcut />

        <JustificationModal
          isOpen={showJustifyModal}
          onClose={() => setShowJustifyModal(false)}
        />
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ── FLUJO CLÁSICO: Vista original (PIN manual / QR simulado) ──
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col gap-5 py-6 animate-fade-in">
      {/* ── Context card ── */}
      <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-card border border-outline-variant/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-primary-fixed/30 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
        <div className="flex items-center justify-between mb-3">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-label-sm font-semibold ${
            session.isActive ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container text-on-surface-variant'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${session.isActive ? 'bg-secondary animate-pulse' : 'bg-outline'}`} />
            {session.isActive ? 'Clase activa detectada' : 'Sin sesión activa'}
          </span>
          <span className="text-label-sm text-primary font-bold px-2 py-0.5 rounded bg-primary-fixed">
            {session.courseCode}
          </span>
        </div>
        <h2 className="text-headline-sm text-on-surface font-bold truncate">{session.course}</h2>
        <div className="mt-2 space-y-1">
          <div className="flex items-center gap-2 text-body-sm text-on-surface-variant">
            <MapPin className="w-3.5 h-3.5 text-primary-container shrink-0" />
            {session.room}
          </div>
          <div className="flex items-center gap-2 text-body-sm text-on-surface-variant">
            <Clock className="w-3.5 h-3.5 text-primary-container shrink-0" />
            Tolerancia: {session.tolerance} minutos
          </div>
          <div className="flex items-center gap-2 text-body-sm text-on-surface-variant">
            <User className="w-3.5 h-3.5 text-primary-container shrink-0" />
            {session.teacher}
          </div>
        </div>
      </div>

      {/* ── Notice if no session ── */}
      {!session.isActive && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-body-sm text-amber-800">
            El docente aún no ha iniciado la sesión. Espera a que aparezca el QR o el PIN en el proyector.
          </p>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="bg-surface-container rounded-xl p-1 flex gap-1">
        {([
          { key: 'pin', icon: Hash,   label: 'Ingresar PIN' },
          { key: 'qr',  icon: QrCode, label: 'Escanear QR'  },
        ] as const).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-label-lg font-semibold transition-all ${
              tab === key
                ? 'bg-surface-container-lowest text-primary shadow-card'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── PIN Panel ── */}
      {tab === 'pin' && (
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-card border border-outline-variant/20 animate-scale-in">
          <h3 className="text-headline-sm text-on-surface font-bold text-center mb-2">
            PIN de 6 dígitos
          </h3>
          <p className="text-body-sm text-on-surface-variant text-center mb-6">
            Ingresa el código que aparece en el proyector del aula.
          </p>
          {processing ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-10 h-10 border-3 border-primary-container/30 border-t-primary-container rounded-full animate-spin" />
              <p className="text-body-sm text-on-surface-variant">Verificando asistencia...</p>
            </div>
          ) : (
            <PinInput onComplete={handlePinComplete} initialPin={pinParam || ''} />
          )}

          {/* Demo hint */}
          {session.isActive && (
            <div className="mt-4 p-3 rounded-xl bg-primary-fixed/40 text-center">
              <p className="text-body-sm text-primary">
                <strong>Demo:</strong> PIN activo = <span className="font-mono font-bold">{session.pin}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── QR Panel (simulado) ── */}
      {tab === 'qr' && (
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-card border border-outline-variant/20 animate-scale-in">
          <h3 className="text-headline-sm text-on-surface font-bold text-center mb-2">
            Escanear código QR
          </h3>
          <p className="text-body-sm text-on-surface-variant text-center mb-6">
            Apunta tu cámara al QR proyectado en el tablero.
          </p>
          {/* Viewfinder simulado */}
          <div className="relative mx-auto w-64 h-64 rounded-2xl overflow-hidden bg-slate-900 flex items-center justify-center">
            <div className="absolute inset-3 rounded-xl border-2 border-white/30" />
            {/* Corner markers */}
            {[
              'top-3 left-3 border-t-2 border-l-2',
              'top-3 right-3 border-t-2 border-r-2',
              'bottom-3 left-3 border-b-2 border-l-2',
              'bottom-3 right-3 border-b-2 border-r-2',
            ].map((cls, i) => (
              <div key={i} className={`absolute w-6 h-6 border-white ${cls}`} />
            ))}
            {/* Scan line */}
            <div className="absolute w-full h-0.5 bg-secondary/70 top-1/2 animate-pulse" />
            <QrCode className="w-16 h-16 text-white/20" />
          </div>
          <p className="text-label-sm text-on-surface-variant text-center mt-4">
            Cámara simulada — escaneo directo de sesión activa
          </p>
          <button
            onClick={() => session.isActive && session.pin && handlePinComplete(session.pin)}
            disabled={!session.isActive || !session.pin || processing}
            className="mt-4 w-full h-12 rounded-xl bg-secondary text-white font-semibold text-label-lg flex items-center justify-center gap-2 hover:bg-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-card"
          >
            📷 Simular escaneo de QR activo
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Justificación Inasistencia (Art. 42) ── */}
      <div className="flex justify-center pt-2">
        <button
          onClick={() => setShowJustifyModal(true)}
          className="inline-flex items-center gap-1.5 text-label-sm text-on-surface-variant hover:text-primary transition-colors underline underline-offset-4"
        >
          <FileText className="w-4 h-4 text-primary" />
          ¿Inconveniente o inasistencia? Radicar justificación (Art. 42)
        </button>
      </div>

      <IncapacitiesShortcut />

      {/* ── Modal de Justificación ── */}
      <JustificationModal
        isOpen={showJustifyModal}
        onClose={() => setShowJustifyModal(false)}
      />
    </div>
  );
}

export default function CheckInPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20 text-on-surface-variant">
        Cargando Aula Check...
      </div>
    }>
      <CheckInContent />
    </Suspense>
  );
}
