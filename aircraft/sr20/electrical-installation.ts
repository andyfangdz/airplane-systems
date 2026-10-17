/** SR20 G6 installation: POH 11934-005 Reissue A, Section 7 Revision A1.
 * Pure source data and electrical projections; visual routing and simulation state live elsewhere. */
import { displayBreakers, DISPLAY_LOADS, DISPLAY_FEEDS } from "../cirrus/display-feeds";
export { DISPLAY_FEEDS } from "../cirrus/display-feeds";
import { defineInstallation, quantity, type EquipmentSpec, type SourceRef } from "@/lib/installation";

export const ELECTRICAL_DOCUMENTS = {
  poh: {
    title: "SR20 POH 11934-005",
    edition: "Reissue A / Section 7 Revision A1",
    applicability: "Early factory Perspective+ G6, serial 2220 or 2339–2900",
    url: "https://www.palomaraviation.com/pdf/sr20-g6-poh.pdf",
  },
  amm: {
    title: "SR20 AMM 12137-002",
    edition: "Reissue A / Revision A1",
    applicability: "Applicable early G6 installation",
  },
} as const;
const ref = (locator: string): SourceRef => ({ document: "poh", locator });
const circuits = ref("Figure 7-11; pp. 7-52–7-58, 7-95");
export const ELECTRICAL_FACTS = {
  alt1Voltage: quantity(27.7, "V", ref("7-49, 7-51")),
  alt2Voltage: quantity(28.7, "V", ref("7-49, 7-51")),
  alt1Rating: quantity(100, "A", ref("7-49")),
  alt2Rating: quantity(70, "A", ref("7-49")),
  bat1Voltage: quantity(24, "V", ref("7-49")),
  bat1Capacity: quantity(11, "Ah", ref("7-49")),
  bat2Voltage: quantity(24, "V", ref("7-49")),
  bat2Capacity: quantity(7, "Ah", ref("7-49")),
  interconnectFuse: quantity(80, "A", ref("7-51")),
  alt2Fuse: quantity(80, "A", ref("7-51 text"), {
    alternatives: [
      { value: 60, source: ref("Figure 7-10, 7-50") },
      { value: 60, source: { document: "amm", locator: "24-30 p. 1" } },
    ],
    decision: "This installation follows POH text; the schematic and AMM disagreement remains visible.",
  }),
} as const;

export const BUS_DEFINITIONS = {
  mdb1: { label: "MAIN DIST 1", source: "ALT 1 · BAT 1" },
  mdb2: { label: "MAIN DIST 2", source: "ALT 2 · diode from Main Dist Bus 1" },
  edb: { label: "ESS DIST", source: "Diode feeds from both main distribution buses and BAT 1" },
  ess1: { label: "ESS BUS 1", source: "Ess Dist Bus via ESSENTIAL POWER · BAT 2" },
  ess2: { label: "ESS BUS 2", source: "Ess Dist Bus (BAT 2 through ESS BUS 1)" },
  main1: { label: "MAIN BUS 1", source: "Main Dist Bus 2" },
  main2: { label: "MAIN BUS 2", source: "Main Dist Bus 2" },
  nonEss: { label: "NON ESS BUS", source: "Main Dist Bus 2" },
  avx: { label: "AVIONICS BUS", source: "MAIN BUS 1 via AVIONICS switch" },
  main3: { label: "MAIN BUS 3", source: "Main Dist Bus 1" },
  ac1: { label: "A/C BUS 1", source: "Main Dist Bus 1" },
  ac2: { label: "A/C BUS 2", source: "Main Dist Bus 1" },
  conv: { label: "CONV BUS", source: "BAT 1 direct, 5 A fuse" },
} as const;
export type BusId = keyof typeof BUS_DEFINITIONS;

