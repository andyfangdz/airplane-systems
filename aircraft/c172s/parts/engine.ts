/** C172S catalogue: propeller and engine — cylinders and ignition, oil, induction, exhaust, cooling, mount and engine controls. */
import * as THREE from "three";
import type { Vec3 } from "@/lib/math";
import { magAnim, plugAnim, pushPull, sparkPhase } from "@/lib/anims";
import { X, box, cyl, tubeGeo } from "../geometry";
import { IN } from "../../cessna/airframe";
import { P3, part, S, fires, altDoorAnim } from "./catalogue";

/* ---------- propeller: McCauley 1A170E/JHA7660, 76 in, fixed pitch (POH 1-5) ---------- */
/** Blades between the spinner bulkheads (FS −40.8 / −37.3, POH 6-23), clear of the nose bowl face at about FS −37.4. */
export const PROP: Vec3 = P3(-39.6, 0, 49.25);
const bladeGeo = () => {
  const R = 38 * IN,
    sh = new THREE.Shape();
  sh.moveTo(-0.055, 0.1);
  sh.quadraticCurveTo(-0.075, R * 0.55, -0.04, R);
  sh.lineTo(0.025, R);
  sh.quadraticCurveTo(0.06, R * 0.5, 0.05, 0.1);
  sh.lineTo(-0.055, 0.1);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: false });
  g.translate(0, 0, -0.008);
  g.rotateY(Math.PI / 2 - 0.35);
  return g;
};
for (let i = 0; i < 2; i++)
  part(bladeGeo, ["propeller", "engine"], {
    parent: "blade:" + i,
    color: "#2E3439",
    name: "Propeller blade",
    note: "One-piece forged aluminum, anodized; fixed pitch, 2 blades, 76 in (75 in minimum) (POH 1-5, 2-6). Dress out nicks; never use alkaline cleaners (POH 8-24).",
    ext: true,
    pin: i === 0,
  });
part(() => cyl(0.055, 0.1, "x"), ["propeller"], {
  pos: P3(-35.5, 0, 49.25),
  color: "#8C959C",
  name: "Propeller spacer / hub",
  note: "3.5-inch spacer C5464 (arm −36.0) between the crankshaft flange and the propeller (POH 6-23). No governor: there is nothing to control the blade angle.",
});

