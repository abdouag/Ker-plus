import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { env } from '@/lib/env';
import './globals.css';

/**
 * Police auto-hébergée par next/font : téléchargée au build, servie depuis le
 * domaine — aucune requête tierce au runtime, aucun décalage de rendu.
 */
const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-manrope',
});

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
    'Estimez gratuitement, en 2 minutes et sans engagement, le coût de construction de votre maison, villa ou immeuble au Sénégal, puis commandez un rapport technique détaillé.',
  applicationName: 'Estimateur Kerplus',
  authors: [{ name: 'Kerplus.sn' }],
  keywords: [
    'estimation construction Sénégal',
    'prix construction maison Dakar',
    'coût construction au m² Sénégal',
    'construire une villa au Sénégal',
    'devis construction Sénégal',
  ],
  // Sur un environnement de recette (SEO_INDEXING=false), le site n'est pas indexé.
  robots: env.seo.indexing ? { index: true, follow: true } : { index: false, follow: false },
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'fr_SN',
    url: env.siteUrl,
    siteName: 'Kerplus.sn',
    title: 'Kerplus — Combien coûte votre maison ?',
    description:
      'Estimez gratuitement le budget de votre projet de construction au Sénégal, en 2 minutes, sans engagement.',
  },
  twitter: {
    // L'image d'aperçu (src/app/opengraph-image.tsx) est reprise automatiquement.
    card: 'summary_large_image',
    title: 'Kerplus — Combien coûte votre maison ?',
    description:
      'Estimez gratuitement le budget de votre projet de construction au Sénégal, en 2 minutes, sans engagement.',
  },
  formatDetection: { telephone: true, address: false, email: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={manrope.variable}>
      <body className="min-h-screen">
        <a href="#contenu" className="kp-skip-link">
          Aller au contenu principal
        </a>
        {children}
      </body>
    </html>
  );
}
