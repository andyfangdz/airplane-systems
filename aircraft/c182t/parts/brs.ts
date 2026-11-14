/**
 * C182T catalogue: the optional BRS-182 whole-airplane parachute (Ballistic Recovery Systems STC SA01999CH), fitted only
 * while the BRS panel's "installed" option is on. Descriptions follow the BRS-182 Installation Manual 9005-IM Rev C
 * (12/2/2004) pp. 1-1 – 1-10 ("IM"); the manual's figures are undimensioned, so every position, size and route here is
 * illustrative. The AFM supplement was not available (see SOURCES.md).
 */
import type * as THREE from "three";
import type { PartAnim } from "@/lib/catalogue";
import { curveOf } from "@/lib/geometry";
import type { Vec3 } from "@/lib/math";
import { RELEASE_T, ROCKET_T, TAUT_T, strapOut } from "../brs";
import { X, Z, box, cyl, sph, topY, tubeGeo, wingP } from "../geometry";
import { live } from "../model";
import { P3, S, part } from "./catalogue";

/** Optional equipment: the parts exist only with the BRS option on. */
const fitted = () => S().brs.installed;
/** Front-strap fairing and strap paint (illustrative). */
const KEVLAR = "#C9A227";
const FIBERGLASS = "#D8D4C8";

/* ---------- canister and rocket (IM p. 1-1) ---------- */
/** Canister centre: in the baggage compartment toward the right side (installer's description; IM Fig. 1 is a photo). */
export const BRS_BOX: Vec3 = P3(110, 8, 40);
part(() => box(0.34, 0.26, 0.28), ["brs"], {
  id: "parts.brs.parachute-canister.001",
  pos: BRS_BOX,
  fitted,
  fairing: true,
  name: "Parachute canister",
  note: "Aluminum canister in the baggage compartment holding the 2,400 sq. ft. round parachute, pressure packed in its deployment bag, with the rocket lanyards and the rear attachment harness; a vacuum-formed ABS plastic cover breaks away when the system is activated. “The BRS-182 Parachute Canister must not be opened by anyone other than authorized factory personnel” (BRS-182 Installation Manual 9005-IM Rev C pp. 1-1, 1-8, 1-10). It takes roughly a third of the baggage area, toward the right side (installer's description); size and position approximate.",
  pin: true,
});
/** Rocket motor base (igniter end) and nozzle direction: aft of the canister, aimed up and aft through the rear window. */
const ROCKET: Vec3 = P3(121, 6, 48);
const ROCKET_TILT = 0.9;
part(() => cyl(0.045, 0.3), ["brs"], {
  id: "parts.brs.rocket-motor.002",
  pos: ROCKET,
  rot: [0, 0, ROCKET_TILT],
  fitted,
  anim: (m) => {
    // gone with the parachute once fired
    m.visible = live.brsT < ROCKET_T;
  },
  name: "Rocket motor (BRS-900)",
  note: "Manually activated solid-propellant rocket mounted aft of the parachute canister. Composite propellant grains in a filament-wound liner inside the motor case; a dual-firing-train percussion igniter lights a black powder/magnesium booster. Fired, it “will penetrate the rear window and extract the parachute away from the airplane” (IM pp. 1-1, 1-3, 1-6 – 1-7). Mounting angle and size approximate.",
  pin: true,
});
part(() => box(0.2, 0.2, 0.16), ["brs"], {
  id: "parts.brs.rocket-shield.003",
  pos: ROCKET,
  rot: [0, 0, ROCKET_TILT],
  fitted,
  fairing: true,
  color: FIBERGLASS,
  name: "Rocket shield",
  note: "Fiberglass shield protecting the rocket motor aft of the canister (IM p. 1-1). Shape approximate.",
  pin: true,
});
/** Igniter at the rocket base, where the activation cable ends. */
const IGNITER: Vec3 = P3(118.5, 6, 44);
part(() => sph(0.03), ["brs"], {
  id: "parts.brs.igniter.004",
  pos: IGNITER,
  fitted,
  name: "Percussion igniter",
  note: "Mechanical, needs no electrical source and is unarmed normally: pulling the cable compresses a spring and cocks a plunger; after ½ in. of plunger travel two ball bearings release it to strike two firing pins and shotgun primers. Directly, about 25 to 30 lb would fire it; the extra handle force is cable-housing friction (IM pp. 1-5 – 1-7).",
  pin: true,
});

