import type { InstanceKey } from "@/lib/catalogue";
import { sided } from "@/lib/geometry";
/** Component detail for the avgas XLS. AMM 6.02.01 Rev 7 applicable -00 chapters,
 * Garmin 190-00545-01 Rev E, Lycoming PC-(L)IO-360-M1A Rev 1 and MT E-124.
 * All undimensioned envelopes, internal poses and stations are approximate. */
import { V, toVec3, type Vec3 } from "@/lib/math";
import type { SysId } from "@/lib/systems";
import {
  DOOR,
  FW,
  PANEL_X,
  ROLLBAR_X,
  SILL_Y,
  box,
  cyl,
  fs,
  loft,
  onSkin,
  sph,
  tubeGeo,
  wingP,
  wingSec,
} from "../geometry";
import * as A from "../depth-anchors";
import { FLAP_ACT, SERVO } from "../rig";
import { CANOPY_HINGE, DOOR_HINGE } from "./airframe";
import { CYLS, PROP } from "./engine";
import { MG } from "./gear";
import { pitotBase } from "./pitot";
import { CAT, part, sim, glow, relTo } from "./catalogue";

const firstDepthPart = CAT.parts.length;
const component = (
  identity: InstanceKey,
  name: string,
  sys: SysId[],
  point: Vec3,
  size: Vec3,
  note: string,
  pin = false,
) =>
  part(() => box(...size), sys, {
    id: "parts.depth.part.001",
    instance: identity,

    name,
    pos: point,
    note,
    pin,
  });
const drum = (
  identity: InstanceKey,
  name: string,
  sys: SysId[],
  point: Vec3,
  radius: number,
  length: number,
  note: string,
  pin = false,
  axis: "x" | "y" | "z" = "y",
) =>
  part(() => cyl(radius, length, axis), sys, {
    id: "parts.depth.part.002",
    instance: identity,
    name,
    pos: point,
    note,
    pin,
  });
const note = (what: string, ref: string) =>
  `${what} (${ref}). Position, dimensions and internal pose schematic; see SOURCES.md.`;

