import * as THREE from "three";
import { V, toVec3, type Vec3 } from "@/lib/math";
import {
  BAG_FRAME,
  FW,
  ROLLBAR_X,
  WJ,
  box,
  botY,
  fRing,
  fs,
  loft,
  planeRing,
  sph,
  topY,
  tubeGeo,
  wingP,
} from "../geometry";
import { part } from "./catalogue";

/* ---------- structure ---------- */
part(() => planeRing(FW), ["airframe", "engine"], {
  plate: true,
  pin: true,
  pinIn: ["airframe"],
  name: "Firewall",
  note: "Fire-resistant matting covered with stainless-steel cladding on the engine side (AFM 7-3). Station not given in the documents (≈ FS 1.35 here).",
});
part(() => planeRing(BAG_FRAME), ["airframe", "cabin"], {
  plate: true,
  pin: true,
  name: "Baggage compartment frame",
  note: "Rear of the standard baggage compartment; the baggage tube and extension lie behind it. Cabin air leaves through holes in this frame (unofficial technical description).",
});
part(
  () => tubeGeo(fRing(ROLLBAR_X, 0.93, 30, -0.1, Math.PI + 0.1, false), 0.025),
  ["airframe", "cabin", "environment"],
  {
    color: "#4E5961",
    name: "Roll bar",
    note: "Cabin roll bar behind the front seats; carries the spherical ventilation nozzles beside the front seats (AFM 7-12). Structural details not in the AFM.",
    pin: true,
  },
);
// stub wing spars crossing under the seats (AMM Fig. 2-6 top view: two carry-throughs under the seat pans)
[
  [
    0.35,
    "Front spar carry-through",
    "Main spar of the stub wing crossing the cabin floor under the front seats (AMM Fig. 2-6).",
  ],
  [0.68, "Rear spar carry-through", "Rear spar of the stub wing, under the rear seat pans."],
].forEach(([xc, name, note]) => {
  part(
    () =>
      tubeGeo(
        [-1.1, -0.6, -0.3, 0, 0.3, 0.6, 1.1].map((z) => {
          const p = wingP(z === 0 ? 0.001 : z, xc as number, 0);
          return [p.x, p.y, z] as Vec3;
        }),
        0.03,
      ),
    ["airframe"],
    { name: name as string, note: note as string, pin: true, color: "#3D5A73" },
  );
});
[1, -1].forEach((s) =>
  part(() => box(0.06, 0.13, 0.03), ["airframe"], {
    pos: toVec3(wingP(s * WJ, 0.4, 0)),
    color: "#E0522B",
    name: "Root rib / wing joint",
    note: "The outer wing bolts to the stub wing here. The Datum Plane is 2.194 m (86.38 in) forward of the most forward point of this root rib (AFM 6-3).",
    pin: s > 0,
  }),
);
[1, -1].forEach((s) =>
  part(() => sph(0.03), ["airframe", "gear"], {
    pos: [fs(2.41), botY(fs(2.41)) - 0.02, s * 0.35],
    color: "#E0522B",
    name: "Jack point",
    note: "Lower fuselage at the left and right root ribs (FS 2410), plus the tail fin (FS 7312) (AFM 8-7; SMM Fig. 2-6).",
    pin: s > 0,
    ext: true,
  }),
);
part(() => box(0.15, 0.025, 0.04), ["airframe"], {
  pos: [fs(6.0), topY(fs(6.0)) - 0.016, 0],
  color: "#E0B040",
  name: "Levelling wedge position",
  note: "Place a 600:31 wedge here, on top of the tail boom in front of the fin: with its top level, the Datum Plane is vertical (AFM 6-3).",
  pin: true,
});
// ventral fin with tail skid
part(
  () => {
    const S = (h: number, le: number, te: number) => {
      const c = le - te;
      const pts: THREE.Vector3[] = [];
      for (const [x, z] of [
        [0, 0],
        [0.3, 0.012],
        [0.7, 0.008],
        [1, 0],
        [0.7, -0.008],
        [0.3, -0.012],
      ])
        pts.push(V(le - x * c, h, z));
      return pts;
    };
    return loft([S(-0.69, fs(6.95), fs(7.3)), S(-0.6, fs(6.7), fs(7.32)), S(-0.5, fs(6.5), fs(7.34))]);
  },
  ["airframe"],
  {
    color: "#E6E9EB",
    name: "Lower fin and tail skid",
    note: "Small ventral fin with the tail skid underneath — walk-around item 'tail skid and lower fin' (AFM 4A-7).",
    ext: true,
    pin: true,
  },
);
