import { TextAreaField, TextField } from '@/components/ui/Field';

export interface ProviderFieldValues {
  name?: string;
  email?: string;
  phone?: string;
  businessName?: string | null;
  specialties?: string[];
  zones?: string[];
  workingHours?: string | null;
  indicativeRates?: string | null;
  bio?: string | null;
}

/** Champs communs aux formulaires de création et de modification d'un prestataire. */
export function ProviderFields({
  categories,
  values = {},
  idPrefix,
}: {
  categories: { slug: string; name: string }[];
  values?: ProviderFieldValues;
  idPrefix: string;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          id={`${idPrefix}-name`}
          label="Nom et prénom"
          name="name"
          required
          maxLength={120}
          defaultValue={values.name ?? ''}
        />
        <TextField
          id={`${idPrefix}-business`}
          label="Nom commercial"
          name="businessName"
          maxLength={120}
          defaultValue={values.businessName ?? ''}
        />
        <TextField
          id={`${idPrefix}-email`}
          label="Email"
          name="email"
          type="email"
          required
          maxLength={160}
          defaultValue={values.email ?? ''}
        />
        <TextField
          id={`${idPrefix}-phone`}
          label="Téléphone"
          name="phone"
          type="tel"
          required
          maxLength={40}
          defaultValue={values.phone ?? ''}
        />
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-forest-700">Spécialités</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {categories.map((category) => (
            <label key={category.slug} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="specialties"
                value={category.slug}
                defaultChecked={values.specialties?.includes(category.slug)}
                className="h-4 w-4 accent-forest-600"
              />
              {category.name}
            </label>
          ))}
        </div>
      </fieldset>
      <TextAreaField
        id={`${idPrefix}-zones`}
        label="Communes desservies"
        name="zones"
        hint="Séparées par des virgules ou des retours à la ligne. Vide = toutes zones."
        maxLength={2000}
        defaultValue={values.zones?.join(', ') ?? ''}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          id={`${idPrefix}-hours`}
          label="Horaires"
          name="workingHours"
          maxLength={200}
          defaultValue={values.workingHours ?? ''}
        />
        <TextField
          id={`${idPrefix}-rates`}
          label="Tarifs indicatifs"
          name="indicativeRates"
          maxLength={500}
          defaultValue={values.indicativeRates ?? ''}
        />
      </div>
      <TextAreaField
        id={`${idPrefix}-bio`}
        label="Présentation"
        name="bio"
        maxLength={1000}
        defaultValue={values.bio ?? ''}
      />
    </div>
  );
}
