import * as THREE from "three";
import type { Vec3 } from "@/lib/math";
import type { SysId } from "@/lib/systems";
import { magAnim, plugAnim, sparkPhase } from "@/lib/anims";
import { PANEL_X, box, cyl, fs } from "../geometry";
import { part, sim, fires, ENGINE, glow, leverAnim } from "./catalogue";

/* ---------- propeller: MT MTV-12-B/183-59b, 3 blades, Ø 1.83 m ---------- */
export const PROP: Vec3 = [fs(0.38), 0, 0];
const bladeGeo = () => {
  // scimitar planform: tip swept back, root under the spinner
  const sh = new THREE.Shape();
  sh.moveTo(-0.055, 0.14);
  sh.quadraticCurveTo(-0.085, 0.5, -0.02, 0.915);
  sh.lineTo(0.025, 0.9);
  sh.quadraticCurveTo(0.08, 0.5, 0.06, 0.14);
  sh.lineTo(-0.055, 0.14);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.022, bevelEnabled: false });
  g.translate(0, 0, -0.011);
  g.rotateY(Math.PI / 2);
  return g;
};
for (let i = 0; i < 3; i++)
  part(bladeGeo, ["propeller", "engine"], {
    parent: "blade:" + i,
    color: "#2E3439",
    name: "Propeller blade",
    note: "MT wood-composite blade with a fibre-reinforced coating and stainless-steel leading-edge cladding (AFM 7-24). Ø 1.83 m, pitch 11°–30° at 0.75 R (STC SA06-52). Light blades change RPM faster than metal ones — move the levers slowly (AFM 7-22).",
    ext: true,
    pin: i === 0,
  });

