import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { requireAdmin, hasRole } from '@/lib/auth/guard';
import { getCsrfToken } from '@/lib/security/csrf';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Feedback';
import { ActionForm } from '@/components/admin/ActionForm';
import { ReferentialSection } from '@/components/admin/ReferentialSection';
import {
  deleteReferentialAction,
  saveAppSettingsAction,
  saveCityZoneAction,
  saveFinishLevelAction,
  saveProjectTypeAction,
} from '@/app/admin/actions/settings';
import {
  getAllSettings,
  SETTING_DEFINITIONS,
  SETTING_GROUP_LABELS,
  type SettingGroup,
} from '@/lib/settings';

export const metadata: Metadata = { title: 'Paramètres' };
export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const admin = await requireAdmin('/admin/parametres');
  const csrfToken = await getCsrfToken();
  const canEdit = hasRole(admin, 'ADMIN');

  const [projectTypes, cityZones, finishLevels, settings] = await Promise.all([
    prisma.projectType.findMany({
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { simulations: true } } },
    }),
    prisma.cityZone.findMany({
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { simulations: true } } },
    }),
    prisma.finishLevel.findMany({
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { simulations: true } } },
    }),
    getAllSettings(),
  ]);

  const groups = Object.keys(SETTING_GROUP_LABELS) as SettingGroup[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Paramètres</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Prix, coefficients, textes et coordonnées. Toute modification s’applique aux nouvelles
          estimations : les simulations déjà enregistrées conservent leurs valeurs d’origine.
        </p>
      </div>

      {!canEdit ? (
        <Alert tone="warning" title="Lecture seule">
          Votre rôle ne permet pas de modifier les paramètres. Contactez un administrateur.
        </Alert>
      ) : null}

      <ReferentialSection
        title="Types de projets"
        description="Le coefficient multiplie l’estimation. 1,00 = référence."
        kind="projectType"
        csrfToken={csrfToken}
        saveAction={saveProjectTypeAction}
        deleteAction={deleteReferentialAction}
        valueLabel="Coefficient"
        valueKind="coefficient"
        withDescription
        rows={projectTypes.map((type) => ({
          id: type.id,
          name: type.name,
          description: type.description,
          coefficient: type.coefficient,
          active: type.active,
          displayOrder: type.displayOrder,
          usageCount: type._count.simulations,
        }))}
      />

      <ReferentialSection
        title="Villes et zones"
        description="Coefficient de localisation appliqué au prix au m²."
        kind="cityZone"
        csrfToken={csrfToken}
        saveAction={saveCityZoneAction}
        deleteAction={deleteReferentialAction}
        valueLabel="Coefficient"
        valueKind="coefficient"
        rows={cityZones.map((zone) => ({
          id: zone.id,
          name: zone.name,
          coefficient: zone.coefficient,
          active: zone.active,
          displayOrder: zone.displayOrder,
          usageCount: zone._count.simulations,
        }))}
      />

      <ReferentialSection
        title="Niveaux de finition"
        description="Prix de référence au mètre carré construit, en FCFA."
        kind="finishLevel"
        csrfToken={csrfToken}
        saveAction={saveFinishLevelAction}
        deleteAction={deleteReferentialAction}
        valueLabel="Prix au m² (FCFA)"
        valueKind="price"
        withDescription
        rows={finishLevels.map((level) => ({
          id: level.id,
          name: level.name,
          description: level.description,
          pricePerSquareMeter: level.pricePerSquareMeter,
          active: level.active,
          displayOrder: level.displayOrder,
          usageCount: level._count.simulations,
        }))}
      />

      <Card>
        <CardHeader
          title="Paramètres généraux"
          description="Offre, délais, coordonnées, textes affichés et paiement."
        />
        <CardBody>
          <ActionForm
            action={saveAppSettingsAction}
            csrfToken={csrfToken}
            submitLabel="Enregistrer les paramètres"
            size="lg"
          >
            <div className="space-y-8">
              {groups.map((group) => {
                const definitions = SETTING_DEFINITIONS.filter(
                  (definition) => definition.group === group,
                );
                if (definitions.length === 0) return null;

                return (
                  <fieldset key={group}>
                    <legend className="text-sm font-bold uppercase tracking-wide text-forest-700">
                      {SETTING_GROUP_LABELS[group]}
                    </legend>
                    <div className="mt-3 grid gap-4 lg:grid-cols-2">
                      {definitions.map((definition) => {
                        const value = settings.get(definition.key) ?? definition.defaultValue;
                        const fieldId = `setting-${definition.key}`;
                        const isTextarea = definition.type === 'TEXT' || definition.type === 'JSON';
                        const textValue =
                          definition.type === 'JSON'
                            ? (() => {
                                try {
                                  const parsed: unknown = JSON.parse(value);
                                  return Array.isArray(parsed) ? parsed.join('\n') : value;
                                } catch {
                                  return value;
                                }
                              })()
                            : value;

                        return (
                          <div
                            key={definition.key}
                            className={isTextarea ? 'lg:col-span-2' : undefined}
                          >
                            <input type="hidden" name="settingKey" value={definition.key} />
                            <label
                              htmlFor={fieldId}
                              className="text-sm font-semibold text-forest-700"
                            >
                              {definition.label}
                            </label>
                            {definition.help ? (
                              <p className="mt-0.5 text-xs text-ink-muted">{definition.help}</p>
                            ) : null}

                            {definition.type === 'BOOLEAN' ? (
                              <label className="mt-1.5 flex items-center gap-2 text-sm">
                                <input
                                  id={fieldId}
                                  type="checkbox"
                                  name={`value:${definition.key}`}
                                  defaultChecked={value === 'true'}
                                  disabled={!canEdit}
                                  className="h-5 w-5 accent-forest-600"
                                />
                                Activé
                              </label>
                            ) : isTextarea ? (
                              <textarea
                                id={fieldId}
                                name={`value:${definition.key}`}
                                defaultValue={textValue}
                                rows={definition.type === 'JSON' ? 8 : 4}
                                disabled={!canEdit}
                                className="mt-1.5 w-full rounded-xl border border-sand-300 p-3 text-sm focus:border-forest-500"
                              />
                            ) : (
                              <input
                                id={fieldId}
                                name={`value:${definition.key}`}
                                defaultValue={value}
                                inputMode={definition.type === 'INTEGER' ? 'numeric' : undefined}
                                disabled={!canEdit}
                                className="mt-1.5 w-full rounded-xl border border-sand-300 px-3 py-2.5 text-sm focus:border-forest-500"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          </ActionForm>
        </CardBody>
      </Card>
    </div>
  );
}