// IO-360 internals and complete lubrication path.
drum(
  ["crankshaft"],
  "Crankshaft",
  ["engine"],
  [fs(0.94), 0, 0],
  0.026,
  0.64,
  note("Direct-drive crankshaft transfers piston forces to the propeller", "Lycoming IPC 72-20 pp. 14–17"),
  false,
  "x",
);
drum(
  ["camshaft"],
  "Camshaft",
  ["engine"],
  [fs(0.95), 0.075, 0],
  0.015,
  0.54,
  note("Camshaft drives the hydraulic tappets and push rods", "Lycoming IPC 72-20 pp. 16–17; 72-30 pp. 26–27"),
  false,
  "x",
);
for (const c of CYLS) {
  drum(
    ["piston-cyl", c.n],
    `Piston, cyl ${c.n}`,
    ["engine"],
    [c.x, 0, c.s * 0.25],
    0.047,
    0.065,
    note("Piston and ring assembly inside cylinder", "Lycoming IPC 72-30 pp. 20–21"),
    false,
    "z",
  );
  drum(
    ["connecting-rod-cyl", c.n],
    `Connecting rod, cyl ${c.n}`,
    ["engine"],
    [c.x, 0, c.s * 0.12],
    0.012,
    0.19,
    note("Connecting rod joins piston pin to crankshaft", "Lycoming IPC 72-30 pp. 20–21"),
    false,
    "z",
  );
  for (const [instance1, dx] of [
    ["member-1", -0.032],
    ["member-2", 0.032],
  ] as const)
    drum(
      ["push-rod-shroud", c.n, instance1],
      "Push-rod shroud",
      ["engine"],
      [c.x + dx, -0.055, c.s * 0.25],
      0.008,
      0.18,
      note("Push rod and protective shroud between hydraulic tappet and rocker", "Lycoming IPC 72-30 pp. 26–27"),
      false,
      "z",
    );
  component(
    ["rocker-box-cover-cyl", c.n],
    `Rocker box cover, cyl ${c.n}`,
    ["engine"],
    [c.x, 0.005, c.s * 0.372],
    [0.1, 0.11, 0.016],
    note(
      "Cover encloses intake/exhaust rocker mechanisms; ghosted in X-ray as a schematic cutaway",
      "Lycoming IPC 72-30 pp. 28–29",
    ),
  ).fairing = true;
  for (const [instance2, dx] of [
    ["member-1", -0.025],
    ["member-2", 0.025],
  ] as const)
    drum(
      ["valve-spring-and-rocker", c.n, instance2],
      "Valve spring and rocker",
      ["engine"],
      [c.x + dx, 0.01, c.s * 0.362],
      0.01,
      0.05,
      note("Rocker opens its valve against the spring; two valves per cylinder", "Lycoming IPC 72-30 pp. 26–27"),
      false,
      "z",
    );
  drum(
    ["injector-nozzle-cyl", c.n],
    `Injector nozzle, cyl ${c.n}`,
    ["engine", "fuel"],
    [c.x, 0.045, c.s * 0.33],
    0.009,
    0.026,
    note("Continuous-flow nozzle at each intake port", "AMM 73-00-00 p. 1; Lycoming IPC 73-10 pp. 44–49"),
    false,
    "x",
  );
  drum(
    ["cht-probe-cyl", c.n],
    `CHT probe, cyl ${c.n}`,
    ["engine", "avionics"],
    [c.x, -0.05, c.s * 0.35],
    0.006,
    0.025,
    note("Cylinder-head temperature thermocouple connected to GEA 71", "Garmin SMM 2.2.4; Lycoming cylinder assembly"),
    false,
    "z",
  );
  drum(
    ["egt-probe-cyl", c.n],
    `EGT probe, cyl ${c.n}`,
    ["engine", "avionics"],
    [c.x, -0.19, c.s * 0.33],
    0.006,
    0.025,
    note("Exhaust gas temperature thermocouple in the header", "Garmin SMM 2.2.4"),
    false,
    "z",
  );
}
drum(
  ["oil-suction-strainer"],
  "Oil suction strainer",
  ["engine"],
  A.OIL_SCREEN,
  0.019,
  0.05,
  note("Sump inlet screen prevents debris reaching the oil pump", "AMM 79-00-00 p. 1; Lycoming IPC 72-50 pp. 32–33"),
  true,
  "x",
);
component(
  ["accessory-oil-pump"],
  "Accessory oil pump",
  ["engine"],
  A.OIL_PUMP,
  [0.055, 0.06, 0.065],
  note("Accessory-case pump pressurizes oil from the sump", "AMM 79-00-00 p. 1; Lycoming IPC 72-60 pp. 36–37"),
  true,
);
drum(
  ["thermostatic-oil-bypass-valve"],
  "Thermostatic oil bypass valve",
  ["engine"],
  A.OIL_THERMOSTAT,
  0.014,
  0.04,
  note("Cold oil bypasses the external cooler; warm oil flows through it", "AMM 79-00-00 p. 1"),
  true,
);
drum(
  ["full-flow-oil-filter"],
  "Full-flow oil filter",
  ["engine"],
  A.OIL_FILTER,
  0.029,
  0.08,
  note(
    "Filters oil after thermostatic valve/cooler; integral bypass protects flow if blocked",
    "AMM 79-00-00 p. 1; Lycoming IPC 72-60 pp. 40–41",
  ),
  true,
  "x",
);
drum(
  ["oil-filter-bypass-valve"],
  "Oil filter bypass valve",
  ["engine"],
  [A.OIL_FILTER[0] - 0.025, A.OIL_FILTER[1], A.OIL_FILTER[2]],
  0.008,
  0.02,
  note("Normally closed; opens to maintain oil flow with a blocked filter", "AMM 79-00-00 p. 1"),
);
drum(
  ["oil-pressure-regulating-valve"],
  "Oil pressure regulating valve",
  ["engine"],
  A.OIL_RELIEF,
  0.015,
  0.035,
  note(
    "Regulates oil pressure before engine galleries; surplus oil returns to sump",
    "AMM 79-00-00 p. 1; Lycoming IPC 72-60",
  ),
  true,
);
component(
  ["oil-cooler-mounting-bracket"],
  "Oil cooler mounting bracket",
  ["engine"],
  [A.OIL_COOLER[0] - 0.015, -0.14, 0.28],
  [0.07, 0.012, 0.06],
  note("Supports cooler from engine-mounting frame", "AMM 79-00-00 p. 1/Fig 1"),
);
drum(
  ["oil-pressure-sensor"],
  "Oil pressure sensor",
  ["engine", "avionics"],
  [fs(0.83), -0.25, -0.12],
  0.013,
  0.03,
  note("Pressure transducer on engine sensor installation, connected to GEA", "Garmin SMM 2.2.4"),
  true,
);
drum(
  ["oil-temperature-sensor"],
  "Oil temperature sensor",
  ["engine", "avionics"],
  [fs(1.16), -0.05, -0.11],
  0.009,
  0.035,
  note("Oil temperature input to GEA", "Garmin SMM 2.2.4"),
);
component(
  ["manifold-pressure-sensor"],
  "Manifold pressure sensor",
  ["engine", "avionics"],
  [fs(0.83), -0.265, -0.2],
  [0.032, 0.028, 0.035],
  note("Pressure input measures induction manifold absolute pressure, not fuel pressure", "Garmin SMM 2.2.4"),
  true,
);
component(
  ["tachometer-pickup"],
  "Tachometer pickup",
  ["engine", "avionics"],
  [fs(1.27) + 0.01, 0.07, 0.15],
  [0.022, 0.02, 0.028],
  note("RPM pickup at right magneto; independent of throttle setting", "Garmin SMM 2.2.4"),
);
component(
  ["slickstart-ignition-booster"],
  "SlickSTART ignition booster",
  ["engine", "electrical"],
  A.SLICKSTART,
  [0.045, 0.045, 0.035],
  note(
    "Boosts starting spark; does not replace independent magnetos during normal running",
    "AFM 7-43; Garmin SMM 2-1 OAM 40-073",
  ),
  true,
);
component(
  ["air-filter-housing"],
  "Air filter housing",
  ["engine"],
  [A.AIR_FILTER[0], A.AIR_FILTER[1] + 0.022, 0],
  [0.12, 0.045, 0.135],
  note("Flexible-sealed housing mounts filter/alternate-air assembly to fuel injector", "AMM 71-60-00 pp. 1–2"),
);
for (let i = 0; i < 6; i++) {
  const a = (i * Math.PI) / 3;
  drum(
    ["alternate-air-inlet-port", i],
    "Alternate-air inlet port",
    ["engine"],
    [A.ALTERNATE_AIR[0] + 0.012 * Math.cos(a), A.ALTERNATE_AIR[1] + 0.012 * Math.sin(a), 0.052],
    0.004,
    0.012,
    note("Six ports in sleeve and flange align when pilot opens alternate air", "AMM 71-60-00 pp. 1–2"),
    false,
    "z",
  );
}

