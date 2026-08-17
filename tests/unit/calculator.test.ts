import { describe, expect, it } from 'vitest';
import {
  computeEstimation,
  EstimationError,
  validateEstimationInput,
} from '@/lib/estimation/calculator';
import {
  SURFACE_MAX,
  SURFACE_MIN,
  toCoefficientInt,
  toPercentageInt,
  fromCoefficientInt,
  fromPercentageInt,
} from '@/lib/estimation/constants';

const BASE = {
  surface: 150,
  pricePerSquareMeter: 200_000,
  cityCoefficient: toCoefficientInt(1.1),
  projectCoefficient: toCoefficientInt(1.1),
  rangePercentage: toPercentageInt(10),
};

describe('computeEstimation', () => {
  it('reproduit l’exemple de référence (150 m², Dakar, standard, villa duplex)', () => {
    const result = computeEstimation(BASE);
    expect(result.estimatedTotal).toBe(36_300_000);
    expect(result.estimatedMinimum).toBe(32_670_000);
    expect(result.estimatedMaximum).toBe(39_930_000);
  });

  it('applique chaque niveau de finition', () => {
    const cases: [number, number][] = [
      [160_000, 160_000 * 150],
      [200_000, 200_000 * 150],
      [280_000, 280_000 * 150],
    ];
    cases.forEach(([price, expected]) => {
      const result = computeEstimation({
        ...BASE,
        pricePerSquareMeter: price,
        cityCoefficient: toCoefficientInt(1),
        projectCoefficient: toCoefficientInt(1),
      });
      expect(result.estimatedTotal).toBe(expected);
    });
  });

  it('applique chaque coefficient de type de projet', () => {
    const coefficients = [1, 1.1, 1.15, 1.2, 1.25];
    coefficients.forEach((coefficient) => {
      const result = computeEstimation({
        ...BASE,
        cityCoefficient: toCoefficientInt(1),
        projectCoefficient: toCoefficientInt(coefficient),
      });
      expect(result.estimatedTotal).toBe(Math.round(150 * 200_000 * coefficient));
    });
  });

  it('applique chaque coefficient de ville', () => {
    const coefficients = [1.1, 1, 0.95, 0.9];
    coefficients.forEach((coefficient) => {
      const result = computeEstimation({
        ...BASE,
        projectCoefficient: toCoefficientInt(1),
        cityCoefficient: toCoefficientInt(coefficient),
      });
      expect(result.estimatedTotal).toBe(Math.round(150 * 200_000 * coefficient));
    });
  });

  it('le type de projet influence réellement le résultat', () => {
    const maison = computeEstimation({ ...BASE, projectCoefficient: toCoefficientInt(1) });
    const immeuble = computeEstimation({ ...BASE, projectCoefficient: toCoefficientInt(1.25) });
    expect(immeuble.estimatedTotal).toBeGreaterThan(maison.estimatedTotal);
    expect(immeuble.estimatedTotal / maison.estimatedTotal).toBeCloseTo(1.25, 5);
  });

  it('accepte les bornes de surface 80 et 500', () => {
    expect(computeEstimation({ ...BASE, surface: SURFACE_MIN }).estimatedTotal).toBe(
      Math.round(80 * 200_000 * 1.1 * 1.1),
    );
    expect(computeEstimation({ ...BASE, surface: SURFACE_MAX }).estimatedTotal).toBe(
      Math.round(500 * 200_000 * 1.1 * 1.1),
    );
  });

  it('rejette une surface hors bornes', () => {
    expect(() => computeEstimation({ ...BASE, surface: 79 })).toThrow(EstimationError);
    expect(() => computeEstimation({ ...BASE, surface: 501 })).toThrow(EstimationError);
    expect(() => computeEstimation({ ...BASE, surface: 0 })).toThrow(EstimationError);
    expect(() => computeEstimation({ ...BASE, surface: -150 })).toThrow(EstimationError);
  });

  it('rejette une surface non entière', () => {
    expect(() => computeEstimation({ ...BASE, surface: 150.5 })).toThrow(EstimationError);
    expect(() => computeEstimation({ ...BASE, surface: Number.NaN })).toThrow(EstimationError);
  });

  it('rejette des coefficients et prix hors bornes', () => {
    expect(() => computeEstimation({ ...BASE, cityCoefficient: 0 })).toThrow(EstimationError);
    expect(() => computeEstimation({ ...BASE, projectCoefficient: 99_999 })).toThrow(
      EstimationError,
    );
    expect(() => computeEstimation({ ...BASE, pricePerSquareMeter: 1 })).toThrow(EstimationError);
    expect(() => computeEstimation({ ...BASE, rangePercentage: -1 })).toThrow(EstimationError);
    expect(() => computeEstimation({ ...BASE, rangePercentage: 5_001 })).toThrow(EstimationError);
  });

  it('calcule la fourchette selon le pourcentage configuré', () => {
    const zero = computeEstimation({ ...BASE, rangePercentage: 0 });
    expect(zero.estimatedMinimum).toBe(zero.estimatedTotal);
    expect(zero.estimatedMaximum).toBe(zero.estimatedTotal);

    const fifteen = computeEstimation({ ...BASE, rangePercentage: toPercentageInt(15) });
    expect(fifteen.estimatedMinimum).toBe(Math.round(36_300_000 * 0.85));
    expect(fifteen.estimatedMaximum).toBe(Math.round(36_300_000 * 1.15));
  });

  it('retourne des entiers, sans décimale', () => {
    const result = computeEstimation({
      ...BASE,
      surface: 137,
      pricePerSquareMeter: 163_333,
      cityCoefficient: toCoefficientInt(0.95),
      projectCoefficient: toCoefficientInt(1.15),
      rangePercentage: toPercentageInt(7.5),
    });
    [result.estimatedTotal, result.estimatedMinimum, result.estimatedMaximum].forEach((value) => {
      expect(Number.isInteger(value)).toBe(true);
    });
  });

  it('arrondit au FCFA le plus proche (0,5 vers le haut)', () => {
    // 81 × 10 000 × 1,005 × 1,000 = 814 050 exactement.
    const exact = computeEstimation({
      surface: 81,
      pricePerSquareMeter: 10_000,
      cityCoefficient: 1005,
      projectCoefficient: 1000,
      rangePercentage: 0,
    });
    expect(exact.estimatedTotal).toBe(814_050);

    // Cas produisant une demi-unité : 1 234 567 × 0,5 % → arrondi supérieur.
    const half = computeEstimation({
      surface: 100,
      pricePerSquareMeter: 100_005,
      cityCoefficient: 1000,
      projectCoefficient: 1000,
      rangePercentage: 1,
    });
    expect(half.estimatedTotal).toBe(10_000_500);
    expect(half.estimatedMaximum).toBe(10_001_500);
  });

  it('reste exact sur les valeurs maximales (aucune perte de précision)', () => {
    const result = computeEstimation({
      surface: 500,
      pricePerSquareMeter: 5_000_000,
      cityCoefficient: 10_000,
      projectCoefficient: 10_000,
      rangePercentage: 5_000,
    });
    expect(result.estimatedTotal).toBe(250_000_000_000);
    expect(result.estimatedMinimum).toBe(125_000_000_000);
    expect(result.estimatedMaximum).toBe(375_000_000_000);
  });
});

describe('conversions d’échelle', () => {
  it('convertit coefficients et pourcentages sans dérive', () => {
    expect(toCoefficientInt(1.1)).toBe(1100);
    expect(fromCoefficientInt(1100)).toBeCloseTo(1.1, 10);
    expect(toPercentageInt(10)).toBe(1000);
    expect(fromPercentageInt(1000)).toBe(10);
  });
});

describe('validateEstimationInput', () => {
  it('nomme le champ fautif', () => {
    try {
      validateEstimationInput({ ...BASE, surface: 10 });
      expect.unreachable('une erreur était attendue');
    } catch (error) {
      expect(error).toBeInstanceOf(EstimationError);
      expect((error as EstimationError).field).toBe('surface');
    }
  });
});
