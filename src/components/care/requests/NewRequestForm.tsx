'use client';

import { useMemo, useState } from 'react';
import type { RequestKind } from '@prisma/client';
import { createRequestAction } from '@/app/ker-care/actions/client';
import { CareForm } from '@/components/care/CareForm';
import { CheckboxField, SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';
import {
  CARE_UPLOAD,
  PREFERRED_SLOTS,
  REQUEST_KIND_HINTS,
  REQUEST_KIND_LABELS,
} from '@/lib/care/constants';
import { formatXOF } from '@/lib/format';
import { cn } from '@/lib/cn';

export interface RequestFormProperty {
  id: string;
  name: string;
  commune: string;
  equipments: { id: string; name: string; location: string | null }[];
}

export interface RequestFormCategory {
  id: string;
  name: string;
  description: string | null;
  indicativePriceFrom: number | null;
}

const KINDS: RequestKind[] = ['PLANNED', 'QUICK_REPAIR', 'EMERGENCY'];

/**
 * Formulaire de signalement. La clé d'idempotence est fournie par la page
 * (une par affichage du formulaire) et reste identique en cas de double clic
 * ou de nouvel envoi après une erreur réseau : le serveur renvoie alors la
 * demande déjà créée au lieu d'en créer une seconde.
 */
export function NewRequestForm({
  csrfToken,
  idempotencyKey,
  properties,
  categories,
  emergencyText,
  defaults,
  minDate,
}: {
  csrfToken: string;
  idempotencyKey: string;
  properties: RequestFormProperty[];
  categories: RequestFormCategory[];
  emergencyText: string;
  defaults: {
    propertyId?: string;
    equipmentId?: string;
    maintenanceTaskId?: string;
    taskTitle?: string;
  };
  minDate: string;
}) {
  const [propertyId, setPropertyId] = useState(defaults.propertyId ?? properties[0]?.id ?? '');
  const [equipmentId, setEquipmentId] = useState(defaults.equipmentId ?? '');
  const [categoryId, setCategoryId] = useState('');
  const [kind, setKind] = useState<RequestKind>('QUICK_REPAIR');
  const [description, setDescription] = useState(
    defaults.taskTitle ? `Entretien prévu : ${defaults.taskTitle}.` : '',
  );
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredSlot, setPreferredSlot] = useState('');
  const [photoCount, setPhotoCount] = useState(0);
  const [photoError, setPhotoError] = useState('');

  const property = properties.find((item) => item.id === propertyId);
  const equipments = property?.equipments ?? [];
  const category = categories.find((item) => item.id === categoryId);
  const equipment = equipments.find((item) => item.id === equipmentId);
  const slotLabel = useMemo(
    () => PREFERRED_SLOTS.find((slot) => slot.value === preferredSlot)?.label,
    [preferredSlot],
  );

  function onPropertyChange(value: string) {
    setPropertyId(value);
    // L'équipement choisi appartient au logement précédent : on le réinitialise.
    setEquipmentId('');
  }

  function onPhotosChange(files: FileList | null) {
    const list = Array.from(files ?? []);
    setPhotoCount(list.length);
    if (list.length > CARE_UPLOAD.maxFilesPerSubmit) {
      setPhotoError(`${CARE_UPLOAD.maxFilesPerSubmit} photos maximum.`);
    } else if (list.some((file) => file.size > CARE_UPLOAD.maxBytes)) {
      setPhotoError('Une photo dépasse 5 Mo : choisissez une image plus légère.');
    } else {
      setPhotoError('');
    }
  }

  return (
    <CareForm
      action={createRequestAction}
      csrfToken={csrfToken}
      submitLabel="Confirmer et envoyer la demande"
      size="lg"
      fullWidthSubmit
      hidden={{
        idempotencyKey,
        ...(defaults.maintenanceTaskId ? { maintenanceTaskId: defaults.maintenanceTaskId } : {}),
      }}
      className="space-y-6"
    >
      {/* 1. Logement */}
      <fieldset className="space-y-4">
        <legend className="text-lg font-bold text-forest-700">1. Votre logement</legend>
        <SelectField
          label="Logement concerné"
          name="propertyId"
          required
          value={propertyId}
          onChange={(event) => onPropertyChange(event.target.value)}
        >
          {properties.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} — {item.commune}
            </option>
          ))}
        </SelectField>
        <p className="text-sm text-ink-muted">
          Un autre logement ?{' '}
          <a
            href="/ker-care/mon-espace/maisons/nouvelle?retour=demande"
            className="font-semibold text-forest-600 underline"
          >
            Ajouter un logement
          </a>
        </p>
      </fieldset>

      {/* 2. Problème */}
      <fieldset className="space-y-4">
        <legend className="text-lg font-bold text-forest-700">2. Le problème</legend>
        <SelectField
          label="Catégorie"
          name="categoryId"
          required
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          hint={category?.description ?? undefined}
        >
          <option value="">Choisissez une catégorie…</option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </SelectField>
        {category?.indicativePriceFrom ? (
          <p className="text-sm text-ink-soft">
            Prix indicatif : à partir de {formatXOF(category.indicativePriceFrom)}. Le montant
            définitif est fixé par le devis, que vous acceptez ou refusez.
          </p>
        ) : null}

        <SelectField
          label="Équipement concerné (facultatif)"
          name="equipmentId"
          value={equipmentId}
          onChange={(event) => setEquipmentId(event.target.value)}
          hint={
            equipments.length === 0 ? 'Aucun équipement enregistré pour ce logement.' : undefined
          }
          disabled={equipments.length === 0}
        >
          <option value="">Aucun en particulier</option>
          {equipments.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
              {item.location ? ` (${item.location})` : ''}
            </option>
          ))}
        </SelectField>

        <TextAreaField
          label="Description"
          name="description"
          required
          minLength={10}
          maxLength={2000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          hint="Que se passe-t-il ? Depuis quand ? Où exactement ?"
          placeholder="Ex. : le climatiseur du salon goutte depuis hier soir et ne refroidit plus."
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="photos" className="text-sm font-semibold text-forest-700">
            Photos (facultatif)
          </label>
          <p id="photos-hint" className="text-sm text-ink-muted">
            Jusqu’à {CARE_UPLOAD.maxFilesPerSubmit} photos JPEG, PNG ou WebP, 5 Mo maximum chacune.
            Visibles uniquement par vous, Kerplus et le prestataire affecté.
          </p>
          <input
            id="photos"
            name="photos"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            aria-describedby="photos-hint"
            onChange={(event) => onPhotosChange(event.target.files)}
            className="block w-full rounded-xl border border-sand-300 bg-white p-3 text-sm file:mr-3 file:min-h-[40px] file:rounded-lg file:border-0 file:bg-forest-50 file:px-3 file:font-semibold file:text-forest-700"
          />
          {photoError ? (
            <p role="alert" className="text-sm font-medium text-red-700">
              {photoError}
            </p>
          ) : null}
        </div>
      </fieldset>

      {/* 3. Urgence */}
      <fieldset className="space-y-3">
        <legend className="text-lg font-bold text-forest-700">3. Urgence ressentie</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {KINDS.map((value) => (
            <label
              key={value}
              className={cn(
                'flex min-h-[44px] cursor-pointer flex-col gap-1 rounded-xl border-2 p-3 transition-colors',
                kind === value
                  ? value === 'EMERGENCY'
                    ? 'border-red-500 bg-red-50'
                    : 'border-forest-500 bg-forest-50'
                  : 'border-sand-200 bg-white hover:border-sand-300',
              )}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="kind"
                  value={value}
                  checked={kind === value}
                  onChange={() => setKind(value)}
                  className="h-4 w-4 accent-forest-600"
                />
                <span className="text-sm font-bold text-forest-700">
                  {REQUEST_KIND_LABELS[value]}
                </span>
              </span>
              <span className="text-xs text-ink-muted">{REQUEST_KIND_HINTS[value]}</span>
            </label>
          ))}
        </div>

        {kind === 'EMERGENCY' ? (
          <Alert
            tone="danger"
            title="Danger immédiat : mettez-vous d’abord en sécurité"
            role="alert"
          >
            <p className="font-semibold">
              Kër Care n’est pas un service de secours et ne peut garantir aucun délai
              d’intervention.
            </p>
            <div className="mt-2 space-y-1">
              {emergencyText
                .split('\n')
                .filter(Boolean)
                .map((line) => (
                  <p key={line}>{line}</p>
                ))}
            </div>
            <div className="mt-3">
              <CheckboxField
                name="safetyAcknowledged"
                required
                label="J’ai lu ces consignes, je suis en sécurité et j’ai contacté les secours si nécessaire."
              />
            </div>
          </Alert>
        ) : null}
      </fieldset>

      {/* 4. Disponibilités */}
      <fieldset className="space-y-4">
        <legend className="text-lg font-bold text-forest-700">4. Vos disponibilités</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Date souhaitée (facultatif)"
            name="preferredDate"
            type="date"
            min={minDate}
            value={preferredDate}
            onChange={(event) => setPreferredDate(event.target.value)}
          />
          <SelectField
            label="Créneau souhaité"
            name="preferredSlot"
            value={preferredSlot}
            onChange={(event) => setPreferredSlot(event.target.value)}
          >
            <option value="">Non précisé</option>
            {PREFERRED_SLOTS.map((slot) => (
              <option key={slot.value} value={slot.value}>
                {slot.label}
              </option>
            ))}
          </SelectField>
        </div>
        <p className="text-sm text-ink-muted">
          Ces préférences guident la recherche d’un prestataire ; le rendez-vous vous sera proposé
          puis confirmé par vous.
        </p>
      </fieldset>

      {/* Récapitulatif avant envoi */}
      <section
        aria-labelledby="recapitulatif"
        className="rounded-2xl border border-forest-200 bg-forest-50 p-4"
      >
        <h2 id="recapitulatif" className="text-base font-bold text-forest-700">
          Récapitulatif avant envoi
        </h2>
        <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[160px_1fr]">
          <dt className="text-ink-muted">Logement</dt>
          <dd className="font-semibold">
            {property ? `${property.name} — ${property.commune}` : '—'}
          </dd>
          <dt className="text-ink-muted">Catégorie</dt>
          <dd className="font-semibold">{category?.name ?? 'À choisir'}</dd>
          <dt className="text-ink-muted">Équipement</dt>
          <dd>{equipment?.name ?? 'Aucun en particulier'}</dd>
          <dt className="text-ink-muted">Urgence</dt>
          <dd>{REQUEST_KIND_LABELS[kind]}</dd>
          <dt className="text-ink-muted">Disponibilité</dt>
          <dd>
            {preferredDate
              ? new Date(`${preferredDate}T12:00:00Z`).toLocaleDateString('fr-FR', {
                  dateStyle: 'long',
                  timeZone: 'Africa/Dakar',
                })
              : 'Date non précisée'}
            {slotLabel ? ` · ${slotLabel}` : ''}
          </dd>
          <dt className="text-ink-muted">Photos</dt>
          <dd>{photoCount > 0 ? `${photoCount} photo(s)` : 'Aucune'}</dd>
        </dl>
        <p className="mt-3 text-xs text-ink-muted">
          Après envoi, Kerplus recherche un prestataire vérifié. Aucun prix n’est définitif avant
          votre acceptation d’un devis.
        </p>
      </section>
    </CareForm>
  );
}
