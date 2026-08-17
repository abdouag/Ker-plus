import type { Metadata, Viewport } from 'next';
import { env } from '@/lib/env';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1A4D2E',
};

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: 'Estimateur Kerplus — coût de construction au Sénégal',
    template: '%s | Kerplus.sn',
  },
  description:
    'Estimez en moins de 2 minutes le coût de construction de votre maison, villa ou immeuble au Sénégal, puis commandez un rapport technique détaillé.',
  applicationName: 'Estimateur Kerplus',
  authors: [{ name: 'Kerplus.sn' }],
  keywords: [
    'estimation construction Sénégal',
    'prix construction maison Dakar',
    'coût construction au m² Sénégal',
    'construire une villa au Sénégal',
    'devis construction Sénégal',
  ],
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'fr_SN',
    url: env.siteUrl,
    siteName: 'Kerplus.sn',
    title: 'Estimateur Kerplus — coût de construction au Sénégal',
    description:
      'Calculez le budget de votre projet de construction au Sénégal et recevez un rapport technique détaillé sous 48 h.',
  },
  twitter: {
    card: 'summary',
    title: 'Estimateur Kerplus — coût de construction au Sénégal',
    description:
      'Estimation immédiate du coût de construction au Sénégal et rapport technique détaillé.',
  },
  formatDetection: { telephone: true, address: false, email: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen">
        <a href="#contenu" className="kp-skip-link">
          Aller au contenu principal
        </a>
        {children}
      </body>
    </html>
  );
}