const displayProtection = displayBreakers(circuits);
export const BREAKERS = {
  essentialPower: { label: "ESSENTIAL POWER", bus: "ess1", rating: undefined },
  pfdA: displayProtection.pfdA,
  adahrs1: { label: "ADAHRS 1", bus: "ess1", rating: quantity(5, "A", circuits) },
  com1: { label: "COM 1", bus: "ess1", rating: quantity(7.5, "A", circuits) },
  gia1: { label: "GPS NAV GIA 1", bus: "ess1", rating: quantity(5, "A", circuits) },
  standbyA: displayProtection.standbyA,
  bat2: { label: "BAT 2", bus: "ess1", rating: quantity(20, "A", circuits) },
  pitchTrim: { label: "PITCH TRIM", bus: "ess2", rating: quantity(2, "A", circuits) },
  rollTrim: { label: "ROLL TRIM", bus: "ess2", rating: quantity(2, "A", circuits) },
  stall: { label: "STALL WARNING", bus: "ess2", rating: quantity(2, "A", circuits) },
  eis: { label: "ENGINE INSTR", bus: "ess2", rating: quantity(3, "A", circuits) },
  alt2: { label: "ALT 2", bus: "ess2", rating: quantity(5, "A", circuits) },
  ice: { label: "ICE LIGHTS", bus: "main1", rating: undefined },
  mfdB: displayProtection.mfdB,
  standbyB: displayProtection.standbyB,
  keypads: { label: "KEYPADS / AP CTRL", bus: "main1", rating: quantity(5, "A", circuits) },
  cabinLights: { label: "CABIN LIGHTS", bus: "main1", rating: quantity(5, "A", circuits) },
  cabinAir: { label: "CABIN AIR CONTROL", bus: "main1", rating: quantity(2, "A", circuits) },
  fuelQty: { label: "FUEL QTY", bus: "main1", rating: quantity(5, "A", circuits) },
  apServos: { label: "AP SERVOS", bus: "main1", rating: undefined },
  avionics: { label: "AVIONICS", bus: "main1", rating: quantity(10, "A", circuits) },
  pfdB: displayProtection.pfdB,
  boost: { label: "FUEL PUMP", bus: "main2", rating: quantity(5, "A", circuits) },
  com2: { label: "COM 2", bus: "main2", rating: quantity(7.5, "A", circuits) },
  gia2: { label: "GPS NAV GIA 2", bus: "main2", rating: quantity(5, "A", circuits) },
  adahrs2: { label: "ADAHRS 2", bus: "main2", rating: quantity(5, "A", circuits) },
  fan2: { label: "AVIONICS FAN 2", bus: "main2", rating: quantity(5, "A", circuits) },
  flaps: { label: "FLAPS", bus: "nonEss", rating: quantity(10, "A", circuits) },
  pitot: { label: "PITOT HEAT", bus: "nonEss", rating: quantity(7.5, "A", circuits) },
  starter: { label: "STARTER", bus: "nonEss", rating: quantity(2, "A", circuits) },
  fan1: { label: "AVIONICS FAN 1", bus: "nonEss", rating: quantity(5, "A", circuits) },
  nav: { label: "NAV LIGHTS", bus: "nonEss", rating: undefined },
  strobe: { label: "STROBE LIGHTS", bus: "nonEss", rating: undefined },
  audio: { label: "AUDIO PANEL", bus: "avx", rating: quantity(5, "A", circuits) },
  transponder: { label: "XPONDER", bus: "avx", rating: quantity(2, "A", circuits) },
  weather: { label: "DATA LINK/WX", bus: "avx", rating: quantity(5, "A", circuits) },
  traffic: { label: "TRAFFIC", bus: "avx", rating: quantity(5, "A", circuits) },
  dme: { label: "DME/ADF", bus: "avx", rating: quantity(3, "A", circuits) },
  landing: { label: "LANDING LIGHTS", bus: "main3", rating: undefined },
  mfdA: displayProtection.mfdA,
  outlet: { label: "12V & USB", bus: "main3", rating: quantity(5, "A", circuits) },
  evs: { label: "EVS CAMERA", bus: "main3", rating: quantity(5, "A", circuits) },
  alt1: { label: "ALT 1", bus: "ac1", rating: quantity(5, "A", circuits) },
  acCondenser: { label: "A/C COND", bus: "ac1", rating: quantity(15, "A", circuits) },
  cabinFan: { label: "CABIN FAN", bus: "ac2", rating: quantity(15, "A", circuits) },
  acCompressor: { label: "A/C COMPR", bus: "ac2", rating: quantity(5, "A", circuits) },
  convenience: { label: "CONV LIGHTS", bus: "conv", rating: quantity(5, "A", circuits) },
} as const;
export type BreakerId = keyof typeof BREAKERS;
export type BreakerLabel = (typeof BREAKERS)[BreakerId]["label"];
export type BreakerState = Partial<Record<BreakerLabel, boolean>>;
export type BusVoltages = Readonly<Record<BusId, number>>;

const PANEL_BUS_ORDER = ["ess1", "ess2", "main1", "main2", "nonEss", "avx", "main3", "ac1", "ac2", "conv"] as const;
/** Panel data is a projection of the source-backed protection table. */
export const BUSES: [BusId, string, string, [string, number?][]][] = PANEL_BUS_ORDER.map((bus) => [
  bus,
  BUS_DEFINITIONS[bus].label,
  BUS_DEFINITIONS[bus].source,
  Object.values(BREAKERS)
    .filter((breaker) => breaker.bus === bus)
    .map((breaker) => [breaker.label, breaker.rating?.value]),
]);

