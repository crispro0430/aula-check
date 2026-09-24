import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aula Check — Sistema Institucional de Asistencia',
  description: 'Sistema universitario de control de asistencia, participación y retención estudiantil.',
  keywords: ['asistencia', 'universidad', 'control', 'académico'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-surface text-on-surface antialiased">
        {children}
      </body>
    </html>
  );
}
