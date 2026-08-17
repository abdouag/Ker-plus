import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

const ROUTES: {
  path: string;
  priority: number;
  changeFrequency: 'weekly' | 'monthly' | 'yearly';
}[] = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/conditions-rapport', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/conditions-generales', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/politique-de-confidentialite', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/mentions-legales', priority: 0.3, changeFrequency: 'yearly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map((route) => ({
    url: `${env.siteUrl}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
