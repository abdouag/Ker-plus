import type { Metadata } from 'next';
import { randomUUID } from 'node:crypto';
import { requireClientPage } from '@/lib/auth/account-guard';
import { getCsrfToken } from '@/lib/security/csrf';
import { getSettingBool, getSettingString, SETTING_KEYS } from '@/lib/settings';
import { getOwnedTodoTask, getRequestFormData } from '@/lib/care/services/request-queries';
import { formatDateISO } from '@/lib/format';
import { NewRequestForm } from '@/components/care/requests/NewRequestForm';
import { Card, CardBody } from '@/components/ui/Card';
import { LinkButton } from '@/components/ui/Button';
import { Alert, EmptyState } from '@/components/ui/Feedback';

export const metadata: Metadata = {
  title: 'Signaler un problème — Kër Care',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

function param(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && /^[a-z0-9]{10,40}$/i.test(raw) ? raw : undefined;
}

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const account = await requireClientPage('/ker-care/mon-espace/demandes/nouvelle');
  const params = await searchParams;
  const [{ properties, categories }, enabled, emergencyText, csrfToken] = await Promise.all([
    getRequestFormData(account.id),
    getSettingBool(SETTING_KEYS.CARE_ENABLED, true),
    getSettingString(SETTING_KEYS.CARE_EMERGENCY_TEXT),
    getCsrfToken(),
  ]);

  const taskId = param(params.tache);
  const task = taskId ? await getOwnedTodoTask(account.id, taskId) : null;

  const requestedProperty = param(params.logement) ?? task?.propertyId;
  const propertyId = properties.some((item) => item.id === requestedProperty)
    ? requestedProperty
    : properties[0]?.id;
  const property = properties.find((item) => item.id === propertyId);
  const requestedEquipment = param(params.equipement) ?? task?.equipmentId ?? undefined;
  const equipmentId = property?.equipments.some((item) => item.id === requestedEquipment)
    ? requestedEquipment
    : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-700">Signaler un problème</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Quelques informations suffisent. Kerplus recherche ensuite un prestataire vérifié et vous
          tient informé à chaque étape.
        </p>
      </div>

      {!enabled ? (
        <Alert tone="warning" title="Demandes momentanément suspendues">
          Les nouvelles demandes d’intervention sont temporairement fermées. Contactez Kerplus
          directement pour toute urgence technique.
        </Alert>
      ) : properties.length === 0 ? (
        <EmptyState
          title="Ajoutez d’abord votre logement"
          description="Votre demande est rattachée à un logement : cela permet au prestataire de préparer son intervention et alimente le carnet de votre maison. Une commune suffit pour commencer."
          action={
            <LinkButton href="/ker-care/mon-espace/maisons/nouvelle?retour=demande">
              Ajouter mon logement
            </LinkButton>
          }
        />
      ) : (
        <Card>
          <CardBody>
            {task ? (
              <Alert tone="info" className="mb-5">
                Demande liée à l’entretien « {task.title} ». Il passera en « planifié » à l’envoi.
              </Alert>
            ) : null}
            <NewRequestForm
              csrfToken={csrfToken}
              idempotencyKey={randomUUID()}
              properties={properties.map((item) => ({
                id: item.id,
                name: item.name,
                commune: item.commune,
                equipments: item.equipments.map((eq) => ({
                  id: eq.id,
                  name: eq.name,
                  location: eq.location,
                })),
              }))}
              categories={categories}
              emergencyText={emergencyText}
              defaults={{
                propertyId,
                equipmentId,
                maintenanceTaskId: task?.id,
                taskTitle: task?.title,
              }}
              minDate={formatDateISO(new Date())}
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
