/** Pipes, wires, ducts, vacuum lines and the hydraulic circuit with moving particles, plus the rules that drive them. */
import * as THREE from "three";
import type { FlowSpec } from "@/lib/catalogue";
import { V, type Vec3 } from "@/lib/math";
import type { SysId } from "@/lib/systems";
import { FW, PANEL_X, botY, onSkin, wingP } from "./geometry";
import { fuelAvail, hornLevel, live, pcEngaged, type Elec, type Sim } from "./model";
import { CYLS, PITOT_Z, SEL, STAT_X, pitotBase } from "./parts";
import { FLAP_PUMP, SERVO } from "./rig";
import { EQUIPMENT, OVERHEAD, headlinerPoint } from "./placement";

const F: FlowSpec[] = [];
const flow = (key: string, pts: FlowSpec["pts"], sys: SysId[], o: Partial<FlowSpec> = {}) =>
  F.push({ key, pts, sys, ...o });
const P = (v: THREE.Vector3): Vec3 => [v.x, v.y, v.z];

/* ---------- fuel: tank → selector → boost pump → engine pump → carburetor (OM p. 3) ---------- */
const tankOut = (s: number) => wingP(s * 0.85, 0.3, -1).add(V(0, 0.03, 0));
flow("fuelL", [tankOut(-1), [1.1, -0.66, -0.4], SEL], ["fuel"], {
  name: "Left tank feed line",
  note: "Aluminium line from the left bay's lowest point to the selector valve (OM p. 3).",
});
flow("fuelR", [tankOut(1), [1.1, -0.66, 0.4], [1.2, -0.66, 0.0], SEL], ["fuel"], {
  name: "Right tank feed line",
  note: "Right bay → selector valve. One tank at a time — no BOTH.",
});
const BOOST: Vec3 = EQUIPMENT.boost,
  MECH: Vec3 = [2.3, -0.2, -0.16],
  CARB: Vec3 = EQUIPMENT.carburetor;
flow("fuelSel", [SEL, [1.55, -0.66, -0.25], BOOST], ["fuel"], {
  name: "Selector → boost pump",
  note: "Through the electric boost pump (it passes fuel when off).",
  r: 0.011,
});
flow("fuelFw", [BOOST, [FW + 0.02, -0.52, -0.2], [2.15, -0.35, -0.2], MECH], ["fuel", "engine"], {
  name: "Through the firewall → engine-driven pump",
  note: "Firewall fitting to the mechanical pump on the accessory case.",
  r: 0.011,
});
flow("fuelCarb", [MECH, [2.42, -0.3, -0.12], CARB], ["fuel", "engine"], {
  name: "Pump → carburetor",
  note: "Fuel pressure is read in this line, 0.5–6 psi (OM p. 29).",
  r: 0.01,
});
[1, -1].forEach((s) =>
  flow(
    "vent" + (s > 0 ? "R" : "L"),
    [P(wingP(s * 1.6, 0.25, 1)), P(wingP(s * 2.4, 0.3, 0)), P(wingP(s * 2.4, 0.3, -1).add(V(0, -0.04, 0)))],
    ["fuel"],
    {
      name: "Tank overflow vent",
      note: "Vents each tank and lets it overflow when full (OM p. 26).",
      r: 0.005,
      count: 4,
      pcolor: "#BFE3FF",
    },
  ),
);

/* ---------- induction, exhaust, oil ---------- */
const AIRBOX: Vec3 = EQUIPMENT.airbox,
  MUFF: Vec3 = EQUIPMENT.exhaust;
