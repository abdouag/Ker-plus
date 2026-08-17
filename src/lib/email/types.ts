export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  cc?: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
}

export interface EmailSendResult {
  delivered: boolean;
  provider: string;
  /** Chemin du fichier de prévisualisation en mode développement. */
  previewPath?: string;
  messageId?: string;
  error?: string;
}

export interface EmailProvider {
  readonly id: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}
