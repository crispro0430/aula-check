'use client';

import { useState, useRef, useEffect, KeyboardEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { QrCode, Hash, ChevronRight, Clock, MapPin, User, AlertCircle, FileText, CheckCircle2, BookOpen, Mail, ShieldCheck } from 'lucide-react';
import { useAulaCheckStore } from '@/lib/store';
import JustificationModal from '@/components/JustificationModal';

const PIN_LENGTH = 6;

// ─── Acceso a "Mis Incapacidades / Excusas" ──────────────────────────────────

function IncapacitiesShortcut() {
  return (
    <Link
      href="/student/incapacities"
      className="flex items-center justify-between gap-3 p-4 rounded-[28px] border border-[#0071e3]/20 bg-[#0071e3]/[0.06] hover:bg-[#0071e3]/[0.1] transition-all active:scale-[0.98]"
    >
      <span className="flex items-center gap-3 min-w-0">
        <span className="w-10 h-10 rounded-2xl bg-[#0071e3]/12 text-[#0071e3] flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5" />
        </span>
        <span className="min-w-0">
          <span className="block font-bold text-sm text-[#1d1d1f]">Mis Incapacidades / Excusas</span>
          <span className="block text-xs text-[#86868b]">Radica soportes y consulta su estado en tiempo real</span>
        </span>
      </span>
      <ChevronRight className="w-5 h-5 text-[#0071e3] shrink-0" />
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

  // Sincroniza el PIN recibido por QR durante el render (patrón recomendado por React)
  const [syncedInitialPin, setSyncedInitialPin] = useState(initialPin);
  if (initialPin !== syncedInitialPin) {
    setSyncedInitialPin(initialPin);
    if (initialPin && initialPin.length === PIN_LENGTH) {
      setDigits(initialPin.split(''));
    }
  }

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
      <div className={`flex gap-1.5 sm:gap-2 ${shaking ? 'animate-shake' : ''}`}>
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
            aria-label={`Dígito ${i + 1} del PIN`}
          />
        ))}
      </div>
      {digits.some(Boolean) && (
        <button onClick={clearPin} className="text-xs font-medium text-[#86868b] underline underline-offset-2 hover:text-[#1d1d1f] transition-colors">
          Limpiar
        </button>
      )}
    </div>
  );
}

// ─── Check-In Inner Content ───────────────────────────────────────────────────

