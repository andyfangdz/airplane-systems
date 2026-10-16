/**
 * Mixture model shared by the C172S and C182T engine helpers (illustrative curves, not POH performance data): each
 * airplane's power, fuel-flow and EGT models in its `model.ts` and `tick.ts` build on these.
 */

/** Relative fuel/air (λ ≈ 1 at peak EGT): full rich gets richer with altitude. */
export const lambda = (mix: number, alt: number) => mix * 1.22 * (1 + Math.max(0, alt) / 25000);

/**
 * Power multiplier from mixture: best power at λ ≈ 1.12, rich of peak EGT (≈ 100 °F rich of peak in the C172S model;
 * ≈ 125 °F in the C182T POH Fig 4-4).
 */
export function mixPower(l: number) {
  if (l < 0.5) return 0;
  const p09 = 1 - 0.55 * (0.9 - 1.12) ** 2;
  return l < 0.9 ? p09 * ((l - 0.5) / 0.4) : 1 - 0.55 * (l - 1.12) ** 2;
}
