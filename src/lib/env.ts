import 'server-only';

/**
 * Lecture centralisée et typée des variables d'environnement serveur.
 * Aucun secret n'est exposé au client : seules les variables `NEXT_PUBLIC_*`
 * traversent la frontière serveur/navigateur.
 */

function optional(name: string, fallback = ''): string {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function integer(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

/** Secret de session. En production, un secret faible est refusé au démarrage. */
function authSecret(): string {
  const secret = optional('AUTH_SECRET');
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'AUTH_SECRET manquant ou trop court (32 caractères minimum). ' +
          'Générer un secret avec : openssl rand -base64 48',
      );
    }
    return 'kerplus-development-only-secret-do-not-use-in-production';
  }
  return secret;
}

export const env = {
  get isProduction() {
    return process.env.NODE_ENV === 'production';
  },
  get isTest() {
    return process.env.NODE_ENV === 'test';
  },
  get siteUrl() {
    return optional('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000').replace(/\/+$/, '');
  },

  authSecret,
  get sessionMaxAge() {
    return integer('SESSION_MAX_AGE', 60 * 60 * 8);
  },

  // Les valeurs ci-dessous sont lues à chaque accès : la configuration peut
  // ainsi être ajustée sans redémarrage lors des tests et des scripts.
  payment: {
    get provider() {
      return optional('PAYMENT_PROVIDER', 'wave_link');
    },
    get wavePaymentUrl() {
      return optional('WAVE_PAYMENT_URL', '');
    },
    get waveApiBaseUrl() {
      return optional('WAVE_API_BASE_URL', '');
    },
    get waveApiKey() {
      return optional('WAVE_API_KEY', '');
    },
    get waveWebhookSecret() {
      return optional('WAVE_WEBHOOK_SECRET', '');
    },
    get premiumReportPriceFallback() {
      return integer('PREMIUM_REPORT_PRICE_XOF', 50_000);
    },
  },

  email: {
    get provider() {
      return optional('EMAIL_PROVIDER', 'preview');
    },
    get from() {
      return optional('EMAIL_FROM', 'Kerplus <contact@kerplus.sn>');
    },
    get replyTo() {
      return optional('EMAIL_REPLY_TO', '');
    },
    get internalNotification() {
      return optional('EMAIL_INTERNAL_NOTIFICATION', '');
    },
    smtp: {
      get host() {
        return optional('SMTP_HOST');
      },
      get port() {
        return integer('SMTP_PORT', 587);
      },
      get secure() {
        return boolean('SMTP_SECURE', false);
      },
      get user() {
        return optional('SMTP_USER');
      },
      get password() {
        return optional('SMTP_PASSWORD');
      },
    },
  },

  seo: {
    /**
     * Mettre SEO_INDEXING=false sur un environnement de recette ou de
     * démonstration : le site répond alors `noindex` et interdit tout
     * référencement du domaine temporaire.
     */
    get indexing() {
      return boolean('SEO_INDEXING', true);
    },
  },

  reports: {
    get storageDir() {
      return optional('REPORT_STORAGE_DIR', './storage/reports');
    },
    get downloadTtlHours() {
      return integer('REPORT_DOWNLOAD_TTL_HOURS', 24 * 30);
    },
    get maxUploadBytes() {
      return integer('REPORT_MAX_UPLOAD_BYTES', 15 * 1024 * 1024);
    },
  },

  security: {
    get rateLimitEnabled() {
      return boolean('RATE_LIMIT_ENABLED', true);
    },
    get captchaProvider() {
      return optional('CAPTCHA_PROVIDER');
    },
    get captchaSecretKey() {
      return optional('CAPTCHA_SECRET_KEY');
    },
  },

  admin: {
    get email() {
      return optional('ADMIN_EMAIL');
    },
    get name() {
      return optional('ADMIN_NAME', 'Administrateur Kerplus');
    },
    get password() {
      return optional('ADMIN_PASSWORD');
    },
  },
} as const;
