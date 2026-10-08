/** M20C structure: firewall and tail-cone bulkhead, steel-tube cabin frame, spars, hoist points, tail skid, empennage pivot, entry step, wing walk. */
import * as THREE from "three";

import { V, type Vec3 } from "@/lib/math";

import {
  AUX_SPAR,
  CABIN_AFT,
  FW,
  MAIN_SPAR,
  TAIL_BH,
  WTIP,
  box,
  botY,
  cyl,
  onSkin,
  planeRing,
  topY,
  tubeGeo,
  wingP,
} from "../geometry";

import { P, part } from "./catalogue";

/* ---------- structure ---------- */
const FRAME = "#3D5A73";
part(() => planeRing(FW), ["airframe", "engine"], {
  plate: true,
  pin: true,
  pinIn: ["airframe"],
  name: "Firewall",
  note: "Stainless steel (OM p. 5). The battery sits on its forward left side, the starting vibrator on its upper forward face, the brake / flap hydraulic reservoir on its top aft side (OM p. 3, 2, 10).",
});
part(() => planeRing(TAIL_BH, 0.95), ["airframe", "controls"], {
  plate: true,
  pin: true,
  pinIn: ["airframe"],
  name: "Tail-cone bulkhead",
  note: "Rear bulkhead of the tail cone: the empennage jack screw bolts to it and the whole tail pivots on two attachment points just aft (OM p. 6; Ranger 1-2).",
});
// steel-tube cabin truss: longerons and verticals just inside the skin (points taken from the skin itself, pushed 8 % inward)
{
  const tube = (pts: Vec3[], r = 0.016) => tubeGeo(pts, r, 0.05);
  const IN_SKIN = 0.9;
  const upper = (x: number, s: number): Vec3 => P(onSkin(x, topY(x) - 0.1, s, IN_SKIN));
  const lower = (x: number, s: number): Vec3 => P(onSkin(x, botY(x) + 0.1, s, IN_SKIN));
  const xs = [FW, 1.65, 1.38, 1.0, 0.6, 0.25, CABIN_AFT];
  [1, -1].forEach((s) => {
    part(() => tube(xs.map((x) => lower(x, s))), ["airframe"], {
      color: FRAME,
      name: "Steel-tube cabin frame",
      note: "Welded 4130 chrome-moly steel-tube cabin structure covered with aluminium sheet — the Mooney 'roll cage' (OM p. 5; Ranger 1-2).",
      pin: s > 0,
    });
    part(() => tube(xs.slice(1).map((x) => upper(x, s))), ["airframe"], { color: FRAME });
    [1.38, 1.0, 0.6, 0.25, CABIN_AFT].forEach((x) =>
      part(() => tube([lower(x, s), P(onSkin(x, (topY(x) + botY(x)) / 2, s, IN_SKIN)), upper(x, s)]), ["airframe"], {
        color: FRAME,
      }),
    );
  });
  [1.38, 0.6, CABIN_AFT].forEach((x) =>
    part(() => tube([upper(x, -1), P(onSkin(x, topY(x) - 0.03, 0, IN_SKIN)), upper(x, 1)]), ["airframe"], {
      color: FRAME,
    }),
  );
  [FW, 1.0, CABIN_AFT].forEach((x) =>
    part(() => tube([lower(x, -1), [x, botY(x) + 0.08, 0], lower(x, 1)]), ["airframe"], { color: FRAME }),
  );
}
[
  [
    MAIN_SPAR,
    "Main spar carry-through",
    "The one-piece wing's main spar runs under the front seats; the main gear trunnions and the aileron centre bellcrank hang on it (service-manual arrangement).",
  ],
  [
    AUX_SPAR,
    "Auxiliary (rear) spar",
    "Rear spar carrying the flap and aileron hinges and the torsion loads with the stressed skin (OM p. 5).",
  ],
].forEach(([xc, name, note]) => {
  part(
    () =>
      tubeGeo(
        [-WTIP + 0.3, -4, -2.5, -1, 0, 1, 2.5, 4, WTIP - 0.3].map((z) => {
          const p = wingP(z === 0 ? 0.001 : z, xc as number, 0);
          return [p.x, p.y, z] as Vec3;
        }),
        xc === MAIN_SPAR ? 0.035 : 0.022,
        0.05,
      ),
    ["airframe"],
    { name: name as string, note: note as string, pin: true, color: FRAME },
  );
});
/** Patch draped over the wing's upper surface between chord fractions c0..c1 and span stations z0..z1, lifted `h` above the skin. */
function wingPatch(z0: number, z1: number, c0: number, c1: number, h = 0.004, nz = 8, nx = 14) {
  const pos: number[] = [],
    idx: number[] = [];
  for (let i = 0; i <= nz; i++)
    for (let j = 0; j <= nx; j++) {
      const z = z0 + ((z1 - z0) * i) / nz,
        xc = c0 + ((c1 - c0) * j) / nx,
        q = wingP(z, xc, 1);
      pos.push(q.x, q.y + h, q.z);
    }
  for (let i = 0; i < nz; i++)
    for (let j = 0; j < nx; j++) {
      const a = i * (nx + 1) + j,
        b = a + 1,
        c = a + nx + 1,
        d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
part(() => wingPatch(0.6, 1.5, 0.06, 0.9), ["airframe", "cabin"], {
  color: "#2A3447",
  name: "Wing walk",
  note: "Non-slip walkway on the right wing root, where you board over the wing to the single door (dark navy panel in the N6947N photo).",
  ext: true,
  pin: true,
});
[1, -1].forEach((s) =>
  part(() => cyl(0.012, 0.03), ["airframe", "gear"], {
    pos: P(wingP(s * 1.75, 0.45, -1).add(V(0, -0.01, 0))),
    color: "#9AA3AA",
    name: "Hoist point / tie-down",
    note: "Marked HOIST POINT just outboard of each main gear: the removable tie-down rings and the jack-point fixtures screw in here (OM p. 25; Ranger 7-3).",
    ext: true,
    pin: s > 0,
  }),
);
part(() => box(0.1, 0.05, 0.03), ["airframe"], {
  pos: [-2.75, -0.62, 0],
  color: "#8C959C",
  name: "Tail skid & tie-down ring",
  note: "The tail tie-down ring is under the tail skid (OM p. 25).",
  ext: true,
  pin: true,
});
part(() => box(0.08, 0.06, 0.1), ["airframe", "controls"], {
  parent: "tail",
  pos: [0, 0, 0],
  color: "#E0522B",
  name: "Empennage pivot",
  note: "The entire empennage — stabilizer, fin, rudder and elevator — pivots around two attachment points on the tail cone for trim (OM p. 6).",
  pin: true,
});
// entry step (right side, under the wing trailing edge by the door): fixed on the 1968 airplane
part(() => box(0.1, 0.03, 0.14), ["airframe", "cabin"], {
  pos: [-0.35, -0.88, 0.52],
  color: "#8C959C",
  name: "Entry step",
  note: "Right side below the wing trailing edge, under the door. 1965–67 Mark 21s had a vacuum-retracted step (raised by a servo when the engine made vacuum, OM p. 10); the 1968 Ranger went back to a fixed step.",
  ext: true,
  pin: true,
});
part(() => cyl(0.012, 0.22), ["airframe"], { pos: [-0.35, -0.78, 0.5], color: "#8C959C", ext: true });
