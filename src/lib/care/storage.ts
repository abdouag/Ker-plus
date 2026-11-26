import 'server-only';

import { randomBytes } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { CARE_UPLOAD } from './constants';
import { CareError } from './errors';

/**
 * Stockage privé des fichiers Kër Care (photos, plans, factures, garanties).
 *
 * Les fichiers sont écrits hors de `public/` sous un nom aléatoire et ne sont
 * servis que par la route /ker-care/fichiers/[id], après contrôle d'accès.
 * Le type réel est déterminé par la signature binaire du fichier, jamais par
 * l'extension ou le type déclaré par le navigateur.
 */

function storageRoot(): string {
  return resolve(process.cwd(), process.env.CARE_STORAGE_DIR || './storage/care');
}

function resolveKey(fileKey: string): string {
  if (!/^[A-Za-z0-9_-]+\.(jpg|png|webp|pdf)$/.test(fileKey)) {
    throw new CareError('Référence de fichier invalide.', 400);
  }
  return join(storageRoot(), fileKey);
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

/** Détecte le type MIME d'après la signature binaire. */
export function sniffMimeType(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    return 'application/pdf';
  }
  return null;
}

export interface ValidatedUpload {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}

/**
 * Valide un fichier téléversé. `allowed` restreint les types acceptés
 * (images seules pour les photos, images + PDF pour les documents).
 */
export async function validateUpload(
  file: File,
  allowed: readonly string[] = CARE_UPLOAD.documentTypes,
): Promise<ValidatedUpload> {
  if (file.size === 0) throw new CareError('Fichier vide.', 400);
  if (file.size > CARE_UPLOAD.maxBytes) {
    throw new CareError(
      `« ${file.name} » est trop volumineux (maximum ${Math.round(CARE_UPLOAD.maxBytes / (1024 * 1024))} Mo).`,
      413,
    );
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = sniffMimeType(buffer);
  if (!mimeType || !allowed.includes(mimeType)) {
    const formats = allowed.includes('application/pdf') ? 'JPEG, PNG, WebP ou PDF' : 'JPEG, PNG ou WebP';
    throw new CareError(`« ${file.name} » : format non accepté (${formats}).`, 415);
  }
  const fileName = (file.name || 'fichier').replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 120);
  return { buffer, mimeType, fileName };
}

/** Extrait les fichiers non vides d'un champ de formulaire multiple. */
export function readFiles(formData: FormData, name: string): File[] {
  const files = formData
    .getAll(name)
    .filter((value): value is File => typeof value === 'object' && value !== null && 'size' in value)
    .filter((file) => file.size > 0);
  if (files.length > CARE_UPLOAD.maxFilesPerSubmit) {
    throw new CareError(
      `Vous pouvez joindre au maximum ${CARE_UPLOAD.maxFilesPerSubmit} fichiers à la fois.`,
      400,
    );
  }
  return files;
}

export async function storeFile(upload: ValidatedUpload): Promise<string> {
  const fileKey = `${randomBytes(18).toString('base64url')}.${EXTENSIONS[upload.mimeType]}`;
  await mkdir(storageRoot(), { recursive: true });
  await writeFile(resolveKey(fileKey), upload.buffer, { mode: 0o600 });
  return fileKey;
}

export async function readStoredFile(fileKey: string): Promise<Buffer | null> {
  try {
    return await readFile(resolveKey(fileKey));
  } catch {
    return null;
  }
}

export async function deleteStoredFile(fileKey: string): Promise<void> {
  try {
    await unlink(resolveKey(fileKey));
  } catch {
    // Fichier déjà absent : rien à faire.
  }
}