/** This predicate is shared by the solver, meshes, diagrams and explanatory flows. */
export function breakerPowered(id: BreakerId, buses: BusVoltages, pulled: BreakerState) {
  const breaker = BREAKERS[id];
  return buses[breaker.bus] > 0 && !pulled[breaker.label];
}

export const LOADS = {
  pfd: DISPLAY_LOADS.pfd,
  mfd: DISPLAY_LOADS.mfd,
  standby: DISPLAY_LOADS.standby,
  mag1: { label: "MAG 1", feeds: ["pfdA"] },
  mag2: { label: "MAG 2", feeds: ["pfdB"], option: "dualAdahrs" },
  adahrs1: { label: "ADAHRS 1", feeds: ["adahrs1"] },
  com1: { label: "COM 1", feeds: ["com1"] },
  gia1: { label: "GPS NAV GIA 1", feeds: ["gia1"] },
  pitchTrim: { label: "PITCH TRIM", feeds: ["pitchTrim"] },
  rollTrim: { label: "ROLL TRIM", feeds: ["rollTrim"] },
  stall: { label: "STALL WARNING", feeds: ["stall"] },
  eis: { label: "ENGINE INSTR", feeds: ["eis"] },
  alt2: { label: "ALT 2", feeds: ["alt2"] },
  ice: { label: "ICE LIGHTS", feeds: ["ice"] },
  keypads: { label: "KEYPADS / AP CTRL", feeds: ["keypads"] },
  cabinLights: { label: "CABIN LIGHTS", feeds: ["cabinLights"] },
  cabinAir: { label: "CABIN AIR CONTROL", feeds: ["cabinAir"] },
  fuelQty: { label: "FUEL QTY", feeds: ["fuelQty"] },
  apServos: { label: "AP SERVOS", feeds: ["apServos"] },
  boost: { label: "FUEL PUMP", feeds: ["boost"] },
  com2: { label: "COM 2", feeds: ["com2"] },
  gia2: { label: "GPS NAV GIA 2", feeds: ["gia2"] },
  adahrs2: { label: "ADAHRS 2", feeds: ["adahrs2"], option: "dualAdahrs" },
  fan2: { label: "AVIONICS FAN 2", feeds: ["fan2"] },
  flaps: { label: "FLAPS", feeds: ["flaps"] },
  pitot: { label: "PITOT HEAT", feeds: ["pitot"] },
  starter: { label: "STARTER", feeds: ["starter"] },
  fan1: { label: "AVIONICS FAN 1", feeds: ["fan1"] },
  nav: { label: "NAV LIGHTS", feeds: ["nav"] },
  strobe: { label: "STROBE LIGHTS", feeds: ["strobe"] },
  audio: { label: "AUDIO PANEL", feeds: ["audio"] },
  transponder: { label: "XPONDER", feeds: ["transponder"] },
  weather: { label: "DATA LINK/WX", feeds: ["weather"] },
  traffic: { label: "TRAFFIC", feeds: ["traffic"] },
  dme: { label: "DME/ADF", feeds: ["dme"] },
  landing: { label: "LANDING LIGHTS", feeds: ["landing"] },
  outlet: { label: "12V & USB", feeds: ["outlet"] },
  evs: { label: "EVS CAMERA", feeds: ["evs"] },
  alt1: { label: "ALT 1", feeds: ["alt1"] },
  acCondenser: { label: "A/C COND", feeds: ["acCondenser"] },
  cabinFan: { label: "CABIN FAN", feeds: ["cabinFan"] },
  acCompressor: { label: "A/C COMPR", feeds: ["acCompressor"] },
  convenience: { label: "CONV LIGHTS", feeds: ["convenience"] },
} as const satisfies Record<string, { label: string; feeds: readonly BreakerId[]; option?: "dualAdahrs" }>;
export type LoadId = keyof typeof LOADS;
export interface ElectricalOptions {
  dualAdahrs: boolean;
}
export function loadFitted(id: LoadId, options: ElectricalOptions) {
  const load = LOADS[id];
  return !("option" in load) || options[load.option];
}
export function loadPowered(
  id: LoadId,
  buses: BusVoltages,
  pulled: BreakerState,
  options: ElectricalOptions = { dualAdahrs: true },
) {
  return loadFitted(id, options) && LOADS[id].feeds.some((feed) => breakerPowered(feed, buses, pulled));
}

/** Visual route keys are also connection IDs. Geometry supplies bends, never a second bus/protection assignment. */