/* ---------- rear harness (IM pp. 1-2 – 1-4) ---------- */
/** Rear attachment assembly on the aft cabin structure (FS 134 wall). */
const REAR_ATTACH: Vec3 = P3(131, 0, 44);
part(() => box(0.06, 0.1, 0.3), ["brs"], {
  id: "parts.brs.rear-attachment-assembly.005",
  pos: REAR_ATTACH,
  fitted,
  name: "Rear attachment assembly",
  note: "Custom assembly on the aft cabin primary structure that spreads the parachute inflation loads across the area; the rear harness straps attach to it (IM p. 1-2, Fig. 3). Position and size approximate.",
  pin: true,
});
const rearStowed: PartAnim = (m) => {
  // pulled out of the baggage area with the parachute
  m.visible = live.brsT < TAUT_T;
};
(
  [
    ["short", 0.05],
    ["long", -0.05],
  ] as const
).forEach(([section, dz]) =>
  part(
    () =>
      tubeGeo(
        [
          [BRS_BOX[0] - 0.1, BRS_BOX[1] + 0.1, BRS_BOX[2] + dz],
          [REAR_ATTACH[0] + 0.15, REAR_ATTACH[1] + 0.02, dz],
          [REAR_ATTACH[0] + 0.03, REAR_ATTACH[1], dz],
        ],
        0.01,
      ),
    ["brs"],
    {
      instance: [section],
      id: "parts.brs.rear-harness.006",
      fitted,
      anim: rearStowed,
      color: KEVLAR,
      name: section === "short" ? "Rear harness — short section" : "Rear harness — long section",
      note:
        section === "short"
          ? "Woven Kevlar, stowed in the baggage area. It limits the rear strap length to control pitch during the deployment cycle; a ring-and-link release (more than 100 to 1 mechanical advantage) held by a nylon cord lets it go when the line cutter fires (IM pp. 1-2 – 1-4). Route approximate."
          : "Folded in half and sewn with rows of heavy nylon thread that peel apart under tension to absorb shock. It takes over after the short section releases, and “the airplane assumes its touchdown attitude of approximately ten degrees nose down” (IM p. 1-4). Route approximate.",
      pin: true,
    },
  ),
);
part(() => cyl(0.014, 0.06), ["brs"], {
  id: "parts.brs.line-cutter.007",
  pos: [BRS_BOX[0] - 0.13, BRS_BOX[1] + 0.1, BRS_BOX[2] + 0.05],
  rot: [Math.PI / 2, 0, 0],
  fitted,
  anim: (m) => {
    m.visible = live.brsT < TAUT_T;
  },
  name: "Reefing line cutter",
  note: `Pyrotechnic cutter on the short rear-harness release. Its eight-second fuse starts when the release pin is pulled as the parachute is extracted; it then severs the cord holding the release's last link (IM pp. 1-3 – 1-4). Shown releasing at T + ${RELEASE_T.toFixed(1)} s.`,
});

/* ---------- front harness straps (IM p. 1-2) ---------- */
/** Chord fraction of the front carry-through spar (structure.ts), where the wings attach at the cabin top. */
const FSPAR = 0.25;
/** Rear-window slot the straps leave the cabin through (approximate station). */
const SLOT_FS = 106;
/**
 * Front strap centreline on side s (-1 left, +1 right): out of the canister, up through the rear-window slot, then forward
 * just above the top skin to the front wing attachment point. The IM gives the route, not its shape (Fig. 2 is a photo).
 */
