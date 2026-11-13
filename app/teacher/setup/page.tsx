'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen, School, MapPin, Users, Clock, QrCode, Hash, Layers,
  ChevronRight, Wifi, Calendar, AlertCircle
} from 'lucide-react';
import { useAulaCheckStore } from '@/lib/store';

const TOLERANCE_OPTIONS = [0, 5, 10, 15, 20];

type Mode = 'qr' | 'pin' | 'both';

export default function TeacherSetupPage() {
  const router = useRouter();
  const startSession = useAulaCheckStore((s) => s.startSession);
  const setSessionId = useAulaCheckStore((s) => s.setSessionId);
  const session = useAulaCheckStore((s) => s.session);
  const courses = useAulaCheckStore((s) => s.courses);

  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id || '');
  const [tolerance, setTolerance] = useState(15);
  const [mode, setMode] = useState<Mode>('both');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);

  const activeCourse = courses.find((c) => c.id === selectedCourseId) || courses[0] || {
    id: 'default',
    code: 'G401',
    name: 'Arquitectura de Software',
    room: 'Edificio de Ingeniería G-401',
    teacher: 'Prof. Dr. Alejandro Morales',
    schedule: 'Lun/Mié 08:00 - 10:00',
    students: 28,
  };

  async function handleStart() {
    if (!topic.trim()) return;
    setLoading(true);

    const generatedPin = startSession({
      courseId: activeCourse.id,
      course: activeCourse.name,
      courseCode: activeCourse.code,
      room: activeCourse.room,
      tolerance,
      mode,
      topic: topic.trim(),
    });

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const qrCodeUrl = `${origin}/student/check-in?pin=${generatedPin}&code=${encodeURIComponent(activeCourse.code)}&name=${encodeURIComponent(activeCourse.name)}&room=${encodeURIComponent(activeCourse.room)}&session=active`;

    try {
      const response = await fetch('/api/attendance/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: activeCourse.id,
          courseCode: activeCourse.code,
          courseName: activeCourse.name,
          room: activeCourse.room,
          schedule: activeCourse.schedule,
          teacherId: 't1',
          teacherName: activeCourse.teacher || 'Prof. Dr. Alejandro Morales',
          pin: generatedPin,
          qrCode: qrCodeUrl,
          durationMinutes: Math.max(tolerance, 30),
          toleranceMinutes: tolerance,
          mode,
          topic: topic.trim(),
        }),
      });
      if (response.ok) {
        const data = (await response.json()) as { session?: { id?: string } };
        if (data.session?.id) {
          setSessionId(data.session.id);
        }
      }
    } catch {
      // Respaldo (Fallback): Si está offline o falla la red, el store local mantiene la sesión operativa
    }

    setLoading(false);
    router.push('/teacher/projector');
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      {/* ── Header ── */}
      <div className="mb-8">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#0071e3]/10 text-[#0071e3] text-[11px] font-semibold uppercase tracking-wider mb-2">
          Sesión en Aula
        </span>
        <h1 className="text-2xl sm:text-3xl text-[#1d1d1f] font-bold tracking-tight mb-1">
          Apertura de Asistencia
        </h1>
        <p className="text-sm text-[#86868b] max-w-2xl">
          Configura los parámetros de la sesión. El sistema generará automáticamente un PIN único y un código QR para el registro de tus estudiantes.
        </p>
      </div>

      {session.isActive && (
        <div className="mb-6 flex items-center gap-3 p-4 rounded-2xl bg-[#ff9500]/10 border border-[#ff9500]/25">
          <AlertCircle className="w-5 h-5 text-[#ff9500] shrink-0" />
          <p className="text-xs sm:text-sm text-[#1d1d1f]">
            Ya tienes una sesión activa para <strong>{session.course}</strong>. Iniciar una nueva cerrará la anterior.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Formulario (2/3) ── */}
        <div className="lg:col-span-2 flex flex-col gap-5">

          {/* Asignatura */}
          <div className="bg-white/80 backdrop-blur-2xl rounded-[28px] p-6 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] border border-black/[0.06]">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center shrink-0">
                <School className="w-4 h-4" />
              </div>
              <h2 className="text-base text-[#1d1d1f] font-bold tracking-tight">Asignatura y Grupo</h2>
            </div>
            <div className="space-y-3">
              {courses.map((c) => {
                const isSelected = activeCourse.id === c.id;
                return (
                  <label
                    key={c.id}
                    className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#0071e3] bg-[#0071e3]/[0.06] shadow-[0_0_0_1px_rgba(0,113,227,0.2)]'
                        : 'border-black/[0.08] bg-white/60 hover:bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="course"
                      className="mt-1 accent-[#0071e3]"
                      checked={isSelected}
                      onChange={() => setSelectedCourseId(c.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-[#1d1d1f] font-semibold">{c.name} — {c.code}</div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        <span className="flex items-center gap-1 text-xs text-[#86868b]">
                          <Clock className="w-3.5 h-3.5 text-[#0071e3]" /> {c.schedule}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-[#86868b]">
                          <MapPin className="w-3.5 h-3.5 text-[#0071e3]" /> {c.room}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-[#86868b]">
                          <Users className="w-3.5 h-3.5 text-[#0071e3]" /> {c.students} alumnos
                        </span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Tema de la clase */}
          <div className="bg-white/80 backdrop-blur-2xl rounded-[28px] p-6 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] border border-black/[0.06]">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <h2 className="text-base text-[#1d1d1f] font-bold tracking-tight">Tema de la Clase</h2>
              <span className="ml-auto text-[11px] text-[#ff3b30] font-semibold px-2 py-0.5 rounded-full bg-[#ff3b30]/10">Requerido</span>
            </div>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ej: Patrones de diseño — Strategy y Observer"
              className="w-full h-11 px-4 rounded-xl border border-black/[0.08] bg-black/[0.03] focus:bg-white text-[#1d1d1f] text-sm placeholder:text-[#86868b] focus:outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/30 transition-all"
            />
          </div>

          {/* Tolerancia y modo */}
          <div className="bg-white/80 backdrop-blur-2xl rounded-[28px] p-6 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] border border-black/[0.06]">
            <h2 className="text-base text-[#1d1d1f] font-bold tracking-tight mb-5">Configuración de Registro</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Tolerancia */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-[#0071e3]" />
                  <label className="text-xs text-[#1d1d1f] font-semibold">Tolerancia</label>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {TOLERANCE_OPTIONS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTolerance(t)}
                      className={`px-3.5 py-2 rounded-full text-xs font-semibold transition-all active:scale-[0.98] ${
                        tolerance === t
                          ? 'bg-[#0071e3] text-white shadow-xs'
                          : 'bg-black/[0.05] text-[#1d1d1f] hover:bg-black/[0.08]'
                      }`}
                    >
                      {t === 0 ? 'Exacto' : `+${t} min`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modo */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="w-4 h-4 text-[#0071e3]" />
                  <label className="text-xs text-[#1d1d1f] font-semibold">Modo de registro</label>
                </div>
                <div className="flex flex-col gap-2">
                  {([
                    { value: 'qr',   icon: QrCode, label: 'Solo QR' },
                    { value: 'pin',  icon: Hash,   label: 'Solo PIN' },
                    { value: 'both', icon: Wifi,   label: 'QR + PIN (recomendado)' },
                  ] as const).map(({ value, icon: Icon, label }) => (
                    <label
                      key={value}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border cursor-pointer transition-all ${
                        mode === value
                          ? 'border-[#0071e3] bg-[#0071e3]/[0.06]'
                          : 'border-black/[0.08] bg-white/60 hover:bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="mode"
                        className="accent-[#0071e3]"
                        checked={mode === value}
                        onChange={() => setMode(value)}
                      />
                      <Icon className="w-4 h-4 text-[#0071e3]" />
                      <span className="text-xs font-semibold text-[#1d1d1f]">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Panel Resumen (1/3) ── */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 flex flex-col gap-4">
            <div className="bg-white/80 backdrop-blur-2xl rounded-[28px] p-6 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] border border-black/[0.06]">
              <h3 className="text-[11px] text-[#86868b] font-semibold mb-4 uppercase tracking-wider">Resumen de sesión</h3>

              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <School className="w-4 h-4 text-[#0071e3] mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[11px] text-[#86868b]">Asignatura</div>
                    <div className="text-xs text-[#1d1d1f] font-semibold">{activeCourse.name}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-[#0071e3] mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[11px] text-[#86868b]">Aula</div>
                    <div className="text-xs text-[#1d1d1f] font-semibold">{activeCourse.room}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Users className="w-4 h-4 text-[#0071e3] mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[11px] text-[#86868b]">Matriculados</div>
                    <div className="text-xs text-[#1d1d1f] font-semibold">{activeCourse.students} alumnos</div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-[#0071e3] mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[11px] text-[#86868b]">Tolerancia</div>
                    <div className="text-xs text-[#1d1d1f] font-semibold">
                      {tolerance === 0 ? 'Sin tolerancia' : `${tolerance} minutos`}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Calendar className="w-4 h-4 text-[#0071e3] mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[11px] text-[#86868b]">Período</div>
                    <div className="text-xs text-[#1d1d1f] font-semibold">2026-2</div>
                  </div>
                </div>
              </div>

              <div className="my-4 h-px bg-black/[0.06]" />

              <div className="p-3.5 rounded-2xl bg-black/[0.03] border border-black/[0.05] text-xs text-[#86868b] leading-relaxed">
                Se generará automáticamente un <strong className="text-[#0071e3]">PIN de 6 dígitos</strong> y un{' '}
                <strong className="text-[#0071e3]">código QR dinámico</strong> para proyección en aula.
              </div>
            </div>

            <button
              onClick={handleStart}
              disabled={!topic.trim() || loading}
              className="w-full h-12 rounded-full bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#006edb] active:scale-[0.98] text-white font-semibold text-sm flex items-center justify-center gap-2.5 transition-all shadow-[0_8px_20px_-6px_rgba(0,113,227,0.55)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Wifi className="w-4 h-4" />
                  Abrir sesión y proyectar
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