export const AVIONICS_DATA_LINKS = {
  gia1Pfd: { from: "gia1", to: "pfd" },
  gia2Mfd: { from: "gia2", to: "mfd" },
  pfdMfd: { from: "pfd", to: "mfd" },
  adahrsPfd: { from: "adahrs1", to: "pfd" },
  adahrs2Mfd: { from: "adahrs2", to: "mfd" },
  magData: { from: "mag1", to: "adahrs1" },
  magData2: { from: "mag2", to: "adahrs2" },
  adahrs1Gia1: { from: "adahrs1", to: "gia1" },
  adahrs1Gia2: { from: "adahrs1", to: "gia2" },
  adahrs2Gia1: { from: "adahrs2", to: "gia1" },
  adahrs2Gia2: { from: "adahrs2", to: "gia2" },
  geaData1: { from: "eis", to: "gia1" },
  geaData2: { from: "eis", to: "gia2" },
} as const satisfies Record<string, { from: LoadId; to: LoadId }>;
export type AvionicsDataLinkId = keyof typeof AVIONICS_DATA_LINKS;
export function dataLinkFitted(id: AvionicsDataLinkId, options: ElectricalOptions) {
  const link = AVIONICS_DATA_LINKS[id];
  return loadFitted(link.from, options) && loadFitted(link.to, options);
}
export function dataLinkAvailable(id: AvionicsDataLinkId, available: (load: LoadId) => boolean) {
  const link = AVIONICS_DATA_LINKS[id];
  return available(link.from) && available(link.to);
}

const equipment: Record<string, EquipmentSpec> = {};
for (const [id, bus] of Object.entries(BUS_DEFINITIONS))
  equipment[`bus.${id}`] = { label: bus.label, ports: { power: "dc" }, source: circuits };
for (const [id, load] of Object.entries(LOADS))
  equipment[`load.${id}`] = {
    label: load.label,
    ports: { ...Object.fromEntries(load.feeds.map((feed) => [feed, "dc" as const])), data: "data" },
    source: circuits,
    ...("option" in load ? { option: load.option } : {}),
  };
const connections: Record<
  string,
  {
    from: { equipment: string; port: string };
    to: { equipment: string; port: string };
    protection?: BreakerId;
    source: SourceRef;
  }
> = {};
for (const [id, load] of Object.entries(LOADS))
  for (const breaker of load.feeds) {
    const display = Object.entries(DISPLAY_FEEDS).find(([, feed]) => feed.breaker === breaker && feed.load === id);
    connections[display?.[0] ?? `feed.${id}.${breaker}`] = {
      from: { equipment: `bus.${BREAKERS[breaker].bus}`, port: "power" },
      to: { equipment: `load.${id}`, port: breaker },
      protection: breaker,
      source: circuits,
    };
  }
for (const [id, link] of Object.entries(AVIONICS_DATA_LINKS))
  connections[id] = {
    from: { equipment: `load.${link.from}`, port: "data" },
    to: { equipment: `load.${link.to}`, port: "data" },
    source: ref("Figure 7-17, 7-74; 7-75–7-79"),
  };
export const ELECTRICAL_INSTALLATION = defineInstallation({
  id: "sr20-g6-electrical",
  documents: ELECTRICAL_DOCUMENTS,
  equipment,
  connections,
  protection: Object.keys(BREAKERS),
  facts: ELECTRICAL_FACTS,
});

export const DISTRIBUTION_GROUPS = {
  mdb1: ["main3", "ac1", "ac2"],
  mdb2: ["main1", "main2", "nonEss"],
} as const satisfies Record<"mdb1" | "mdb2", readonly BusId[]>;

/** Feed the panel buses from the same installation ancestry used by the diagram. */
export function distributionBranches(sources: Pick<BusVoltages, "mdb1" | "mdb2">) {
  type Branch = (typeof DISTRIBUTION_GROUPS)[keyof typeof DISTRIBUTION_GROUPS][number];
  const result = {} as Record<Branch, number>;
  for (const source of ["mdb1", "mdb2"] as const)
    for (const bus of DISTRIBUTION_GROUPS[source]) result[bus] = sources[source];
  return result;
}

export function connectionPowered(id: keyof typeof DISPLAY_FEEDS, buses: BusVoltages, pulled: BreakerState) {
  return breakerPowered(ELECTRICAL_INSTALLATION.connections[id].protection!, buses, pulled);
}

export const DISTRIBUTION_DIAGRAM = Object.freeze({
  mdb1: DISTRIBUTION_GROUPS.mdb1.map((bus) => BUS_DEFINITIONS[bus].label),
  mdb2: DISTRIBUTION_GROUPS.mdb2.map((bus) => BUS_DEFINITIONS[bus].label),
  interconnectAmps: ELECTRICAL_FACTS.interconnectFuse.value,
});
