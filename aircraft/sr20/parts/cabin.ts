/**
 * Cockpit and cabin: instrument panel and glareshield, bolster switches, ignition switch, console, seats, side yokes,
 * trim cartridges, flap drive and switch, fuel selector and boost pump switch, CAPS handle, fire extinguisher, armrest,
 * ELT and ALT AIR knob.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeos, roundEnds, sweepGeo } from "@/lib/geometry";
import { toVec3, type Vec3 } from "@/lib/math";
import { box, cyl, sectionSlab, wingP } from "../geometry";
import { PEDAL_TT } from "../rig";
import { useSR20 } from "../store";
import { part, selPtrAnim } from "./catalogue";

/* ---------- cockpit / cabin ---------- */
part(() => sectionSlab(2.3, -0.18, 0.3, 0.97, 0.04, 2.32), ["avionics", "cabin"], {
  color: "#2B3238",
  name: "Instrument panel",
  note: "All-metal sectional panel under a composite glareshield.",
});
part(() => sectionSlab(2.24, 0.3, 0.35, 0.95, 0.2, 2.36), ["cabin"], {
  color: "#2B3238",
  name: "Glareshield",
  note: "Projects over the panel; windshield diffuser outlet runs along its base.",
});
/** Prism: a profile in the x–y plane (side view) extruded across z0…z1. */
function prism(pts: [number, number][], z0: number, z1: number) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), {
    depth: z1 - z0,
    bevelEnabled: false,
  });
  g.translate(0, 0, z0);
  return g;
}
/**
 * Sloped face seen from the side, from its lower aft edge a up to its upper forward edge b. `at(t, out, z)` is the point t up
 * the slope and `out` off it into the cabin; `rot` turns a part drawn facing aft (−x) to face out of the slope.
 */
function slope(a: [number, number], b: [number, number]) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    dx = (b[0] - a[0]) / L,
    dy = (b[1] - a[1]) / L;
  const tilt = Math.atan2(-dx, dy);
  return {
    at: (t: number, out: number, z: number): Vec3 => [a[0] + dx * t - dy * out, a[1] + dy * t + dx * out, z],
    tilt,
    rot: [0, 0, tilt] as Vec3,
  };
}
// POH Fig. 7-4: the bolster runs between the yokes directly under the displays, about 10 cm deep. Its flat top carries the switch
// strip, facing up at the pilot; the MD302 is on its aft face. The avionics stack of the centre console (item 15) leans back from
// the displays down to the console between the bolster halves.
const BOLSTER_TOP = slope([2.18, -0.005], [2.28, -0.005]);
// Separate bolster halves leave the centre-console avionics stack unobstructed (POH Fig. 7-4).
part(
  () => mergeGeos([-1, 1].map((s) => box(0.1, 0.145, 0.305).translate(0, 0, s * 0.2475))),
  ["cabin", "lighting", "electrical"],
  {
    pos: [2.23, -0.0775, 0],
    color: "#39424A",
    name: "Bolster switch panel",
    note: "Below the PFD (POH Fig. 7-4 item 18, Fig. 7-12): a placard, then MASTER (BAT 2, BAT 1, ALT 1, ALT 2, AVIONICS) and EXTERIOR LIGHTS (NAV, STROBE, LAND), PITOT HEAT, the ICE PROTECT positions (blank without FIKI), and the PANEL and INSTRUMENT dimmers at the right end. The MD302 standby is below the switches, under the PFD.",
  },
);
/**
 * Bolster switch strip under the PFD, laid out from POH Fig. 7-12: the strip spans the PFD's width (z −0.385 … −0.10) and
 * `slot` maps the figure's horizontal position (its pixel column, strip 205–625) onto it. The rockers sit close together,
 * five MASTER then the EXTERIOR LIGHTS; PITOT HEAT and the ICE PROTECT positions follow after a gap. Up = ON.
 */
