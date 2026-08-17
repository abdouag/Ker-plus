import 'server-only';

import { formatDate, formatXOF } from '@/lib/format';
import type { EmailMessage } from './types';

/** Échappement HTML — aucune donnée client n'est injectée telle quelle. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface LayoutOptions {
  title: string;
  preheader: string;
  bodyHtml: string;
  companyName: string;
  companyEmail: string;
}

function layout({ title, preheader, bodyHtml, companyName, companyEmail }: LayoutOptions): string {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#F5EFE6;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1B1B1B;">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5EFE6;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="background:#1A4D2E;padding:20px 24px;color:#FFFFFF;font-size:18px;font-weight:700;">
                ${escapeHtml(companyName)}
              </td>
            </tr>
            <tr>
              <td style="padding:24px;font-size:15px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;background:#F5EFE6;font-size:12px;color:#4A4A4A;line-height:1.5;">
                ${escapeHtml(companyName)}${companyEmail ? ` — ${escapeHtml(companyEmail)}` : ''}<br />
                Estimation indicative : ce message ne constitue ni un devis contractuel ni une étude technique.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function toText(lines: string[]): string {
  return lines.filter(Boolean).join('\n');
}

export interface OrderEmailContext {
  customerFirstName: string;
  customerEmail: string;
  orderReference: string;
  amount: number;
  paymentLabel: string;
  paymentInstructions: string;
  projectSummary: string;
  deliveryHours: number;
  companyName: string;
  companyEmail: string;
  orderUrl: string;
}

/** 1. Commande créée — paiement en attente. Aucun message de succès. */
export function buildOrderCreatedEmail(context: OrderEmailContext): EmailMessage {
  const bodyHtml = `
    <p>Bonjour ${escapeHtml(context.customerFirstName)},</p>
    <p>Votre commande de rapport technique détaillé a bien été enregistrée.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;border-collapse:collapse;">
      <tr><td style="padding:6px 0;color:#4A4A4A;">Numéro de commande</td><td style="padding:6px 0;font-weight:700;">${escapeHtml(context.orderReference)}</td></tr>
      <tr><td style="padding:6px 0;color:#4A4A4A;">Montant</td><td style="padding:6px 0;font-weight:700;">${escapeHtml(formatXOF(context.amount))}</td></tr>
      <tr><td style="padding:6px 0;color:#4A4A4A;">Moyen de paiement</td><td style="padding:6px 0;">${escapeHtml(context.paymentLabel)}</td></tr>
      <tr><td style="padding:6px 0;color:#4A4A4A;">Statut</td><td style="padding:6px 0;">Paiement en attente de vérification</td></tr>
      <tr><td style="padding:6px 0;color:#4A4A4A;">Projet</td><td style="padding:6px 0;">${escapeHtml(context.projectSummary)}</td></tr>
    </table>
    <p style="background:#F5EFE6;padding:12px 14px;border-radius:10px;">${escapeHtml(context.paymentInstructions)}</p>
    <p>Votre rapport vous sera transmis sous ${context.deliveryHours} heures <strong>après confirmation du paiement</strong>, suivi d’un appel conseil.</p>
    <p><a href="${escapeHtml(context.orderUrl)}" style="display:inline-block;background:#FF8C42;color:#1B1B1B;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:10px;">Suivre ma commande</a></p>
  `;

  return {
    to: context.customerEmail,
    subject: `Commande ${context.orderReference} enregistrée — paiement en attente`,
    html: layout({
      title: 'Commande enregistrée',
      preheader: `Commande ${context.orderReference} — paiement en attente`,
      bodyHtml,
      companyName: context.companyName,
      companyEmail: context.companyEmail,
    }),
    text: toText([
      `Bonjour ${context.customerFirstName},`,
      '',
      'Votre commande de rapport technique détaillé a bien été enregistrée.',
      `Numéro de commande : ${context.orderReference}`,
      `Montant : ${formatXOF(context.amount)}`,
      `Moyen de paiement : ${context.paymentLabel}`,
      'Statut : paiement en attente de vérification',
      `Projet : ${context.projectSummary}`,
      '',
      context.paymentInstructions,
      '',
      `Rapport livré sous ${context.deliveryHours} heures après confirmation du paiement.`,
      `Suivi de commande : ${context.orderUrl}`,
    ]),
  };
}