// Mechanical, oil-to-coarse governor. No feathering/accumulator is fitted in this configuration.
drum(
  ["governor-gear-pump"],
  "Governor gear pump",
  ["propeller", "engine"],
  [A.GOVERNOR[0], 0.102, 0.06],
  0.022,
  0.035,
  note("Boosts engine oil pressure for propeller pitch control", "AMM 61-20-00 p. 1"),
  false,
  "x",
);
drum(
  ["governor-pilot-valve"],
  "Governor pilot valve",
  ["propeller"],
  [A.GOVERNOR[0], 0.132, 0.06],
  0.007,
  0.025,
  note(
    "On-speed closes both ports; overspeed supplies oil to coarsen blades; underspeed drains oil to fine pitch",
    "AMM 61-20-00 pp. 1–3",
  ),
  true,
);
drum(
  ["governor-speeder-spring"],
  "Governor speeder spring",
  ["propeller"],
  [A.GOVERNOR[0], 0.15, 0.06],
  0.012,
  0.02,
  note("Blue RPM lever changes spring preload opposing centrifugal flyweights", "AMM 61-20-00 pp. 1–3"),
);
for (const s of [-1, 1])
  component(
    ["governor-flyweight", s],
    "Governor flyweight",
    ["propeller"],
    [A.GOVERNOR[0], 0.13, 0.06 + s * 0.018],
    [0.012, 0.015, 0.009],
    note("Centrifugal flyweight opposes speeder-spring force", "AMM 61-20-00 p. 1"),
  );
part(() => cyl(0.082, 0.14, "x"), ["propeller"], {
  id: "parts.depth.propeller-hub-and-pitch-piston.003",
  pos: [PROP[0] + 0.02, 0, 0],
  name: "Propeller hub and pitch piston",
  note: note(
    "Oil moves the pitch piston; natural twisting forces and return spring move blades to fine pitch on oil loss",
    "AMM 61-20-00; MT E-124 §4.4–4.6 non-feathering system",
  ),
  ext: true,
  pin: true,
});
part(() => cyl(0.03, 0.05, "x"), ["propeller"], {
  id: "parts.depth.propeller-return-spring.004",
  pos: [PROP[0] + 0.07, 0, 0],
  name: "Propeller return spring",
  note: note("Fine-pitch return spring for the non-feathering MTV-12-B system", "MT E-124 §4.4–4.6"),
  ext: true,
});

