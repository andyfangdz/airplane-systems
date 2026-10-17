/** The matched SR20 G6 / SR22T G6 redundant display circuits.
 * Each installation supplies its own source and may override a published rating. Other circuits remain aircraft-specific.
 */
import { quantity, type SourceRef, type SourcedQuantity } from "@/lib/installation";

const CIRCUITS = {
  pfdA: { label: "PFD A", bus: "ess1" },
  pfdB: { label: "PFD B", bus: "main2" },
  mfdA: { label: "MFD A", bus: "main3" },
  mfdB: { label: "MFD B", bus: "main1" },
  standbyA: { label: "STDBY ATTD A", bus: "ess1" },
  standbyB: { label: "STDBY ATTD B", bus: "main1" },
} as const;
export type DisplayBreakerId = keyof typeof CIRCUITS;
export type DisplayBusId = (typeof CIRCUITS)[DisplayBreakerId]["bus"];
export type DisplayBreakers = {
  readonly [K in DisplayBreakerId]: (typeof CIRCUITS)[K] & { readonly rating: Readonly<SourcedQuantity<"A">> };
};
export function displayBreakers(
  source: SourceRef,
  ratings: Partial<Record<DisplayBreakerId, SourcedQuantity<"A">>> = {},
): DisplayBreakers {
  return Object.fromEntries(
    Object.entries(CIRCUITS).map(([id, circuit]) => [
      id,
      {
        ...circuit,
        rating: ratings[id as DisplayBreakerId] ?? quantity(5, "A", source),
      },
    ]),
  ) as DisplayBreakers;
}
export const DISPLAY_LOADS = {
  pfd: { label: "PFD", feeds: ["pfdA", "pfdB"] },
  mfd: { label: "MFD", feeds: ["mfdA", "mfdB"] },
  standby: { label: "MD302 standby", feeds: ["standbyA", "standbyB"] },
} as const;
export type DisplayLoadId = keyof typeof DISPLAY_LOADS;
export const DISPLAY_FEEDS = {
  pfdFeedA: { load: "pfd", breaker: "pfdA" },
  pfdFeedB: { load: "pfd", breaker: "pfdB" },
  mfdFeedA: { load: "mfd", breaker: "mfdA" },
  mfdFeedB: { load: "mfd", breaker: "mfdB" },
  standbyFeedA: { load: "standby", breaker: "standbyA" },
  standbyFeedB: { load: "standby", breaker: "standbyB" },
} as const;
export const DISPLAY_BUS_LABELS: Record<DisplayBusId, string> = {
  ess1: "ESS BUS 1",
  main1: "MAIN BUS 1",
  main2: "MAIN BUS 2",
  main3: "MAIN BUS 3",
};
export function displayBreakerPowered(
  id: DisplayBreakerId,
  breakers: DisplayBreakers,
  buses: Readonly<Record<DisplayBusId, number>>,
  pulled: Readonly<Record<string, boolean | undefined>>,
) {
  const breaker = breakers[id];
  return buses[breaker.bus] > 0 && !pulled[breaker.label];
}
export function displayPowered(
  id: DisplayLoadId,
  breakers: DisplayBreakers,
  buses: Readonly<Record<DisplayBusId, number>>,
  pulled: Readonly<Record<string, boolean | undefined>>,
) {
  return DISPLAY_LOADS[id].feeds.some((feed) => displayBreakerPowered(feed, breakers, buses, pulled));
}