export interface PaymentConfirmedContext {
  customerFirstName: string;
  customerEmail: string;
  orderReference: string;
  amount: number;
  paidAt: Date;
  dueAt: Date | null;
  companyName: string;
  companyEmail: string;
  orderUrl: string;
}

/** 2. Paiement confirmé par le serveur (jamais par le navigateur). */
export function buildPaymentConfirmedEmail(context: PaymentConfirmedContext): EmailMessage {
  const bodyHtml = `
    <p>Bonjour ${escapeHtml(context.customerFirstName)},</p>
    <p>Nous confirmons la réception de votre paiement de <strong>${escapeHtml(formatXOF(context.amount))}</strong> pour la commande <strong>${escapeHtml(context.orderReference)}</strong>.</p>
    <p>Paiement vérifié le ${escapeHtml(formatDate(context.paidAt))}.</p>
    ${context.dueAt ? `<p>Votre rapport est en préparation et vous sera transmis au plus tard le ${escapeHtml(formatDate(context.dueAt))}.</p>` : ''}
    <p>Un appel conseil sera ensuite organisé avec notre équipe.</p>
    <p><a href="${escapeHtml(context.orderUrl)}" style="display:inline-block;background:#FF8C42;color:#1B1B1B;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:10px;">Voir ma commande</a></p>
  `;

  return {
    to: context.customerEmail,
    subject: `Paiement confirmé — commande ${context.orderReference}`,
    html: layout({
      title: 'Paiement confirmé',
      preheader: `Paiement confirmé pour la commande ${context.orderReference}`,
      bodyHtml,
      companyName: context.companyName,
      companyEmail: context.companyEmail,
    }),
    text: toText([
      `Bonjour ${context.customerFirstName},`,
      '',
      `Paiement de ${formatXOF(context.amount)} confirmé pour la commande ${context.orderReference}.`,
      `Vérifié le ${formatDate(context.paidAt)}.`,
      context.dueAt ? `Rapport transmis au plus tard le ${formatDate(context.dueAt)}.` : '',
      `Suivi de commande : ${context.orderUrl}`,
    ]),
  };
}

export interface ReportReadyContext {
  customerFirstName: string;
  customerEmail: string;
  orderReference: string;
  downloadUrl: string;
  expiresAt: Date | null;
  companyName: string;
  companyEmail: string;
}

/** 3. Rapport disponible — lien de téléchargement sécurisé et expirable. */
export function buildReportReadyEmail(context: ReportReadyContext): EmailMessage {
  const bodyHtml = `
    <p>Bonjour ${escapeHtml(context.customerFirstName)},</p>
    <p>Votre rapport technique détaillé (commande <strong>${escapeHtml(context.orderReference)}</strong>) est disponible.</p>
    <p><a href="${escapeHtml(context.downloadUrl)}" style="display:inline-block;background:#1A4D2E;color:#FFFFFF;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:10px;">Télécharger mon rapport (PDF)</a></p>
    ${context.expiresAt ? `<p style="font-size:13px;color:#4A4A4A;">Ce lien personnel expire le ${escapeHtml(formatDate(context.expiresAt))}. Ne le partagez pas.</p>` : ''}
    <p>Notre équipe vous contactera pour convenir de votre appel conseil.</p>
    <p style="font-size:13px;color:#4A4A4A;">Ce rapport est un document d’aide à la décision. Il doit être validé par un professionnel avant tout engagement de chantier.</p>
  `;

  return {
    to: context.customerEmail,
    subject: `Votre rapport Kerplus est disponible — ${context.orderReference}`,
    html: layout({
      title: 'Rapport disponible',
      preheader: `Rapport disponible pour la commande ${context.orderReference}`,
      bodyHtml,
      companyName: context.companyName,
      companyEmail: context.companyEmail,
    }),
    text: toText([
      `Bonjour ${context.customerFirstName},`,
      '',
      `Votre rapport (commande ${context.orderReference}) est disponible.`,
      `Lien de téléchargement : ${context.downloadUrl}`,
      context.expiresAt ? `Lien valable jusqu'au ${formatDate(context.expiresAt)}.` : '',
    ]),
  };
}