flow("intake", [[2.98, -0.2, 0.12], AIRBOX, CARB], ["engine"], {
  tube: false,
  pcolor: "#8FD3E8",
  size: 0.06,
  name: "Induction air",
});
flow("carbHot", [[2.5, -0.4, 0.1], AIRBOX, CARB], ["engine"], {
  tube: false,
  pcolor: "#F2C35A",
  size: 0.06,
  name: "Carburetor heat air",
});
CYLS.forEach((c) =>
  flow("man" + c.n, [CARB, [c.x, -0.2, c.s * 0.12], [c.x, -0.08, c.s * 0.26]], ["engine"], {
    r: 0.014,
    color: "#8A969E",
    pcolor: "#8FD3E8",
    count: 4,
    name: "Intake pipe",
    note: "Updraft carburetor → induction pipes under the sump to each intake port.",
  }),
);
CYLS.forEach((c) =>
  flow("exh" + c.n, [[c.x, -0.08, c.s * 0.33], [c.x, -0.3, c.s * 0.26], MUFF], ["engine"], {
    r: 0.015,
    color: "#8A5A3C",
    pcolor: "#FF8A4A",
    count: 4,
    name: "Exhaust riser",
    note: "Into the manifold / muffler under the engine; the optional EGT probe sits in a riser (OM p. 20).",
  }),
);
flow("tailpipe", [MUFF, [2.3, -0.45, 0.12], [2.15, botY(2.15) - 0.05, 0.16]], ["engine"], {
  r: 0.022,
  color: "#8A5A3C",
  pcolor: "#FF8A4A",
  name: "Exhaust tailpipe",
  note: "Out under the cowling on the right.",
  ext: true,
});
flow(
  "oil",
  [
    [2.58, -0.24, 0],
    [2.4, -0.12, -0.2],
    [2.55, -0.26, -0.3],
    [2.75, -0.05, -0.1],
    [2.6, 0.1, 0],
    [2.4, 0.06, 0],
  ],
  ["engine"],
  {
    r: 0.009,
    color: "#B85A2A",
    name: "Oil circuit",
    note: "Sump → pump → thermostatic bypass → oil cooler on the lower left cowl → galleries (OM p. 2; Ranger 2-6).",
  },
);
flow(
  "oilGov",
  [
    [2.7, 0.06, 0.04],
    [2.9, 0.08, 0.06],
    [3.0, 0.02, 0],
    [3.07, 0, 0],
  ],
  ["engine", "propeller"],
  {
    r: 0.008,
    color: "#B85A2A",
    name: "Governor oil to the hub",
    note: "The governor meters engine oil to the propeller hub to raise blade angle and hold RPM (OM p. 2).",
  },
);

/* ---------- cabin heat & ventilation (OM p. 10–11) ---------- */
const AIR = "#149C94",
  HOT = "#E0522B";
