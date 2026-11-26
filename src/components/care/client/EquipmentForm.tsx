'use client';

import type { Equipment } from '@prisma/client';
import { createEquipmentAction, updateEquipmentAction } from '@/app/ker-care/actions/client';
import { CareForm } from '@/components/care/CareForm';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';

export interface EquipmentTypeOption {
  id: string;
  name: string;
  defaultFrequencyMonths: number | null;
}

function toInputDate(value: Date | null | undefined): string {
  return value ? value.toISOString().slice(0, 10) : '';
}

/** Ajout ou modification d'un équipement du logement. */
export function EquipmentForm({
  csrfToken,
  propertyId,
  types,
  equipment,
}: {
  csrfToken: string;
  propertyId: string;
  types: EquipmentTypeOption[];
  equipment?: Equipment;
}) {
  const editing = Boolean(equipment);
  const prefix = equipment ? `eq-${equipment.id}` : 'eq-new';
  return (
    <CareForm
      action={editing ? updateEquipmentAction : createEquipmentAction}
      csrfToken={csrfToken}
      hidden={editing ? { equipmentId: equipment!.id } : { propertyId }}
      submitLabel={editing ? 'Enregistrer' : 'Ajouter l’équipement'}
      variant={editing ? 'secondary' : 'primary'}
      size="sm"
      resetOnSuccess={!editing}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id={`${prefix}-type`}
          label="Type d’équipement"
          name="typeId"
          defaultValue={equipment?.typeId ?? ''}
        >
          <option value="">Autre / personnalisé</option>
          {types.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
              {type.defaultFrequencyMonths
                ? ` — entretien indicatif tous les ${type.defaultFrequencyMonths} mois`
                : ''}
            </option>
          ))}
        </SelectField>
        <TextField
          id={`${prefix}-name`}
          label="Nom"
          name="name"
          required
          maxLength={80}
          placeholder="Climatiseur chambre parents"
          defaultValue={equipment?.name ?? ''}
        />
        <TextField
          id={`${prefix}-location`}
          label="Emplacement"
          name="location"
          maxLength={80}
          placeholder="Chambre 1, toit…"
          defaultValue={equipment?.location ?? ''}
        />
        <TextField
          id={`${prefix}-quantity`}
          label="Quantité"
          name="quantity"
          type="number"
          inputMode="numeric"
          min={1}
          max={500}
          defaultValue={equipment?.quantity ?? 1}
        />
        <TextField
          id={`${prefix}-brand`}
          label="Marque"
          name="brand"
          maxLength={80}
          defaultValue={equipment?.brand ?? ''}
        />
        <TextField
          id={`${prefix}-model`}
          label="Modèle"
          name="model"
          maxLength={80}
          defaultValue={equipment?.model ?? ''}
        />
        <TextField
          id={`${prefix}-installed`}
          label="Date d’installation"
          name="installedAt"
          type="date"
          defaultValue={toInputDate(equipment?.installedAt)}
        />
        <TextField
          id={`${prefix}-warranty`}
          label="Garantie jusqu’au"
          name="warrantyUntil"
          type="date"
          defaultValue={toInputDate(equipment?.warrantyUntil)}
        />
        <TextField
          id={`${prefix}-service`}
          label="Dernier entretien"
          name="lastServiceAt"
          type="date"
          defaultValue={toInputDate(equipment?.lastServiceAt)}
        />
        <TextField
          id={`${prefix}-frequency`}
          label="Fréquence d’entretien (mois)"
          name="frequencyMonths"
          type="number"
          inputMode="numeric"
          min={1}
          max={120}
          hint="Facultatif. Remplace la fréquence indicative du type, selon le fabricant ou votre technicien."
          defaultValue={equipment?.frequencyMonths ?? ''}
        />
      </div>
      <TextAreaField
        id={`${prefix}-notes`}
        label="Notes"
        name="notes"
        maxLength={1000}
        defaultValue={equipment?.notes ?? ''}
      />
    </CareForm>
  );
}
