import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { requireProviderPage } from '@/lib/auth/account-guard';
import { getCsrfToken } from '@/lib/security/csrf';
import { updateProviderProfileAction } from '@/app/ker-care/actions/provider';
import { CareForm } from '@/components/care/CareForm';
import { VerificationBadge } from '@/components/care/StatusBadge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Feedback';
import { TextAreaField, TextField } from '@/components/ui/Field';

export const metadata: Metadata = { title: 'Profil' };
export const dynamic = 'force-dynamic';

export default async function ProviderProfilePage() {
  const account = await requireProviderPage('/ker-care/prestataire/profil');
  const [profile, categories, csrfToken] = await Promise.all([
    prisma.providerProfile.findUniqueOrThrow({ where: { id: account.providerProfile.id } }),
    prisma.careCategory.findMany({ select: { slug: true, name: true } }),
    getCsrfToken(),
  ]);
  const categoryNames = new Map(categories.map((category) => [category.slug, category.name]));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold text-forest-700">Mon profil</h1>

      <Card as="section">
        <CardHeader
          title="Spécialités et vérification"
          description="Gérées par Kerplus. Contactez-nous pour les faire évoluer."
        />
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-forest-700">Statut :</span>
            <VerificationBadge status={profile.verificationStatus} />
          </div>
          <div className="flex flex-wrap gap-2">
            {profile.specialties.length ? (
              profile.specialties.map((slug) => (
                <Badge key={slug} tone="info">
                  {categoryNames.get(slug) ?? slug}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-ink-muted">Aucune spécialité renseignée.</p>
            )}
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase text-ink-muted">Email</dt>
              <dd>{account.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-ink-muted">Téléphone</dt>
              <dd>{account.phone}</dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <Card as="section">
        <CardHeader title="Informations professionnelles" />
        <CardBody>
          <CareForm
            action={updateProviderProfileAction}
            csrfToken={csrfToken}
            submitLabel="Enregistrer"
            fullWidthSubmit
          >
            <div className="space-y-3">
              <TextField
                label="Nom commercial"
                name="businessName"
                defaultValue={profile.businessName ?? ''}
                maxLength={120}
              />
              <TextAreaField
                label="Communes desservies"
                name="zones"
                hint="Séparées par des virgules ou des retours à la ligne."
                defaultValue={profile.zones.join(', ')}
                maxLength={2000}
              />
              <TextField
                label="Horaires de disponibilité"
                name="workingHours"
                defaultValue={profile.workingHours ?? ''}
                maxLength={200}
                placeholder="Lun–sam, 8 h – 18 h"
              />
              <TextAreaField
                label="Tarifs indicatifs"
                name="indicativeRates"
                defaultValue={profile.indicativeRates ?? ''}
                maxLength={500}
              />
              <TextAreaField
                label="Présentation"
                name="bio"
                defaultValue={profile.bio ?? ''}
                maxLength={1000}
              />
            </div>
          </CareForm>
        </CardBody>
      </Card>
    </div>
  );
}