const JB: Vec3 = [FW - 0.1, -0.3, 0.35];
flow(
  "heatIn",
  [[2.95, -0.12, 0.13], [2.75, -0.3, 0.2], MUFF, [2.3, -0.42, 0.25], [FW + 0.05, -0.35, 0.33], JB],
  ["environment"],
  {
    r: 0.022,
    color: HOT,
    pcolor: "#FF7A3D",
    name: "Heat duct",
    note: "Ram air through the muff around the exhaust manifold, then a flexible duct through the firewall to the junction box (OM p. 10).",
  },
);
flow("ventIn", [P(onSkin(1.85, -0.1, 1, 0.96)), [1.85, -0.22, 0.42], JB], ["environment"], {
  r: 0.02,
  color: AIR,
  pcolor: "#5FC8F0",
  name: "Right scoop → junction box",
  note: "Cool air from the right flush scoop (OM p. 10). CABIN VENT control.",
});
flow("defrost", [JB, [PANEL_X + 0.15, 0.0, 0.2], [PANEL_X + 0.12, 0.22, 0.0]], ["environment"], {
  r: 0.018,
  color: AIR,
  name: "Defroster duct",
  note: "Junction box → windshield defroster outlets (OM p. 11).",
});
[1, -1].forEach((s) =>
  flow("feetF" + s, [JB, [1.72, -0.55, s * 0.3]], ["environment"], {
    r: 0.014,
    color: AIR,
    name: "Pilots' foot outlets",
  }),
);
flow("feetR", [JB, [1.3, -0.64, 0.2], [0.55, -0.6, 0.25]], ["environment"], {
  r: 0.014,
  color: AIR,
  name: "Rear passengers' feet",
  note: "No rear heat outlets on 1962 airplanes (supplement).",
});
flow("bag", [JB, [1.3, -0.64, 0.3], [-0.05, -0.56, 0.3]], ["environment"], {
  r: 0.012,
  color: AIR,
  name: "Baggage compartment outlet",
});
flow("radioGrill", [P(onSkin(1.85, -0.1, 1, 0.96)), [FW - 0.05, 0.05, 0.3], [FW - 0.05, 0.05, 0.0]], ["environment"], {
  r: 0.012,
  color: AIR,
  pcolor: "#5FC8F0",
  name: "Radio vent grill feed",
  note: "Right scoop → firewall grill ahead of the centre radio panel (OM p. 11).",
});
OVERHEAD.outlets.forEach((outlet, i) =>
  flow("ceil" + i, [OVERHEAD.inlet, headlinerPoint(outlet[0], outlet[2] * 0.5, 0.04), outlet], ["environment"], {
    r: 0.012,
    color: AIR,
    pcolor: "#5FC8F0",
    name: "Overhead scoop → ceiling outlet",
    note: "Four individually controlled ceiling outlets from the retractable overhead scoop (OM p. 11).",
  }),
);
flow("leftScoop", [P(onSkin(1.5, -0.2, -1, 0.96)), [1.5, -0.35, -0.48], [1.45, -0.4, -0.42]], ["environment"], {
  r: 0.012,
  color: AIR,
  pcolor: "#5FC8F0",
  name: "Left scoop → eyeball outlet",
  note: "One outlet by the pilot's knee plus two radio-cooling tubes (OM p. 11).",
});

/* ---------- pitot-static (Ranger 2-7) ---------- */
const ASI: Vec3 = [PANEL_X + 0.04, 0.05, -0.36];
flow(
  "pitot",
  [
    P(pitotBase.clone().add(V(0.0, 0.01, 0))),
    P(wingP(PITOT_Z, 0.35, 0)),
    P(wingP(-0.9, 0.35, 0)),
    [1.0, -0.6, -0.5],
    [PANEL_X + 0.1, -0.4, -0.45],
    ASI,
  ],
  ["pitot"],
  {
    r: 0.008,
    name: "Pitot line",
    note: "Inboard through the wing (drain at the root) and up behind the panel to the airspeed indicator.",
  },
);
flow("static", [P(V(STAT_X, -0.3, 0.17)), [STAT_X + 0.1, -0.3, 0], P(V(STAT_X, -0.3, -0.17))], ["pitot"], {
  r: 0.008,
  color: "#2E6FB0",
  name: "Static crossover",
  note: "The two tail-cone ports are tied together.",
});
flow(
  "static2",
  [
    [STAT_X + 0.1, -0.3, 0],
    [-2.4, -0.45, 0],
    [-0.5, -0.6, -0.3],
    [1.0, -0.62, -0.42],
    [PANEL_X + 0.1, -0.35, -0.4],
    [PANEL_X + 0.04, 0.05, -0.3],
  ],
  ["pitot"],
  {
    r: 0.008,
    color: "#2E6FB0",
    name: "Static line",
    note: "Forward along the belly (drain below the tail-cone access door) to the altimeter, airspeed and rate of climb.",
  },
);
flow(
  "altStatic",
  [
    [PANEL_X + 0.06, -0.28, -0.4],
    [PANEL_X + 0.08, -0.1, -0.4],
  ],
  ["pitot"],
  {
    r: 0.007,
    color: "#2E6FB0",
    name: "Alternate static line",
    note: "Valve open: cabin pressure feeds the static instruments.",
  },
);
flow(
  "stall",
  [P(wingP(-1.9, 0.02, 0)), P(wingP(-1.0, 0.25, 0)), [1.0, -0.55, -0.5], headlinerPoint(1, -0.4, 0.045), OVERHEAD.horn],
  ["pitot"],
  { tube: false, pcolor: "#FF6A6A", size: 0.04, name: "Stall warning circuit" },
);