function CheckInContent() {
  const router             = useRouter();
  const searchParams       = useSearchParams();
  const session            = useAulaCheckStore((s) => s.session);
  const students           = useAulaCheckStore((s) => s.students);
  const currentUser        = useAulaCheckStore((s) => s.currentUser);
  const checkIn            = useAulaCheckStore((s) => s.checkInStudent || s.checkIn);
  const applyRemoteCheckIn = useAulaCheckStore((s) => s.applyRemoteCheckIn);
  const setCheckInError    = useAulaCheckStore((s) => s.setCheckInError);

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

  // Estado opcional de sesión activa detectada en Supabase (para dispositivos móviles)
  const [remoteActiveSession, setRemoteActiveSession] = useState<{
    id: string;
    pin: string;
    courseCode: string;
    courseName: string;
    room: string;
    tolerance: number;
    teacherName: string;
  } | null>(null);

  // Consultar al montar si existe una sesión activa en Supabase para mostrar contexto en el celular
  useEffect(() => {
    let cancelled = false;
    async function fetchActiveSessionContext() {
      try {
        const query = pinParam ? `?pin=${encodeURIComponent(pinParam)}` : '';
        const res = await fetch(`/api/attendance/session${query}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          valid?: boolean;
          session?: { id: string; pin: string; room: string; toleranceMinutes: number };
          course?: { code: string; name: string };
          teacher?: { name: string };
        };
        if (!cancelled && data.valid && data.session && data.course) {
          setRemoteActiveSession({
            id: data.session.id,
            pin: data.session.pin,
            courseCode: data.course.code,
            courseName: data.course.name,
            room: data.session.room,
            tolerance: data.session.toleranceMinutes,
            teacherName: data.teacher?.name || 'Prof. Dr. Alejandro Morales',
          });
        }
      } catch {
        // Fallback silencioso a store local
      }
    }
    void fetchActiveSessionContext();
    return () => {
      cancelled = true;
    };
  }, [pinParam]);

  async function handlePinComplete(
    pin: string,
    studentId?: string,
    checkInMethod: 'PIN' | 'QR' = isQrFlow ? 'QR' : 'PIN',
  ) {
    setProcessing(true);

    // Identificar estudiante objetivo para enviar al backend
    const matchedStudent =
      (studentId
        ? students.find((s) => s.id === studentId || s.code === studentId)
        : undefined) ??
      (studentCode
        ? students.find((s) => s.code === studentCode || s.id === studentCode)
        : undefined) ??
      (currentUser
        ? students.find(
            (s) =>
              (currentUser.email && s.email.toLowerCase() === currentUser.email.toLowerCase()) ||
              (currentUser.name && s.name.toLowerCase() === currentUser.name.toLowerCase()),
          )
        : undefined) ??
      students[0];

    const resolvedStudentId = studentId || studentCode || matchedStudent?.id || '2021815001';
    const resolvedStudentCode = studentCode || matchedStudent?.code || resolvedStudentId;
    const resolvedStudentName = matchedStudent?.name || currentUser?.name || 'Juan David Pérez';
    const resolvedStudentEmail =
      studentEmail || matchedStudent?.email || currentUser?.email || 'juan.perez@universidad.edu.co';

    try {
      // 1. Validar PIN contra PostgreSQL/Supabase via GET /api/attendance/session?pin=...
      const validateRes = await fetch(`/api/attendance/session?pin=${encodeURIComponent(pin.trim())}`);

      if (validateRes.ok) {
        const sessionPayload = (await validateRes.json()) as {
          valid: boolean;
          session: {
            id: string;
            pin: string;
            room: string;
            toleranceMinutes: number;
            startedAt: string;
          };
          course: { id: string; code: string; name: string; room: string };
          teacher?: { id: string; name: string };
        };

        const startedAtMs = sessionPayload.session.startedAt
          ? new Date(sessionPayload.session.startedAt).getTime()
          : Date.now();
        const minutesLate = Math.floor((Date.now() - startedAtMs) / 60000);
        const attendanceStatus =
          minutesLate <= (sessionPayload.session.toleranceMinutes ?? 15) ? 'presente' : 'tardanza';

        // 2. Registrar asistencia en Supabase via POST /api/attendance/record
        try {
          await fetch('/api/attendance/record', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: sessionPayload.session.id,
              studentId: resolvedStudentId,
              studentCode: resolvedStudentCode,
              studentName: resolvedStudentName,
              studentEmail: resolvedStudentEmail,
              studentProgram: matchedStudent?.program || 'Ing. de Sistemas',
              checkInMethod,
              status: attendanceStatus.toUpperCase(),
            }),
          });
        } catch {
          // Si falla la escritura secundaria, igual confirmamos en la UI con la sesión validada
        }

        // 3. Actualizar store local con la materia correspondiente y redirigir a confirmación
        applyRemoteCheckIn({
          pin: pin.trim(),
          sessionId: sessionPayload.session.id,
          courseCode: sessionPayload.course.code,
          courseName: sessionPayload.course.name,
          room: sessionPayload.session.room || sessionPayload.course.room,
          teacher: sessionPayload.teacher?.name,
          tolerance: sessionPayload.session.toleranceMinutes,
          studentId: resolvedStudentId,
          studentCode: resolvedStudentCode,
          studentName: resolvedStudentName,
          studentEmail: resolvedStudentEmail,
          status: attendanceStatus,
        });

        setProcessing(false);
        router.push('/student/success');
        return;
      }

      // Si el servidor respondió 404 pero la sesión está activa en el store local (mismo navegador)
      if (session.isActive && session.pin === pin.trim()) {
        const localResult = checkIn(pin.trim(), studentId);
        setProcessing(false);
        router.push(localResult.success ? '/student/success' : '/student/error');
        return;
      }

      const errorPayload = (await validateRes.json().catch(() => ({}))) as {
        errorType?: 'wrong_pin' | 'expired' | 'already_registered' | 'session_inactive';
      };
      setCheckInError(errorPayload.errorType || 'wrong_pin');
      setProcessing(false);
      router.push('/student/error');
    } catch {
      // 4. Respaldo (Fallback): Si falla la red o está offline, usar el store local (Zustand)
      const fallbackResult = checkIn(pin.trim(), studentId);
      setProcessing(false);
      if (fallbackResult.success) {
        router.push('/student/success');
      } else {
        router.push('/student/error');
      }
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
    void handlePinComplete(pinParam, sid, 'QR');
  }

  const canConfirm = isQrFlow && pinParam && (selectedStudentId || studentCode.trim().length >= 5);

  // ════════════════════════════════════════════════════════════════════════════
  // ── FLUJO QR: Vista optimizada para escaneo móvil ──
  // ════════════════════════════════════════════════════════════════════════════
  if (isQrFlow) {
    return (
      <div className="flex flex-col gap-5 py-6 animate-fade-in">
        {/* ── Indicador "Validado vía QR" ── */}
        <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[#34c759]/12 border border-[#34c759]/25">
          <ShieldCheck className="w-5 h-5 text-[#248a3d]" />
          <span className="text-sm text-[#1d1d1f] font-semibold">PIN validado vía QR</span>
          <span className="font-mono text-sm text-[#248a3d] bg-white px-2.5 py-0.5 rounded-lg font-bold tracking-widest border border-[#34c759]/20">
            {pinParam}
          </span>
        </div>

        {/* ── Tarjeta de materia identificada ── */}
        <div className="bg-white/80 backdrop-blur-2xl rounded-[28px] p-5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] border border-black/[0.06] relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#34c759]/12 text-[#248a3d]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34c759] animate-pulse" />
              Clase activa detectada
            </span>
            <span className="font-mono text-[11px] text-[#0071e3] font-bold px-2.5 py-0.5 rounded-full bg-[#0071e3]/10">
              {effectiveSession.courseCode}
            </span>
          </div>
          <h2 className="text-base text-[#1d1d1f] font-bold tracking-tight truncate flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#0071e3] shrink-0" />
            {effectiveSession.course}
          </h2>
          {effectiveSession.room && (
            <div className="mt-2 flex items-center gap-2 text-xs text-[#86868b]">
              <MapPin className="w-3.5 h-3.5 text-[#0071e3] shrink-0" />
              {effectiveSession.room}
            </div>
          )}
        </div>

        {/* ── Formulario de datos del estudiante ── */}
        <div className="bg-white/80 backdrop-blur-2xl rounded-[28px] p-6 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] border border-black/[0.06]">
          <h3 className="text-base text-[#1d1d1f] font-bold tracking-tight mb-1">
            Confirma tu identidad
          </h3>
          <p className="text-xs text-[#86868b] mb-5">
            Ingresa tus datos para registrar la asistencia.
          </p>

          {/* ── Selector de estudiante (demo) ── */}
          <div className="space-y-4">
            <div>
              <label htmlFor="student-select" className="flex items-center gap-1.5 text-xs text-[#1d1d1f] font-semibold mb-1.5">
                <User className="w-3.5 h-3.5 text-[#0071e3]" />
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
                className="w-full h-11 px-3.5 rounded-xl border border-black/[0.08] bg-black/[0.03] focus:bg-white text-[#1d1d1f] text-sm focus:outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/30 transition-all"
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
              <label htmlFor="student-code" className="flex items-center gap-1.5 text-xs text-[#1d1d1f] font-semibold mb-1.5">
                <Hash className="w-3.5 h-3.5 text-[#0071e3]" />
                Código Estudiantil
              </label>
              <input
                id="student-code"
                type="text"
                inputMode="numeric"
                placeholder="Ej. 2021815001"
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value.replace(/\D/g, ''))}
                className="w-full h-11 px-3.5 rounded-xl border border-black/[0.08] bg-black/[0.03] focus:bg-white text-[#1d1d1f] text-sm font-mono placeholder:text-[#86868b] focus:outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/30 transition-all"
                maxLength={15}
              />
            </div>

            <div>
              <label htmlFor="student-email" className="flex items-center gap-1.5 text-xs text-[#1d1d1f] font-semibold mb-1.5">
                <Mail className="w-3.5 h-3.5 text-[#0071e3]" />
                Correo Institucional
              </label>
              <input
                id="student-email"
                type="email"
                placeholder="correo@universidad.edu.co"
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-black/[0.08] bg-black/[0.03] focus:bg-white text-[#1d1d1f] text-sm placeholder:text-[#86868b] focus:outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/30 transition-all"
              />
            </div>
          </div>

          {/* ── Botón Confirmar Asistencia ── */}
          <button
            onClick={handleQrConfirm}
            disabled={!canConfirm || processing}
            className="mt-6 w-full h-12 rounded-full bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#006edb] active:scale-[0.98] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_8px_20px_-6px_rgba(0,113,227,0.5)]"
          >
            {processing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Verificando asistencia...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Confirmar Asistencia
              </>
            )}
          </button>
        </div>

        {/* ── Justificación Inasistencia (Art. 42) ── */}
        <div className="flex justify-center pt-1">
          <button
            onClick={() => setShowJustifyModal(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#86868b] hover:text-[#0066cc] transition-colors underline underline-offset-4"
          >
            <FileText className="w-3.5 h-3.5 text-[#0071e3]" />
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

  const displaySession = remoteActiveSession
    ? {
        isActive: true,
        courseCode: remoteActiveSession.courseCode,
        course: remoteActiveSession.courseName,
        room: remoteActiveSession.room,
        tolerance: remoteActiveSession.tolerance,
        teacher: remoteActiveSession.teacherName,
        pin: remoteActiveSession.pin,
      }
    : session;

  // ════════════════════════════════════════════════════════════════════════════
  // ── FLUJO CLÁSICO: Vista original (PIN manual / QR simulado) ──
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col gap-5 py-6 animate-fade-in">
      {/* ── Context card ── */}
      <div className="bg-white/80 backdrop-blur-2xl rounded-[28px] p-5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] border border-black/[0.06] relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
            displaySession.isActive ? 'bg-[#34c759]/12 text-[#248a3d]' : 'bg-black/[0.05] text-[#86868b]'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${displaySession.isActive ? 'bg-[#34c759] animate-pulse' : 'bg-[#86868b]'}`} />
            {displaySession.isActive ? 'Clase activa detectada' : 'Sin sesión activa'}
          </span>
          <span className="font-mono text-[11px] text-[#0071e3] font-bold px-2.5 py-0.5 rounded-full bg-[#0071e3]/10">
            {displaySession.courseCode}
          </span>
        </div>
        <h2 className="text-base text-[#1d1d1f] font-bold tracking-tight truncate">{displaySession.course}</h2>
        <div className="mt-2.5 space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-[#86868b]">
            <MapPin className="w-3.5 h-3.5 text-[#0071e3] shrink-0" />
            {displaySession.room}
          </div>
          <div className="flex items-center gap-2 text-xs text-[#86868b]">
            <Clock className="w-3.5 h-3.5 text-[#0071e3] shrink-0" />
            Tolerancia: {displaySession.tolerance} minutos
          </div>
          <div className="flex items-center gap-2 text-xs text-[#86868b]">
            <User className="w-3.5 h-3.5 text-[#0071e3] shrink-0" />
            {displaySession.teacher}
          </div>
        </div>
      </div>

      {/* ── Notice if no session ── */}
      {!displaySession.isActive && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#ff9500]/10 border border-[#ff9500]/25">
          <AlertCircle className="w-5 h-5 text-[#ff9500] shrink-0 mt-0.5" />
          <p className="text-xs text-[#1d1d1f] leading-relaxed">
            El docente aún no ha iniciado la sesión. Espera a que aparezca el QR o el PIN en el proyector.
          </p>
        </div>
      )}

      {/* ── Tabs (Segmented Control iOS) ── */}
      <div className="bg-[#e6e6e8]/80 rounded-[14px] p-1 flex gap-1">
        {([
          { key: 'pin', icon: Hash,   label: 'Ingresar PIN' },
          { key: 'qr',  icon: QrCode, label: 'Escanear QR'  },
        ] as const).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-[10px] text-xs font-semibold transition-all active:scale-[0.98] ${
              tab === key
                ? 'bg-white text-[#1d1d1f] shadow-[0_1px_4px_rgba(0,0,0,0.08)]'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── PIN Panel ── */}
      {tab === 'pin' && (
        <div className="bg-white/80 backdrop-blur-2xl rounded-[28px] p-6 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] border border-black/[0.06] animate-scale-in">
          <h3 className="text-base text-[#1d1d1f] font-bold tracking-tight text-center mb-1.5">
            PIN de 6 dígitos
          </h3>
          <p className="text-xs text-[#86868b] text-center mb-6">
            Ingresa el código que aparece en el proyector del aula.
          </p>
          {processing ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-10 h-10 border-3 border-[#0071e3]/25 border-t-[#0071e3] rounded-full animate-spin" />
              <p className="text-xs text-[#86868b]">Verificando asistencia...</p>
            </div>
          ) : (
            <PinInput onComplete={handlePinComplete} initialPin={pinParam || ''} />
          )}
        </div>
      )}

      {/* ── QR Panel ── */}
      {tab === 'qr' && (
        <div className="bg-white/80 backdrop-blur-2xl rounded-[28px] p-6 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] border border-black/[0.06] animate-scale-in">
          <h3 className="text-base text-[#1d1d1f] font-bold tracking-tight text-center mb-1.5">
            Escanear código QR
          </h3>
          <p className="text-xs text-[#86868b] text-center mb-6">
            Apunta tu cámara al QR proyectado en el tablero.
          </p>
          {/* Viewfinder */}
          <div className="relative mx-auto w-60 h-60 sm:w-64 sm:h-64 rounded-[24px] overflow-hidden bg-[#1d1d1f] flex items-center justify-center">
            <div className="absolute inset-3 rounded-2xl border border-white/25" />
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
            <div className="absolute w-full h-0.5 bg-[#34c759]/80 top-1/2 animate-pulse" />
            <QrCode className="w-16 h-16 text-white/20" />
          </div>
          <button
            onClick={() => displaySession.isActive && displaySession.pin && handlePinComplete(displaySession.pin, undefined, 'QR')}
            disabled={!displaySession.isActive || !displaySession.pin || processing}
            className="mt-5 w-full h-11 rounded-full bg-[#34c759] hover:brightness-95 active:scale-[0.98] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirmar lectura de QR
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Justificación Inasistencia (Art. 42) ── */}
      <div className="flex justify-center pt-1">
        <button
          onClick={() => setShowJustifyModal(true)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#86868b] hover:text-[#0066cc] transition-colors underline underline-offset-4"
        >
          <FileText className="w-3.5 h-3.5 text-[#0071e3]" />
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