/* ---------- engine: Lycoming IO-360-L2A, 180 BHP @ 2,700 RPM (POH 1-5) ---------- */
part(() => box(0.62, 0.3, 0.42), ["engine"], {
  pos: P3(-18.6, 0, 47.5),
  color: "#7E8890",
  name: "Lycoming IO-360-L2A",
  note: "Four-cylinder, horizontally opposed, fuel-injected, direct drive, air cooled, 360 cu in; 180 BHP at 2,700 RPM; wet sump (POH 1-5, 7-29). Engine CG FS −18.6 (POH 6-23).",
  pin: true,
});
part(() => box(0.5, 0.12, 0.34), ["engine"], {
  pos: P3(-18, 0, 38.5),
  color: "#B85A2A",
  name: "Oil sump",
  note: "Wet sump on the bottom of the engine: 8 qt capacity (9 total with the filter); never operate below 5 qt (POH 7-35, 1-7).",
});
/** Cylinder positions (Lycoming numbering: 1 & 3 right, 2 & 4 left; the POH does not map numbers to positions). */
export const CYLS = [
  { n: 1, fs: -27.5, s: 1 },
  { n: 2, fs: -24, s: -1 },
  { n: 3, fs: -15.5, s: 1 },
  { n: 4, fs: -12, s: -1 },
];
CYLS.forEach((c) => {
  const base = P3(c.fs, c.s * 11, 49.5);
  part(() => cyl(0.06, 0.2, "z", 18), ["engine"], {
    pos: base,
    color: "#7C858C",
    name: "Cylinder " + c.n,
    note:
      (c.s > 0 ? "Right" : "Left") +
      " bank. Baffles route cooling air down around the fins (POH 7-37). Numbering per Lycoming convention (not stated in the POH).",
  });
  for (let k = -2; k <= 2; k++)
    part(() => cyl(0.075, 0.008, "z", 18), ["engine"], {
      pos: [base[0], base[1], base[2] + c.s * k * 0.03],
      color: "#8C959C",
    });
  part(() => box(0.15, 0.15, 0.07), ["engine"], {
    pos: [base[0], base[1] + 0.01, base[2] + c.s * 0.12],
    color: "#6A737A",
    name: "Cylinder head " + c.n,
    note: "Two spark plugs; CHT thermocouple in the head, EGT probe in the exhaust riser (POH 7-34).",
  });
  (
    [
      ["U", 0.055],
      ["L", -0.055],
    ] as const
  ).forEach(([pos, dy]) => {
    // POH 7-36: left magneto fires the upper left and lower right plugs; right magneto the lower left and upper right
    const mag = c.s < 0 === (pos === "U") ? "L" : "R";
    part(() => cyl(0.014, 0.05, "x", 10), ["engine"], {
      pos: [base[0] - 0.09, base[1] + dy, base[2] + c.s * 0.12],
      color: "#DADFE2",
      anim: plugAnim(fires(mag), sparkPhase(`${c.n}${pos}`)),
      name: `Spark plug — cyl ${c.n} ${pos === "U" ? "upper" : "lower"}`,
      note: `Fired by the ${mag === "L" ? "left" : "right"} magneto. “The left magneto fires the upper left and lower right spark plugs, and the right magneto fires the lower left and upper right” (POH 7-36).`,
    });
  });
  part(() => box(0.03, 0.03, 0.03), ["engine"], {
    pos: [base[0] - 0.02, base[1] - 0.12, base[2] + c.s * 0.08],
    color: "#C9B98F",
    name: "Fuel injector nozzle",
    note: "Air-bleed nozzle in the intake valve chamber of each cylinder (POH 7-37).",
  });
});
part(() => cyl(0.045, 0.12, "x"), ["engine"], {
  pos: P3(-5.5, -5.5, 54),
  color: "#3E4A52",
  anim: magAnim(fires("L")),
  name: "Left magneto",
  note: "Fires the upper left and lower right plugs (POH 7-36). Rear accessory case.",
  pin: true,
});
part(() => cyl(0.045, 0.12, "x"), ["engine"], {
  pos: P3(-5.5, 5.5, 54),
  color: "#3E4A52",
  anim: magAnim(fires("R")),
  name: "Right magneto",
  note: "Fires the lower left and upper right plugs (POH 7-36). Normal operation is BOTH; R and L are for checking and emergencies.",
  pin: true,
});
part(() => box(0.12, 0.1, 0.1), ["engine", "electrical"], {
  pos: P3(-33.5, -7, 42.5),
  color: "#4B5860",
  name: "Starter",
  note: "Front of the engine (POH 7-29). MAGNETOS to START with the MASTER on closes the starter contactor in the J-box. Crank 10 s, cool 20 s (POH 4-26).",
  pin: true,
});
part(() => cyl(0.04, 0.1, "x"), ["engine"], {
  pos: P3(-5, 0, 47.5),
  color: "#1F3A5A",
  name: "Oil filter (full flow)",
  note: "Rear of the accessory case; its adapter has a bypass valve for a plugged filter or very cold oil, and carries the oil temperature sensor (POH 7-35, 7-33).",
  pin: true,
});
part(() => box(0.06, 0.14, 0.18), ["engine"], {
  pos: P3(-11, 11, 54),
  color: "#9A6A48",
  name: "Oil cooler",
  note: "Thermostatically controlled remote cooler (POH 7-35); arm −11.0 (POH 6-24). The KAP 140 POH puts it on the right rear baffle.",
});
part(() => cyl(0.012, 0.18, "y"), ["engine"], {
  pos: P3(-8, 9, 52),
  color: "#E0B040",
  name: "Oil dipstick / filler",
  note: "Right rear of the engine through a door in the right cowl. Cap placard “OIL 8 QTS.” Fill to 8 qt for normal flights (POH 7-35, 2-26).",
  pin: true,
});
// on the outside of the crankcase box (BL ±8.27, top WL 53.4): sensors at their equipment-list arms; side and height are not in the POH
part(() => box(0.03, 0.03, 0.03), ["engine"], {
  pos: P3(-12.9, 8.92, 43),
  color: "#3A9448",
  name: "Oil pressure transducer",
  note: "Connected to the engine forward oil pressure port → OIL PRES on the EIS (POH 7-33); P165-5281, arm −12.9 (POH 6-24). Shown at that arm on the right side of the crankcase: the side and height are approximate (not in the POH). A separate low-pressure switch drives the red OIL PRESSURE annunciation at 0–20 PSI.",
});
part(() => box(0.025, 0.025, 0.025), ["engine"], {
  pos: P3(-10.9, 8.82, 43),
  color: "#E0263B",
  name: "Low oil pressure switch",
  note: "Independent of the transducer: OIL PRESSURE (red) at 0–20 PSI — shown before start (POH 7-33, 4-5). The Hobbs runs above 20 PSI (POH 7-13). The POH doesn't locate the switch: shown beside the transducer (approximate).",
});
part(() => box(0.08, 0.06, 0.08), ["engine"], {
  pos: P3(-8, 0, 54.65),
  color: "#4B5860",
  name: "Tach sensor",
  note: "Speed sensor on the engine tachometer drive accessory pad, arm −8.0 → digital RPM to the GEA 71 (POH 7-31, 6-24). Shown on top of the rear accessory case between the magnetos; the pad's exact position is approximate (not in the POH).",
});
// induction
part(() => box(0.06, 0.08, 0.2), ["engine"], {
  pos: P3(-36.5, 0, 37.8),
  color: "#1E2A33",
  name: "Induction air intake",
  note: "Ram air enters through an intake on the lower front of the cowl, through the air filter into the air box (POH 7-36).",
  ext: true,
  pin: true,
});
part(() => box(0.08, 0.1, 0.16), ["engine"], {
  pos: P3(-27.5, 0, 38),
  color: "#C9B98F",
  name: "Induction air filter",
  note: "Arm −27.5 (POH 6-23). Replace as condition warrants, 500 h maximum (POH 8-24). Ice on the filter costs RPM (POH 3-14).",
  pin: true,
});
// The air box and servo sit below the filter, under the front of the engine: the servo (FS −30.6…−25.8, h 31.8–35.8) is below the
// oil sump (bottom h 36.1) and the filter (bottom h 36.0) and just forward of the muffler shroud (FS −25.8); the door is on the air
// box's right side, clear of the filter (BL ≤ 3.15) and the servo. The servo's lines in flows.ts (fuelServo, fuelMetered, fuelReturn,
// intake, altAir, man*) start or end at these positions.
part(() => box(0.1, 0.07, 0.03), ["engine"], {
  pos: P3(-29.4, 3.8, 34.6),
  color: "#E0B040",
  anim: altDoorAnim(X(-29.4)),
  name: "Alternate air door",
  note: "Spring-loaded door in the air box: if the filter blocks, engine suction opens it and draws unfiltered air from the lower cowl — about 10% power loss at full throttle (POH 7-36). No cockpit control. The POH doesn't say where on the air box it is: shown on its right side, below the filter (approximate).",
  pin: true,
});
part(() => cyl(0.05, 0.12, "x"), ["engine", "fuel"], {
  pos: P3(-28.2, 0, 33.8),
  color: "#7E8A93",
  name: "Fuel/air control unit (servo)",
  note: "Under the engine, after the air box (POH 7-36): meters fuel in proportion to induction air flow; throttle and mixture act here. An orifice in its top feeds the fuel return line (POH 7-39, 7-44). Shown under the front of the engine; its exact position is approximate (not in the POH).",
  pin: true,
});
CYLS.forEach((c) =>
  part(
    () =>
      tubeGeo(
        [P3(-26.2, 0, 35.2), P3(-23.8, c.s * 2.5, 37.2), P3(c.fs, c.s * 6, 40), P3(c.fs + 1, c.s * 11, 45.5)],
        0.016,
      ),
    ["engine"],
    {
      color: "#8A969E",
      name: "Intake tube",
      note: "Intake manifold tube from the fuel/air control unit to each cylinder's intake port (POH 7-36). Routing approximate.",
    },
  ),
);
// exhaust and cabin heat
part(() => cyl(0.06, 0.34, "z"), ["engine", "environment"], {
  pos: P3(-22.7, 0, 33.5),
  color: "#8A5A3C",
  name: "Muffler",
  note: "Each cylinder's riser feeds one common muffler below the engine, then a single tailpipe (POH 7-37). Arm −22.7.",
});
part(() => cyl(0.078, 0.26, "z"), ["environment", "engine"], {
  pos: P3(-22.7, 0, 33.5),
  color: "#E0522B",
  fairing: true,
  name: "Muffler heater shroud",
  note: "Outside air flows through a shroud around the muffler and is heated for the cabin (POH 7-37). A muffler crack under the shroud can put CO in the cabin (POH 3-39).",
  pin: true,
});
// cooling
[1, -1].forEach((s) => {
  part(
    () => {
      const g = new THREE.TorusGeometry(0.056, 0.011, 8, 22);
      g.rotateY(Math.PI / 2);
      return g;
    },
    ["engine", "airframe"],
    {
      pos: P3(-37.25, s * 10.2, 53.3),
      color: "#1E2A33",
      ext: true,
      pin: s > 0,
      name: "Cooling air inlet",
      note: "Two intake openings in the front of the cowl; baffles route the air down around the cylinders; it exits at the bottom aft edge of the cowl. No cowl flaps (POH 7-37).",
    },
  );
  part(
    () => {
      const g = new THREE.CircleGeometry(0.056, 20);
      g.rotateY(Math.PI / 2);
      return g;
    },
    ["engine", "airframe"],
    { pos: P3(-37.55, s * 10.2, 53.3), color: "#0B1014", ext: true },
  );
});
part(() => box(0.05, 0.03, 0.42), ["engine"], {
  pos: P3(-1.5, 0, 25),
  color: "#1E2A33",
  name: "Cooling air exit",
  note: "Opening at the bottom aft edge of the cowl (POH 7-37). Point the airplane into the wind for long ground runs (POH 4-30).",
  ext: true,
});
part(() => box(0.32, 0.02, 0.5), ["engine"], {
  pos: P3(-19, 0, 58.5),
  color: "#B8BEC4",
  name: "Cylinder baffles",
  note: "Direct ram air from above the engine down around the cylinders (POH 7-37).",
});
// engine mount
[1, -1].forEach((s) =>
  [1, -1].forEach((u) =>
    part(() => tubeGeo([P3(-0.5, s * 13, 49 + u * 9), P3(-9, s * 9, 47 + u * 4)], 0.009), ["engine", "airframe"], {
      color: "#5C6E7E",
      name: "Engine mount",
      note: "Welded tube mount bolted to the firewall at the four engine mount stringers (POH 7-5).",
    }),
  ),
);
// controls on the panel
part(() => cyl(0.016, 0.03, "x"), ["engine"], {
  pos: P3(18.6, 1.8, 47.5),
  color: "#1A1F23",
  anim: pushPull(X(18.6), () => S().eng.throttle),
  name: "Throttle (with friction lock)",
  note: "Smooth black push-pull knob below the standby instruments: in = FULL, out = IDLE. Friction lock at its base (POH 7-29). With a fixed-pitch prop it sets RPM directly.",
  pin: true,
});
part(() => cyl(0.016, 0.03, "x"), ["engine"], {
  pos: P3(18.6, 5.2, 47.5),
  color: "#C8313B",
  anim: pushPull(X(18.6), () => S().eng.mix),
  name: "Mixture (red, vernier)",
  note: "Red knob with raised points and a lock button: in = RICH, out = IDLE CUTOFF; rotate for fine adjustment (POH 7-29).",
  pin: true,
});
// far lower left of the panel, level with and outboard of the breaker panel (Fig. 7-2 item 33; photos)
part(() => cyl(0.016, 0.01, "x"), ["engine", "electrical"], { pos: P3(17.9, -18.4, 49.6), color: "#3E4A52" });
part(() => box(0.012, 0.032, 0.009), ["engine", "electrical"], {
  pos: P3(18.2, -18.4, 49.6),
  color: "#C9D0D5",
  anim: (m) => {
    const k = S().eng.mags;
    m.rotation.x = ({ OFF: -1, R: -0.5, L: 0, BOTH: 0.5, START: 1 } as const)[k];
  },
  name: "MAGNETOS switch",
  note: "Rotary OFF – R – L – BOTH – START, spring-loaded from START back to BOTH (POH 7-36). The starter relay coil is fed through the WARN breaker.",
  pin: true,
});