const slot = (px: number) => -0.385 + (px - 205) * (0.285 / 420);
/** Point on the bolster top at the strip's centre line (dt up the slope), `out` off its surface. */
const onStrip = (z: number, out: number, dt = 0) => BOLSTER_TOP.at(0.05 + dt, out, z);
const SR = () => useSR20.getState().s;
part(() => box(0.004, 0.048, 0.285), ["cabin", "lighting", "electrical"], {
  pos: onStrip(slot(415), 0.001),
  rot: BOLSTER_TOP.rot,
  color: "#20262B",
});
part(() => box(0.003, 0.03, 0.06), ["cabin"], {
  pos: onStrip(slot(255), 0.004),
  rot: BOLSTER_TOP.rot,
  color: "#9AA3AA",
});
(
  [
    [312, "BAT 2", "Battery 2 relay: BAT 2 feeds ESS BUS 1 and charges from it.", () => SR().elec.bat2],
    [
      329,
      "BAT 1",
      "Battery 1 relay: BAT 1 on the Main Dist Bus 1 side, for starting; ALT 1 needs it on.",
      () => SR().elec.bat1,
    ],
    [346, "ALT 1", "Alternator 1 field; needs BAT 1 on.", () => SR().elec.alt1],
    [363, "ALT 2", "Alternator 2 field.", () => SR().elec.alt2],
    [380, "AVIONICS", "AVIONICS bus.", () => SR().elec.avionics],
    [397, "NAV", "Wingtip position and aft position lights.", () => SR().lights.nav],
    [414, "STROBE", "Wingtip anti-collision strobes.", () => SR().lights.strobe],
    [431, "LAND", "Both wingtip landing lights.", () => SR().lights.land],
    [
      448,
      "ICE",
      "Wing ice inspection lights. Fig. 7-12 shows only NAV, STROBE and LAND (exterior lighting is in the Spectra wing tip light supplement): shown after LAND, position approximate.",
      () => SR().lights.ice,
    ],
    [470, "PITOT HEAT", "Heated pitot tube; a current sensor drives PITOT HEAT FAIL.", () => SR().pitot.heat],
  ] as [number, string, string, () => boolean][]
).forEach(([px, label, note, on]) =>
  part(() => box(0.01, 0.02, 0.0095), ["electrical", "lighting"], {
    pos: onStrip(slot(px), 0.007),
    rot: BOLSTER_TOP.rot,
    color: "#D8DDE0",
    anim: (m) => {
      m.rotation.z = BOLSTER_TOP.tilt + (on() ? -0.3 : 0.3);
    },
    name: label + " switch",
    note: note + " Bolster switch panel (POH Fig. 7-12), up = ON.",
  }),
);
// ICE PROTECT positions (blank on a non-FIKI airplane) and the wider blank slot before the dimmers
(
  [
    [495, 0.0095],
    [512, 0.0095],
    [537, 0.02],
  ] as [number, number][]
).forEach(([px, w]) =>
  part(() => box(0.004, 0.02, w), ["cabin"], { pos: onStrip(slot(px), 0.004), rot: BOLSTER_TOP.rot, color: "#3A4148" }),
);
(
  [
    [0.012, "PANEL dimmer"],
    [-0.012, "INSTRUMENT dimmer"],
  ] as [number, string][]
).forEach(([dt, name]) =>
  part(() => cyl(0.008, 0.014, "x", 16), ["lighting"], {
    pos: onStrip(slot(588), 0.008, dt),
    rot: BOLSTER_TOP.rot,
    color: "#20262B",
    name,
    note: "Right end of the bolster switch panel: PANEL forward, INSTRUMENT aft of it (POH Fig. 7-12).",
  }),
);
// POH 7-13, Fig. 7-4 item 19: left side of the instrument panel, outboard of the PFD; above the yoke tube here (height approximate)
part(() => cyl(0.016, 0.01, "x"), ["engine", "electrical"], { pos: [2.276, 0.03, -0.47], color: "#3E4A52" });
part(() => box(0.012, 0.03, 0.008), ["engine", "electrical"], {
  pos: [2.266, 0.03, -0.47],
  color: "#C9D0D5",
  anim: (m) => {
    m.rotation.x = ({ OFF: -1, R: -0.5, L: 0, BOTH: 0.5, START: 1 } as const)[SR().eng.key];
  },
  name: "Ignition key switch",
  pin: true,
  pinIn: ["engine"],
  note: "Keyed rotary switch on the left side of the instrument panel, outboard of the PFD: OFF – R – L – BOTH – START, spring-loaded from START to BOTH (POH 7-13, Fig. 7-4 item 19).",
});
part(() => box(0.9, 0.26, 0.26), ["cabin"], {
  pos: [1.63, -0.4, 0],
  color: "#39424A",
  name: "Center console",
  note: "Horizontal section between the seats: power and mixture levers, fuel selector, armrest; breakers, ALT AIR, ELT switch and alternate static on its left side. The avionics stack and flap switch are on its sloping front section.",
});
// front section of the console (Fig. 7-4 item 15, POH 7-13, 7-76), leaning back from the displays down to the console top; top to
// bottom: GCU 479 FMS keyboard, GMC 707 autopilot mode controller, GMA 350 audio panel, then the flap control at its foot (order
// from Fig. 7-4; slope and heights approximate)
export const STACK = slope([2.0, -0.27], [2.22, -0.005]);
part(
  () =>
    prism(
      [
        [2.0, -0.27],
        [2.22, -0.005],
        [2.28, -0.005],
        [2.28, -0.53],
        [2.0, -0.53],
      ],
      -0.08,
      0.09,
    ),
  ["cabin", "avionics"],
  {
    color: "#39424A",
    name: "Avionics panel (centre console)",
    note: "Sloping front section of the centre console, rising between the bolster halves to meet the displays: FMS keyboard, autopilot mode controller and audio panel, with the flap control at its foot (POH 7-13, Fig. 7-4 items 10 and 15).",
  },
);
part(() => box(0.4, 0.18, 0.02), ["electrical"], {
  pos: [1.78, -0.4, -0.14],
  color: "#5A4A1C",
  name: "Circuit breaker panel",
  note: "Left side of the center console. Holds ESS 1/2, MAIN 1/2/3, NON ESS, A/C 1/2 and AVIONICS bus breakers.",
  pin: true,
});
(
  [
    [1.25, -0.33, "Pilot seat", 0.4],
    [1.25, 0.33, "Front passenger seat", 0.4],
    [0.35, -0.24, "Rear seat (2+1 bench)", 0.46],
    [0.35, 0.28, "Rear seat", 0.4],
  ] as [number, number, string, number][]
).forEach(([x, z, name, w], i) => {
  part(() => box(0.48, 0.1, w), ["cabin"], {
    pos: [x, -0.4, z],
    color: "#6B5A48",
    name,
    note:
      i < 2
        ? "Adjusts fore/aft on an upward-angled track. Honeycomb core crushes to absorb vertical impact — never stand on it."
        : "Seat backs split 60/40 and fold forward for long cargo.",
  });
  part(() => box(0.09, 0.58, w * 0.92), ["cabin"], {
    pos: [x - 0.27, -0.08, z],
    rot: [0, 0, 0.2],
    color: "#6B5A48",
    name,
    note:
      i < 2
        ? "4-point harness with inflatable shoulder belt (airbag)."
        : "3-point harness on inertia reels at the rear bulkhead.",
  });
});
export const YOKES = [
  { side: "L", z: -0.46 },
  { side: "R", z: 0.46 },
];
export const YOKE_X = 2.02,
  YOKE_Y = -0.06;
