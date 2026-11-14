/**
 * C182T catalogue: the optional BRS-182 whole-airplane parachute (Ballistic Recovery Systems STC SA01999CH), fitted only
 * while the BRS panel's "installed" option is on. Descriptions follow the BRS-182 Installation Manual 9005-IM Rev C
 * (12/2/2004) pp. 1-1 – 1-10 ("IM"). Its Figures 1–4 are undimensioned drawings; the layout here follows them and an
 * installer's photographs (Tennessee Aircraft Services, see SOURCES.md), so every position, size and route is
 * approximate. The AFM supplement was not available.
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

/* ---------- canister and rocket (IM p. 1-1, Fig. 1) ---------- */
/** Canister footprint and height (approximate): an upright column about three times as tall as it is wide (IM Fig. 1). */
const BOX_W = 0.3;
const BOX_H = 0.86;
/**
 * Canister centre: standing on the baggage floor toward the right side, its top just under the rear window (IM Fig. 1;
 * installer's photographs). Fig. 1 draws it leaning slightly; the model keeps it vertical.
 */
export const BRS_BOX: Vec3 = P3(103, 8, 29 + BOX_H / 0.0254 / 2);
/** Top of the canister, under its breakaway cover: where the straps leave and the parachute comes out. */
export const BRS_TOP: Vec3 = [BRS_BOX[0], BRS_BOX[1] + BOX_H / 2, BRS_BOX[2]];
part(() => box(BOX_W, BOX_H, BOX_W), ["brs"], {
  id: "parts.brs.parachute-canister.001",
  pos: BRS_BOX,
  fitted,
  fairing: true,
  name: "Parachute canister",
  note: "Aluminum canister standing upright in the baggage compartment (IM Fig. 1), its top just under the rear window. It holds the 2,400 sq. ft. round parachute, pressure packed in its deployment bag, with the rocket lanyards and the rear attachment harness; a vacuum-formed ABS plastic cover breaks away when the system is activated. “The BRS-182 Parachute Canister must not be opened by anyone other than authorized factory personnel” (BRS-182 Installation Manual 9005-IM Rev C pp. 1-1, 1-8, 1-10). It takes roughly a third of the baggage area, almost all the way to the right side (installer's description); size and position approximate.",
  pin: true,
});
/** Rocket motor centre: upright on a bracket just aft of the canister (installer's photographs), under the rear window. */
const ROCKET: Vec3 = P3(113, 8, 52);
const ROCKET_LEN = 0.3;
part(() => cyl(0.045, ROCKET_LEN), ["brs"], {
  id: "parts.brs.rocket-motor.002",
  pos: ROCKET,
  fitted,
  anim: (m) => {
    // gone with the parachute once fired
    m.visible = live.brsT < ROCKET_T;
  },
  name: "Rocket motor (BRS-900)",
  note: "Manually activated solid-propellant rocket mounted aft of the parachute canister, standing upright under the rear window. Composite propellant grains in a filament-wound liner inside the motor case; a dual-firing-train percussion igniter lights a black powder/magnesium booster. Fired, it “will penetrate the rear window and extract the parachute away from the airplane” (IM pp. 1-1, 1-3, 1-6 – 1-7). Position and size approximate.",
  pin: true,
});
part(() => box(0.16, ROCKET_LEN + 0.1, 0.16), ["brs"], {
  id: "parts.brs.rocket-shield.003",
  pos: ROCKET,
  fitted,
  fairing: true,
  color: FIBERGLASS,
  name: "Rocket shield",
  note: "Fiberglass shield protecting the rocket motor aft of the canister (IM p. 1-1). Shape approximate.",
  pin: true,
});
/** Igniter at the rocket base, where the activation cable ends. */
const IGNITER: Vec3 = [ROCKET[0], ROCKET[1] - ROCKET_LEN / 2 - 0.03, ROCKET[2]];
part(() => sph(0.03), ["brs"], {
  id: "parts.brs.igniter.004",
  pos: IGNITER,
  fitted,
  name: "Percussion igniter",
  note: "Mechanical, needs no electrical source and is unarmed normally: pulling the cable compresses a spring and cocks a plunger; after ½ in. of plunger travel two ball bearings release it to strike two firing pins and shotgun primers. Directly, about 25 to 30 lb would fire it; the extra handle force is cable-housing friction (IM pp. 1-5 – 1-7).",
  pin: true,
});

