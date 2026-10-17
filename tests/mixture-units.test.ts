import { expect, test } from "vitest";
import { fuelEquivalenceRatio, mixPower } from "@/aircraft/cessna/engine";
import {
  excessAirFromFuelEquivalence,
  fuelEquivalenceFromExcessAir,
  excessAirRatio,
} from "@/engines/model/mixture-units";
import { AFR_STOICH } from "@/engines/model/mixture";

test("fuel equivalence φ and excess-air λ have reciprocal rich/lean meanings", () => {
  // Normalized mass-ratio definitions, independent of either model's illustrative power calibration.
  expect(excessAirRatio(AFR_STOICH, 1, AFR_STOICH)).toBe(1);
  expect(excessAirRatio(AFR_STOICH, 2, AFR_STOICH)).toBe(0.5);
  expect(excessAirFromFuelEquivalence(2)).toBe(0.5);
  expect(fuelEquivalenceFromExcessAir(0.5)).toBe(2);
  expect(excessAirFromFuelEquivalence(0)).toBe(Infinity);
  expect(fuelEquivalenceFromExcessAir(Infinity)).toBe(0);
});

test("Cessna illustrative mixture calibration keeps full-rich and best-power on the rich side", () => {
  const fullRich = fuelEquivalenceRatio(1, 0);
  expect(fullRich).toBe(1.22);
  expect(excessAirFromFuelEquivalence(fullRich)).toBeLessThan(1);
  expect(fuelEquivalenceRatio(1, 10000)).toBeGreaterThan(fullRich);
  expect(mixPower(1.12)).toBe(1);
  for (const phi of [0.5, 0.9, 1, 1.12, 1.22, 2])
    expect(fuelEquivalenceFromExcessAir(excessAirFromFuelEquivalence(phi))).toBeCloseTo(phi, 14);
});
