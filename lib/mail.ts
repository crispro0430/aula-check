/**
 * Aula Check — Servicio modular de correo electrónico.
 *
 * Proveedores (en orden de prioridad):
 *   1. Resend  → si existe `RESEND_API_KEY` (API REST, sin dependencias extra).
 *   2. SMTP    → si existen `SMTP_HOST`, `SMTP_USER` y `SMTP_PASS` (Nodemailer).
 *   3. Ninguno → los envíos se omiten y se registran en consola (no rompe ningún flujo).
 *
 * Todas las funciones públicas son tolerantes a fallos: devuelven un `MailResult`
 * en lugar de lanzar, para poder dispararse en segundo plano tras la respuesta HTTP.
 * Módulo exclusivo de servidor: solo debe importarse desde route handlers.
 */

export interface MailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export type MailResult =
  | { ok: true; provider: 'resend' | 'smtp'; id?: string }
  | { ok: false; provider: 'resend' | 'smtp' | 'none'; reason: string };

type MailProvider = 'resend' | 'smtp' | 'none';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const SEND_TIMEOUT_MS = 10_000;
const EMAIL_PATTERN = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

function getFromAddress(): string {
  return process.env.MAIL_FROM?.trim() || 'Aula Check <no-reply@aulacheck.edu.co>';
}

export function getMailProvider(): MailProvider {
  if (process.env.RESEND_API_KEY?.trim()) return 'resend';
  if (process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim() && process.env.SMTP_PASS) {
    return 'smtp';
  }
  return 'none';
}

function normalizeRecipients(to: string | string[]): string[] {
  const list = Array.isArray(to) ? to : [to];
  const unique = new Set(
    list.map((address) => address.trim().toLowerCase()).filter((address) => EMAIL_PATTERN.test(address)),
  );
  return [...unique];
}

async function sendWithResend(message: MailMessage, recipients: string[]): Promise<MailResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY?.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: getFromAddress(),
        to: recipients,
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, provider: 'resend', reason: `HTTP ${res.status} ${body.slice(0, 200)}` };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, provider: 'resend', id: data.id };
  } finally {
    clearTimeout(timer);
  }
}

type SmtpTransport = {
  sendMail: (options: Record<string, unknown>) => Promise<{ messageId?: string }>;
};
let smtpTransportPromise: Promise<SmtpTransport> | null = null;

function getSmtpTransport(): Promise<SmtpTransport> {
  if (!smtpTransportPromise) {
    smtpTransportPromise = import('nodemailer').then((mod) => {
      // Interop CJS/ESM: según el bundler el módulo llega como namespace o en `default`.
      const nodemailer = (mod as typeof mod & { default?: typeof mod }).default ?? mod;
      const port = Number(process.env.SMTP_PORT) || 587;
      const secure = process.env.SMTP_SECURE
        ? process.env.SMTP_SECURE === 'true'
        : port === 465;
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST?.trim(),
        port,
        secure,
        auth: { user: process.env.SMTP_USER?.trim(), pass: process.env.SMTP_PASS },
        connectionTimeout: SEND_TIMEOUT_MS,
        greetingTimeout: SEND_TIMEOUT_MS,
        socketTimeout: SEND_TIMEOUT_MS,
      }) as unknown as SmtpTransport;
    });
  }
  return smtpTransportPromise;
}

async function sendWithSmtp(message: MailMessage, recipients: string[]): Promise<MailResult> {
  const transport = await getSmtpTransport();
  const info = await transport.sendMail({
    from: getFromAddress(),
    to: recipients.join(', '),
    subject: message.subject,
    html: message.html,
    text: message.text,
    ...(message.replyTo ? { replyTo: message.replyTo } : {}),
  });
  return { ok: true, provider: 'smtp', id: info.messageId };
}

