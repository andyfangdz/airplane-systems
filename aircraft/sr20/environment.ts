import type { Elec, Sim } from "./model";

/** Effective cabin-air operation (POH 7-59; electrical supplies in Fig. 7-10).
 * Valve positions remain the selected positions; loss of power removes the blower and refrigeration.
 * Airflow magnitudes are illustrative. The SR20 has no flight-state model, so ram air is assumed while its engine runs.
 */
export function cabinOperation(s: Sim, E: Elec) {
  const { env } = s;
  const powered = (bus: "main1" | "ac1" | "ac2", breaker: string) => E[bus] > 0 && !s.cb[breaker];
  const controls = powered("main1", "CABIN AIR CONTROL");
  const blower = env.fan > 0 && controls && powered("ac2", "CABIN FAN");
  const selectedAc = env.ac && env.fan > 0;
  const selectedRecirc = env.recirc && selectedAc;
  const ac = selectedAc && blower && s.eng.running && powered("ac1", "A/C COND") && powered("ac2", "A/C COMPR");
  const recirc = selectedRecirc && blower;
  const air = env.fan < 0 ? 0 : blower ? 0.6 + env.fan * 0.4 : s.eng.running && !selectedRecirc ? 0.45 : 0;
  const hotValve = env.fan < 0 || selectedAc ? 0 : env.temp;
  const freshValve = env.fan < 0 || selectedRecirc ? 0 : 1 - env.temp;
  return {
    controls,
    blower,
    ac,
    recirc,
    air,
    hotValve,
    freshValve,
    fresh: air * freshValve,
    hot: s.eng.running ? air * hotValve : 0,
  };
}
