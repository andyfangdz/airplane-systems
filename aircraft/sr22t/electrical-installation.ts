/** SR22T G6 display circuits: only the matched family topology is shared with the SR20.
 * Sources, protection ratings and equipment options belong to this installation.
 */
import { defineInstallation, type EquipmentSpec } from "@/lib/installation";
import {
  displayBreakers,
  displayBreakerPowered,
  displayPowered,
  DISPLAY_FEEDS,
  DISPLAY_LOADS,
  type DisplayBreakerId,
  type DisplayBusId,
  type DisplayLoadId,
} from "../cirrus/display-feeds";
export { DISPLAY_FEEDS, DISPLAY_BUS_LABELS } from "../cirrus/display-feeds";
const source = { document: "poh", locator: "Figure 7-11, 7-52; 7-74; 7-95" } as const;
export const DISPLAY_BREAKERS = displayBreakers(source);
export const displayBreakerRow = (id: DisplayBreakerId): [string, number] => [
  DISPLAY_BREAKERS[id].label,
  DISPLAY_BREAKERS[id].rating.value,
];
export const displayFeedPowered = (
  id: DisplayBreakerId,
  buses: Readonly<Record<DisplayBusId, number>>,
  pulled: Readonly<Record<string, boolean | undefined>>,
) => displayBreakerPowered(id, DISPLAY_BREAKERS, buses, pulled);
export const displayLoadPowered = (
  id: DisplayLoadId,
  buses: Readonly<Record<DisplayBusId, number>>,
  pulled: Readonly<Record<string, boolean | undefined>>,
) => displayPowered(id, DISPLAY_BREAKERS, buses, pulled);
const equipment: Record<string, EquipmentSpec> = {};
for (const { bus } of Object.values(DISPLAY_BREAKERS))
  equipment[`bus.${bus}`] = { label: bus, ports: { power: "dc" }, source };
for (const [id, load] of Object.entries(DISPLAY_LOADS))
  equipment[id] = {
    label: load.label,
    ports: Object.fromEntries(load.feeds.map((feed) => [feed, "dc"])),
    source,
  };
export const DISPLAY_INSTALLATION = defineInstallation({
  id: "sr22t.g6.display-electrical",
  documents: {
    poh: {
      title: "SR22T POH 13772-007",
      edition: "13772-007, Section 7",
      applicability: "Modelled G6 Perspective+ installation",
    },
  },
  equipment,
  protection: Object.keys(DISPLAY_BREAKERS),
  facts: Object.fromEntries(Object.entries(DISPLAY_BREAKERS).map(([id, breaker]) => [id, breaker.rating])),
  connections: Object.fromEntries(
    Object.entries(DISPLAY_FEEDS).map(([id, feed]) => [
      id,
      {
        from: { equipment: `bus.${DISPLAY_BREAKERS[feed.breaker].bus}`, port: "power" },
        to: { equipment: feed.load, port: feed.breaker },
        protection: feed.breaker,
        source,
      },
    ]),
  ),
});