// Three connected aluminum chambers per wing; no collector or powered tank transfer.
for (const s of [1, -1]) {
  for (const chamber of A.FUEL_CHAMBERS) {
    part(
      () =>
        loft(
          sided(
            [chamber.z0, (chamber.z0 + chamber.z1) / 2, chamber.z1].map((z) => wingSec(s * z, 0.15, 0.6, 0.7)),
            s,
          ),
        ),
      ["fuel"],
      {
        instance: [s, chamber.id],
        id: "parts.depth.part.005",
        name: chamber.name,
        pos: [0, 0, 0],
        note: note(
          "Aluminum chamber in interconnected long-range wing tank; skins are not wet-wing storage. Flexible large couplings carry fuel, top hoses balance vent pressure",
          "AMM 28-10-00 pp. 3–6",
        ),
        fairing: true,
        pin: s < 0,
      },
    );
    const z = (chamber.z0 + chamber.z1) / 2;
    part(
      () =>
        loft(
          sided(
            [z - 0.004, z + 0.004].map((az) => wingSec(s * az, 0.15, 0.6, 0.65)),
            s,
          ),
        ),
      ["fuel"],
      {
        instance: [s, chamber.id],
        id: "parts.depth.fuel-chamber-baffle.006",
        name: "Fuel chamber baffle",
        pos: [0, 0, 0],
        plate: true,
        note: note(
          "Representative chamber baffle limits rapid slosh; number/station illustrative",
          "AMM 28-10-00 p. 6",
        ),
      },
    );
  }
  for (const [instance3, z] of [
    ["member-1", 2.1],
    ["member-2", 2.975],
  ] as const)
    drum(
      ["fuel-chamber-flexible-coupling", s, instance3],
      "Fuel chamber flexible coupling",
      ["fuel"],
      A.tankPort(s, z),
      0.025,
      0.075,
      note(
        "Large flexible coupling connects adjoining aluminum chambers, secured by worm-drive clamps",
        "AMM 28-10-00 pp. 5–6",
      ),
      s < 0,
      "z",
    );
  for (const longRange of [false, true]) {
    const point = A.FUEL_PROBE(s, longRange);
    part(() => tubeGeo([point, A.tankPort(s, Math.abs(point[2]) + 0.35)], 0.006, 0.05), ["fuel", "avionics"], {
      id: "parts.depth.part.007",
      instance: [longRange, s],
      name: longRange ? "Long-range capacitive fuel probe" : "Inboard capacitive fuel probe",
      note: note(
        "Fuel-wetted probe capacitance supplies measured quantity; G1000 sums probes with long-range gauge behavior, not legacy AUX FUEL QTY switch",
        "AFM 7-34–7-37; Garmin SMM §4.6; AMM 28-40-00",
      ),
      pin: s < 0,
    });
  }
}
component(
  ["under-floor-fuel-selector-body"],
  "Under-floor fuel selector body",
  ["fuel"],
  A.FUEL_SELECTOR_BODY,
  [0.07, 0.06, 0.08],
  note(
    "Actual selector/shutoff valve below cockpit floor, driven by long shaft from console handle; LEFT/RIGHT/OFF",
    "AMM 28-20-00 p. 3",
  ),
  true,
);
part(() => tubeGeo([A.FUEL_SELECTOR_BODY, [A.FUEL_SELECTOR_BODY[0], -0.32, 0]], 0.006, 0.05), ["fuel"], {
  id: "parts.depth.fuel-selector-drive-shaft.008",
  name: "Fuel selector drive shaft",
  note: note("Connects selector valve to cockpit selector lever and OFF safety catch", "AMM 28-20-00 p. 3"),
});
drum(
  ["gascolator-filter-screen"],
  "Gascolator filter screen",
  ["fuel"],
  [A.GASCOLATOR[0], -0.54, 0],
  0.025,
  0.035,
  note("Filter/sediment bowl at system low point; drain before flight", "AMM 28-20-00 p. 3"),
);
component(
  ["electric-fuel-pump-bypass"],
  "Electric fuel-pump bypass",
  ["fuel"],
  [A.ELECTRIC_PUMP[0], -0.53, 0.125],
  [0.035, 0.025, 0.025],
  note("Bypass permits engine pump to draw fuel with electric pump off", "AFM 7-31 schematic"),
);
component(
  ["firewall-fuel-bulkhead-connector"],
  "Firewall fuel bulkhead connector",
  ["fuel"],
  A.FUEL_FIREWALL,
  [0.022, 0.028, 0.028],
  note("Cabin pump outlet connects to firesleeved engine-pump hose at firewall", "AMM 28-20-00 p. 3"),
);

