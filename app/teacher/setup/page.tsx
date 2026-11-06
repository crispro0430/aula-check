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
        <h1 className="text-headline-xl text-primary font-bold tracking-tight mb-1">
          Apertura de Asistencia
        </h1>
        <p className="text-body-lg text-on-surface-variant max-w-2xl">
          Configura los parámetros de la sesión. El sistema generará automáticamente un PIN único y un código QR para el registro de tus estudiantes.
        </p>
      </div>

      {session.isActive && (
        <div className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-body-sm text-amber-800">
            Ya tienes una sesión activa para <strong>{session.course}</strong>. Iniciar una nueva cerrará la anterior.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Formulario (2/3) ── */}
        <div className="lg:col-span-2 flex flex-col gap-5">

          {/* Asignatura */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-card border border-outline-variant/20">
            <div className="flex items-center gap-2 mb-4">
              <School className="w-5 h-5 text-primary-container" />
              <h2 className="text-headline-sm text-on-surface font-bold">Asignatura y Grupo</h2>
            </div>
            <div className="space-y-3">
              {courses.map((c) => {
                const isSelected = activeCourse.id === c.id;
                return (
                  <label
                    key={c.id}
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-primary-container bg-primary-fixed/30'
                        : 'border-outline-variant/40 hover:border-outline-variant hover:bg-surface-container-low'
                    }`}
                  >
                    <input
                      type="radio"
                      name="course"
                      className="mt-1 accent-primary-container"
                      checked={isSelected}
                      onChange={() => setSelectedCourseId(c.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-label-lg text-on-surface font-semibold">{c.name} — {c.code}</div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        <span className="flex items-center gap-1 text-body-sm text-on-surface-variant">
                          <Clock className="w-3.5 h-3.5" /> {c.schedule}
                        </span>
                        <span className="flex items-center gap-1 text-body-sm text-on-surface-variant">
                          <MapPin className="w-3.5 h-3.5" /> {c.room}
                        </span>
                        <span className="flex items-center gap-1 text-body-sm text-on-surface-variant">
                          <Users className="w-3.5 h-3.5" /> {c.students} alumnos
                        </span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Tema de la clase */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-card border border-outline-variant/20">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-5 h-5 text-primary-container" />
              <h2 className="text-headline-sm text-on-surface font-bold">Tema de la Clase</h2>
              <span className="ml-auto text-label-sm text-error font-semibold">Requerido</span>
            </div>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ej: Patrones de diseño — Strategy y Observer"
              className="w-full h-12 px-4 rounded-xl border-2 border-outline-variant bg-surface-container-low text-on-surface text-body-lg placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary-container focus:ring-4 focus:ring-primary-container/10 transition-all"
            />
          </div>

          {/* Tolerancia y modo */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-card border border-outline-variant/20">
            <h2 className="text-headline-sm text-on-surface font-bold mb-5">Configuración de Registro</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Tolerancia */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-primary-container" />
                  <label className="text-label-lg text-on-surface font-semibold">Tolerancia</label>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {TOLERANCE_OPTIONS.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTolerance(t)}
                      className={`px-3 py-2 rounded-xl text-label-lg font-semibold transition-all ${
                        tolerance === t
                          ? 'bg-primary-container text-white shadow-card'
                          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
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
                  <Layers className="w-4 h-4 text-primary-container" />
                  <label className="text-label-lg text-on-surface font-semibold">Modo de registro</label>
                </div>
                <div className="flex flex-col gap-2">
                  {([
                    { value: 'qr',   icon: QrCode, label: 'Solo QR' },
                    { value: 'pin',  icon: Hash,   label: 'Solo PIN' },
                    { value: 'both', icon: Wifi,   label: 'QR + PIN (recomendado)' },
                  ] as const).map(({ value, icon: Icon, label }) => (
                    <label
                      key={value}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                        mode === value
                          ? 'border-primary-container bg-primary-fixed/20'
                          : 'border-outline-variant/40 hover:bg-surface-container-low'
                      }`}
                    >
                      <input
                        type="radio"
                        name="mode"
                        className="accent-primary-container"
                        checked={mode === value}
                        onChange={() => setMode(value)}
                      />
                      <Icon className="w-4 h-4 text-primary-container" />
                      <span className="text-label-lg text-on-surface">{label}</span>
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
            <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-card border border-outline-variant/20">
              <h3 className="text-label-lg text-on-surface font-bold mb-4 uppercase tracking-wider">Resumen de sesión</h3>

              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <School className="w-4 h-4 text-primary-container mt-0.5 shrink-0" />
                  <div>
                    <div className="text-label-sm text-on-surface-variant">Asignatura</div>
                    <div className="text-body-md text-on-surface font-medium">{activeCourse.name}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-primary-container mt-0.5 shrink-0" />
                  <div>
                    <div className="text-label-sm text-on-surface-variant">Aula</div>
                    <div className="text-body-md text-on-surface font-medium">{activeCourse.room}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 text-primary-container mt-0.5 shrink-0" />
                  <div>
                    <div className="text-label-sm text-on-surface-variant">Matriculados</div>
                    <div className="text-body-md text-on-surface font-medium">{activeCourse.students} alumnos</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-primary-container mt-0.5 shrink-0" />
                  <div>
                    <div className="text-label-sm text-on-surface-variant">Tolerancia</div>
                    <div className="text-body-md text-on-surface font-medium">
                      {tolerance === 0 ? 'Sin tolerancia' : `${tolerance} minutos`}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-primary-container mt-0.5 shrink-0" />
                  <div>
                    <div className="text-label-sm text-on-surface-variant">Período</div>
                    <div className="text-body-md text-on-surface font-medium">2026-2</div>
                  </div>
                </div>
              </div>

              <div className="my-4 h-px bg-outline-variant/30" />

              <div className="p-3 rounded-xl bg-surface-container-low text-body-sm text-on-surface-variant">
                Se generará automáticamente un <strong className="text-primary">PIN de 6 dígitos</strong> y un{' '}
                <strong className="text-primary">código QR dinámico</strong> para proyección en aula.
              </div>
            </div>

            <button
              onClick={handleStart}
              disabled={!topic.trim() || loading}
              className="w-full h-14 rounded-xl bg-primary-container text-white font-bold text-label-lg flex items-center justify-center gap-3 hover:bg-primary transition-all active:scale-[0.98] shadow-elevated disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Wifi className="w-5 h-5" />
                  Abrir sesión y proyectar
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
