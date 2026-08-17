import 'server-only';

import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import {
  SETTING_DEFINITIONS,
  SETTING_DEFINITION_BY_KEY,
  SETTING_KEYS,
  type SettingDefinition,
} from './definitions';

export * from './definitions';

export interface SettingRecord {
  key: string;
  value: string;
  type: string;
  label: string | null;
  group: string;
  updatedAt: Date;
}

/** Lit tous les paramètres, complétés par les valeurs par défaut manquantes. */
export async function getAllSettings(): Promise<Map<string, string>> {
  const rows = await prisma.appSetting.findMany();
  const map = new Map<string, string>();
  SETTING_DEFINITIONS.forEach((definition) => map.set(definition.key, definition.defaultValue));
  rows.forEach((row) => map.set(row.key, row.value));
  return map;
}

async function readRaw(key: string): Promise<string> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (row) return row.value;
  return SETTING_DEFINITION_BY_KEY.get(key)?.defaultValue ?? '';
}

export async function getSettingString(key: string, fallback = ''): Promise<string> {
  const value = await readRaw(key);
  return value === '' ? fallback : value;
}

export async function getSettingInt(key: string, fallback: number): Promise<number> {
  const value = await readRaw(key);
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function getSettingBool(key: string, fallback = false): Promise<boolean> {
  const value = await readRaw(key);
  if (value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export async function getSettingList(key: string): Promise<string[]> {
  const value = await readRaw(key);
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string');
    }
  } catch {
    // Valeur non JSON : on retombe sur un découpage ligne à ligne.
    return value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }
  return [];
}

/** Pourcentage de fourchette, exprimé ×100 (1000 = 10 %). */
export async function getRangePercentage(): Promise<number> {
  return getSettingInt(SETTING_KEYS.RANGE_PERCENTAGE, 1000);
}

/** Prix du rapport Premium en FCFA entier. */
export async function getPremiumReportPrice(): Promise<number> {
  return getSettingInt(SETTING_KEYS.PREMIUM_REPORT_PRICE, env.payment.premiumReportPriceFallback);
}

export async function getReportDeliveryHours(): Promise<number> {
  return getSettingInt(SETTING_KEYS.REPORT_DELIVERY_HOURS, 48);
}

/** Coordonnées publiques utilisées dans les pages et emails. */
export interface CompanyContact {
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  legalInfo: string;
}

export async function getCompanyContact(): Promise<CompanyContact> {
  const settings = await getAllSettings();
  return {
    name: settings.get(SETTING_KEYS.COMPANY_NAME) || 'Kerplus.sn',
    email: settings.get(SETTING_KEYS.COMPANY_EMAIL) || '',
    phone: settings.get(SETTING_KEYS.COMPANY_PHONE) || '',
    whatsapp: settings.get(SETTING_KEYS.COMPANY_WHATSAPP) || '',
    address: settings.get(SETTING_KEYS.COMPANY_ADDRESS) || '',
    legalInfo: settings.get(SETTING_KEYS.COMPANY_LEGAL_INFO) || '',
  };
}

/** Écriture d'un paramètre (upsert). La validation est faite par l'appelant. */
export async function setSetting(key: string, value: string): Promise<void> {
  const definition: SettingDefinition | undefined = SETTING_DEFINITION_BY_KEY.get(key);
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: {
      key,
      value,
      type: definition?.type ?? 'STRING',
      label: definition?.label ?? key,
      group: definition?.group ?? 'general',
    },
  });
}
