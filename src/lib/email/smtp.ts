import 'server-only';

import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '@/lib/env';
import { maskSensitive } from '@/lib/security/request';
import type { EmailMessage, EmailProvider, EmailSendResult } from './types';

/** Envoi transactionnel via SMTP (compatible tout fournisseur : OVH, SES, Brevo…). */
export class SmtpEmailProvider implements EmailProvider {
  readonly id = 'smtp';

  private transporter: Transporter | null = null;

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;
    const { host, port, secure, user, password } = env.email.smtp;
    if (!host) {
      throw new Error('SMTP_HOST non configuré : impossible d’envoyer un email.');
    }
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass: password } : undefined,
    });
    return this.transporter;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      const info = await this.getTransporter().sendMail({
        from: env.email.from,
        to: message.to,
        cc: message.cc,
        replyTo: message.replyTo ?? env.email.replyTo ?? undefined,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments,
      });
      return { delivered: true, provider: this.id, messageId: info.messageId };
    } catch (error) {
      // Les identifiants SMTP ne doivent jamais apparaître dans les journaux.
      console.error('[email] échec SMTP', {
        to: maskSensitive(message.to),
        subject: message.subject,
        message: error instanceof Error ? error.message : 'erreur inconnue',
      });
      return {
        delivered: false,
        provider: this.id,
        error: 'Envoi SMTP impossible.',
      };
    }
  }
}
