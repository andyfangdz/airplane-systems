import * as THREE from "three";
import { afRing, mergeGeos } from "@/lib/geometry";
import { mats } from "@/lib/materials";
import { V, clamp, toVec3, type Vec3 } from "@/lib/math";
import { sysNow } from "@/lib/anims";
import { PANEL_X, box, cyl, fs, loft, sph, tubeGeo, wingP } from "../geometry";
import { hornLevel } from "../model";
import { part, sim, glow } from "./catalogue";

/* ---------- pitot-static & stall warning ---------- */
export const PITOT_Z = -3.9;
export const pitotBase = wingP(PITOT_Z, 0.28, -1);
/** Streamlined mast hanging below the wing, leaning forward, with a short pitot head at its lower leading edge. */
const MAST = { h: 0.16, c0: 0.085, c1: 0.055, lean: 0.07, head: 0.05, r: 0.011 };
const mastAt = (u: number) => ({
  y: pitotBase.y + 0.01 - u * MAST.h,
  c: MAST.c0 + (MAST.c1 - MAST.c0) * u,
  le: pitotBase.x + 0.035 + MAST.lean * u,
});
const MAST_TIP = (() => {
  const b = mastAt(1);
  return V(b.le + MAST.head, b.y + 0.012, PITOT_Z);
})();
part(
  () => {
    const blade = loft(
      [0, 0.25, 0.5, 0.75, 1].map((u) => {
        const m = mastAt(u);
        return afRing(0, 1, 0.16, 0, 12).map(([x, t]) => V(m.le - x * m.c, m.y, PITOT_Z + t * m.c));
      }),
    );
    const head = new THREE.CylinderGeometry(MAST.r * 0.8, MAST.r, MAST.head + 0.02, 16);
    head.rotateZ(Math.PI / 2);
    head.translate(MAST_TIP.x - (MAST.head + 0.02) / 2, MAST_TIP.y, PITOT_Z);
    return mergeGeos([blade, head]);
  },
  ["pitot"],
  {
    anim: (m) => {
      const { s, E } = sim();
      const hot = s.pitot.heat && E.pitotPwr && !s.pitot.heaterFail;
      m.material =
        sysNow() === "pitot" || sysNow() === "overview"
          ? hot
            ? mats("#FF8A4A").hi
            : mats("#3A9448").on
          : mats("#3A9448").dim;
    },
    name: "Pitot-static mast (heated)",
    ext: true,
    pin: true,
    note: "One streamlined mast under the left wing gives both pressures: total pressure at the opening on its leading edge, static pressure at two orifices on its lower and rear edges (AFM 7.12, p. 7-54, which calls it the Pitot probe; P/N DAI-9034-57-00). Electrically heated; a thermal switch holds the temperature and a thermal fuse protects it (AFM 7-45). Span station approximate.",
  },
);
part(
  () => {
    const g = new THREE.CircleGeometry(MAST.r * 0.45, 12);
    g.rotateY(Math.PI / 2);
    return g;
  },
  ["pitot"],
  {
    pos: [MAST_TIP.x + 0.0005, MAST_TIP.y, PITOT_Z],
    color: "#0B1014",
    name: "Pitot opening",
    note: "Total (ram) pressure enters at the leading edge of the mast (AFM 7.12). Check it is clean and open on the walk-around (AFM 4A).",
    ext: true,
  },
);
(
  [
    [0.5, -1],
    [1, 0],
  ] as const
).forEach(([xc, up], i) => {
  const m = mastAt(1);
  part(() => sph(0.0045), ["pitot"], {
    pos: [m.le - xc * m.c + (up ? 0 : -0.002), m.y + (up < 0 ? -0.001 : 0.02), PITOT_Z],
    color: "#0B1014",
    name: "Static orifice",
    note:
      i === 0
        ? "Static pressure is taken at two orifices, on the lower and rear edges of the pitot-static mast (AFM 7.12)."
        : "Rear-edge static orifice on the pitot-static mast (AFM 7.12).",
    ext: true,
  });
});
part(() => box(0.05, 0.03, 0.04), ["pitot"], {
  pos: [fs(2.3), -0.5, -0.5],
  color: "#3A9448",
  name: "Pitot-static filters",
  note: "Filters against dirt and condensation, reachable from the left wing root (AFM 7-54).",
});
part(() => box(0.05, 0.05, 0.04), ["pitot"], {
  pos: [fs(1.86), -0.3, -0.42],
  color: "#3A9448",
  anim: (m) => {
    m.rotation.z = sim().s.pitot.altStatic ? 0.8 : 0;
  },
  name: "Alternate static valve",
  note: "Optional (OAM 40-072), under the panel: OPEN uses cabin pressure. 'If Alternate Static is open Emergency Window and Cockpit Vent must be closed' (AFM 7-54, 2-29).",
  pin: true,
});
export const STALL_Z = -3.0;
part(
  () => {
    const g = new THREE.TorusGeometry(0.022, 0.006, 8, 16);
    g.rotateY(Math.PI / 2);
    return g;
  },
  ["pitot"],
  {
    pos: toVec3(wingP(STALL_Z, 0, 0).add(V(0.004, 0, 0))),
    color: "#E0263B",
    name: "Stall-warning orifice (red ring)",
    note: "In the left wing leading edge, marked by a red ring. Suction here sounds the horn through a hose (AFM 7-54). Pre-flight: suck on the opening (AFM 4A-6).",
    ext: true,
    pin: true,
  },
);
part(() => sph(0.035), ["pitot"], {
  pos: toVec3(wingP(STALL_Z, 0.2, 1)),
  color: "#E0263B",
  anim: (m) => {
    const s = sim().s;
    const vs = 53,
      ias = s.stall.ias;
    const xc = clamp(0.25 - ((vs + 15 - ias) / 15) * 0.25, 0, 0.25);
    m.position.copy(wingP(STALL_Z, xc, xc < 0.02 ? 0 : 1));
    m.visible = sysNow() === "pitot";
  },
  name: "Low-pressure peak",
  note: "Moves forward around the leading edge as the angle of attack rises; near the stall it reaches the orifice.",
  ext: true,
});
/** Stall-warning hose: inside the left wing to the root, under the floor ahead of the pilot's seat, up behind the panel to the horn. */
export const STALL_HOSE: Vec3[] = [
  toVec3(wingP(STALL_Z, 0.04, 0)),
  toVec3(wingP(-2.0, 0.2, 0)),
  toVec3(wingP(-0.6, 0.2, 0)),
  [fs(2.05), -0.54, -0.36],
  [PANEL_X + 0.05, -0.45, -0.36],
  [PANEL_X + 0.05, -0.12, -0.42],
];
part(() => tubeGeo(STALL_HOSE, 0.006), ["pitot"], {
  color: "#3A9448",
  name: "Stall-warning hose",
  note: "Runs from the orifice to the horn in the instrument panel (routing assumed).",
});
part(() => cyl(0.025, 0.03, "x", 16), ["pitot"], {
  pos: [PANEL_X + 0.03, -0.12, -0.42],
  color: "#3A9448",
  anim: glow("#2A6A34", "#FF4A4A", () => hornLevel(sim().s) > 0, ["pitot"]),
  name: "Stall-warning horn",
  note: "In the instrument panel; purely pneumatic — works with no electrical power. Sounds from about 10 to at least 5 kt above the stall, louder as you slow (AFM 7-54).",
  pin: true,
});
part(() => box(0.04, 0.03, 0.03), ["pitot", "avionics"], {
  pos: [PANEL_X + 0.12, 0.02, 0.06],
  color: "#3A9448",
  name: "Pitot / static lines to GDC 74A",
  note: "Green and blue PVC tubing to the GDC 74A and the standby airspeed and altimeter (SMM Fig. 2-2).",
});