// Pitot/static water traps are parallel sump loops, not an invented series reservoir.
for (const [instance4, [line, start, sump, end]] of [
  ["pitot", ["Pitot", A.PITOT_SPLIT, A.PITOT_SUMP, A.PITOT_JOIN]],
  ["static", ["Static", A.STATIC_SPLIT, A.STATIC_SUMP, A.STATIC_JOIN]],
] as const) {
  for (const [instance5, point] of [
    ["member-1", start],
    ["member-2", end],
  ] as const)
    drum(
      ["", instance4, instance5],
      `${line} trap tee`,
      ["pitot"],
      point,
      0.01,
      0.025,
      note(
        "T-pieces divide/rejoin the upper instrument line and lower water-collecting sump loop",
        "AMM 34-10-00 p. 1",
      ),
    );
  drum(
    ["-2", instance4],
    `${line} water-trap low point`,
    ["pitot"],
    sump,
    0.013,
    0.028,
    note("Lowest part of parallel sump below pilot seat; access from rear footwell", "AMM 34-10-00 p. 1"),
    true,
  );
}
for (const [instance6, [name, dy, dx]] of [
  ["pitot-thermal-switch", ["Pitot thermal switch", -0.045, 0.048]],
  ["pitot-thermal-fuse", ["Pitot thermal fuse", -0.07, 0.06]],
] as const)
  part(() => box(0.009, 0.013, 0.009), ["pitot", "electrical"], {
    id: "parts.depth.part.009",
    instance: [instance6],

    pos: [pitotBase.x + dx, pitotBase.y + dy, pitotBase.z],
    name,
    ext: true,
    note: note(
      "Thermal switch is on the probe; independent built-in thermal fuse permanently interrupts heat after overheating. Internal element stations schematic",
      "AFM 7-45",
    ),
  });

// Brake detail and hydraulic reservoirs; wheel-side fittings are intentionally external.
for (const s of [-1, 1]) {
  const circuit = A.brakeCircuit(s);
  drum(
    ["brake-fluid-reservoir", s],
    "Brake fluid reservoir",
    ["gear"],
    circuit.reservoir,
    0.016,
    0.035,
    note(
      "Reservoir on this wheel circuit’s copilot master; outlet passes through the matching pilot master, parking valve and caliper",
      "AFM 7-14; AMM 32-40-00 pp. 3–5",
    ),
    s < 0,
  );
  for (const [instance7, dz] of [
    ["member-1", -0.03],
    ["member-2", 0.03],
  ] as const)
    part(() => cyl(0.025, 0.025, "z"), ["gear"], {
      id: "parts.depth.main-wheel-tapered-bearing.010",
      instance: [instance7, s],
      pos: [MG.x, MG.y, s * MG.z + dz],
      name: "Main-wheel tapered bearing",
      note: note("Tapered roller bearing and grease seal in each wheel-hub half", "AMM 32-40-00 pp. 1–2"),
      ext: true,
    });
  part(() => box(0.065, 0.09, 0.045), ["gear"], {
    instance: [s],
    id: "parts.depth.brake-caliper-and-piston.011",
    pos: [MG.x + 0.04, MG.y + 0.06, s * (MG.z - 0.13)],
    name: "Brake caliper and piston",
    note: note(
      "Hydraulic piston clamps linings against single wheel disk; lining and cylinder mount to torque plate",
      "AMM 32-40-00 pp. 3–7",
    ),
    ext: true,
    pin: s < 0,
    anim: glow("#6E7A84", "#FF9C44", () => sim().s.gear.park || Math.sign(sim().s.gear.diff) === s, ["gear"]),
  });
  part(() => cyl(0.006, 0.02, "y"), ["gear"], {
    instance: [s],
    id: "parts.depth.brake-bleed-screw.012",
    pos: [MG.x + 0.04, MG.y + 0.11, s * (MG.z - 0.13)],
    name: "Brake bleed screw",
    note: note("Hydraulic bleed fitting at each wheel brake cylinder", "AMM 32-40-00 Fig 4"),
    ext: true,
  });
}
component(
  ["parking-brake-cable-quadrant"],
  "Parking-brake cable quadrant",
  ["gear"],
  [A.BRAKE_VALVE[0] + 0.03, -0.52, 0.1],
  [0.03, 0.03, 0.025],
  note(
    "Bowden control operates parking valve; AFM lever procedure governs differing AMM text",
    "AFM 7-13; AMM 32-40-00",
  ),
);

// Separate electrical relay/bus hardware and G1000 lightning interfaces.
for (const [instance8, [name, point]] of [
  ["battery-contactor", ["Battery contactor", A.BATTERY_RELAY]],
  ["starter-contactor", ["Starter contactor", A.START_RELAY]],
  ["external-power-contactor", ["External-power contactor", A.EXT_RELAY]],
  ["essential-main-tie-relay", ["Essential/main tie relay", A.TIE_RELAY]],
  ["avionics-master-relay", ["Avionics master relay", A.AV_RELAY]],
] as const)
  component(
    ["declaration", instance8],
    name,
    ["electrical"],
    point,
    [0.026, 0.025, 0.028],
    note(
      "Physical relay corresponding to the aircraft-specific electrical schematic; no invented second alternator or essential battery",
      "Garmin SMM Fig 2-3, 2-9; AFM 7-40–7-43",
    ),
    name === "Essential/main tie relay",
  );
