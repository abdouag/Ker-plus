import { z } from 'zod';
import { SURFACE_MAX, SURFACE_MIN } from '@/lib/estimation/constants';
import { isValidPhone, normalizePhone } from '@/lib/phone';
import { SERVICE_KEYS } from '@/lib/content/services';

/** Identifiant Prisma (cuid). Volontairement souple pour rester portable. */
const idSchema = z
  .string()
  .trim()
  .min(1, 'Sélection obligatoire.')
  .max(64, 'Identifiant invalide.')
  .regex(/^[A-Za-z0-9_-]+$/, 'Identifiant invalide.');

export const surfaceSchema = z
  .number({ invalid_type_error: 'La surface doit être un nombre.' })
  .int('La surface doit être un nombre entier de m².')
  .min(SURFACE_MIN, `La surface minimale est de ${SURFACE_MIN} m².`)
  .max(SURFACE_MAX, `La surface maximale est de ${SURFACE_MAX} m².`);

/** Services demandés : uniquement des clés du catalogue, sans doublon. */
export const requestedServicesSchema = z
  .array(z.enum(SERVICE_KEYS))
  .max(SERVICE_KEYS.length, 'Sélection de services invalide.')
  .default([])
  .transform((keys) => [...new Set(keys)]);

/** Paramètres d'une estimation : seuls des identifiants sont acceptés. */
export const estimationInputSchema = z.object({
  projectTypeId: idSchema,
  surface: surfaceSchema,
  cityZoneId: idSchema,
  finishLevelId: idSchema,
});

export type EstimationInputPayload = z.infer<typeof estimationInputSchema>;

export const utmSchema = z.object({
  utmSource: z.string().trim().max(120).optional().nullable(),
  utmMedium: z.string().trim().max(120).optional().nullable(),
  utmCampaign: z.string().trim().max(120).optional().nullable(),
});

const phoneSchema = z
  .string()
  .trim()
  .min(6, 'Numéro de téléphone trop court.')
  .max(24, 'Numéro de téléphone trop long.')
  .refine(isValidPhone, 'Numéro de téléphone invalide.')
  .transform((value) => normalizePhone(value)?.value ?? value);

const nameSchema = z
  .string()
  .trim()
  .min(2, 'Ce champ doit contenir au moins 2 caractères.')
  .max(80, 'Ce champ est trop long.')
  .regex(/^[\p{L}\p{M}][\p{L}\p{M}\s'’.-]*$/u, 'Ce champ contient des caractères non autorisés.');

/** Coordonnées client saisies avant la commande. */
export const customerSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema,
  whatsappSameAsPhone: z.boolean().default(true),
  whatsapp: z.string().trim().max(24).optional().or(z.literal('')),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(5, 'Adresse email invalide.')
    .max(160, 'Adresse email trop longue.')
    .email('Adresse email invalide.'),
  city: z.string().trim().min(2, 'Ville du projet obligatoire.').max(120),
  desiredStartDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide.')
    .optional()
    .or(z.literal('')),
  comment: z
    .string()
    .trim()
    .max(2000, 'Commentaire trop long (2000 caractères maximum).')
    .optional(),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'Vous devez accepter les conditions générales.' }),
  }),
  consentData: z.literal(true, {
    errorMap: () => ({ message: 'Votre consentement est nécessaire pour traiter la demande.' }),
  }),
});

/** Requête complète de création de commande. */
export const createOrderSchema = estimationInputSchema
  .merge(utmSchema)
  .merge(customerSchema)
  .extend({
    /** Champ leurre : doit rester vide (protection anti-spam). */
    website: z.string().max(0, 'Requête rejetée.').optional().or(z.literal('')),
    captchaToken: z.string().max(4096).optional(),
    /** Simulation déjà enregistrée à réutiliser, si elle correspond aux paramètres. */
    simulationReference: z.string().trim().max(40).optional(),
    /** Services souhaités pour le projet (étape facultative du formulaire). */
    requestedServices: requestedServicesSchema,
  })
  .superRefine((data, ctx) => {
    if (!data.whatsappSameAsPhone) {
      const value = data.whatsapp?.trim() ?? '';
      if (!value) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['whatsapp'],
          message: 'Indiquez un numéro WhatsApp ou cochez « identique au téléphone ».',
        });
      } else if (!isValidPhone(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['whatsapp'],
          message: 'Numéro WhatsApp invalide.',
        });
      }
    }
  });

export type CreateOrderPayload = z.infer<typeof createOrderSchema>;

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresse email invalide.'),
  password: z.string().min(8, 'Mot de passe trop court.').max(200),
});

export const manualPaymentSchema = z.object({
  paymentId: idSchema,
  externalReference: z
    .string()
    .trim()
    .min(3, 'Indiquez la référence de la transaction Wave.')
    .max(120),
  note: z.string().trim().max(1000).optional().or(z.literal('')),
});

export const orderStatusSchema = z.enum([
  'DRAFT',
  'AWAITING_PAYMENT',
  'PAID',
  'IN_PREPARATION',
  'READY',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
]);

export const callStatusSchema = z.enum([
  'NOT_SCHEDULED',
  'PROPOSED',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
]);

export const reportItemSchema = z.object({
  id: z.string().optional(),
  category: z.string().trim().min(2, 'Catégorie obligatoire.').max(80),
  label: z.string().trim().min(2, 'Libellé obligatoire.').max(160),
  amount: z.number().int('Montant entier attendu.').min(0).max(100_000_000_000),
  percentage: z.number().int().min(0).max(10_000).nullable().optional(),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  displayOrder: z.number().int().min(0).max(999).default(0),
});

export const reportContentSchema = z.object({
  summary: z.string().trim().max(8000).optional().or(z.literal('')),
  assumptions: z.string().trim().max(8000).optional().or(z.literal('')),
  recommendations: z.string().trim().max(8000).optional().or(z.literal('')),
  exclusions: z.string().trim().max(8000).optional().or(z.literal('')),
  timeline: z.string().trim().max(4000).optional().or(z.literal('')),
  validatedBy: z.string().trim().max(160).optional().or(z.literal('')),
  items: z.array(reportItemSchema).max(60),
});

export const referentialSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, 'Nom obligatoire.').max(80),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  active: z.boolean().default(true),
  displayOrder: z.number().int().min(0).max(999).default(0),
});

export const projectTypeSchema = referentialSchema.extend({
  coefficient: z.number().int().min(100).max(10_000),
});

export const cityZoneSchema = referentialSchema.extend({
  coefficient: z.number().int().min(100).max(10_000),
});

export const finishLevelSchema = referentialSchema.extend({
  pricePerSquareMeter: z.number().int().min(10_000).max(5_000_000),
});