/* ---------- vacuum: pump → regulator → gyros, PC servos (OM p. 8, 10) ---------- */
const VAC = "#3A9448",
  PUMP: Vec3 = [2.28, -0.08, 0],
  REG: Vec3 = [FW - 0.08, 0.1, -0.15],
  FILT: Vec3 = [FW - 0.1, 0.0, -0.35],
  GYROS: Vec3 = [PANEL_X + 0.05, 0.05, -0.3],
  TC: Vec3 = [PANEL_X + 0.06, 0.0, -0.44];
flow("vacPump", [PUMP, [2.1, 0.0, -0.1], [FW + 0.02, 0.08, -0.15], REG], ["vacuum"], {
  r: 0.009,
  color: VAC,
  name: "Vacuum pump suction line",
  note: "Pump → regulator on the aft side of the firewall.",
});
flow("vacGyro", [REG, [PANEL_X + 0.1, 0.1, -0.2], GYROS], ["vacuum"], {
  r: 0.008,
  color: VAC,
  name: "Regulator → gyros",
  note: "Suction to the artificial horizon and directional gyro; the red lights watch it (OM p. 10).",
});
flow("vacFilt", [GYROS, [PANEL_X + 0.1, -0.05, -0.33], FILT], ["vacuum"], {
  r: 0.007,
  color: VAC,
  pcolor: "#BFE8C8",
  name: "Filtered air inlet",
  note: "Cabin air enters the gyros through the central filter (Ranger 2-7).",
});
flow(
  "pcRoll",
  [TC, [PANEL_X + 0.0, -0.3, -0.5], [0.9, -0.55, -0.6], P(wingP(-2.0, 0.6, 0)), SERVO.roll],
  ["autopilot", "vacuum"],
  {
    r: 0.007,
    color: "#C8399F",
    name: "PC roll servo line (left)",
    note: "Pneumatic signal from the turn coordinator's pick-off out through the wing to the aileron servo (Ranger 2-9).",
  },
);
flow(
  "pcRollR",
  [
    TC,
    [PANEL_X + 0.0, -0.3, 0.3],
    [0.9, -0.55, 0.6],
    P(wingP(2.0, 0.6, 0)),
    [SERVO.roll[0], SERVO.roll[1], -SERVO.roll[2]],
  ],
  ["autopilot", "vacuum"],
  {
    r: 0.007,
    color: "#C8399F",
    name: "PC roll servo line (right)",
    note: "The opposite servo is signalled for the other roll direction.",
  },
);
flow(
  "pcYaw",
  [TC, [PANEL_X + 0.0, -0.35, -0.3], [0.5, -0.6, 0.1], [-1.0, -0.55, 0.1], SERVO.yaw],
  ["autopilot", "vacuum"],
  {
    r: 0.007,
    color: "#C8399F",
    name: "PC rudder servo lines",
    note: "Signal lines aft through the tail cone to the two rudder servos.",
  },
);
flow(
  "pcCut",
  [[PANEL_X - 0.2, 0.02, -0.43], [PANEL_X - 0.05, -0.2, -0.46], [PANEL_X + 0.08, -0.1, -0.46], TC],
  ["autopilot"],
  {
    r: 0.005,
    color: "#C8399F",
    name: "Cut-off valve line",
    note: "From the valve in the left wheel grip: pressed, it vents the servos (OM p. 8).",
  },
);

/* ---------- hydraulics: reservoir → brakes and the flap hand pump (OM p. 9–10) ---------- */
const RES: Vec3 = [FW - 0.08, 0.1, 0.2],
  HYD = "#7C57CF",
  CYLF: Vec3 = [0.25, -0.62, 0.0];
