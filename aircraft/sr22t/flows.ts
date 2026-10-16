/** Pipes, wires, ducts and cables with moving particles, plus the rules that drive them. */
import * as THREE from "three";
import { chanOfKey, type FlowSpec } from "@/lib/catalogue";
import { wingP } from "./geometry";
import { FLAP_DEG, acCompressorOn, live, type Elec, type Sim } from "./model";
import { FT, hotValveOpen, valveEnv } from "./parts";
import { CABLES } from "./rig";
import { flowList } from "./flow-builder";
import { ELECTRICAL_DEPTH_FLOWS, electricalDepthRates } from "./electrical-depth-flow";
import { FUEL_DEPTH_FLOWS, fuelDepthRates } from "./fuel-depth-flow";
import { ENGINE_DEPTH_FLOWS, engineDepthRates } from "./engine-depth-flow";
import { ENVIRONMENT_DEPTH_FLOWS, environmentDepthRates } from "./environment-depth-flow";
import { TURBO_OIL_DEPTH_FLOWS, turboOilDepthRates } from "./turbo-oil-depth-flow";
import { PITOT_DEPTH_FLOWS, pitotDepthRates } from "./pitot-depth-flow";
import { AVIONICS_DEPTH_FLOWS, avionicsDepthRates } from "./avionics-depth-flow";

const { F, flow } = flowList();

// control cables — laid out after POH Figures 7-1 / 7-2 / 7-3 (see ./rig.ts)
CABLES.forEach((c) =>
  flow(c.key, c.pts, ["controls"], {
    r: 0.005,
    size: 0.045,
    tension: 0.05,
    name: c.name,
    note: c.note,
    count: 18,
    chan: chanOfKey(c.key),
  }),
);
flow("flapPush", [[FT.x, FT.y, 0], [FT.x, FT.y, 0.9], wingP(1.2, 0.74, 0)], ["flaps"], {
  tube: false,
  pcolor: "#B9A3F0",
});
flow("flapPush2", [[FT.x, FT.y, 0], [FT.x, FT.y, -0.9], wingP(-1.2, 0.74, 0)], ["flaps"], {
  tube: false,
  pcolor: "#B9A3F0",
});

/** Every flow, in the order the sections were laid out (the scene draws them in this order). */
export const FLOWS: FlowSpec[] = [
  ...ELECTRICAL_DEPTH_FLOWS,
  ...FUEL_DEPTH_FLOWS,
  ...ENGINE_DEPTH_FLOWS,
  ...ENVIRONMENT_DEPTH_FLOWS,
  ...TURBO_OIL_DEPTH_FLOWS,
  ...PITOT_DEPTH_FLOWS,
  ...AVIONICS_DEPTH_FLOWS,
  ...F,
];
/** Stall warning by configuration (AMM 27-31 ¶A / ¶B, PDF 1032): pneumatic line without FIKI, transducer wiring with it. */
const PNEUMATIC_ONLY = new Set(["stall"]),
  FIKI_ONLY = new Set(["stallWire"]);
const FLOWS_STD = FLOWS.filter((f) => !FIKI_ONLY.has(f.key)),
  FLOWS_FIKI = FLOWS.filter((f) => !PNEUMATIC_ONLY.has(f.key));
/** The flows drawn for an airplane with (`fiki`) or without TKS ice protection; stable arrays, so the scene memo holds. */
export const flowsFor = (fiki: boolean) => (fiki ? FLOWS_FIKI : FLOWS_STD);

const CABIN_AIR = [
  "toMan",
  "fanDuct",
  "panelL",
  "panelR",
  "panelL2",
  "panelR2",
  "armL",
  "armR",
  "floorF",
  "floorF2",
  "floorR",
  "floorR2",
  "defrost",
  "defrost2",
  // the A/C evaporator's outlet and its recirculated inlet carry cabin air too
  "acEvapDuct",
  "acRecirc",
];
export const isCabinAir = (k: string) => CABIN_AIR.includes(k);

/** Particle speed multiplier per flow (0 = stopped; negative = reversed). */
export function flowRates(s: Sim, E: Elec): Record<string, number> {
  const R: Record<string, number> = Object.assign(
    {},
    electricalDepthRates(s, E),
    fuelDepthRates(s, E),
    engineDepthRates(s),
    turboOilDepthRates(s),
    environmentDepthRates(s, E),
    pitotDepthRates(s, E),
    avionicsDepthRates(s, E),
  );
  // each cable loop: one strand pays out while the other takes up
  R.elA = s.ctrl.pitch * 2;
  R.elB = -s.ctrl.pitch * 2;
  R.ailR = s.ctrl.roll * 2;
  R.ailL = -s.ctrl.roll * 2;
  R.ailBal = -s.ctrl.roll * 2;
  R.rudR = -s.ctrl.yaw * 2;
  R.rudL = s.ctrl.yaw * 2;
  const flapMoving = Math.abs(live.flapAng - FLAP_DEG[s.flaps.cmd]) > 0.2 && E.flapsPwr;
  R.flapPush = R.flapPush2 = flapMoving ? 1 : 0;
  return R;
}

/** Cabin-air colour follows the held hot-air valve (POH 13772-007 7-66); cooling needs the compressor (7-61). */
export function cabinAirColor(s: Sim, E: Elec, out: THREE.Color) {
  const env = valveEnv(s, E);
  if (acCompressorOn(s, E, env)) return out.set("#6EC9E6");
  return out.set("#5FC8F0").lerp(new THREE.Color("#FF7A3D"), hotValveOpen(env));
}
