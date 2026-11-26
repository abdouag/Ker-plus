import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { hasRole, requireAdmin } from '@/lib/auth/guard';
import { getCsrfToken } from '@/lib/security/csrf';
import { formatXOF } from '@/lib/format';
import {
  saveCategoryAction,
  saveEquipmentTypeAction,
  savePlanAction,
} from '@/app/admin/actions/care';
import { ActionForm } from '@/components/admin/ActionForm';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Alert, Badge } from '@/components/ui/Feedback';

export const metadata: Metadata = { title: 'Catalogue Kër Care' };
export const dynamic = 'force-dynamic';

const INPUT = 'mt-1 min-h-[44px] w-full rounded-xl border border-sand-300 bg-white px-3 text-sm';
const AREA = 'mt-1 w-full rounded-xl border border-sand-300 bg-white p-2 text-sm';

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-sm ${className ?? ''}`}>
      <span className="font-semibold text-forest-700">{label}</span>
      {children}
    </label>
  );
}

type CategoryValues = {
  name?: string;
  description?: string | null;
  services?: string[];
  zones?: string[];
  indicativePriceFrom?: number | null;
  active?: boolean;
  displayOrder?: number;
};

function CategoryFields({ values = {} }: { values?: CategoryValues }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="Nom">
        <input
          name="name"
          required
          maxLength={80}
          defaultValue={values.name ?? ''}
          className={INPUT}
        />
      </Field>
      <Field label="Prix indicatif « à partir de » (FCFA)">
        <input
          name="indicativePriceFrom"
          inputMode="numeric"
          defaultValue={values.indicativePriceFrom ?? ''}
          className={INPUT}
        />
      </Field>
      <Field label="Description" className="md:col-span-2">
        <input
          name="description"
          maxLength={500}
          defaultValue={values.description ?? ''}
          className={INPUT}
        />
      </Field>
      <Field label="Prestations (une par ligne)">
        <textarea
          name="services"
          rows={3}
          defaultValue={values.services?.join('\n') ?? ''}
          className={AREA}
        />
      </Field>
      <Field label="Communes couvertes (vide = toutes)">
        <textarea
          name="zones"
          rows={3}
          defaultValue={values.zones?.join(', ') ?? ''}
          className={AREA}
        />
      </Field>
      <Field label="Ordre d’affichage">
        <input
          name="displayOrder"
          type="number"
          defaultValue={values.displayOrder ?? 0}
          className={INPUT}
        />
      </Field>
      <label className="flex items-center gap-2 self-end text-sm font-semibold">
        <input
          type="checkbox"
          name="active"
          defaultChecked={values.active ?? true}
          className="h-4 w-4 accent-forest-600"
        />{' '}
        Active
      </label>
    </div>
  );
}

type TypeValues = {
  name?: string;
  categoryId?: string | null;
  defaultFrequencyMonths?: number | null;
  recommendation?: string | null;
  active?: boolean;
};

function TypeFields({
  values = {},
  categories,
}: {
  values?: TypeValues;
  categories: { id: string; name: string }[];
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="Nom">
        <input
          name="name"
          required
          maxLength={80}
          defaultValue={values.name ?? ''}
          className={INPUT}
        />
      </Field>
      <Field label="Catégorie de service">
        <select name="categoryId" defaultValue={values.categoryId ?? ''} className={INPUT}>
          <option value="">Aucune</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Fréquence indicative (mois, vide = aucun rappel)">
        <input
          name="defaultFrequencyMonths"
          type="number"
          min={1}
          max={120}
          defaultValue={values.defaultFrequencyMonths ?? ''}
          className={INPUT}
        />
      </Field>
      <label className="flex items-center gap-2 self-end text-sm font-semibold">
        <input
          type="checkbox"
          name="active"
          defaultChecked={values.active ?? true}
          className="h-4 w-4 accent-forest-600"
        />{' '}
        Actif
      </label>
      <Field label="Recommandation d’entretien" className="md:col-span-2">
        <input
          name="recommendation"
          maxLength={500}
          defaultValue={values.recommendation ?? ''}
          className={INPUT}
        />
      </Field>
    </div>
  );
}

export default async function CareCataloguePage() {
  const admin = await requireAdmin('/admin/ker-care/catalogue');
  const canEdit = hasRole(admin, 'ADMIN');
  const [categories, types, plans, csrfToken] = await Promise.all([
    prisma.careCategory.findMany({ orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] }),
    prisma.equipmentType.findMany({
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: { category: { select: { name: true } } },
    }),
    prisma.carePlan.findMany({ orderBy: { displayOrder: 'asc' } }),
    getCsrfToken(),
  ]);
  const categoryOptions = categories.map((category) => ({ id: category.id, name: category.name }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Catalogue Kër Care</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Catégories de services, règles d’entretien indicatives et offres. La commission et les
          autres réglages sont dans{' '}
          <Link href="/admin/parametres" className="font-semibold underline">
            Paramètres › Kër Care
          </Link>
          .
        </p>
      </div>
      {!canEdit ? (
        <Alert tone="neutral">
          Lecture seule : la modification du catalogue est réservée aux administrateurs.
        </Alert>
      ) : null}

      <Card as="section">
        <CardHeader
          title="Catégories de services"
          description="Aucun prix n’est présenté comme définitif avant validation d’un devis."
        />
        <CardBody className="space-y-2">
          {categories.map((category) => (
            <details key={category.id} className="rounded-xl border border-sand-200">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3">
                <span className="font-semibold">{category.name}</span>
                <Badge tone={category.active ? 'success' : 'neutral'}>
                  {category.active ? 'Active' : 'Inactive'}
                </Badge>
                <span className="text-sm text-ink-muted">
                  {category.indicativePriceFrom
                    ? `à partir de ${formatXOF(category.indicativePriceFrom)}`
                    : 'sans prix indicatif'}
                </span>
              </summary>
              <div className="border-t border-sand-200 p-4">
                {canEdit ? (
                  <ActionForm
                    action={saveCategoryAction}
                    csrfToken={csrfToken}
                    hidden={{ id: category.id }}
                    submitLabel="Enregistrer"
                  >
                    <CategoryFields values={category} />
                  </ActionForm>
                ) : (
                  <p className="text-sm text-ink-soft">{category.description}</p>
                )}
              </div>
            </details>
          ))}
          {canEdit ? (
            <details className="rounded-xl border border-dashed border-forest-300">
              <summary className="cursor-pointer px-4 py-3 font-semibold text-forest-700">
                Ajouter une catégorie
              </summary>
              <div className="border-t border-sand-200 p-4">
                <ActionForm
                  action={saveCategoryAction}
                  csrfToken={csrfToken}
                  submitLabel="Créer la catégorie"
                  variant="primary"
                >
                  <CategoryFields />
                </ActionForm>
              </div>
            </details>
          ) : null}
        </CardBody>
      </Card>

      <Card as="section">
        <CardHeader
          title="Types d’équipements et règles d’entretien"
          description="Fréquences indicatives, modifiables pour chaque équipement selon le fabricant ou le technicien."
        />
        <CardBody className="space-y-2">
          {types.map((type) => (
            <details key={type.id} className="rounded-xl border border-sand-200">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3">
                <span className="font-semibold">{type.name}</span>
                <span className="text-sm text-ink-muted">
                  {type.defaultFrequencyMonths
                    ? `tous les ${type.defaultFrequencyMonths} mois`
                    : 'pas de rappel'}
                  {type.category ? ` · ${type.category.name}` : ''}
                </span>
                {!type.active ? <Badge>Inactif</Badge> : null}
              </summary>
              <div className="border-t border-sand-200 p-4">
                {canEdit ? (
                  <ActionForm
                    action={saveEquipmentTypeAction}
                    csrfToken={csrfToken}
                    hidden={{ id: type.id }}
                    submitLabel="Enregistrer"
                  >
                    <TypeFields values={type} categories={categoryOptions} />
                  </ActionForm>
                ) : (
                  <p className="text-sm text-ink-soft">{type.recommendation ?? '—'}</p>
                )}
              </div>
            </details>
          ))}
          {canEdit ? (
            <details className="rounded-xl border border-dashed border-forest-300">
              <summary className="cursor-pointer px-4 py-3 font-semibold text-forest-700">
                Ajouter un type d’équipement
              </summary>
              <div className="border-t border-sand-200 p-4">
                <ActionForm
                  action={saveEquipmentTypeAction}
                  csrfToken={csrfToken}
                  submitLabel="Créer"
                  variant="primary"
                >
                  <TypeFields categories={categoryOptions} />
                </ActionForm>
              </div>
            </details>
          ) : null}
        </CardBody>
      </Card>

      <Card as="section">
        <CardHeader
          title="Offres d’abonnement (indicatives)"
          description="Hypothèses commerciales affichées « Offre indicative ». La souscription reste désactivée tant que le paiement et les règles contractuelles (quotas, zones, exclusions…) ne sont pas prêts."
        />
        <CardBody className="grid gap-4 md:grid-cols-2">
          {plans.map((plan) => (
            <div key={plan.id} className="rounded-xl border border-sand-200 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">
                  {plan.name} · {formatXOF(plan.monthlyPrice)} / mois
                </p>
                <Badge tone={plan.active ? 'success' : 'neutral'}>
                  {plan.active ? 'Affichée' : 'Masquée'}
                </Badge>
              </div>
              {canEdit ? (
                <ActionForm
                  action={savePlanAction}
                  csrfToken={csrfToken}
                  hidden={{ id: plan.id }}
                  submitLabel="Enregistrer"
                >
                  <div className="space-y-3">
                    <Field label="Nom">
                      <input
                        name="name"
                        required
                        maxLength={80}
                        defaultValue={plan.name}
                        className={INPUT}
                      />
                    </Field>
                    <Field label="Tarif mensuel indicatif (FCFA)">
                      <input
                        name="monthlyPrice"
                        inputMode="numeric"
                        defaultValue={plan.monthlyPrice}
                        className={INPUT}
                      />
                    </Field>
                    <Field label="Avantages (un par ligne)">
                      <textarea
                        name="benefits"
                        rows={4}
                        defaultValue={plan.benefits.join('\n')}
                        className={AREA}
                      />
                    </Field>
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <input
                        type="checkbox"
                        name="active"
                        defaultChecked={plan.active}
                        className="h-4 w-4 accent-forest-600"
                      />{' '}
                      Afficher sur le site
                    </label>
                  </div>
                </ActionForm>
              ) : (
                <ul className="list-disc pl-5 text-sm text-ink-soft">
                  {plan.benefits.map((benefit) => (
                    <li key={benefit}>{benefit}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
