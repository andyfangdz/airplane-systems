/** Oil remaining in the sump after accumulated leakage, US quarts. */
export const remainingOilQt = (oilQt: number, oilLossQt = 0) => Math.max(0, oilQt - oilLossQt);