flow(
  "hydRes",
  [RES, [FW - 0.1, -0.2, 0.15], [1.7, -0.5, 0.1], [FLAP_PUMP.pivot[0], -0.5, FLAP_PUMP.pivot[2]]],
  ["flaps", "gear"],
  {
    r: 0.007,
    color: HYD,
    name: "Reservoir → flap pump",
    note: "One reservoir on the top aft side of the firewall serves the brakes and the flap pump (OM p. 9–10).",
  },
);
flow("hydFlap", [[FLAP_PUMP.pivot[0], -0.5, FLAP_PUMP.pivot[2]], [0.6, -0.64, 0.05], CYLF], ["flaps"], {
  r: 0.008,
  color: HYD,
  name: "Pump → flap cylinder",
  note: "Each stroke pushes fluid into the cylinder; the DOWN control holds it, UP opens the relief valve (OM p. 9).",
});
flow("hydBrake", [RES, [FW - 0.1, -0.3, -0.1], [PANEL_X + 0.25, -0.5, -0.3]], ["gear"], {
  r: 0.006,
  color: HYD,
  name: "Reservoir → brake master cylinders",
});

/* ---------- electrical (OM p. 3–4) ---------- */
const BAT: Vec3 = [EQUIPMENT.battery[0], EQUIPMENT.battery[1] + 0.1, EQUIPMENT.battery[2]],
  RELAY: Vec3 = [FW + 0.25, -0.08, -0.3],
  GEN: Vec3 = [2.8, -0.18, -0.2],
  REGU: Vec3 = [FW + 0.12, 0.15, -0.3],
  SWP: Vec3 = [PANEL_X - 0.03, -0.22, -0.46],
  CBP: Vec3 = [PANEL_X - 0.03, -0.15, 0.45];
flow("bat", [BAT, RELAY], ["electrical"], {
  r: 0.014,
  name: "Battery → master relay",
  note: "The master switch closes this relay at the battery (OM p. 3).",
});
flow("batBus", [RELAY, [FW - 0.02, -0.05, -0.3], [PANEL_X + 0.1, -0.1, -0.45], SWP], ["electrical"], {
  r: 0.013,
  name: "Relay → bus (switch-breakers)",
  note: "Main feed to the switch-breaker row and on to the push-to-reset breaker panel.",
});
flow("busCb", [SWP, [PANEL_X + 0.08, -0.25, 0.0], CBP], ["electrical"], {
  r: 0.011,
  name: "Bus → push-to-reset breakers",
  note: "Radios, instruments and warning circuits on the co-pilot's side (OM p. 4).",
});
flow("start", [RELAY, [2.3, -0.3, -0.2], [2.6, -0.35, 0.1], EQUIPMENT.starter], ["electrical", "engine"], {
  r: 0.016,
  color: "#B0761A",
  name: "Starter cable",
  note: "Heavy cable from the battery relay to the starter at the front of the engine.",
});
flow("gen", [GEN, [2.5, -0.26, -0.3], [2.2, 0.05, -0.28], REGU, [FW - 0.02, 0.05, -0.3]], ["electrical"], {
  r: 0.012,
  name: "Alternator → ALT 60 A → bus",
  note: "Alternator output through the ALT breaker to the bus; the regulator on the firewall feeds its field through ALT FIELD (Ranger 2-13).",
});
flow("vib", [SWP, [FW - 0.05, 0.1, -0.1], [FW + 0.04, 0.12, 0]], ["electrical", "engine"], {
  r: 0.006,
  color: "#6FD8FF",
  name: "Vibrator feed",
  note: "Battery power to the starting vibrator while START is pushed (OM p. 2).",
});

export const FLOWS = F;

const CABIN_AIR = ["defrost", "feetF1", "feetF-1", "feetR", "bag"];
export const isCabinAir = (k: string) => CABIN_AIR.includes(k);