component(
  ["main-to-essential-bypass-diode"],
  "Main-to-essential bypass diode",
  ["electrical"],
  A.TIE_DIODE,
  [0.028, 0.018, 0.018],
  note(
    "One-way alternator feed to essential bus across isolated tie relay; opposite flow is blocked",
    "Garmin SMM Fig 2-3",
  ),
  true,
);
for (const [bus, point] of Object.entries(A.BUS))
  component(
    ["-3", bus],
    `${bus.toUpperCase()} bus bar`,
    ["electrical"],
    point,
    [0.04, 0.012, 0.07],
    note(
      "Physical schematic bus rail feeding its breaker group; main avionics controlled by avionics master",
      "Garmin SMM 2-9/Fig 2-3",
    ),
  );
for (const [instance9, [name, point]] of [
  ["gia-1", ["GIA 1", A.GIA1]],
  ["gia-2", ["GIA 2", A.GIA2]],
  ["ahrs", ["AHRS", A.GRS]],
] as const) {
  component(
    ["-4", instance9],
    `${name} lightning resistor/TVS/fuse`,
    ["electrical", "avionics"],
    [point[0] + 0.04, point[1] + 0.05, point[2]],
    [0.025, 0.018, 0.025],
    note(
      "0.499-ohm resistor, TVS and 3.2 A slow-blow fuse protect LRU power; fabricated block at remote enclosure",
      "Garmin SMM 2-10",
    ),
    name === "AHRS",
  );
}
component(
  ["remote-enclosure-ground-block"],
  "Remote enclosure ground block",
  ["electrical", "avionics"],
  [A.GIA1[0] + 0.13, -0.49, -0.13],
  [0.025, 0.018, 0.05],
  note("Ground strap and braided bonds connect avionics enclosure to airframe ground station", "Garmin SMM 2-4, 2-11"),
);
component(
  ["g1000-shield-block"],
  "G1000 shield block",
  ["avionics"],
  [A.GEA[0] + 0.04, A.GEA[1], A.GEA[2]],
  [0.018, 0.025, 0.025],
  note(
    "Connector backshell shield block terminates sensor/harness shields; earlier spider-style installation is not assumed",
    "Garmin SMM 2-11",
  ),
);

// Five actual flap microswitch roles and servo mounts, alongside the existing moving rig.
for (const [instance10, [i, role]] of [
  ["member-1", [1, "UP travel limit"]],
  ["member-2", [2, "UP indication"]],
  ["member-3", [3, "T/O position and indication"]],
  ["member-4", [4, "LDG travel limit"]],
  ["member-5", [5, "LDG indication"]],
] as const)
  component(
    ["flap-microswitch", instance10],
    `Flap microswitch ${i} — ${role}`,
    ["flaps"],
    [FLAP_ACT[0] - 0.015, FLAP_ACT[1] + 0.025, FLAP_ACT[2] + (i - 3) * 0.02],
    [0.018, 0.025, 0.014],
    note("Cam-driven microswitch on adjustable board; logic controls motor and indicators", "AMM 27-50-00 pp. 3–6"),
    i === 3,
  );
for (const [name, point] of Object.entries(SERVO)) {
  component(
    ["gsm-85", name],
    `GSM 85 ${name} servo mount`,
    ["autopilot", "controls"],
    [point[0], point[1] - 0.01, point[2]],
    [0.09, 0.014, 0.08],
    note(
      "Servo mount contains capstan/slip clutch so pilot can overpower servo and motor can be removed without re-rigging",
      "Garmin SMM 2-8",
    ),
  );
}
component(
  ["electric-pedal-adjustment-motor"],
  "Electric pedal-adjustment motor",
  ["controls", "gear"],
  [fs(2.08), -0.5, -0.3],
  [0.04, 0.05, 0.065],
  note(
    "Optional OAM 40-251 drives adjustable pedal assemblies; ground use only, runaway isolated by local breaker",
    "AFM 7-9; AMM 27-20-00 pp. 1–3",
  ),
);

