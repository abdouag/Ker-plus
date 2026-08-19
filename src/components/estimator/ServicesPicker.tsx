'use client';

import { listSelectableServices, type ServiceKey } from '@/lib/content/services';
import { SERVICE_ICONS } from '@/components/services/service-icons';
import { IconCheck } from '@/components/ui/icons';

/**
 * Étape « De quels services avez-vous besoin ? » du formulaire de commande.
 *
 * Sélection multiple facultative. L'option « conseillez-moi » est exclusive :
 * la cocher décoche les services, et inversement — côté serveur, toute
 * combinaison de clés valides reste acceptée.
 */
export function ServicesPicker({
  value,
  onChange,
}: {
  value: ServiceKey[];
  onChange: (next: ServiceKey[]) => void;
}) {
  const options = listSelectableServices();

  const toggle = (key: ServiceKey) => {
    if (value.includes(key)) {
      onChange(value.filter((item) => item !== key));
      return;
    }
    if (key === 'needs_guidance') {
      onChange(['needs_guidance']);
      return;
    }
    onChange([...value.filter((item) => item !== 'needs_guidance'), key]);
  };

  return (
    <fieldset>
      <legend className="text-sm font-semibold text-forest-700">
        De quels services avez-vous besoin ?
      </legend>
      <p className="mt-1 text-sm text-ink-muted">
        Facultatif — sélectionnez un ou plusieurs services : notre équipe en tiendra compte dans
        votre rapport et lors de l’appel conseil.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map((service) => {
          const selected = value.includes(service.key);
          const Icon = SERVICE_ICONS[service.icon];
          const guidance = service.key === 'needs_guidance';
          return (
            <label
              key={service.key}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-all duration-150 focus-within:ring-2 focus-within:ring-ember-500 focus-within:ring-offset-2 ${
                selected
                  ? 'border-forest-600 bg-forest-50 shadow-card'
                  : 'border-sand-200 bg-white hover:border-forest-300 hover:shadow-card'
              } ${guidance ? 'sm:col-span-2' : ''}`}
            >
              <span
                className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  selected ? 'bg-forest-600 text-white' : 'bg-sand-100 text-forest-600'
                }`}
              >
                <Icon width={19} height={19} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-forest-700">
                  {service.title}
                  {selected ? (
                    <IconCheck width={15} height={15} className="shrink-0 text-forest-600" />
                  ) : null}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-ink-muted">
                  {service.description}
                </span>
              </span>
              <input
                type="checkbox"
                name="requestedServices"
                value={service.key}
                checked={selected}
                onChange={() => toggle(service.key)}
                className="mt-1 h-4 w-4 shrink-0 accent-forest-600"
              />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
