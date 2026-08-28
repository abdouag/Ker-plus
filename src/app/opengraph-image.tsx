import { ImageResponse } from 'next/og';

/**
 * Image d'aperçu du lien (Open Graph) affichée quand le site est partagé sur
 * Facebook, WhatsApp ou X. Générée au build, sans dépendance externe : un
 * visuel de marque, jamais une fausse photo de chantier.
 */

export const alt = 'Kerplus — Combien coûte votre maison ? Estimation gratuite en 2 minutes.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#1A4D2E',
          padding: '72px 80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 72,
              height: 72,
              borderRadius: 18,
              backgroundColor: '#F5EFE6',
              color: '#1A4D2E',
              fontSize: 46,
              fontWeight: 800,
            }}
          >
            K
          </div>
          <div style={{ display: 'flex', color: '#F5EFE6', fontSize: 40, fontWeight: 800 }}>
            Kerplus
            <span style={{ color: '#FF8C42' }}>.sn</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div
            style={{
              display: 'flex',
              color: '#FFFFFF',
              fontSize: 76,
              fontWeight: 800,
              lineHeight: 1.1,
              maxWidth: 900,
            }}
          >
            Combien coûte votre maison ?
          </div>
          <div style={{ display: 'flex', width: 120, height: 10, backgroundColor: '#FF8C42' }} />
          <div style={{ display: 'flex', color: '#DCE8DF', fontSize: 34, maxWidth: 880 }}>
            Estimation gratuite en 2 minutes, sans engagement — construction au Sénégal.
          </div>
        </div>

        <div style={{ display: 'flex', color: '#A9C3B1', fontSize: 26 }}>
          Maison · Villa · Immeuble — rapport technique détaillé sur demande
        </div>
      </div>
    ),
    { ...size },
  );
}
