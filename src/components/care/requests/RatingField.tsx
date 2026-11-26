/**
 * Groupe de boutons radio 1 à 5, accessible au clavier (fieldset + legend).
 * Aucun JavaScript requis.
 */
export function RatingField({
  name,
  legend,
  required,
}: {
  name: string;
  legend: string;
  required?: boolean;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-forest-700">
        {legend}
        {required ? (
          <span className="text-ember-500" aria-hidden="true">
            {' '}
            *
          </span>
        ) : (
          <span className="font-normal text-ink-muted"> (facultatif)</span>
        )}
      </legend>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((value) => (
          <label key={value} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={value}
              required={required}
              className="peer sr-only"
            />
            <span
              className="inline-flex h-11 min-w-[44px] items-center justify-center rounded-xl border-2 border-sand-200 bg-white px-3 text-sm font-bold text-forest-700 transition-colors peer-checked:border-forest-600 peer-checked:bg-forest-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-ember-400"
              aria-hidden="true"
            >
              {value}
            </span>
            <span className="sr-only">{value} sur 5</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
