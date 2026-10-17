/**
 * Combustion mixture conventions. λ is actual air/fuel divided by stoichiometric air/fuel; φ is its reciprocal,
 * actual fuel/air divided by stoichiometric fuel/air. Thus λ > 1 is lean while φ > 1 is rich. Keep these conversions
 * at kernel boundaries: the fleet's illustrative mixture curves use φ; the detailed engine kernel uses λ.
 * The helpers do not select a fuel's stoichiometric ratio or change any calibrated curve.
 */
export const excessAirFromFuelEquivalence = (phi: number) => 1 / phi;
export const fuelEquivalenceFromExcessAir = (lambda: number) => 1 / lambda;

/** Air and fuel must use the same mass (or mass-flow) unit; stoichiometricAirFuel is a mass ratio. */
export const excessAirRatio = (air: number, fuel: number, stoichiometricAirFuel: number) =>
  air / (fuel * stoichiometricAirFuel);
