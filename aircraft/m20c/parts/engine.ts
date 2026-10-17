/** M20C powerplant: Hartzell propeller, Lycoming O-360-A1D and accessories, exhaust, cowl flaps, and the push-pull engine controls and ignition switch. */
import * as THREE from "three";

import { mats } from "@/lib/materials";
import { type Vec3 } from "@/lib/math";
import type { SysId } from "@/lib/systems";
import { magAnim, plugAnim, sparkPhase } from "@/lib/anims";
import { FW, PANEL_X, box, botY, cyl } from "../geometry";
import { live } from "../model";

import { fires, glow, knobAnim, part, sim } from "./catalogue";
import { EQUIPMENT } from "../placement";

/* ---------- propeller: Hartzell HC-C2YK-1B / 7666 A-2, 74 in ---------- */
export const PROP: Vec3 = [3.07, 0, 0];
const bladeGeo = () => {
  const sh = new THREE.Shape();
  sh.moveTo(-0.045, 0.16);
  sh.quadraticCurveTo(-0.075, 0.55, -0.035, 0.925);
  sh.lineTo(0.03, 0.92);
  sh.quadraticCurveTo(0.075, 0.55, 0.05, 0.16);
  sh.lineTo(-0.045, 0.16);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: false });
  g.translate(0, 0, -0.01);
  g.rotateY(Math.PI / 2);
  return g;
};
for (let i = 0; i < 2; i++)
  part(bladeGeo, ["propeller", "engine"], {
    id: "parts.engine.propeller-blade.001",
    instance: [i],
    parent: "blade:" + i,
    color: "#2E3439",
    name: "Propeller blade",
    note: "Hartzell aluminium-alloy constant-speed blade, 74 in diameter (OM p. 2); hub HC-C2YK-1B, blades 7666 A-2 (AFM, Ranger 1-4). Pitch 13° low to 29° high at the 30 in station. Installed hub suffix, blades and modifications determine AD applicability; no recurring interval is inferred from the generic model name (Hartzell 115N Inspection/Check).",
    ext: true,
    pin: i === 0,
    pinIn: [],
  });
part(() => cyl(0.09, 0.1, "x", 20), ["propeller"], {
  id: "parts.engine.propeller-hub.002",
  pos: [PROP[0] - 0.02, 0, 0],
  color: "#4A5158",
  name: "Propeller hub",
  ext: true,
  note: "Single-acting hub: engine oil pressure from the governor drives the piston to increase blade angle; a spring and the blades' aerodynamic twisting moment return them to low pitch (Ranger 1-2). Lose oil and the blades go fine — full RPM.",
  pin: true,
});

