'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { computeEstimation } from '@/lib/estimation/calculator';
import {
  SURFACE_DEFAULT,
  SURFACE_MAX,
  SURFACE_MIN,
  SURFACE_STEP,
  fromCoefficientInt,
} from '@/lib/estimation/constants';
import { formatDecimal, formatSurface, formatXOF } from '@/lib/format';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/client';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Feedback';
import { SelectField } from '@/components/ui/Field';
import { ResultCard } from './ResultCard';
import { DisclaimerPanel } from './DisclaimerPanel';
import { LeadForm } from './LeadForm';
import type { EstimatorReferentials, EstimatorTexts } from './types';

interface EstimatorAppProps {
  referentials: EstimatorReferentials;
  texts: EstimatorTexts;
}

interface PersistedSimulation {
  reference: string;
  signature: string;
}

function buildSignature(
  projectTypeId: string,
  surface: number,
  cityZoneId: string,
  finishLevelId: string,
) {
  return `${projectTypeId}|${surface}|${cityZoneId}|${finishLevelId}`;
}

export function EstimatorApp({ referentials, texts }: EstimatorAppProps) {
  const { projectTypes, cityZones, finishLevels, rangePercentage } = referentials;

  const [projectTypeId, setProjectTypeId] = useState(projectTypes[0]?.id ?? '');
  const [surface, setSurface] = useState(SURFACE_DEFAULT);
  const [surfaceText, setSurfaceText] = useState(String(SURFACE_DEFAULT));
  const [cityZoneId, setCityZoneId] = useState(cityZones[0]?.id ?? '');
  const [finishLevelId, setFinishLevelId] = useState(
    finishLevels[1]?.id ?? finishLevels[0]?.id ?? '',
  );

  const [simulation, setSimulation] = useState<PersistedSimulation | null>(null);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [startedTracked, setStartedTracked] = useState(false);
  const [createdAt, setCreatedAt] = useState<Date>(() => new Date());

  const leadFormRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const projectType = projectTypes.find((item) => item.id === projectTypeId) ?? projectTypes[0];
  const cityZone = cityZones.find((item) => item.id === cityZoneId) ?? cityZones[0];
  const finishLevel = finishLevels.find((item) => item.id === finishLevelId) ?? finishLevels[0];

  /** Calcul immédiat côté navigateur — le serveur recalcule systématiquement. */
  const result = useMemo(() => {
    if (!projectType || !cityZone || !finishLevel) return null;
    try {
      return computeEstimation({
        surface,
        pricePerSquareMeter: finishLevel.pricePerSquareMeter,
        cityCoefficient: cityZone.coefficient,
        projectCoefficient: projectType.coefficient,
        rangePercentage,
      });
    } catch {
      return null;
    }
  }, [projectType, cityZone, finishLevel, surface, rangePercentage]);

  useEffect(() => {
    trackEvent(ANALYTICS_EVENTS.estimatorViewed);
  }, []);

  const markStarted = useCallback(() => {
    if (startedTracked) return;
    setStartedTracked(true);
    trackEvent(ANALYTICS_EVENTS.estimatorStarted);
  }, [startedTracked]);

  const signature = buildSignature(projectTypeId, surface, cityZoneId, finishLevelId);

  /**
   * Enregistrement serveur de la simulation (anti-rebond 900 ms).
   * Le serveur recalcule les montants : la réponse fait autorité.
   */
  useEffect(() => {
    if (!projectTypeId || !cityZoneId || !finishLevelId) return;
    if (surface < SURFACE_MIN || surface > SURFACE_MAX) return;
    if (simulation?.signature === signature) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/estimation', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ projectTypeId, surface, cityZoneId, finishLevelId }),
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = (await response.json()) as { reference?: string };
        if (data.reference) {
          setSimulation({ reference: data.reference, signature });
          setCreatedAt(new Date());
          trackEvent(ANALYTICS_EVENTS.estimateCompleted, {
            surface,
            city: cityZone?.name ?? '',
            finish: finishLevel?.name ?? '',
          });
        }
      } catch {
        // Hors ligne ou requête annulée : l'affichage local reste disponible.
      }
    }, 900);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const handleSurfaceSlider = (value: number) => {
    markStarted();
    setSurface(value);
    setSurfaceText(String(value));
  };

  const handleSurfaceText = (value: string) => {
    markStarted();
    setSurfaceText(value);
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      setSurface(Math.min(SURFACE_MAX, Math.max(SURFACE_MIN, parsed)));
    }
  };

  const commitSurfaceText = () => {
    const parsed = Number.parseInt(surfaceText, 10);
    const next = Number.isFinite(parsed)
      ? Math.min(SURFACE_MAX, Math.max(SURFACE_MIN, parsed))
      : SURFACE_DEFAULT;
    setSurface(next);
    setSurfaceText(String(next));
  };

  const openLeadForm = () => {
    setShowLeadForm(true);
    trackEvent(ANALYTICS_EVENTS.checkoutStarted, { amount: texts.reportPrice });
    requestAnimationFrame(() => {
      leadFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const closeLeadForm = () => {
    setShowLeadForm(false);
    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  if (!projectType || !cityZone || !finishLevel || !result) {
    return (
      <Alert tone="danger" title="Estimateur indisponible">
        Les référentiels de calcul ne sont pas configurés. Contactez Kerplus.
      </Alert>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
      <Card as="section" className="overflow-hidden">
        <CardHeader
          title="Estimez le coût de votre construction"
          description="Quatre informations suffisent. Le résultat s’affiche immédiatement."
        />
        <CardBody className="space-y-8">
          {/* 1. Type de projet */}
          <fieldset>
            <legend className="text-sm font-semibold text-forest-700">
              1. Type de projet <span className="text-ember-500">*</span>
            </legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {projectTypes.map((option) => {
                const selected = option.id === projectTypeId;
                return (
                  <label
                    key={option.id}
                    className={`flex cursor-pointer flex-col gap-1 rounded-xl border-2 p-3 transition-colors ${
                      selected
                        ? 'border-forest-600 bg-forest-50'
                        : 'border-sand-200 bg-white hover:border-forest-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="projectType"
                        value={option.id}
                        checked={selected}
                        onChange={() => {
                          markStarted();
                          setProjectTypeId(option.id);
                        }}
                        className="h-4 w-4 accent-forest-600"
                      />
                      <span className="text-sm font-semibold text-forest-700">{option.name}</span>
                      <span className="ml-auto text-xs font-medium text-ink-muted">
                        ×{formatDecimal(fromCoefficientInt(option.coefficient))}
                      </span>
                    </span>
                    {option.description ? (
                      <span className="pl-6 text-xs leading-snug text-ink-muted">
                        {option.description}
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* 2. Surface */}
          <div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <label htmlFor="surface-number" className="text-sm font-semibold text-forest-700">
                  2. Surface construite totale <span className="text-ember-500">*</span>
                </label>
                <p id="surface-hint" className="mt-1 text-sm text-ink-muted">
                  Indiquez la surface construite totale, tous les niveaux compris.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="surface-number"
                  type="number"
                  inputMode="numeric"
                  min={SURFACE_MIN}
                  max={SURFACE_MAX}
                  step={SURFACE_STEP}
                  value={surfaceText}
                  onChange={(event) => handleSurfaceText(event.target.value)}
                  onBlur={commitSurfaceText}
                  aria-describedby="surface-hint"
                  className="w-24 rounded-xl border border-sand-300 px-3 py-2 text-right text-lg font-bold text-forest-700 focus:border-forest-500"
                />
                <span className="text-sm font-semibold text-ink-soft">m²</span>
              </div>
            </div>
            <input
              type="range"
              aria-label="Surface construite totale en mètres carrés"
              min={SURFACE_MIN}
              max={SURFACE_MAX}
              step={SURFACE_STEP}
              value={surface}
              onChange={(event) => handleSurfaceSlider(Number(event.target.value))}
              className="kp-range mt-4"
            />
            <div className="mt-1 flex justify-between text-xs text-ink-muted">
              <span>{formatSurface(SURFACE_MIN)}</span>
              <span>{formatSurface(SURFACE_MAX)}</span>
            </div>
          </div>

          {/* 3. Ville */}
          <SelectField
            label="3. Ville ou zone du projet"
            required
            value={cityZoneId}
            onChange={(event) => {
              markStarted();
              setCityZoneId(event.target.value);
            }}
            hint="Le coût de construction varie selon la localisation du chantier."
          >
            {cityZones.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </SelectField>

          {/* 4. Finition */}
          <fieldset>
            <legend className="text-sm font-semibold text-forest-700">
              4. Niveau de finition <span className="text-ember-500">*</span>
            </legend>
            <div className="mt-3 space-y-2">
              {finishLevels.map((option) => {
                const selected = option.id === finishLevelId;
                return (
                  <label
                    key={option.id}
                    className={`flex cursor-pointer gap-3 rounded-xl border-2 p-3 transition-colors ${
                      selected
                        ? 'border-forest-600 bg-forest-50'
                        : 'border-sand-200 bg-white hover:border-forest-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="finishLevel"
                      value={option.id}
                      checked={selected}
                      onChange={() => {
                        markStarted();
                        setFinishLevelId(option.id);
                      }}
                      className="mt-1 h-4 w-4 shrink-0 accent-forest-600"
                    />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-semibold text-forest-700">{option.name}</span>
                        <span className="text-sm font-bold text-ember-600">
                          {formatXOF(option.pricePerSquareMeter)}/m²
                        </span>
                      </span>
                      {option.description ? (
                        <span className="mt-0.5 block text-xs leading-snug text-ink-muted">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </CardBody>
      </Card>

      {/* Résultat */}
      <div ref={resultRef} className="space-y-4 lg:sticky lg:top-4">
        <ResultCard
          result={result}
          summary={{
            projectTypeName: projectType.name,
            cityName: cityZone.name,
            finishName: finishLevel.name,
            surface,
            createdAt,
            reference: simulation?.signature === signature ? simulation.reference : null,
          }}
        />

        {texts.orderEnabled ? (
          <div className="space-y-2">
            {!showLeadForm ? (
              <Button size="lg" fullWidth onClick={openLeadForm} data-testid="cta-report">
                Recevoir mon rapport détaillé – {formatXOF(texts.reportPrice)}
              </Button>
            ) : (
              <Button size="lg" variant="ghost" fullWidth onClick={closeLeadForm}>
                Modifier mon estimation
              </Button>
            )}
            <p className="text-center text-xs text-ink-muted">
              Rapport PDF livré sous {texts.deliveryHours} h après confirmation du paiement, suivi
              d’un appel conseil de {texts.callDurationMinutes} minutes.
            </p>
          </div>
        ) : (
          <Alert tone="neutral">
            La commande de rapport détaillé est momentanément indisponible.
          </Alert>
        )}
      </div>

      {/* Formulaire client */}
      <div ref={leadFormRef} className="lg:col-span-2">
        {showLeadForm ? (
          <LeadForm
            amount={texts.reportPrice}
            deliveryHours={texts.deliveryHours}
            estimation={{
              projectTypeId,
              surface,
              cityZoneId,
              finishLevelId,
              simulationReference:
                simulation?.signature === signature ? simulation.reference : undefined,
            }}
            defaultCity={cityZone.name}
            onCancel={closeLeadForm}
          />
        ) : null}
      </div>

      {/* Hypothèses, exclusions, avertissement */}
      <Card as="section" className="lg:col-span-2">
        <CardHeader title="Hypothèses, exclusions et avertissement" />
        <CardBody>
          <DisclaimerPanel
            disclaimer={texts.disclaimer}
            assumptions={texts.assumptions}
            exclusions={texts.exclusions}
            variationFactors={texts.variationFactors}
          />
        </CardBody>
      </Card>
    </div>
  );
}