// Door bolts are separate from handle and move with their shell; closed-state physical envelopes are internal.
for (const side of [-1, 1]) {
  const point = onSkin(ROLLBAR_X + 0.05, SILL_Y + 0.01, side, 0.94);
  part(() => cyl(0.009, 0.034, "z"), ["cabin"], {
    id: "parts.depth.canopy-locking-bolt.013",
    instance: [side],
    name: "Canopy locking bolt",
    parent: "canopy",
    pos: relTo(point, CANOPY_HINGE),
    note: note(
      "Two bolts at rear-bottom canopy corners operated by LH handle; cooling-gap position only on ground",
      "AMM 52-00-00 p. 1; AFM 7-17",
    ),
    pin: side < 0,
  });
  component(
    ["canopy-lock-detection-switch", side],
    "Canopy lock-detection switch",
    ["cabin", "avionics"],
    toVec3(point.clone().add(V(0.035, -0.02, 0))),
    [0.022, 0.02, 0.022],
    note("Door detection input reaches GEA 71; state reflects cockpit locking position", "Garmin SMM 2.2.4; AMM 52-10"),
  );
}
for (const [instance11, x] of [
  ["member-1", DOOR.x0 - 0.045],
  ["member-2", DOOR.x1 + 0.045],
] as const) {
  part(() => cyl(0.009, 0.033, "z"), ["cabin"], {
    id: "parts.depth.rear-door-locking-bolt.014",
    instance: [instance11],

    name: "Rear door locking bolt",
    parent: "door",
    pos: relTo(onSkin(x, SILL_Y + 0.015, -1, 0.94), DOOR_HINGE),
    note: note(
      "Two bolts at front and rear lower door corners; handle and safety lever prevent unintentional opening",
      "AMM 52-00-00 p. 1",
    ),
    pin: x > -0.5,
  });
}
component(
  ["rear-door-lock-detection-switch"],
  "Rear door lock-detection switch",
  ["cabin", "avionics"],
  toVec3(onSkin(DOOR.x0 - 0.06, SILL_Y - 0.015, -1, 0.93)),
  [0.018, 0.02, 0.022],
  note("Locked-door discrete input to engine/airframe unit; no independent attitude sensor", "Garmin SMM 2.2.4"),
);

// Documented heating and ventilation hardware.
component(
  ["left-stub-wing-fresh-air-collector"],
  "Left stub-wing fresh-air collector",
  ["environment"],
  toVec3(wingP(-0.75, 0.15, 0)),
  [0.12, 0.055, 0.15],
  note("Main bulkhead/closing ribs form collector after left stub-wing NACA inlet", "AMM 21-00-00 pp. 1–4"),
  true,
);
component(
  ["right-stub-wing-distribution-chamber"],
  "Right stub-wing distribution chamber",
  ["environment"],
  toVec3(wingP(0.75, 0.15, 0)),
  [0.1, 0.05, 0.12],
  note("Cross-fuselage pipe brings left-inlet air to right closing rib and side duct", "AMM 21-00-00 p. 3"),
);
component(
  ["heat-valve-butterfly"],
  "Heat-valve butterfly",
  ["environment"],
  [FW + 0.045, -0.4, 0.12],
  [0.025, 0.075, 0.07],
  note("CABIN HEAT diverts exhaust-muff air to cabin or overboard, with intermediate blending", "AMM 21-00-00 pp. 1–3"),
);
component(
  ["defrost-floor-distributor-butterfly"],
  "Defrost/floor distributor butterfly",
  ["environment"],
  [FW - 0.14, -0.42, 0],
  [0.03, 0.065, 0.12],
  note(
    "Air distribution lever divides heated air between canopy defrost and front/rear footwells",
    "AMM 21-00-00 pp. 1–3",
  ),
);
for (const side of [-1, 1])
  part(() => sph(0.02), ["environment"], {
    id: "parts.depth.optional-panel-vent-naca-inlet.015",
    instance: [side],
    pos: toVec3(onSkin(fs(1.88), -0.16, side, 1.005)),
    name: "Optional panel-vent NACA inlet",
    ext: true,
    note: note(
      "OAM 40-099 adds separate front-fuselage NACA inlets and panel nozzle hoses; not supplied from wing collector",
      "AMM 21-00-00 p. 3",
    ),
    fitted: () => sim().s.env.extraVents,
  });
component(
  ["flood-light-inverter"],
  "Flood-light inverter",
  ["lighting", "electrical"],
  [PANEL_X + 0.07, 0.045, 0.34],
  [0.055, 0.026, 0.03],
  note(
    "Solid-state inverter supplies electroluminescent panel; standby emergency pack can power flood light",
    "AMM 33-10-00; AFM 7-42–7-44",
  ),
);
component(
  ["instrument-light-dimmer-module"],
  "Instrument-light dimmer module",
  ["lighting", "electrical"],
  [PANEL_X + 0.07, -0.04, 0.34],
  [0.045, 0.03, 0.025],
  note("INSTR dimmer controls panel-light intensity; separate from emergency flood lighting", "AMM 33-10-00"),
);