/* ---------- engine: Lycoming O-360-A1D, 180 hp @ 2,700 ---------- */
export const CYLS = [
  { n: 1, x: 2.72, s: 1 },
  { n: 2, x: 2.79, s: -1 },
  { n: 3, x: 2.44, s: 1 },
  { n: 4, x: 2.51, s: -1 },
];
part(() => box(0.62, 0.26, 0.3), ["engine"], {
  id: "parts.engine.lycoming-o-360-a1d.003",
  pos: [2.58, -0.02, 0],
  color: "#7C858C",
  fairing: true,
  name: "Lycoming O-360-A1D",
  note: "Four-cylinder, horizontally opposed, air cooled, carbureted,361cuin,8.5:1 compression,180 hp at 2700 RPM (1968 OM scan p. 9). Minimum aviation fuel91/96 in the 1968 book; use approved fuel for the fitted engine and current records. No fuel injection or turbocharger.",
  pin: true,
});
part(() => box(0.44, 0.1, 0.26), ["engine"], {
  id: "parts.engine.oil-sump-wet-sump.004",
  pos: [2.58, -0.2, 0],
  color: "#6A737A",
  fairing: true,
  name: "Oil sump (wet sump)",
  note: "Pressure-type wet sump, 8 qt; add a quart below 6 (OM p. 2). Automatic cooler bypass operates when cold or obstructed (1968 OM scan p. 16). The study180°F display crossover is illustrative, not a valve calibration.",
  pin: true,
});
CYLS.forEach((c) => {
  const parent = "cyl:" + c.n;
  part(() => cyl(0.07, 0.18, "z", 18), ["engine"], {
    instance: [c.n, parent],
    id: "parts.engine.part.005",
    parent,
    color: "#7C858C",
    fairing: true,
    name: "Cylinder " + c.n,
    note:
      (c.s > 0 ? "Right" : "Left") +
      " bank (Lycoming numbering: 1–3 right, 2–4 left). Baffling directs the cooling air over the fins and out past the cowl flaps (OM p. 2).",
  });
  for (let k = -2; k <= 2; k++)
    part(() => cyl(0.085, 0.008, "z", 18), ["engine"], {
      id: "parts.engine.part.006",
      instance: [k, c.n, parent],
      parent,
      pos: [0, 0, k * 0.032],
      color: "#8C959C",
      fairing: true,
    });
  part(() => box(0.14, 0.14, 0.05), ["engine"], {
    instance: [c.n, parent],
    id: "parts.engine.part.007",
    parent,
    pos: [0, 0, c.s * 0.11],
    color: "#6A737A",
    fairing: true,
    name: "Cylinder head " + c.n,
    note: "Two shielded spark plugs; the CHT probe is on one head (OM p. 2: shielded plugs and harness suppress radio noise).",
  });
  (
    [
      ["u", ["U", 0.055]],
      ["l", ["L", -0.055]],
    ] as const
  ).forEach(([instance1, [pos, dy]]) => {
    const mag = c.s > 0 === (pos === "L") ? "R" : "L";
    part(() => cyl(0.014, 0.05, "x", 10), ["engine"], {
      id: "parts.engine.part.008",
      instance: [instance1, c.n, parent],
      parent,
      pos: [-0.09, dy, c.s * 0.11],
      color: "#DADFE2",
      anim: plugAnim(fires(mag), sparkPhase(`${c.n}${pos}`)),
      name: `Spark plug — cyl ${c.n} ${pos === "U" ? "upper" : "lower"}`,
      note: `Fired by the ${mag === "R" ? "right" : "left"} magneto (conventional cross-firing assumed; not in the manual).`,
    });
  });
});
part(() => cyl(0.045, 0.12, "x"), ["engine"], {
  id: "parts.engine.right-magneto.009",
  pos: [2.26, 0.07, 0.11],
  color: "#3E4A52",
  anim: magAnim(fires("R")),
  name: "Right magneto",
  note: "Bendix magneto on the accessory case; grounded out during the start so only the retard-breaker left magneto fires (OM p. 2). Run-up check at 1,700 RPM: max drop 125 (OM p. 18).",
  pin: true,
});
part(() => cyl(0.045, 0.12, "x"), ["engine"], {
  id: "parts.engine.left-magneto-retard-points.010",
  pos: [2.26, 0.07, -0.11],
  color: "#3E4A52",
  anim: magAnim(fires("L")),
  name: "Left magneto (retard points)",
  note: "Has a second set of retard breaker points: with START held, the vibrator feeds an interrupted current through them, giving a 'shower of sparks' after top dead centre for easy starting (OM p. 2).",
  pin: true,
});
part(() => box(0.06, 0.08, 0.1), ["engine", "electrical"], {
  id: "parts.engine.starting-vibrator.011",
  pos: [FW + 0.04, 0.12, 0.0],
  color: "#4B5860",
  anim: glow("#4B5860", "#6FD8FF", () => sim().E.vibrator, ["engine", "electrical"]),
  name: "Starting vibrator",
  note: "On the upper firewall: furnishes the shower of sparks while the starter switch is pushed in (OM p. 2). Battery powered — 'push to start' from 1963 (supplement p. 2).",
  pin: true,
});
part(() => box(0.12, 0.11, 0.12), ["engine", "electrical"], {
  id: "parts.engine.starter.012",
  pos: EQUIPMENT.starter,
  color: "#4B5860",
  anim: glow("#4B5860", "#E7B416", () => sim().E.starterOn, ["engine", "electrical"]),
  name: "Starter",
  note: "At the front of the engine (TCDS arm −18 in). Engaged by pushing the ignition key in at START; release when the engine fires and the switch springs back to BOTH (OM p. 16). Let it cool 5 min after 10–15 s of cranking (Ranger 3-7).",
  pin: true,
});
part(() => box(0.1, 0.12, 0.1), ["engine", "fuel"], {
  id: "parts.engine.carburetor-marvel-schebler-ma-4-5.013",
  pos: EQUIPMENT.carburetor,
  color: "#7E8A93",
  fairing: true,
  name: "Carburetor (Marvel-Schebler MA-4-5)",
  note: "Updraft float carburetor under the sump (Ranger 1-3). Its accelerator pump is the only primer: pump the throttle twice with the boost pump on (OM p. 15). Mixture to idle cut-off stops the engine (OM p. 24).",
  pin: true,
});
part(() => box(0.14, 0.1, 0.16), ["engine"], {
  id: "parts.engine.carburetor-air-box-filter.014",
  pos: EQUIPMENT.airbox,
  color: "#C9B98F",
  anim: (m) => {
    m.material = sim().s.eng.carbHeat > 0.5 ? mats("#E0B040").on : mats("#C9B98F").on;
  },
  name: "Carburetor air box & filter",
  note: "Ram air through the filter in the lower cowl; the carb-heat valve switches to unfiltered hot air from the muff (Ranger 2-4). Clean the filter every 25 h (OM p. 26).",
  pin: true,
});
part(() => box(0.03, 0.08, 0.1), ["engine"], {
  id: "parts.engine.carburetor-heat-valve.015",
  pos: EQUIPMENT.carbHeatValve,
  color: "#E0B040",
  anim: (m) => {
    m.rotation.z = sim().s.eng.carbHeat * 1.1;
  },
  name: "Carburetor heat valve",
  note: "Full heat rather than partial when reducing power for descent or landing (partial heat can bring the carburetor to icing temperature) (OM p. 22).",
  pin: true,
  pinIn: [],
});
part(() => cyl(0.055, 0.28, "z"), ["engine", "environment"], {
  id: "parts.engine.exhaust-manifold-muffler.016",
  pos: EQUIPMENT.exhaust,
  color: "#8A5A3C",
  name: "Exhaust manifold & muffler",
  note: "Crossover exhaust under the engine; the cabin heat muff surrounds it (OM p. 10). The schematic housing is aft of the carburetor, with separate occupied space; exact mounting coordinates are not dimensioned in the manual. A cracked muff lets exhaust into the cabin heat — the classic Mooney CO hazard.",
  pin: true,
});
part(
  () => {
    const g = new THREE.LatheGeometry(
      [
        [0.06, -0.09],
        [0.07, -0.08],
        [0.07, 0.08],
        [0.06, 0.09],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
      24,
    );
    g.rotateX(Math.PI / 2);
    return g;
  },
  ["environment", "engine"],
  {
    id: "parts.engine.heat-muff.017",
    pos: EQUIPMENT.exhaust,
    color: "#E0522B",
    fairing: true,
    name: "Heat muff",
    note: "Shroud around the exhaust manifold; ram air through it is ducted to the junction box behind the firewall (OM p. 10).",
    pin: true,
  },
);
part(() => box(0.1, 0.16, 0.06), ["engine"], {
  id: "parts.engine.oil-cooler.018",
  pos: [2.55, -0.26, -0.3],
  color: "#9A6A48",
  name: "Oil cooler",
  note: "Mounted on the lower left side of the cowling (OM p. 2; TCDS arm −18 in); the automatic bypass valve routes oil around it when cold (Ranger 2-6).",
  pin: true,
});
part(() => cyl(0.04, 0.1, "x"), ["engine"], {
  id: "parts.engine.oil-filter-optional.019",
  pos: [FW + 0.06, -0.1, -0.2],
  color: "#9A6A48",
  name: "Oil filter (optional)",
  note: "Full-flow oil filter mounted on the firewall was optional equipment (OM p. 2); the standard engine has pressure and suction screens.",
  pin: true,
});
[1, -1].forEach((s) =>
  part(() => box(0.2, 0.012, 0.16), ["engine"], {
    instance: [s],
    id: "parts.engine.cowl-flap-fixed.020",
    pos: [2.08, botY(2.08) + 0.03, s * 0.16],
    rot: [0, 0, 0.2],
    color: "#8C959C",
    name: "Cowl flap (fixed)",
    note: "Two cowl-flap doors on the lower cowling. On 1962–67 airplanes they were adjustable from a push-pull control (open on the ground and in the climb, OM p. 2, 21); from s/n 680001 they are fixed in a position that gives proper cooling airflow on the ground and in flight (TCDS 2A3 note 2; Ranger 2-6).",
    ext: true,
    pin: s > 0,
  }),
);
(
  [
    ["member-1", [1, 1]],
    ["member-2", [1, -1]],
    ["member-3", [-1, 1]],
    ["member-4", [-1, -1]],
  ] as const
).forEach(([instance2, [a, b]]) =>
  part(() => cyl(0.03, 0.04, "x", 12), ["engine", "airframe"], {
    id: "parts.engine.engine-mount-bushing-lord.021",
    instance: [instance2],

    pos: [FW + 0.25, a * 0.16 - 0.05, b * 0.2],
    color: "#1E2226",
    name: "Engine mount bushing (Lord)",
    note: "Four rubber bushings on the aft side of the engine mount and isolate vibration (OM p. 2); Dynafocal mount. A propeller sagging an inch below the cowl centreline is the owner's cue for worn mounts.",
    pin: a > 0 && b > 0,
  }),
);
part(() => cyl(0.025, 0.05, "x"), ["engine", "vacuum"], {
  id: "parts.engine.engine-driven-vacuum-pump.022",
  pos: [2.28, -0.08, 0.0],
  color: "#3A9448",
  anim: glow("#2A6A34", "#5FD36E", () => live.vac > 3.5, ["vacuum", "engine"]),
  name: "Engine-driven vacuum pump",
  note: "Airborne dry carbon-vane pump on the accessory case; suction powers artificial horizon, directional gyro and PC servos (1968 OM scan p. 17; IPC 205 Fig. 43). Pump or drive failure can remove all three functions. No fixed failure-hour prediction is supported by the inspected manuals.",
  pin: true,
});
part(() => cyl(0.06, 0.12, "x"), ["electrical", "engine"], {
  id: "parts.engine.alternator-12-v-60-a.023",
  pos: [2.8, -0.18, -0.2],
  color: "#D9960F",
  anim: glow("#5A5040", "#D9960F", () => sim().E.genOn, ["electrical", "engine"]),
  name: "Alternator — 12 V, 60 A",
  note: "Selected study configuration: belt-driven60A alternator. The 1968 POH 1187 scan p. 7,24 permits either 50 A generator or 60 A alternator; it does not establish N6947N's installed model. Field regulator circuit and main output breaker are separate;1968 main breaker is on right-side upholstery panel (MAN 106 § 9-3). Earlier generator behavior is not silently substituted.",
  pin: true,
});
part(() => box(0.08, 0.08, 0.1), ["engine", "fuel"], {
  id: "parts.engine.engine-driven-fuel-pump.024",
  pos: [2.3, -0.2, -0.16],
  color: "#7E8A93",
  name: "Engine-driven fuel pump",
  note: "Mechanical diaphragm pump on the accessory case: the normal fuel supply, 0.5–6 psi, normal 2.5–3.5 (OM p. 3, 29).",
  pin: true,
});

/* ---------- engine controls: push-pull knobs on the panel centre (OM p. 2) ---------- */
const Q = { x: PANEL_X - 0.02, y: -0.17 };
(
  [
    [
      "throttle",
      [
        "Throttle",
        -0.1,
        "#1B1F23",
        () => sim().s.eng.throttle,
        "Push-pull throttle control on the panel regulates manifold pressure (OM p. 2). Pump it twice to prime (OM p. 15). Full retard with the gear up sounds the horn.",
        ["engine"],
      ] as [string, number, string, () => number, string, SysId[]],
    ],
    [
      "mixture-hexagon-knob",
      [
        "Mixture (hexagon knob)",
        -0.05,
        "#C8313B",
        () => sim().s.eng.mix,
        "Hexagon-shaped push-pull control between throttle and propeller (OM p. 2). Full forward = rich; full out = idle cut-off. Lean with the optional EGT: peak then 25 °F lean for economy, 100 °F rich of peak for best power (OM p. 20). Don't lean above 75 % power.",
        ["engine", "fuel"],
      ] as [string, number, string, () => number, string, SysId[]],
    ],
    [
      "propeller-control",
      [
        "Propeller control",
        0.0,
        "#2D63B8",
        () => sim().s.eng.prop,
        "Push-pull control operating the governor: sets and holds engine RPM by adjusting blade angle (OM p. 2). Exercise at 1,800–2,000 RPM, 100 RPM drop (OM p. 18).",
        ["engine", "propeller"],
      ] as [string, number, string, () => number, string, SysId[]],
    ],
    [
      "carburetor-heat",
      [
        "Carburetor heat",
        0.06,
        "#1B1F23",
        () => sim().s.eng.carbHeat,
        "Pull for full heat when power is reduced for descent or landing (OM p. 22). Unfiltered air — avoid on the ground except to test (Ranger 2-4).",
        ["engine"],
      ] as [string, number, string, () => number, string, SysId[]],
    ],
  ] as const
).forEach(([instance3, [name, z, color, val, note, sys]]) => {
  part(() => cyl(0.013, 0.03, "x", 14), sys, {
    id: "parts.engine.part.025",
    instance: [instance3],

    pos: [Q.x, Q.y, z],
    color,
    anim: knobAnim(Q.x, val),
    name,
    note,
    pin: true,
    pinIn: sys,
  });
  part(() => cyl(0.004, 0.08, "x", 6), sys, {
    id: "parts.engine.part.026",
    instance: [instance3],

    pos: [Q.x + 0.04, Q.y, z],
    color: "#9AA3AA",
    anim: knobAnim(Q.x + 0.04, val),
  });
});
part(() => box(0.03, 0.03, 0.03), ["engine", "electrical"], {
  id: "parts.engine.magneto-starter-switch.027",
  pos: [PANEL_X - 0.03, -0.1, -0.5],
  color: "#A8B0B6",
  anim: (m) => {
    m.rotation.x = { OFF: -0.9, R: -0.45, L: 0, BOTH: 0.45, START: 0.9 }[sim().s.eng.key];
  },
  name: "Magneto / starter switch",
  note: "OFF – R – L – BOTH – START: turn to START and push the key in to crank; it springs back to BOTH (OM p. 15–16; Ranger 2-5). Must be OFF when the engine is not running.",
  pin: true,
});