/* ---------- rear harness (IM pp. 1-2 – 1-4, Figs. 3–4) ---------- */
/** Rear attachment assembly: a crossbar between doubler plates on the aft cabin side walls, below the window sill. */
const REAR_ATTACH: Vec3 = P3(120, 0, 58);
/** Butt line of the side plates, just inside the skin (approximate). */
const PLATE_BL = 12.5;
part(() => cyl(0.016, Z(2 * PLATE_BL), "z"), ["brs"], {
  id: "parts.brs.rear-attachment-assembly.005",
  pos: REAR_ATTACH,
  fitted,
  name: "Rear attachment assembly",
  note: "Custom assembly on the aft cabin primary structure that spreads the parachute inflation loads across the area; the rear harness straps attach to it (IM p. 1-2). Fig. 3 draws a crossbar spanning the aft baggage area between a plate on each side wall. Position and size approximate.",
  pin: true,
});
[-1, 1].forEach((s) =>
  part(() => box(0.2, 0.13, 0.008), ["brs"], {
    instance: [s],
    id: "parts.brs.rear-attachment-plate.013",
    pos: [REAR_ATTACH[0], REAR_ATTACH[1], s * Z(PLATE_BL)],
    fitted,
    name: "Rear attachment side plate",
    note: "Plate on the aft cabin side wall at each end of the rear attachment assembly's crossbar (IM Fig. 3). An installer's photographs show it riveted to the skin just below the window sill, with a Kevlar harness strap bolted to a lug on it. Shape and position approximate.",
    pin: s > 0,
  }),
);
const rearStowed: PartAnim = (m) => {
  // pulled out of the baggage area with the parachute
  m.visible = live.brsT < TAUT_T;
};
/** Where the stowed rear harness meets the legs to the two side plates (illustrative). */
const REAR_JOIN: Vec3 = [REAR_ATTACH[0] - 0.08, REAR_ATTACH[1] + 0.05, BRS_BOX[2] / 2];
(
  [
    ["short", 0.03],
    ["long", -0.03],
  ] as const
).forEach(([section, dz]) =>
  part(
    () =>
      tubeGeo(
        [
          [BRS_TOP[0] + 0.1, BRS_TOP[1] - 0.02, BRS_TOP[2] + dz],
          [ROCKET[0], BRS_TOP[1] + 0.02, BRS_TOP[2] - 0.14 + dz],
          [REAR_JOIN[0], REAR_JOIN[1], REAR_JOIN[2] + dz],
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
[-1, 1].forEach((s) =>
  part(() => tubeGeo([REAR_JOIN, [REAR_ATTACH[0], REAR_ATTACH[1] + 0.02, s * Z(PLATE_BL - 1.5)]], 0.01), ["brs"], {
    instance: [s],
    id: "parts.brs.rear-harness-leg.014",
    fitted,
    anim: rearStowed,
    color: KEVLAR,
    name: "Rear harness leg",
    note: "The rear harness ends on both sides of the aft cabin: Fig. 4 draws a rear strap from each side after the parachute is extracted (IM pp. 1-2 – 1-3). How the short and long sections join the two legs is not described in the excerpt; this arrangement is illustrative.",
    pin: s > 0,
  }),
);
part(() => cyl(0.014, 0.06), ["brs"], {
  id: "parts.brs.line-cutter.007",
  pos: [BRS_TOP[0] + 0.12, BRS_TOP[1] + 0.02, BRS_TOP[2] + 0.03],
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
/** Rear-window slot the straps leave the cabin through: on the centreline near the window's top edge (IM Fig. 2). */
const SLOT_FS = 92;
/**
 * Front strap centreline on side s (-1 left, +1 right): out of the canister top, up through the rear-window slot, then
 * forward just above the top skin to the front wing attachment point (IM Fig. 2, undimensioned).
 */
export const frontStrap = (s: number): Vec3[] => {
  const pts: Vec3[] = [
    [BRS_TOP[0] - 0.05, BRS_TOP[1], BRS_TOP[2] + s * 0.05],
    [X(SLOT_FS + 4), topY(X(SLOT_FS + 4)) - 0.1, s * 0.04],
    [X(SLOT_FS), topY(X(SLOT_FS)) + 0.015, s * 0.05],
  ];
  // forward over the cabin top, onto the wing centre section and its attach fitting
  pts.push([X(SLOT_FS - 2), topY(X(SLOT_FS - 2)) + 0.015, s * 0.07]);
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
    note: "Woven Kevlar strap “routed through a slot in the rear window and across the top skin to the front wing attachment points”, under a fiberglass fairing (not drawn). Fig. 2 draws the pair leaving at the top of the rear window on the centreline. On deployment the rocket's pull peels both front straps away from the top skin (IM pp. 1-2 – 1-3). Installers cut holes in the cabin-top skin near the forward wing attach points. Route and slot position approximate.",
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
        P3(60, 2, 27),
        P3(95, 1, 28),
        P3(110, 2, 31.5),
        P3(113, 8, 33.5),
        IGNITER,
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

/** The harness legs for the deployment overlay: the two front attachment points and the middle of the rear crossbar. */
export const BRS_HARNESS: Record<"fwdL" | "fwdR" | "aft", Vec3> = {
  fwdL: FRONT_ATTACH[0],
  fwdR: FRONT_ATTACH[1],
  aft: REAR_ATTACH,
};
