import 'server-only';

import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/** Longueur minimale imposée aux mots de passe administrateurs. */
export const PASSWORD_MIN_LENGTH = 12;

export interface PasswordCheck {
  valid: boolean;
  errors: string[];
}

export function checkPasswordStrength(password: string): PasswordCheck {
  const errors: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`);
  }
  if (!/[a-z]/.test(password)) errors.push('Ajoutez au moins une minuscule.');
  if (!/[A-Z]/.test(password)) errors.push('Ajoutez au moins une majuscule.');
  if (!/\d/.test(password)) errors.push('Ajoutez au moins un chiffre.');
  return { valid: errors.length === 0, errors };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}