export const frontStrap = (s: number): Vec3[] => {
  const pts: Vec3[] = [
    [BRS_BOX[0] + 0.05, BRS_BOX[1] + 0.13, BRS_BOX[2] + s * 0.05],
    [X(SLOT_FS), topY(X(SLOT_FS)) - 0.06, s * 0.04],
    [X(SLOT_FS), topY(X(SLOT_FS)) + 0.015, s * 0.05],
  ];
  // forward over the rear window and cabin top, onto the wing centre section and its attach fitting
  for (const fs of [104, 96, 90]) pts.push([X(fs), topY(X(fs)) + 0.015, s * 0.07]);
  for (const c of [0.95, 0.7, 0.45]) {
    const p = wingP(s * Z(10 + 12 * (1 - c)), c, 1);
    pts.push([p.x, p.y + 0.015, p.z]);
  }
  const fit = wingP(s * Z(22), FSPAR, 1);
  pts.push([fit.x, fit.y + 0.015, fit.z]);
  return pts;
};
/** Front wing attachment points (strap ends). */
export const FRONT_ATTACH = [-1, 1].map((s) => frontStrap(s).at(-1)!) as [Vec3, Vec3];
const strapCurves = new Map<number, THREE.Curve<THREE.Vector3>>();
/** Point (airplane coordinates) where the front strap on side s leaves the skin when a fraction `out` is peeled off. */
export const strapPeel = (s: number, out: number) => {
  let c = strapCurves.get(s);
  if (!c) strapCurves.set(s, (c = curveOf(frontStrap(s))));
  return c.getPointAt(out);
};
/** Stowed front strap: the part still on the skin, ahead of the peel point; gone at line stretch. */
const peelOff: PartAnim = (m) => {
  const out = strapOut(live.brsT),
    g = m.geometry as THREE.TubeGeometry,
    { tubularSegments, radialSegments } = g.parameters;
  m.visible = out < 1;
  g.setDrawRange(Math.round(out * tubularSegments) * radialSegments * 6, Infinity);
};
[-1, 1].forEach((s) =>
  part(() => tubeGeo(frontStrap(s), 0.012), ["brs"], {
    instance: [s],
    id: "parts.brs.front-harness-strap.008",
    fitted,
    dynamicGeo: true,
    anim: peelOff,
    color: KEVLAR,
    ext: true,
    name: "Front harness strap",
    note: "Woven Kevlar strap “routed through a slot in the rear window and across the top skin to the front wing attachment points”, under a fiberglass fairing (not drawn). On deployment the rocket's pull peels both front straps away from the top skin (IM pp. 1-2 – 1-3). Installers cut holes in the cabin-top skin near the forward wing attach points. Route and slot position approximate.",
    pin: s > 0,
  }),
);
[-1, 1].forEach((s) =>
  part(() => sph(0.025), ["brs"], {
    instance: [s],
    id: "parts.brs.front-attach-point.009",
    pos: FRONT_ATTACH[s < 0 ? 0 : 1],
    fitted,
    ext: true,
    name: "Front wing attachment point",
    note: "The front harness straps end at the front wing attachment points on the cabin top, one each side (IM p. 1-2). One of the four harness attachment points; the two rear straps attach to the aft cabin structure. Fitting shape approximate.",
    pin: s > 0,
  }),
);

/* ---------- activation (IM p. 1-5) ---------- */
/** Handle box: on the floor between and slightly forward of the pilot and copilot. */
const HANDLE_BOX: Vec3 = P3(34, 2, 28.5);
part(() => box(0.14, 0.07, 0.08), ["brs"], {
  id: "parts.brs.activation-handle-box.010",
  pos: HANDLE_BOX,
  fitted,
  color: FIBERGLASS,
  name: "Activation handle box",
  note: "Protective fiberglass box on the floor between and slightly forward of the pilot and copilot. The handle is the only part of the system the pilot can reach in flight; a cover keeps it from being pulled accidentally (IM p. 1-5, Fig. 7). Size and exact position approximate.",
  pin: true,
});
part(() => box(0.03, 0.025, 0.07), ["brs"], {
  id: "parts.brs.activation-handle.011",
  pos: [HANDLE_BOX[0], HANDLE_BOX[1] + 0.05, HANDLE_BOX[2]],
  fitted,
  anim: (m) => {
    // pulled up out of the box: slack take-up, then the stroke that arms and fires the igniter
    m.position.y = HANDLE_BOX[1] + 0.05 + (S().brs.deployed && live.brsT >= 0 ? 0.12 : 0);
  },
  name: "Activation handle",
  note: "Two separate, deliberate actions: remove the protective cover from the handle box, then pull the handle out with at least 40 lb of force. The first few inches take up cable slack; the rest arms and fires the igniter (IM p. 1-5). The AFM supplement's procedure and placards were not available: see the BRS panel.",
  pin: true,
});
part(
  () =>
    tubeGeo(
      [
        [HANDLE_BOX[0] - 0.05, HANDLE_BOX[1] - 0.02, HANDLE_BOX[2]],
        P3(60, 3, 27),
        P3(90, 5, 28),
        P3(108, 6, 30),
        P3(115, 6, 37),
        [IGNITER[0], IGNITER[1], IGNITER[2]],
      ],
      0.006,
    ),
  ["brs"],
  {
    id: "parts.brs.activation-cable.012",
    fitted,
    color: "#8A8F94",
    name: "Activation cable",
    note: "Flexible stainless-steel aircraft-grade cable from the handle to the rocket igniter, in a Teflon-lined housing under the carpet (IM p. 1-5). Route approximate.",
    pin: true,
  },
);

/** The harness legs for the deployment overlay: the two front attachment points and the rear attachment assembly. */
export const BRS_HARNESS: Record<"fwdL" | "fwdR" | "aft", Vec3> = {
  fwdL: FRONT_ATTACH[0],
  fwdR: FRONT_ATTACH[1],
  aft: [REAR_ATTACH[0] + 0.03, REAR_ATTACH[1], 0],
};