/** Envía un correo con el proveedor configurado. Nunca lanza excepciones. */
export async function sendMail(message: MailMessage): Promise<MailResult> {
  const provider = getMailProvider();
  const recipients = normalizeRecipients(message.to);

  if (recipients.length === 0) {
    return { ok: false, provider, reason: 'NO_VALID_RECIPIENTS' };
  }
  if (provider === 'none') {
    console.info(`[mail] Proveedor no configurado. Correo omitido: "${message.subject}"`);
    return { ok: false, provider, reason: 'MAIL_NOT_CONFIGURED' };
  }

  try {
    const result =
      provider === 'resend'
        ? await sendWithResend(message, recipients)
        : await sendWithSmtp(message, recipients);
    if (!result.ok) {
      console.error(`[mail] Fallo de envío (${provider}): ${result.reason}`);
    }
    return result;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[mail] Error de envío (${provider}): ${reason}`);
    return { ok: false, provider, reason };
  }
}

// ─── Plantillas HTML minimalistas (estilo Apple: Gallery White, Ink, Apple Blue) ──

/** Escapa texto para interpolarlo de forma segura en HTML (evita inyección en correos). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

type Tone = 'neutral' | 'success' | 'danger' | 'warning';

const TONE_COLORS: Record<Tone, { fg: string; bg: string }> = {
  neutral: { fg: '#0066cc', bg: '#eaf3fd' },
  success: { fg: '#1d7a3a', bg: '#e8f5ec' },
  danger: { fg: '#c4161c', bg: '#fdecec' },
  warning: { fg: '#a15c00', bg: '#fff4e0' },
};

interface TemplateInput {
  preheader: string;
  eyebrow: string;
  tone: Tone;
  title: string;
  intro: string;
  rows: Array<[label: string, value: string]>;
  note?: { label: string; body: string };
  cta?: { label: string; href: string };
}

function getAppUrl(): string | null {
  const raw = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null;
  } catch {
    return null;
  }
}

/** Construye un enlace absoluto a la app solo si `APP_URL` está configurada. */
export function appLink(path: string): string | undefined {
  const base = getAppUrl();
  return base ? `${base}${path.startsWith('/') ? path : `/${path}`}` : undefined;
}

function renderTemplate(input: TemplateInput): { html: string; text: string } {
  const tone = TONE_COLORS[input.tone];
  const font =
    "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

  const rowsHtml = input.rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:12px 0;border-top:1px solid #e6e6e8;font-size:13px;color:#707070;width:40%;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:12px 0;border-top:1px solid #e6e6e8;font-size:14px;color:#1d1d1f;font-weight:500;vertical-align:top;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join('');

  const noteHtml = input.note
    ? `
      <div style="margin-top:24px;padding:16px 18px;background:#f5f5f7;border-radius:16px;">
        <div style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#707070;font-weight:600;margin-bottom:6px;">${escapeHtml(input.note.label)}</div>
        <div style="font-size:14px;line-height:1.5;color:#1d1d1f;white-space:pre-line;">${escapeHtml(input.note.body)}</div>
      </div>`
    : '';

  const ctaHtml = input.cta
    ? `
      <div style="margin-top:28px;">
        <a href="${escapeHtml(input.cta.href)}" style="display:inline-block;background:#0071e3;color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;padding:11px 22px;border-radius:980px;">${escapeHtml(input.cta.label)}</a>
      </div>`
    : '';

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:${font};-webkit-font-smoothing:antialiased;">
  <span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(input.preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="padding:0 8px 20px;font-size:15px;font-weight:600;color:#1d1d1f;letter-spacing:-0.01em;">Aula Check</td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:28px;padding:36px 32px;">
              <span style="display:inline-block;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${tone.fg};background:${tone.bg};padding:4px 10px;border-radius:980px;">${escapeHtml(input.eyebrow)}</span>
              <h1 style="margin:16px 0 8px;font-size:24px;line-height:1.2;font-weight:600;color:#1d1d1f;letter-spacing:-0.02em;">${escapeHtml(input.title)}</h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#424245;">${escapeHtml(input.intro)}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}
              </table>${noteHtml}${ctaHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 8px 0;font-size:12px;line-height:1.5;color:#86868b;">
              Mensaje automático del sistema institucional de asistencia Aula Check. No respondas a este correo.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textLines = [
    'Aula Check',
    '',
    input.title,
    '',
    input.intro,
    '',
    ...input.rows.map(([label, value]) => `${label}: ${value}`),
    ...(input.note ? ['', `${input.note.label}:`, input.note.body] : []),
    ...(input.cta ? ['', `${input.cta.label}: ${input.cta.href}`] : []),
    '',
    'Mensaje automático del sistema institucional de asistencia Aula Check.',
  ];

  return { html, text: textLines.join('\n') };
}

// ─── Notificaciones de negocio ───────────────────────────────────────────────

export interface IncapacityMailData {
  studentName: string;
  studentEmail: string;
  studentCode: string;
  courseName: string;
  courseCode: string;
  absenceDate: string; // YYYY-MM-DD
  type: string;
  reason: string;
}

/** a) Docente: un estudiante radicó una incapacidad en su asignatura. */
export function notifyTeacherIncapacitySubmitted(
  teacher: { name: string; email: string },
  data: IncapacityMailData,
): Promise<MailResult> {
  const { html, text } = renderTemplate({
    preheader: `${data.studentName} radicó una incapacidad en ${data.courseName}.`,
    eyebrow: 'Nueva incapacidad',
    tone: 'neutral',
    title: 'Tienes una incapacidad por revisar',
    intro: `Hola ${teacher.name}, ${data.studentName} radicó una solicitud de justificación de inasistencia que requiere tu revisión.`,
    rows: [
      ['Estudiante', `${data.studentName} (${data.studentCode})`],
      ['Asignatura', `${data.courseName} · ${data.courseCode}`],
      ['Fecha de la falta', data.absenceDate],
      ['Tipo', data.type],
    ],
    note: { label: 'Motivo', body: data.reason },
    cta: (() => {
      const href = appLink('/teacher/incapacities');
      return href ? { label: 'Revisar solicitud', href } : undefined;
    })(),
  });
  return sendMail({
    to: teacher.email,
    subject: `Nueva incapacidad · ${data.courseCode} · ${data.studentName}`,
    html,
    text,
  });
}

/** a) Estudiante: su incapacidad fue aprobada o rechazada (con observaciones). */
export function notifyStudentIncapacityReviewed(
  data: IncapacityMailData & {
    approved: boolean;
    reviewerName: string;
    reviewerComment: string;
  },
): Promise<MailResult> {
  const { html, text } = renderTemplate({
    preheader: `Tu incapacidad de ${data.courseName} fue ${data.approved ? 'aprobada' : 'rechazada'}.`,
    eyebrow: data.approved ? 'Aprobada' : 'Rechazada',
    tone: data.approved ? 'success' : 'danger',
    title: data.approved ? 'Tu incapacidad fue aprobada' : 'Tu incapacidad fue rechazada',
    intro: data.approved
      ? `Hola ${data.studentName}, tu inasistencia quedó justificada y tu porcentaje de asistencia fue recalculado.`
      : `Hola ${data.studentName}, tu solicitud no fue aceptada. Revisa las observaciones del revisor.`,
    rows: [
      ['Asignatura', `${data.courseName} · ${data.courseCode}`],
      ['Fecha de la falta', data.absenceDate],
      ['Tipo', data.type],
      ['Revisado por', data.reviewerName],
    ],
    note: { label: 'Observaciones', body: data.reviewerComment || 'Sin observaciones.' },
    cta: (() => {
      const href = appLink('/student/incapacities');
      return href ? { label: 'Ver mis solicitudes', href } : undefined;
    })(),
  });
  return sendMail({
    to: data.studentEmail,
    subject: `Incapacidad ${data.approved ? 'aprobada' : 'rechazada'} · ${data.courseCode}`,
    html,
    text,
  });
}

export interface AttendanceRiskMailData {
  studentName: string;
  studentEmail: string;
  studentCode: string;
  courseName: string;
  courseCode: string;
  attendancePercentage: number;
  thresholdPercentage: number;
  absences: number;
  totalSessions: number;
  levelLabel: string;
}

/** b) Alerta de inasistencia: al estudiante y al docente titular. */
export async function notifyAttendanceRisk(
  data: AttendanceRiskMailData,
  teacher: { name: string; email: string } | null,
): Promise<MailResult[]> {
  const rows: Array<[string, string]> = [
    ['Asignatura', `${data.courseName} · ${data.courseCode}`],
    ['Asistencia actual', `${data.attendancePercentage}%`],
    ['Mínimo requerido', `${data.thresholdPercentage}%`],
    ['Inasistencias', `${data.absences} de ${data.totalSessions} sesiones`],
    ['Semáforo', data.levelLabel],
  ];

  const student = renderTemplate({
    preheader: `Tu asistencia en ${data.courseName} bajó a ${data.attendancePercentage}%.`,
    eyebrow: 'Alerta de asistencia',
    tone: 'warning',
    title: 'Estás en riesgo académico por inasistencia',
    intro: `Hola ${data.studentName}, tu porcentaje de asistencia está por debajo del mínimo institucional. Si tienes soportes de tus faltas, radica una incapacidad lo antes posible.`,
    rows,
    cta: (() => {
      const href = appLink('/student/incapacities');
      return href ? { label: 'Radicar incapacidad', href } : undefined;
    })(),
  });

  const sends: Array<Promise<MailResult>> = [
    sendMail({
      to: data.studentEmail,
      subject: `Alerta de asistencia · ${data.courseCode} · ${data.attendancePercentage}%`,
      html: student.html,
      text: student.text,
    }),
  ];

  if (teacher) {
    const teacherMail = renderTemplate({
      preheader: `${data.studentName} entró en riesgo académico en ${data.courseName}.`,
      eyebrow: 'Alerta de asistencia',
      tone: 'warning',
      title: 'Un estudiante entró en riesgo académico',
      intro: `Hola ${teacher.name}, ${data.studentName} (${data.studentCode}) quedó por debajo del mínimo de asistencia en tu asignatura.`,
      rows: [['Estudiante', `${data.studentName} (${data.studentCode})`], ...rows],
      cta: (() => {
        const href = appLink('/teacher/summary');
        return href ? { label: 'Ver resumen del curso', href } : undefined;
      })(),
    });
    sends.push(
      sendMail({
        to: teacher.email,
        subject: `Riesgo académico · ${data.courseCode} · ${data.studentName}`,
        html: teacherMail.html,
        text: teacherMail.text,
      }),
    );
  }

  return Promise.all(sends);
}