/* ---------- engine: Lycoming IO-360-M1A (180 hp @ 2,700) ---------- */
export const CYLS = [
  { n: 1, x: fs(0.76), s: 1 },
  { n: 2, x: fs(0.83), s: -1 },
  { n: 3, x: fs(1.0), s: 1 },
  { n: 4, x: fs(1.07), s: -1 },
];
part(() => box(0.7, 0.24, 0.3), ["engine"], {
  pos: [fs(0.92), -0.02, 0],
  color: "#7C858C",
  name: "Lycoming IO-360-M1A",
  note: "Air-cooled, four-cylinder, horizontally opposed, direct drive, fuel injected, underslung exhaust. 5,916 cm³ (361 in³), 180 hp at 2,700 RPM (AFM 7-20).",
  pin: true,
});
part(() => box(0.48, 0.1, 0.26), ["engine"], {
  pos: [fs(0.9), -0.2, 0],
  color: "#6A737A",
  name: "Oil sump",
  note: "Wet sump, 4–8 qt (VFR min 4, IFR min 6). Filler neck and dipstick behind a door in the cowling (AFM 2-5, 2-28). The fuel-pressure and fuel-flow sensors are mounted at the sump (SMM 2-18).",
  pin: true,
});
CYLS.forEach((c) => {
  const parent = "cyl:" + c.n;
  part(() => cyl(0.07, 0.18, "z", 18), ["engine"], {
    parent,
    color: "#7C858C",
    name: "Cylinder " + c.n,
    note:
      (c.s > 0 ? "Right" : "Left") +
      " bank (Lycoming numbering assumed: 1-3 right, 2-4 left). CHT probe in each head, EGT probe in each exhaust header (SMM 2-21).",
  });
  for (let k = -2; k <= 2; k++)
    part(() => cyl(0.085, 0.008, "z", 18), ["engine"], { parent, pos: [0, 0, k * 0.032], color: "#8C959C" });
  part(() => box(0.16, 0.16, 0.06), ["engine"], {
    parent,
    pos: [0, 0, c.s * 0.115],
    color: "#6A737A",
    name: "Cylinder head " + c.n,
    note: "Two spark plugs, CHT probe; fuel-injection nozzle at the intake port.",
  });
  (
    [
      ["U", 0.055],
      ["L", -0.055],
    ] as const
  ).forEach(([pos, dy]) => {
    const mag = c.s > 0 === (pos === "L") ? "R" : "L";
    part(() => cyl(0.014, 0.05, "x", 10), ["engine"], {
      parent,
      pos: [-0.1, dy, c.s * 0.115],
      color: "#DADFE2",
      anim: plugAnim(fires(mag), sparkPhase(`${c.n}${pos}`), ENGINE),
      name: `Spark plug — cyl ${c.n} ${pos === "U" ? "upper" : "lower"}`,
      note: `Fired by the ${mag === "R" ? "right" : "left"} magneto (plug assignment not in the AFM; conventional cross-firing assumed).`,
    });
  });
});
part(() => cyl(0.045, 0.12, "x"), ["engine"], {
  pos: [fs(1.27), 0.07, 0.1],
  color: "#3E4A52",
  anim: magAnim(fires("R"), ENGINE),
  name: "Right magneto",
  note: "Slick magneto at the rear of the engine; the G1000 tach sensor sits in its bleed port (SMM 2-19). SlickSTART boosts spark energy for starting (AFM 7-43).",
  pin: true,
});
part(() => cyl(0.045, 0.12, "x"), ["engine"], {
  pos: [fs(1.27), 0.07, -0.1],
  color: "#3E4A52",
  anim: magAnim(fires("L"), ENGINE),
  name: "Left magneto",
  note: "Second Slick magneto. Run-up check L–BOTH–R–BOTH: max drop 175 RPM, max difference 50 RPM (AFMS p. 47).",
  pin: true,
});
part(() => box(0.1, 0.09, 0.1), ["engine", "propeller"], {
  pos: [fs(0.75), 0.12, 0.06],
  color: "#C0602F",
  name: "Propeller governor",
  note: "Flanged onto the front of the engine (arm 0.747 m). Meters engine oil to the hub to hold the RPM set by the blue lever; if the governor or oil supply fails the blades go to fine pitch (max RPM) (AFM 7-22).",
  pin: true,
});
part(() => cyl(0.065, 0.12, "x"), ["electrical", "engine"], {
  pos: [fs(0.64), -0.18, -0.17],
  color: "#D9960F",
  anim: glow("#5A5040", "#D9960F", () => sim().E.altFeed, ["electrical", "engine"]),
  name: "Alternator — 28 V, 70 A",
  note: "Front of the engine, V-belt driven (AFM 7-42). Regulated by the VR2000 regulator with over-voltage protection; output through the ALT 70 A breaker to the MAIN bus.",
  pin: true,
});
part(() => box(0.12, 0.11, 0.12), ["engine", "electrical"], {
  pos: [fs(0.64), -0.2, 0.16],
  color: "#4B5860",
  anim: glow("#4B5860", "#E7B416", () => sim().E.starterOn, ["engine", "electrical"]),
  name: "Starter (Skytec 149-24LS)",
  note: "Front of the engine, fed from the relay box through the START relay (~160 A). Max 10 s cranking, then 20 s cooling; after 6 attempts let it cool 30 min (AFMS p. 39).",
  pin: true,
});
part(() => box(0.08, 0.08, 0.1), ["engine", "fuel"], {
  pos: [fs(1.28), -0.12, -0.12],
  color: "#7E8A93",
  name: "Engine-driven fuel pump",
  note: "Mechanical pump at the rear of the engine — the normal fuel supply; has a bleed line (AFM 7-20, 7-31).",
  pin: true,
});
part(() => cyl(0.05, 0.14, "x"), ["engine", "fuel"], {
  pos: [fs(1.08), -0.31, 0],
  color: "#7E8A93",
  name: "Fuel servo (injection timing device)",
  note: "The AFM schematic's 'injection timing device with screen': meters fuel with airflow and mixture. The fuel-pressure tap is here (AFM 7-31).",
  pin: true,
});
part(() => box(0.06, 0.05, 0.06), ["engine", "fuel"], {
  pos: [fs(0.92), 0.15, 0],
  color: "#7E8A93",
  name: "Fuel distributor",
  note: "Flow divider on top of the engine: four lines to the cylinders, plus a distributor bleed line (AFM 7-31).",
  pin: true,
});
part(() => box(0.06, 0.04, 0.05), ["engine", "fuel", "avionics"], {
  pos: [fs(0.98), -0.27, 0.15],
  color: "#2F7FE6",
  name: "Fuel-flow transducer (Shadin)",
  note: "Inline in the fuel hose in a fire sleeve, on a bracket at the oil sump; read by the GEA 71 (SMM 2-19).",
});
part(() => box(0.08, 0.14, 0.1), ["engine"], {
  pos: [fs(0.6), -0.06, 0.32],
  color: "#9A6A48",
  name: "Oil cooler",
  note: "Exists (pre-heat thaws congealed oil in it, AFM 4A-14); location not in the documents — shown behind the right inlet, which also feeds it per an unofficial technical description.",
});
part(() => box(0.09, 0.1, 0.11), ["engine"], {
  pos: [fs(0.62), 0.0, 0.2],
  color: "#C9B98F",
  name: "Induction air filter",
  note: "Normal induction air passes an air filter. Location not in the AFM; shown behind the right inlet.",
  pin: true,
});
part(() => box(0.03, 0.08, 0.1), ["engine"], {
  pos: [fs(0.82), -0.18, 0.2],
  color: "#E0B040",
  anim: (m) => {
    m.position.y = -0.18 - (sim().s.eng.altAir ? 0.05 : 0);
  },
  name: "Alternate air door",
  note: "Opened by the ALTERNATE AIR lever: takes warm air from the engine compartment if MP drops from icing or a blocked filter (AFM 7-23).",
});
part(() => cyl(0.06, 0.3, "z"), ["engine", "environment"], {
  pos: [fs(0.95), -0.36, 0.06],
  color: "#8A5A3C",
  name: "Tuned exhaust (Power Flow)",
  note: "Underslung exhaust; the XLS has the Power Flow Systems tuned exhaust (AOPA 2008). Hot — can cause burns (AFM 4A-10).",
  pin: true,
});
// open sleeve on the muffler's own axis (muffler r 0.06), its ends necked onto the muffler wall, over the muffler's
// right-hand end (the side the right-intake duct comes from): z 0.105–0.205 leaves the tailpipe outlet (z ≈ 0.06–0.1)
// uncovered, and r 0.068 keeps it below the fuel-flow transducer
part(
  () => {
    const g = new THREE.LatheGeometry(
      [
        [0.0615, -0.05],
        [0.068, -0.038],
        [0.068, 0.038],
        [0.0615, 0.05],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
      24,
    );
    g.rotateX(Math.PI / 2);
    return g;
  },
  ["environment", "engine"],
  {
    pos: [fs(0.95), -0.36, 0.155],
    color: "#E0522B",
    fairing: true,
    name: "Muffler heat shroud",
    note: "Cabin heat source: 'a shroud round the exhaust muffler and the outside wall of the muffler make the heat exchanger'. Ram air from the right cowl intake flows through it to the heat valve on the firewall (unofficial DA40 technical description and its heating schematic; the AFM, AFMS and AMM give no heat source). Which part of the muffler it covers is approximate.",
  },
);

/* ---------- engine controls ---------- */
const Q = { x: fs(2.0), y: -0.27 };
(
  [
    [
      "Throttle",
      -0.045,
      "#1B1F23",
      () => sim().s.eng.throttle,
      "Left lever, large black knob. Forward = MAX PWR. At the forward stop extra fuel is supplied for high power. The GFC 700 GA button is on the left side of the knob (AFM 7-21; AFMS p. 57).",
    ],
    [
      "RPM lever",
      0,
      "#2D63B8",
      () => sim().s.eng.rpmLever,
      "Centre lever, blue handle. Forward = HIGH RPM (fine pitch). Sets the governor; RPM then holds regardless of airspeed and throttle (AFM 7-21).",
    ],
    [
      "Mixture lever",
      0.045,
      "#C8313B",
      () => sim().s.eng.mix,
      "Right lever, red handle with a lock. Forward = RICH; pull to the rear stop to shut the engine down (AFM 7-22, 7-23).",
    ],
  ] as [string, number, string, () => number, string][]
).forEach(([name, z, color, val, note], i) => {
  // each lever is tagged with the systems it works; in the engine view the quadrant carries the one label
  const sys: SysId[] = [["engine"], ["engine", "propeller"], ["engine", "fuel"]][i] as SysId[];
  part(() => box(0.03, 0.04, 0.03), sys, {
    pos: [Q.x, Q.y, z],
    color,
    anim: leverAnim(Q.x, val),
    name,
    note,
    pin: true,
    pinIn: sys.filter((x) => x !== "engine"),
  });
});
part(() => box(0.14, 0.06, 0.15), ["engine", "cabin"], {
  pos: [Q.x, Q.y - 0.07, 0],
  color: "#39424A",
  name: "Throttle quadrant",
  note: "Large centre console: throttle (black), RPM (blue) and mixture (red) levers with a friction adjuster — a loose friction is the first check for uncommanded RPM changes (AFM 7-21, 3-13).",
  pin: true,
  pinIn: ["engine"],
});
part(() => box(0.02, 0.012, 0.012), ["autopilot"], {
  pos: [Q.x + 0.0, Q.y + 0.01, -0.063],
  color: "#D9D9D9",
  anim: leverAnim(Q.x, () => sim().s.eng.throttle),
  name: "GA button",
  note: "Go-around switch on the left side of the throttle knob: disconnects the AP and commands GA (wings level, 7° nose up) (AFMS p. 57; CRG 6-16).",
  pin: true,
});
part(() => box(0.05, 0.05, 0.03), ["engine"], {
  pos: [fs(1.86), -0.33, -0.14],
  color: "#E0B040",
  anim: (m) => {
    m.position.x = fs(1.86) - (sim().s.eng.altAir ? 0.05 : 0);
  },
  name: "ALTERNATE AIR lever",
  note: "Under the panel, left of the centre console. Pull aft = ALTERNATE AIR ON (placard changes) (AFM 7-23).",
  pin: true,
  pinIn: [],
});
part(() => box(0.03, 0.03, 0.03), ["engine", "electrical"], {
  pos: [PANEL_X - 0.035, -0.17, -0.01],
  pinIn: ["electrical"],
  color: "#A8B0B6",
  anim: (m) => {
    const k = sim().s.eng.key;
    m.rotation.x = { OFF: -0.9, L: -0.45, R: 0, BOTH: 0.45, START: 0.9 }[k];
  },
  name: "Ignition key switch",
  note: "OFF – L – R – BOTH – START, turning right (AFM 7-20). START engages the starter through the START relay; the G1000 shows red STARTER ENGD while it is engaged.",
  pin: true,
});
