/**
 * Prueba manual del servicio de correo (lib/mail.ts) con las variables del entorno.
 * Uso:  npx tsx --env-file=.env scripts/send-test-mail.ts destinatario@dominio.com
 * No escribe nada en la base de datos.
 */
import { getMailProvider, notifyStudentIncapacityReviewed } from '../lib/mail';

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error('Indica el destinatario: npx tsx --env-file=.env scripts/send-test-mail.ts correo@dominio.com');
    process.exit(1);
  }

  console.log(`Proveedor configurado: ${getMailProvider()}`);
  const result = await notifyStudentIncapacityReviewed({
    studentName: 'Estudiante de Prueba',
    studentEmail: to,
    studentCode: '0000000000',
    courseName: 'Arquitectura de Software',
    courseCode: 'G401',
    absenceDate: new Date().toISOString().slice(0, 10),
    type: 'Médica',
    reason: 'Correo de verificación del sistema de notificaciones de Aula Check.',
    approved: true,
    reviewerName: 'Aula Check · Prueba de humo',
    reviewerComment: 'Si recibes este mensaje, el envío de correos funciona correctamente.',
  });

  console.log(result.ok ? `Enviado vía ${result.provider} (id: ${result.id ?? 'n/d'})` : `Fallo (${result.provider}): ${result.reason}`);
  process.exit(result.ok ? 0 : 1);
}

void main();