// Fuel-injector pressure balance is mechanical; GEA pressure sensing does not control the metering valve.
for (const [instance12, [name, offset]] of [
  ["fuel-servo-inlet-screen", ["Fuel-servo inlet screen", [-0.035, 0, 0]] as [string, Vec3]],
  ["fuel-servo-air-diaphragm", ["Fuel-servo air diaphragm", [0, 0.015, -0.022]] as [string, Vec3]],
  ["fuel-servo-fuel-diaphragm", ["Fuel-servo fuel diaphragm", [0, 0.015, 0.022]] as [string, Vec3]],
  ["fuel-servo-metering-idle-valve", ["Fuel-servo metering/idle valve", [0.015, -0.01, 0]] as [string, Vec3]],
] as const)
  component(
    ["declaration-2", instance12],
    name,
    ["engine", "fuel"],
    [A.FUEL_SERVO[0] + offset[0], A.FUEL_SERVO[1] + offset[1], A.FUEL_SERVO[2] + offset[2]],
    [0.015, 0.018, 0.015],
    note(
      "Injector venturi/air and fuel diaphragms balance ball-valve metering; manual mixture and idle linkage control fuel",
      "AMM 73-00-00 pp 1–3",
    ),
  );
drum(
  ["flow-divider-diaphragm-and-needle"],
  "Flow-divider diaphragm and needle",
  ["fuel", "engine"],
  [A.FUEL_DIVIDER[0], A.FUEL_DIVIDER[1] + 0.007, 0],
  0.017,
  0.025,
  note(
    "Metered fuel lifts atmospheric-reference diaphragm/needle against spring; four outlets supply cylinders",
    "AMM 73-00-00 p 3",
  ),
);
for (const side of [-1, 1])
  for (const check of [false, true])
    part(() => cyl(0.006, 0.018), ["fuel"], {
      id: "parts.depth.part.016",
      instance: [check, side],
      name: check ? "Fuel check-valve vent outlet" : "Fuel capillary vent outlet",
      pos: A.VENT(side, check),
      ext: true,
      note: note("Independent capillary balance vent and one-way inlet end below wing", "AFM 7-34; AMM 28-10-00 p 6"),
    });
component(
  ["power-flow-collector-box"],
  "Power Flow collector box",
  ["engine", "environment"],
  [fs(1), -0.31, 0.05],
  [0.17, 0.06, 0.18],
  note(
    "Four numbered header slip joints enter collector; late 41303 style is shown, exact installed serial unconfirmed",
    "PFS 15250-00 Rev E pp. . 3–6; PFS 15102IPCRevGsheet3",
  ),
  true,
);
component(
  ["power-flow-firewall-bracket"],
  "Power Flow firewall bracket",
  ["engine"],
  [FW + 0.035, -0.475, 0.13],
  [0.06, 0.015, 0.045],
  note(
    "Bracket shares bolts beside fuel bulkhead fitting and supports muffler clamp/neoprene strap",
    "PFS 15250-00 RevEp6",
  ),
);
component(
  ["power-flow-engine-mount-heat-shield"],
  "Power Flow engine-mount heat shield",
  ["engine"],
  [fs(1.07), -0.22, -0.28],
  [0.11, 0.008, 0.075],
  note(
    "Shield clamped to engine mount adjacent to cylinder 4 header; prevents radiant heat damage",
    "PFS 15250-00 RevEp7; IPC sheet 5",
  ),
);
for (let i = 0; i < 3; i++)
  drum(
    ["power-flow-ball-joint-spring", i],
    "Power Flow ball-joint spring",
    ["engine"],
    [fs(1.06) + (i - 1) * 0.017, -0.39, 0.12],
    0.005,
    0.026,
    note(
      "Three springs keep exhaust ball-joint flanges aligned while accommodating engine motion; no maintenance dimensions are inferred from geometry",
      "PFS 15250-00 Rev E pp. 4, 6; IPC sheet 8",
    ),
  );
component(
  ["gea-configuration-module"],
  "GEA configuration module",
  ["avionics"],
  [A.GEA[0] + 0.037, A.GEA[1] + 0.02, A.GEA[2]],
  [0.018, 0.015, 0.023],
  note("Backshell module preserves installation configuration; distinct from airframe sensors", "Garmin SMM 7.3"),
);
drum(
  ["gea-backshell-thermocouple"],
  "GEA backshell thermocouple",
  ["avionics"],
  [A.GEA[0] + 0.038, A.GEA[1] - 0.02, A.GEA[2]],
  0.005,
  0.015,
  note(
    "K-type backshell thermocouple compensates engine temperature measurement in conjunction with configuration module",
    "Garmin SMM 7.3.3",
  ),
);

export const DEPTH_PARTS = CAT.parts.slice(firstDepthPart);
