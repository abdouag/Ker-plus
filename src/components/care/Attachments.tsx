import type { Attachment } from '@prisma/client';
import { ATTACHMENT_KIND_LABELS } from '@/lib/care/constants';
import { formatDate } from '@/lib/format';
import { IconFileText } from '@/components/ui/icons';

/**
 * Liste de fichiers privés. Les liens passent par /ker-care/fichiers/[id],
 * qui revérifie les droits à chaque téléchargement.
 */
export function AttachmentGrid({
  attachments,
  emptyLabel = 'Aucun fichier.',
}: {
  attachments: Pick<Attachment, 'id' | 'kind' | 'fileName' | 'mimeType' | 'title' | 'createdAt'>[];
  emptyLabel?: string;
}) {
  if (attachments.length === 0) return <p className="text-sm text-ink-muted">{emptyLabel}</p>;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {attachments.map((file) => {
        const href = `/ker-care/fichiers/${file.id}`;
        const isImage = file.mimeType.startsWith('image/');
        return (
          <li key={file.id} className="overflow-hidden rounded-xl border border-sand-200 bg-white">
            <a
              href={href}
              target="_blank"
              rel="noopener"
              className="block focus-visible:outline-offset-2"
            >
              {isImage ? (
                // Fichier privé servi après contrôle d'accès : pas d'optimisation next/image.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={href}
                  alt={file.title || `${ATTACHMENT_KIND_LABELS[file.kind]} — ${file.fileName}`}
                  loading="lazy"
                  className="aspect-[4/3] w-full bg-sand-100 object-cover"
                />
              ) : (
                <span className="flex aspect-[4/3] w-full items-center justify-center bg-sand-50 text-forest-600">
                  <IconFileText className="h-8 w-8" />
                </span>
              )}
              <span className="block px-2 py-1.5">
                <span className="block truncate text-xs font-semibold text-forest-700">
                  {file.title || file.fileName}
                </span>
                <span className="block text-[11px] text-ink-muted">
                  {ATTACHMENT_KIND_LABELS[file.kind]} · {formatDate(file.createdAt)}
                </span>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
