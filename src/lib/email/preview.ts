import 'server-only';

import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { EmailMessage, EmailProvider, EmailSendResult } from './types';

/**
 * Fournisseur « preview » : aucun email n'est réellement envoyé.
 * Chaque message est écrit dans storage/emails pour relecture pendant le
 * développement et les tests. C'est le mode par défaut, afin qu'aucune
 * configuration incomplète ne provoque d'envoi involontaire.
 */
export class PreviewEmailProvider implements EmailProvider {
  readonly id = 'preview';

  private readonly directory = resolve(process.cwd(), 'storage/emails');

  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      await mkdir(this.directory, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${stamp}-${randomUUID().slice(0, 8)}.html`;
      const path = join(this.directory, fileName);
      const header = [
        `<!-- À : ${message.to} -->`,
        `<!-- Sujet : ${message.subject} -->`,
        message.cc ? `<!-- Copie : ${message.cc} -->` : '',
      ]
        .filter(Boolean)
        .join('\n');
      await writeFile(path, `${header}\n${message.html}`, 'utf8');
      return { delivered: false, provider: this.id, previewPath: path };
    } catch (error) {
      return {
        delivered: false,
        provider: this.id,
        error: error instanceof Error ? error.message : 'écriture impossible',
      };
    }
  }
}
