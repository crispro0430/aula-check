import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aula Check — Sistema Institucional de Asistencia',
  description: 'Sistema universitario de control de asistencia, participación y retención estudiantil.',
  keywords: ['asistencia', 'universidad', 'control', 'académico'],
};

export const viewport: Viewport = {
  themeColor: '#f5f5f7',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-[#f5f5f7] text-[#1d1d1f] antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
