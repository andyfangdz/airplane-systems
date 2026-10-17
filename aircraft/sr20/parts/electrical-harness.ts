/**
 * SR20 protection and schematic harness bundles; imports only earlier registered sections.
 * AMM 12137-002 24-50 pp. 2–3 defines relay/TVS hardware. Harness routes are illustrative,
 * not maintenance routing, wire gauges or installation dimensions.
 */
import { glowAnim } from "@/lib/anims";
import { toVec3, type Vec3 } from "@/lib/math";
import { box, cyl, tubeGeo, wingP } from "../geometry";
import { useSR20 } from "../store";
import { part } from "./catalogue";
import { MCU } from "./electrical";
import { ADAHRS_1, ADAHRS_2, GEA_71, GIA_1, MD302_POS, PFD_CONN, dualAdahrsFitted } from "./avionics";

const S = () => useSR20.getState();
export const BREAKER_FEED: Vec3 = [1.8, -0.42, -0.115];
export const AVIONICS_RELAYS: Vec3 = [1.64, -0.37, -0.11];
part(() => box(0.04, 0.03, 0.035), ["electrical"], {
  id: "parts.electrical-harness.avionics-master-relays.001",
  pos: AVIONICS_RELAYS,
  name: "Avionics master relays",
  note: "AVIONICS master energizes relays connecting the 10 A AVIONICS breaker on MAIN BUS 1 to the AVIONICS bus (POH 7-53, 7-56; AMM 24-50 p. 2). No documented installation coordinates: schematic location behind the breaker panel, approximate.",
  pin: true,
  anim: glowAnim("#7A8288", () => S().s.elec.avionics && S().E.main1 > 0 && !S().s.cb.AVIONICS, ["electrical"]),
});
const TVS_ROWS: [string, string, Vec3, boolean][] = [
  ["adahrs1", "ADAHRS 1 connector", [ADAHRS_1[0] + 0.04, ADAHRS_1[1] - 0.03, ADAHRS_1[2] - 0.045], false],
  ["adahrs2", "ADAHRS 2 connector", [ADAHRS_2[0] + 0.04, ADAHRS_2[1] - 0.03, ADAHRS_2[2] - 0.045], true],
  ["gia1", "GIA 1 connector", [GIA_1[0] + 0.12, GIA_1[1] - 0.06, GIA_1[2]], false],
  ["standby", "standby attitude connector", [MD302_POS[0] + 0.05, MD302_POS[1] - 0.035, MD302_POS[2]], false],
  ["pfdA", "PFD connector", [PFD_CONN[0] + 0.025, PFD_CONN[1] + 0.075, PFD_CONN[2] - 0.045], false],
  ["pfdB", "PFD connector", [PFD_CONN[0] + 0.025, PFD_CONN[1] + 0.075, PFD_CONN[2] + 0.045], false],
  ["breakerA", "circuit-breaker panel", [1.72, -0.36, -0.115], false],
  ["breakerB", "circuit-breaker panel", [1.77, -0.36, -0.115], false],
];
export const HARNESS_TVS: [string, Vec3, boolean][] = TVS_ROWS.map(([, where, pos, optional]) => [
  where,
  pos,
  optional,
]);
for (const [key, where, pos, optional] of TVS_ROWS)
  part(() => cyl(0.006, 0.022, "z"), ["electrical"], {
    id: "parts.electrical-harness.harness-tvs.002",
    instance: key,
    pos,
    color: "#2F3A44",
    name: "Harness TVS",
    note: `Transient-voltage suppressor integral to the harness at the ${where} (AMM 24-50 p. 3). Eight locations for dual-ADAHRS equipment: ADAHRS1/2, GIA1, standby attitude, two PFD and two breaker-panel connectors. Lightning-induced energy dissipates through a semiconductor path to ground (POH 7-52). Placement schematic.`,
    fitted: optional ? dualAdahrsFitted : undefined,
  });
for (const [key, dx] of [
  ["aft", -0.05],
  ["forward", 0.05],
] as const)
  part(() => cyl(0.012, 0.03, "z"), ["electrical"], {
    id: "parts.electrical-harness.console-transient-voltage-suppressor.003",
    instance: key,

    pos: [1.65 + dx, -0.42, 0.1],
    color: "#2F3A44",
    name: "Console transient voltage suppressor",
    note: "One of two TVS on the RH side of the center console (AMM 24-50 p. 3). Protects power entry points from induced lightning transients; position approximate.",
  });
part(() => box(0.14, 0.035, 0.1), ["electrical", "lighting"], {
  id: "parts.electrical-harness.convenience-system-controller.004",
  pos: [0.47, -0.58, 0.2],
  color: "#4B5860",
  name: "Convenience system controller",
  pin: true,
  note: "Under RH rear seat (POH Fig 7-20 item 15, 7-89). Controls cabin, entry-step and baggage convenience illumination from the constantly powered CONV bus/5 A CONV LIGHTS breaker (POH 7-61; AMM 24-50 Convenience System). Position approximate.",
});
const run = (key: string, name: string, pts: Vec3[], note: string) =>
  part(() => tubeGeo(pts, 0.006, 0.1), ["electrical"], {
    id: "parts.electrical-harness.part.005",
    instance: key,

    name,
    color: "#3E3A33",
    note: note + " Routing schematic; positions and bundle radius approximate.",
    pin: true,
  });
for (const side of [-1, 1] as const)
  run(
    `wing.${side}`,
    `Wing harness (${side < 0 ? "LH" : "RH"})`,
    [BREAKER_FEED, [1.56, -0.48, side * 0.35], ...[0.7, 1.2, 2, 3, 4, 4.6].map((z) => toVec3(wingP(side * z, 0.2, 0)))],
    "Circuit-breaker panel to wing electrical loads: lights, pitot heat, stall warning, magnetic/OAT sensors, fuel quantity and flaps (POH 7-49–7-61, 7-69–7-76). A bundle depicts the wiring group, not each pin-to-pin circuit.",
  );
run(
  "tail",
  "Tail harness",
  [
    BREAKER_FEED,
    [1.5, -0.49, -0.08],
    [1, -0.5, -0.12],
    [0.45, -0.49, -0.16],
    [0, -0.44, -0.2],
    [-0.48, -0.34, -0.25],
    [-0.75, -0.22, -0.18],
    [-1.2, -0.2, -0.08],
  ],
  "Breaker panel to empennage BAT2 and avionics bay behind FS222 (POH 7-49, 7-89). Individual data and power paths are shown separately.",
);
run(
  "engine-sensors",
  "Engine sensor harness (firewall → GEA)",
  [[2.6, -0.12, 0.38], [2.53, -0.06, 0.38], GEA_71],
  "Engine sensors through firewall to GEA71/71B behind MFD (POH 7-36–7-43, 7-79). No unverified harness part number is assigned.",
);
run(
  "bolster",
  "Bolster master switch wiring",
  [
    [2.23, -0.158, -0.36],
    [2.35, -0.24, -0.45],
    [2.55, -0.2, -0.45],
    [MCU[0] - 0.04, MCU[1] - 0.03, MCU[2] - 0.06],
  ],
  "BAT1/BAT2/ALT1/ALT2 master control wiring between bolster and MCU; AVIONICS controls its master relays (POH 7-55–7-56).",
);
