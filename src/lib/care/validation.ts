import { z } from 'zod';
import { normalizePhone } from '@/lib/phone';

/**
 * Schémas de validation Kër Care (côté serveur, à partir de FormData).
 * Les champs facultatifs vides sont convertis en `undefined`.
 */

const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalText = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

const requiredText = (label: string, max: number, min = 1) =>
  z
    .string({ required_error: `${label} : champ requis.` })
    .trim()
    .min(min, `${label} : champ requis.`)
    .max(max, `${label} : ${max} caractères maximum.`);

const optionalInt = (min: number, max: number) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ invalid_type_error: 'Nombre invalide.' })
      .int('Nombre entier attendu.')
      .min(min, `Valeur minimale : ${min}.`)
      .max(max, `Valeur maximale : ${max}.`)
      .optional(),
  );

/** Date AAAA-MM-JJ, interprétée à midi UTC (Dakar = UTC toute l'année). */
const optionalDate = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide.')
    .transform((value) => new Date(`${value}T12:00:00.000Z`))
    .refine((date) => !Number.isNaN(date.getTime()), 'Date invalide.')
    .optional(),
);

const requiredDate = z
  .string({ required_error: 'Date requise.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide.')
  .transform((value) => new Date(`${value}T12:00:00.000Z`))
  .refine((date) => !Number.isNaN(date.getTime()), 'Date invalide.');

const phoneField = z
  .string()
  .trim()
  .min(1, 'Téléphone requis.')
  .transform((value, ctx) => {
    const normalized = normalizePhone(value);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Numéro de téléphone invalide.' });
      return z.NEVER;
    }
    return normalized.value;
  });

export const signupSchema = z.object({
  name: requiredText('Nom', 120, 2),
  email: z.string().trim().toLowerCase().email('Adresse email invalide.').max(160),
  phone: phoneField,
  password: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
    .max(200)
    .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), {
      message: 'Le mot de passe doit contenir au moins une lettre et un chiffre.',
    }),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Vous devez accepter les conditions pour créer un compte.' }),
  }),
});

export const accountLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(160),
  password: z.string().min(1).max(200),
});

export const propertySchema = z.object({
  name: requiredText('Nom du logement', 80),
  type: z.enum(['VILLA', 'MAISON', 'APPARTEMENT', 'IMMEUBLE', 'AUTRE']),
  commune: requiredText('Commune', 80),
  quartier: optionalText(80),
  landmark: optionalText(160),
  address: optionalText(200),
  surface: optionalInt(5, 100_000),
  levels: optionalInt(1, 60),
  bedrooms: optionalInt(0, 200),
  bathrooms: optionalInt(0, 200),
  yearBuilt: optionalInt(1900, 2100),
});

export const equipmentSchema = z.object({
  typeId: optionalText(40),
  name: requiredText('Nom de l’équipement', 80),
  location: optionalText(80),
  quantity: z.preprocess(
    (value) => (value === '' || value === undefined || value === null ? 1 : value),
    z.coerce.number().int().min(1).max(500),
  ),
  brand: optionalText(80),
  model: optionalText(80),
  installedAt: optionalDate,
  warrantyUntil: optionalDate,
  lastServiceAt: optionalDate,
  frequencyMonths: optionalInt(1, 120),
  notes: optionalText(1000),
});

export const taskSchema = z.object({
  title: requiredText('Intitulé', 120),
  equipmentId: optionalText(40),
  dueAt: requiredDate,
  frequencyMonths: optionalInt(1, 120),
  recommendation: optionalText(500),
});

export const requestSchema = z.object({
  idempotencyKey: z.string().trim().min(16).max(80),
  propertyId: z.string().trim().min(1, 'Choisissez un logement.').max(40),
  categoryId: z.string().trim().min(1, 'Choisissez une catégorie.').max(40),
  equipmentId: optionalText(40),
  maintenanceTaskId: optionalText(40),
  description: requiredText('Description', 2000, 10).refine((value) => value.length >= 10, {
    message: 'Décrivez le problème en quelques mots (10 caractères minimum).',
  }),
  kind: z.enum(['PLANNED', 'QUICK_REPAIR', 'EMERGENCY']),
  preferredDate: optionalDate,
  preferredSlot: optionalText(40),
  safetyAcknowledged: z.boolean(),
});

export const quoteSchema = z.object({
  lines: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(160),
        quantity: z.coerce.number().int().min(1).max(10_000),
        unitPrice: z.coerce.number().int().min(0).max(1_000_000_000),
      }),
    )
    .max(30),
  travelFee: z.coerce.number().int().min(0).default(0),
  diagnosticFee: z.coerce.number().int().min(0).default(0),
  laborAmount: z.coerce.number().int().min(0).default(0),
  otherFees: z.coerce.number().int().min(0).default(0),
  discountAmount: z.coerce.number().int().min(0).default(0),
  taxAmount: z.coerce.number().int().min(0).default(0),
  validityDays: z.coerce.number().int().min(1).max(90),
  conditions: optionalText(2000),
  exclusions: optionalText(2000),
  note: optionalText(2000),
});

export const appointmentSchema = z.object({
  type: z.enum(['DIAGNOSTIC', 'INTERVENTION']),
  date: requiredDate,
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure invalide.'),
  durationMinutes: z.coerce
    .number()
    .int()
    .min(15)
    .max(12 * 60),
  fee: z.coerce.number().int().min(0).max(1_000_000).default(0),
  note: optionalText(500),
});

export const reportSchema = z.object({
  diagnostic: requiredText('Diagnostic', 4000, 5),
  workDone: requiredText('Travaux effectués', 4000, 5),
  partsUsed: optionalText(2000),
  recommendations: optionalText(2000),
  durationMinutes: optionalInt(1, 10_000),
  nextMaintenanceAt: optionalDate,
});

const score = z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(5).optional());

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, 'Choisissez une note.').max(5),
  quality: score,
  punctuality: score,
  price: score,
  behaviour: score,
  comment: optionalText(1500),
});

export const providerSchema = z.object({
  name: requiredText('Nom', 120, 2),
  email: z.string().trim().toLowerCase().email('Adresse email invalide.').max(160),
  phone: phoneField,
  businessName: optionalText(120),
  specialties: z.array(z.string().max(60)).max(20),
  zones: z.array(z.string().trim().min(1).max(80)).max(40),
  workingHours: optionalText(200),
  indicativeRates: optionalText(500),
  bio: optionalText(1000),
});

export const providerSelfSchema = providerSchema.pick({
  businessName: true,
  workingHours: true,
  indicativeRates: true,
  bio: true,
  zones: true,
});

/** Convertit une erreur Zod en premier message lisible. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Données invalides.';
}

/** Combine une date (midi UTC) et une heure HH:MM en instant Dakar (UTC+0). */
export function combineDateTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hours, minutes, 0, 0),
  );
}

/** Découpe une liste saisie en texte libre (virgules ou retours à la ligne). */
export function splitList(value: string): string[] {
  return value
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 40);
}

/** Découpe un texte libre ligne par ligne (les virgules sont conservées). */
export function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 40);
}
