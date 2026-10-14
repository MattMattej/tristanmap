import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';

const display = Fraunces({ subsets: ['latin'], variable: '--font-display', display: 'swap', weight: ['600'] });
const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Feria de Tristán Narvaja · Mapa', template: '%s · Feria de Tristán Narvaja' },
  description: 'Mapa interactivo de la Feria de Tristán Narvaja, Montevideo: puestos, sectores y piques.',
  openGraph: { type: 'website', locale: 'es_UY', siteName: 'Mapa de la Feria de Tristán Narvaja' },
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f3eee3',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-UY" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
