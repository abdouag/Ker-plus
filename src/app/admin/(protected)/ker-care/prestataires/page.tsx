import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { hasRole, requireAdmin } from '@/lib/auth/guard';
import { getCsrfToken } from '@/lib/security/csrf';
import { listProviders, providerRatings } from '@/lib/care/services/accounts';
import { VERIFICATION_STATUS_LABELS } from '@/lib/care/constants';
import { formatDateTime } from '@/lib/format';
import {
  accountAdminAction,
  createProviderAction,
  setVerificationAction,
  updateProviderAction,
} from '@/app/admin/actions/care';
import { ActionForm } from '@/components/admin/ActionForm';
import { ProviderFields } from '@/components/care/admin/ProviderFields';
import { VerificationBadge } from '@/components/care/StatusBadge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge, EmptyState } from '@/components/ui/Feedback';

export const metadata: Metadata = { title: 'Prestataires Kër Care' };
export const dynamic = 'force-dynamic';

export default async function CareProvidersPage() {
  const admin = await requireAdmin('/admin/ker-care/prestataires');
  const canOperate = hasRole(admin, 'MANAGER');
  const isAdmin = hasRole(admin, 'ADMIN');
  const [providers, ratings, categories, csrfToken] = await Promise.all([
    listProviders(),
    providerRatings(),
    prisma.careCategory.findMany({
      orderBy: { displayOrder: 'asc' },
      select: { slug: true, name: true, active: true },
    }),
    getCsrfToken(),
  ]);
  const categoryNames = new Map(categories.map((category) => [category.slug, category.name]));
  // Les catégories inactives restent proposées pour ne pas perdre une spécialité existante.
  const categoryOptions = categories.map((category) => ({
    slug: category.slug,
    name: category.active ? category.name : `${category.name} (inactive)`,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Prestataires</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Un badge « Vérifié » n’est attribué qu’après contrôle de l’identité, du téléphone, des
          compétences et des références. Les notes de vérification restent internes.
        </p>
      </div>

      {canOperate ? (
        <Card as="section">
          <details>
            <summary className="cursor-pointer px-5 py-4 text-base font-bold text-forest-700">
              Ajouter un prestataire
            </summary>
            <CardBody className="border-t border-sand-200">
              <ActionForm
                action={createProviderAction}
                csrfToken={csrfToken}
                submitLabel="Créer le compte prestataire"
                variant="primary"
              >
                <ProviderFields categories={categoryOptions} idPrefix="new-provider" />
                <p className="mt-3 text-xs text-ink-muted">
                  Un mot de passe temporaire est généré et affiché une seule fois : transmettez-le
                  au prestataire par un canal sûr. Le compte démarre « vérification en attente ».
                </p>
              </ActionForm>
            </CardBody>
          </details>
        </Card>
      ) : null}

      <Card as="section">
        <CardHeader title={`${providers.length} prestataire(s)`} />
        <CardBody className="space-y-3">
          {providers.length === 0 ? (
            <EmptyState
              title="Aucun prestataire"
              description="Ajoutez un premier prestataire pour pouvoir affecter des demandes."
            />
          ) : (
            providers.map((provider) => {
              const rating = ratings.get(provider.id);
              return (
                <details key={provider.id} className="rounded-xl border border-sand-200 bg-white">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                    <span className="font-bold text-forest-700">
                      {provider.businessName || provider.account.name}
                    </span>
                    <VerificationBadge status={provider.verificationStatus} />
                    {!provider.account.active ? (
                      <Badge tone="danger">Compte désactivé</Badge>
                    ) : null}
                    <span className="text-sm text-ink-muted">
                      {provider.specialties
                        .map((slug) => categoryNames.get(slug) ?? slug)
                        .join(', ') || 'Aucune spécialité'}
                    </span>
                    <span className="text-sm text-ink-muted">
                      {provider._count.assignments} mission(s) ·{' '}
                      {rating
                        ? `${rating.average.toFixed(1).replace('.', ',')}/5 (${rating.count} avis)`
                        : 'aucun avis'}
                    </span>
                  </summary>
                  <div className="space-y-5 border-t border-sand-200 p-4">
                    <dl className="grid gap-2 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="text-xs font-semibold uppercase text-ink-muted">Contact</dt>
                        <dd>
                          {provider.account.name} · {provider.account.phone}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase text-ink-muted">Email</dt>
                        <dd className="break-all">{provider.account.email}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase text-ink-muted">
                          Dernière connexion
                        </dt>
                        <dd>{formatDateTime(provider.account.lastLoginAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase text-ink-muted">Zones</dt>
                        <dd>{provider.zones.join(', ') || 'Toutes'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase text-ink-muted">
                          Vérifié le
                        </dt>
                        <dd>{formatDateTime(provider.verifiedAt)}</dd>
                      </div>
                    </dl>

                    {canOperate ? (
                      <div className="grid gap-5 lg:grid-cols-2">
                        <ActionForm
                          action={setVerificationAction}
                          csrfToken={csrfToken}
                          hidden={{ providerId: provider.id }}
                          submitLabel="Enregistrer la vérification"
                          className="rounded-xl bg-sand-50 p-4"
                        >
                          <h3 className="mb-2 text-sm font-bold text-forest-700">Vérification</h3>
                          <label className="block text-sm">
                            <span className="font-semibold">Statut</span>
                            <select
                              name="status"
                              defaultValue={provider.verificationStatus}
                              className="mt-1 min-h-[44px] w-full rounded-xl border border-sand-300 bg-white px-3"
                            >
                              {Object.entries(VERIFICATION_STATUS_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="mt-3 block text-sm">
                            <span className="font-semibold">
                              Notes internes (pièces vérifiées, références…)
                            </span>
                            <textarea
                              name="notes"
                              rows={3}
                              maxLength={2000}
                              defaultValue={provider.verificationNotes ?? ''}
                              className="mt-1 w-full rounded-xl border border-sand-300 p-2"
                            />
                          </label>
                        </ActionForm>

                        {isAdmin ? (
                          <div className="space-y-3 rounded-xl bg-sand-50 p-4">
                            <h3 className="text-sm font-bold text-forest-700">Compte</h3>
                            <ActionForm
                              action={accountAdminAction}
                              csrfToken={csrfToken}
                              hidden={{
                                accountId: provider.account.id,
                                operation: provider.account.active ? 'deactivate' : 'activate',
                              }}
                              submitLabel={
                                provider.account.active
                                  ? 'Désactiver le compte'
                                  : 'Réactiver le compte'
                              }
                              variant={provider.account.active ? 'danger' : 'secondary'}
                              size="sm"
                              confirmMessage={
                                provider.account.active
                                  ? 'Désactiver ce compte ? Le prestataire perdra immédiatement l’accès.'
                                  : undefined
                              }
                            />
                            <ActionForm
                              action={accountAdminAction}
                              csrfToken={csrfToken}
                              hidden={{
                                accountId: provider.account.id,
                                operation: 'reset-password',
                              }}
                              submitLabel="Générer un nouveau mot de passe"
                              variant="ghost"
                              size="sm"
                              confirmMessage="Remplacer le mot de passe actuel par un mot de passe temporaire ?"
                            />
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {canOperate ? (
                      <details>
                        <summary className="cursor-pointer text-sm font-semibold text-forest-600">
                          Modifier les informations
                        </summary>
                        <ActionForm
                          action={updateProviderAction}
                          csrfToken={csrfToken}
                          hidden={{ providerId: provider.id }}
                          submitLabel="Enregistrer"
                          className="mt-3"
                        >
                          <ProviderFields
                            categories={categoryOptions}
                            idPrefix={`provider-${provider.id}`}
                            values={{
                              name: provider.account.name,
                              email: provider.account.email,
                              phone: provider.account.phone,
                              businessName: provider.businessName,
                              specialties: provider.specialties,
                              zones: provider.zones,
                              workingHours: provider.workingHours,
                              indicativeRates: provider.indicativeRates,
                              bio: provider.bio,
                            }}
                          />
                        </ActionForm>
                      </details>
                    ) : null}
                  </div>
                </details>
              );
            })
          )}
        </CardBody>
      </Card>
    </div>
  );
}
