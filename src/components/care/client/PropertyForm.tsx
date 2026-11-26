'use client';

import type { Property } from '@prisma/client';
import { createPropertyAction, updatePropertyAction } from '@/app/ker-care/actions/client';
import { CareForm } from '@/components/care/CareForm';
import { SelectField, TextField } from '@/components/ui/Field';
import { PROPERTY_TYPE_LABELS } from '@/lib/care/constants';

type PropertyValues = Pick<
  Property,
  | 'id'
  | 'name'
  | 'type'
  | 'commune'
  | 'quartier'
  | 'landmark'
  | 'address'
  | 'surface'
  | 'levels'
  | 'bedrooms'
  | 'bathrooms'
  | 'yearBuilt'
>;

/** Création ou modification d'un logement. Seuls nom, type et commune sont requis. */
export function PropertyForm({
  csrfToken,
  property,
  returnTo,
}: {
  csrfToken: string;
  property?: PropertyValues;
  returnTo?: string;
}) {
  const editing = Boolean(property);
  const hidden: Record<string, string> = {};
  if (property) hidden.propertyId = property.id;
  if (returnTo) hidden.returnTo = returnTo;

  return (
    <CareForm
      action={editing ? updatePropertyAction : createPropertyAction}
      csrfToken={csrfToken}
      hidden={hidden}
      submitLabel={editing ? 'Enregistrer les modifications' : 'Ajouter ce logement'}
      variant={editing ? 'secondary' : 'primary'}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Nom du logement"
          name="name"
          required
          maxLength={80}
          placeholder="Maison de Ouakam"
          defaultValue={property?.name ?? ''}
        />
        <SelectField label="Type" name="type" required defaultValue={property?.type ?? 'MAISON'}>
          {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Commune"
          name="commune"
          required
          maxLength={80}
          placeholder="Dakar, Pikine, Rufisque…"
          defaultValue={property?.commune ?? ''}
        />
        <TextField
          label="Quartier"
          name="quartier"
          maxLength={80}
          placeholder="Ouakam, Cité Keur Gorgui…"
          defaultValue={property?.quartier ?? ''}
        />
        <TextField
          label="Point de repère"
          name="landmark"
          maxLength={160}
          hint="Communiqué au prestataire uniquement après acceptation de la mission."
          placeholder="Près de la mosquée, portail vert"
          defaultValue={property?.landmark ?? ''}
          containerClassName="sm:col-span-2"
        />
        <TextField
          label="Adresse (facultatif)"
          name="address"
          maxLength={200}
          defaultValue={property?.address ?? ''}
          containerClassName="sm:col-span-2"
        />
      </div>

      <details className="rounded-xl border border-sand-200 bg-sand-50 px-4 py-3" open={editing}>
        <summary className="min-h-[44px] cursor-pointer content-center text-sm font-semibold text-forest-700">
          Caractéristiques (facultatif)
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <TextField
            label="Surface (m²)"
            name="surface"
            type="number"
            inputMode="numeric"
            min={5}
            max={100000}
            defaultValue={property?.surface ?? ''}
          />
          <TextField
            label="Niveaux"
            name="levels"
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            defaultValue={property?.levels ?? ''}
          />
          <TextField
            label="Chambres"
            name="bedrooms"
            type="number"
            inputMode="numeric"
            min={0}
            max={200}
            defaultValue={property?.bedrooms ?? ''}
          />
          <TextField
            label="Salles de bain"
            name="bathrooms"
            type="number"
            inputMode="numeric"
            min={0}
            max={200}
            defaultValue={property?.bathrooms ?? ''}
          />
          <TextField
            label="Année de construction"
            name="yearBuilt"
            type="number"
            inputMode="numeric"
            min={1900}
            max={2100}
            defaultValue={property?.yearBuilt ?? ''}
          />
        </div>
      </details>
    </CareForm>
  );
}