/**
 * Side-yoke grip in its roll group's frame (origin where the yoke tube meets the grip; s −1 left, +1 right): a handle rising
 * up and inboard from the tube end to a head that carries the trim switch (outboard) and the red A/P DISC button (inboard).
 * The POH gives no dimensions: shape and proportions are from photos of the Perspective panel.
 */
const GRIP_LEAN = 37 * (Math.PI / 180);
/** Point in side s's grip frame: xo fore-aft, d along the handle (+ up, toward the head), w across it (+ toward the right wing). */
const onGrip = (s: number, xo: number, d: number, w: number): Vec3 => [
  xo,
  d * Math.cos(GRIP_LEAN) + w * s * Math.sin(GRIP_LEAN),
  -s * d * Math.sin(GRIP_LEAN) + w * Math.cos(GRIP_LEAN),
];
const gripRot = (s: number): Vec3 => [-s * GRIP_LEAN, 0, 0];
const HEAD = { d: 0.114, x: -0.01, l: 0.04 };
function sideYokeGeo(s: number) {
  const handle = sweepGeo(
    [
      onGrip(s, 0.002, -0.05, 0),
      onGrip(s, 0.006, 0, 0),
      onGrip(s, 0.003, 0.05, 0),
      onGrip(s, -0.006, HEAD.d - 0.01, 0),
    ],
    (t) => {
      const e = roundEnds(t, 0.14, 0);
      return [(0.019 + 0.002 * Math.sin(Math.PI * t)) * e, 0.017 * e];
    },
  );
  const head = new RoundedBoxGeometry(0.054, HEAD.l, 0.048, 3, 0.013);
  head.rotateX(gripRot(s)[0]);
  head.translate(...onGrip(s, HEAD.x, HEAD.d, 0));
  const boss = cyl(0.022, 0.036, "x");
  boss.translate(0.016, 0, 0);
  return mergeGeos([handle, head, boss]);
}
YOKES.forEach(({ side }) => {
  const s = side === "L" ? -1 : 1,
    grip = "grip:" + side,
    top = HEAD.d + HEAD.l / 2;
  part(() => cyl(0.018, 0.5, "x"), ["controls"], {
    parent: "yoke:" + side,
    chan: ["elevator", "aileron"],
    pos: [0.27, 0, 0],
    color: "#555E66",
    name: "Yoke tube",
    note: "Slides fore/aft in its bearing carriage for pitch (driving the elevator drop link) and rotates the carriage for roll.",
  });
  part(() => sideYokeGeo(s), ["controls"], {
    parent: grip,
    chan: ["elevator", "aileron"],
    color: "#20262B",
    name: "Side yoke",
    note: "Single-handed grip on the end of each yoke tube, angled up and inboard. Push or pull to slide the tube for pitch; rotate the grip to turn the tube and its bearing carriage for roll. Conical trim switch and red A/P DISC button on the head; PTT switch for COM.",
  });
  part(
    () => {
      const g = new THREE.CylinderGeometry(0.004, 0.008, 0.012, 16);
      g.translate(0, 0.006, 0);
      return g;
    },
    ["controls"],
    {
      parent: grip,
      chan: ["elevator", "aileron"],
      pos: onGrip(s, HEAD.x - 0.004, top, s * 0.01),
      rot: gripRot(s),
      color: "#4A535B",
      name: "Trim switch",
      note: "Conical switch on the head of each yoke: fore/aft = pitch trim, left/right = roll trim. The trim motors move the spring cartridges' neutral point (PITCH TRIM and ROLL TRIM breakers, ESS BUS 2).",
    },
  );
  part(() => cyl(0.0065, 0.006), ["controls"], {
    parent: grip,
    chan: ["elevator", "aileron"],
    pos: onGrip(s, HEAD.x + 0.004, top + 0.002, -s * 0.011),
    rot: gripRot(s),
    color: "#C8313B",
    name: "A/P DISC button",
    note: "Red autopilot disconnect button on the head of each yoke: disengages the GFC 700.",
  });
});
part(() => box(0.08, 0.05, 0.05), ["controls"], {
  pos: [-2.66, 0.05, 0.04],
  color: "#9F85E6",
  chan: ["elevator"],
  name: "Pitch trim cartridge",
  note: "Electric motor shifts the spring cartridge's neutral point. 2 A PITCH TRIM breaker, ESS BUS 2.",
});
part(() => box(0.08, 0.04, 0.06), ["controls"], {
  pos: toVec3(wingP(-3.4, 0.66, 0)),
  color: "#9F85E6",
  chan: ["aileron"],
  name: "Roll trim cartridge",
  note: "Spring cartridge at the left actuation pulley. Autopilot also uses it. 2 A ROLL TRIM, ESS BUS 2.",
});
part(() => box(0.08, 0.04, 0.06), ["controls"], {
  pos: [PEDAL_TT.x - 0.05, PEDAL_TT.y, -0.22],
  color: "#9F85E6",
  chan: ["rudder"],
  name: "Yaw trim spring cartridge",
  note: "Centering spring on the pedal torque tube. Ground-adjustable only.",
});
export const FT = { x: 0.66, y: -0.54 };
part(() => cyl(0.02, 1.9, "z"), ["flaps"], {
  pos: [FT.x, FT.y, 0],
  color: "#9F85E6",
  name: "Flap torque tube",
  note: "Mechanically ties both flaps to one actuator.",
});
part(() => box(0.24, 0.07, 0.09), ["flaps"], {
  pos: [FT.x + 0.02, FT.y + 0.02, 0],
  color: "#7C57CF",
  name: "Flap actuator",
  note: "Motorized linear actuator; proximity switches stop travel and drive the position lights. 10 A FLAPS, NON ESS BUS.",
  pin: true,
});
// POH 7-23: at the bottom of the console's vertical section. Fig. 7-4 (7-14/7-15) item 10 is the panel between the avionics panel
// (15) and the engine controls (13), knob on its right: here at the foot of the upright avionics panel, right of centre.
part(() => box(0.04, 0.04, 0.07), ["flaps"], {
  pos: STACK.at(0.08, 0.02, 0.04),
  rot: STACK.rot,
  color: "#7C57CF",
  name: "FLAPS switch",
  pin: true,
  note: "Airfoil-shaped knob at the bottom of the console's vertical section, with detents at UP (0%), 50% and 100%; VFE is marked at 50% and 100%. A light at each position comes on when the flaps reach it: UP green, 50% and 100% yellow (POH 7-23, Fig. 7-4 item 10). Position in the model is approximate.",
});
part(() => cyl(0.045, 0.03, "y"), ["fuel"], {
  pos: [1.24, -0.25, 0],
  name: "Fuel selector valve",
  note: "LEFT / RIGHT / OFF at the rear of the console. Lift the release to select OFF.",
  pin: true,
});
part(() => box(0.09, 0.02, 0.02), ["fuel"], { pos: [1.24, -0.23, 0], color: "#F2F5F7", anim: selPtrAnim });
part(() => box(0.04, 0.03, 0.04), ["fuel"], {
  pos: [1.34, -0.26, 0.08],
  name: "BOOST PUMP switch",
  note: "Next to the selector. On for takeoff, climb, maneuvering, landing and tank switching.",
});
part(() => new THREE.CylinderGeometry(0.012, 0.012, 0.1, 8), ["caps", "cabin"], {
  pos: [1.3, 0.63, -0.02],
  color: "#D32640",
  name: "CAPS activation T-handle",
  note: "Ceiling, centerline, above the pilot's right shoulder. Pull ~2 in. of slack, then pull straight down (up to 45 lb).",
  pin: true,
});
part(() => box(0.03, 0.02, 0.15), ["caps", "cabin"], { pos: [1.3, 0.58, -0.02], color: "#D32640" });
part(() => cyl(0.04, 0.24), ["cabin"], {
  pos: [2.18, -0.45, -0.44],
  color: "#D32640",
  name: "Fire extinguisher",
  note: "Halon 1211, class B & C. Forward outboard in the pilot footwell. About 2.5 lb; check gauge/pin preflight. Case dimensions and mounting coordinates are approximate.",
  pin: true,
});
part(() => box(0.22, 0.05, 0.12), ["cabin"], {
  pos: [1.45, -0.24, 0],
  color: "#8A6A3A",
  name: "Armrest: egress hammer & hour meters",
  note: "8 oz ball-peen hammer for breaking the acrylic windows. HOBBS runs with BAT 1 + either ALT on; FLIGHT starts ~35 KIAS.",
  pin: true,
});
part(() => box(0.16, 0.09, 0.11), ["cabin", "caps"], {
  pos: [-0.8, -0.28, 0.13],
  color: "#EB7A12",
  name: "ELT — Artex ELT 1000",
  note: "406 MHz + 121.5 MHz. Triggers at 4–5 ft/s longitudinal Δv or on CAPS deployment. Removable for portable use.",
  pin: true,
});
// both stand proud of the circuit breaker panel face (z −0.15) on the left side of the console
part(() => box(0.05, 0.04, 0.02), ["cabin"], {
  pos: [1.92, -0.44, -0.161],
  color: "#EB7A12",
  name: "ELT remote switch (RCPI)",
  note: "ON – ARM/OFF – TEST, red LED flashes when transmitting. Below the ALT AIR knob by the pilot's right knee (POH Section 7, ELT Remote Switch and Indicator Panel).",
});
part(() => box(0.05, 0.05, 0.03), ["engine"], {
  pos: [1.92, -0.36, -0.166],
  color: "#E0B040",
  name: "ALT AIR – PULL knob",
  note: "On the left side of the console near the pilot's right knee. Press the lock button, pull, release: opens the alternate air door. Use if induction filter blockage is suspected (POH Section 7, Alternate Air Control).",
});