/** Particle speed multiplier per flow (0 = stopped; negative = reversed). */
export function flowRates(s: Sim, E: Elec): Record<string, number> {
  const R: Record<string, number> = {};
  const run = s.eng.running,
    avail = fuelAvail(s),
    pumping = E.fuelPump && avail;
  const ff = run ? live.ff / 9 : pumping ? 0.4 : 0;
  const feed = avail && (run || pumping) ? Math.max(0.3, ff) : 0;
  R.fuelL = s.fuel.sel === "L" ? feed : 0;
  R.fuelR = s.fuel.sel === "R" ? feed : 0;
  R.fuelSel = R.fuelFw = R.fuelCarb = feed;
  R.ventL = R.ventR = s.air ? 0.2 : 0;
  R.intake = run && s.eng.carbHeat < 0.5 ? live.rpm / 2400 : 0;
  R.carbHot = run && s.eng.carbHeat >= 0.5 ? live.rpm / 2400 : 0;
  CYLS.forEach((c) => {
    R["man" + c.n] = run ? live.rpm / 2400 : 0;
    R["exh" + c.n] = run ? (1.2 * live.rpm) / 2400 : 0;
  });
  R.tailpipe = run ? 1.3 : 0;
  R.oil = run || live.oilP > 5 ? 0.7 : 0;
  R.oilGov = run && !s.eng.fail.governor && live.oilP > 20 ? 0.5 : 0;
  // heat & vent: ram air, or prop wash on the ground
  const ram = s.air ? 1 : run ? 0.5 : 0,
    heat = s.env.heat,
    vent = s.env.vent;
  R.heatIn = ram * (0.2 + 0.8 * heat);
  R.ventIn = ram * vent;
  const mix = ram * Math.max(heat, vent);
  R.defrost = mix;
  R.feetF1 = R["feetF-1"] = mix * 0.9;
  R.feetR = mix * 0.7;
  R.bag = mix * 0.4;
  R.radioGrill = ram * 0.6;
  [0, 1, 2, 3].forEach((i) => (R["ceil" + i] = ram * s.env.scoop));
  R.leftScoop = ram * 0.6;
  R.pitot = R.static = R.static2 = s.air ? 0.4 : 0;
  R.altStatic = s.pitot.altStatic ? 0.4 : 0;
  R.stall = hornLevel(s, E) > 0 ? 1.2 : 0;
  // vacuum: flow toward the pump
  const vac = live.vac > 1 ? 0.8 : 0;
  R.vacPump = vac;
  R.vacGyro = -vac;
  R.vacFilt = -vac;
  const pc = pcEngaged(s);
  R.pcRoll = pc && live.pcRoll < 0.02 ? -0.4 - Math.abs(live.pcRoll) : 0;
  R.pcRollR = pc && live.pcRoll > -0.02 ? -0.4 - Math.abs(live.pcRoll) : 0;
  R.pcYaw = pc ? -0.4 - Math.abs(live.pcYaw) : 0;
  R.pcCut = s.pc.cutoff ? 1 : 0;
  // hydraulics
  R.hydRes = live.pumpAnim > 0.2 ? 1 : 0;
  R.hydFlap = live.pumpAnim > 0.2 ? 1.5 : s.flaps.valve === "UP" && live.flapAng > 0 ? -0.6 : 0;
  R.hydBrake = Math.abs(s.gear.diff) > 0.05 || s.gear.park ? 0.8 : 0;
  // electrical
  R.bat = !E.batOk ? 0 : E.genOn ? -0.6 : E.batLoad > 0 ? 1 : 0;
  R.batBus = E.bus > 0 ? 1 : 0;
  R.busCb = E.bus > 0 ? 0.8 : 0;
  R.start = E.starterOn ? 2.5 : 0;
  R.gen = E.genOn ? 1 : 0;
  R.vib = E.vibrator ? 2 : 0;
  return R;
}

const HOT_AIR = new THREE.Color("#FF7A3D");
/** Cabin-air particles follow the heat control (cool blue → hot orange). */
export function cabinAirColor(s: Sim, out: THREE.Color) {
  const warm = s.env.heat / Math.max(0.05, s.env.heat + s.env.vent);
  return out.set("#5FC8F0").lerp(HOT_AIR, warm);
}
