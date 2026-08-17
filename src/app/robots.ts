import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

// Rendu à la demande : SEO_INDEXING et NEXT_PUBLIC_SITE_URL sont lus au
// démarrage du serveur, jamais figés au moment du build.
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  // Environnement de recette / démonstration : aucun référencement.
  if (!env.seo.indexing) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Espaces privés : administration, commandes clients et rapports.
        disallow: ['/admin', '/api', '/commande', '/rapport'],
      },
    ],
    sitemap: `${env.siteUrl}/sitemap.xml`,
    host: env.siteUrl,
  };
}
