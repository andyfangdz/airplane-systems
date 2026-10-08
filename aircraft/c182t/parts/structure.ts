/**
 * C182T catalogue: structure (firewall, aft cabin wall, spars, struts and fittings, door posts, tiedowns, steps) and the
 * cockpit panel, pedestal and seats.
 */
import * as THREE from "three";
import { V } from "@/lib/math";
import { mergeGeos } from "@/lib/geometry";
import {
  X,
  Y,
  Z,
  box,
  cyl,
  onSkin,
  planeRing,
  rearRoofGeo,
  sectionSlab,
  sph,
  strutGeo,
  tubeGeo,
  wingP,
} from "../geometry";
import { P3, PV, part } from "./catalogue";
import { RUD_TRIM } from "../rig";

/* ---------- structure ---------- */
part(() => planeRing(X(0)), ["airframe", "engine"], {
  plate: true,
  pin: true,
  name: "Firewall — FS 0 (datum)",
  note: "Reference datum: front face of the firewall, lower portion (POH 2-8, 6-5). The J-box (PDM) is on its left forward side.",
});
part(() => planeRing(X(134), 0.97), ["airframe", "cabin"], {
  plate: true,
  pin: true,
  name: "Aft cabin wall — FS 134",
  note: "Aft baggage wall (≈ FS 134), “a convenient interior reference point” (POH 6-14). The ELT is behind this partition; the main battery, GIAs, AHRS and transponder sit in the tailcone (POH 2-21, 6-20).",
});
const FSPAR = 0.25,
  RSPAR = 0.68;
(
  [
    [
      FSPAR,
      "Front carry-through spar",
      "The wings attach to front and rear carry-through spars across the cabin top (POH 7-5).",
    ],
    [RSPAR, "Rear carry-through spar", "Rear carry-through spar at the rear door posts (POH 7-5)."],
  ] as [number, string, string][]
).forEach(([c, name, note]) =>
  part(
    () =>
      tubeGeo(
        [-22, 0, 22].map((b) => wingP(Z(b), c, 0)),
        0.03,
      ),
    ["airframe"],
    { color: "#3D5A73", name, note, pin: true },
  ),
);
[1, -1].forEach((s) => {
  part(
    () =>
      tubeGeo(
        [22, 60, 100, 140, 180, 206].map((b) => wingP(s * Z(b), FSPAR, 0)),
        0.024,
      ),
    ["airframe"],
    {
      color: "#3D5A73",
      name: "Wing front spar",
      note: "Full-span front spar with the wing-to-fuselage and wing-to-strut attach fittings (POH 7-5).",
      pin: s > 0,
    },
  );
  part(
    () =>
      tubeGeo(
        [22, 60, 102, 132].map((b) => wingP(s * Z(b), RSPAR, 0)),
        0.018,
      ),
    ["airframe"],
    {
      color: "#3D5A73",
      name: "Wing rear spar (partial span)",
      note: "The aft spars are partial-span spars with wing-to-fuselage attach fittings (POH 7-5).",
      pin: s > 0,
    },
  );
  // lift strut: base of the forward door post → front spar near the chord break (Fig 1-1)
  const lo = PV(onSkin(X(29.5), Y(28.5), s, 1.0)),
    hi = PV(wingP(s * Z(100), FSPAR, -1).add(V(0, -0.02, 0)));
  part(() => strutGeo(lo, hi, 0.16, 0.055), ["airframe"], {
    color: "#E9EDF0",
    name: "Wing strut",
    note: "One streamlined lift strut per side from the fitting at the base of the forward door post to the front spar near the chord break (POH 7-5, Fig 1-1). Use the struts as push points when moving the airplane by hand (POH 7-19).",
    ext: true,
    pin: s > 0,
  });
  [lo, hi].forEach((p, i) =>
    part(() => sph(0.03), ["airframe"], {
      pos: p,
      color: "#E0522B",
      name: i ? "Strut-to-wing fitting" : "Strut-to-fuselage fitting",
      note: i
        ? "On the wing front spar."
        : "Bulkhead with attach fittings at the base of the forward door post (POH 7-5).",
      ext: true,
      pin: s > 0,
    }),
  );
  part(
    () => tubeGeo([PV(onSkin(X(29.8), Y(29), s, 0.955)), PV(onSkin(X(30.6), Y(76), s, 0.955))], 0.012),
    ["airframe", "cabin"],
    {
      color: "#5C6E7E",
      name: "Forward door post",
      note: "Strut attach fitting at its base; the aileron cables run up inside it (POH 7-5, Fig 7-1).",
    },
  );
  part(
    () => tubeGeo([PV(onSkin(X(65.3), Y(28), s, 0.955)), PV(onSkin(X(65.3), Y(76.5), s, 0.955))], 0.012),
    ["airframe", "cabin", "fuel"],
    {
      color: "#5C6E7E",
      name: "Rear door post",
      note: "Rear door post bulkhead at FS 65.30 with the main gear forgings at its base (POH 7-5, 6-15); the fuel manifold from each tank runs down inside it (POH 7-38).",
    },
  );
  part(() => box(0.1, 0.05, 0.16), ["airframe", "gear"], {
    pos: P3(65, s * 14, 24.5),
    color: "#E0522B",
    name: "Main gear bulkhead / forging",
    note: "Takes the spring-steel main gear leg at the base of the rear door post (POH 7-5).",
  });
  part(() => new THREE.TorusGeometry(0.02, 0.006, 6, 12), ["airframe"], {
    pos: PV(wingP(s * Z(100), FSPAR + 0.08, -1).add(V(0, -0.03, 0))),
    color: "#8C959C",
    name: "Wing tiedown ring",
    note: "Wing, tail and nose tiedown fittings: 700 lb ropes or chains (POH 8-10).",
    ext: true,
    pin: s > 0,
  });
});
part(() => new THREE.TorusGeometry(0.02, 0.006, 6, 12), ["airframe"], {
  pos: P3(250, 0, 41.2),
  color: "#8C959C",
  name: "Tail tiedown ring",
  note: "Tail tiedown under the tailcone; the tail rests on it when the nose is raised by pressing on a tailcone bulkhead — never on the stabilizer (POH 8-10).",
  ext: true,
  pin: true,
});
[139.65, 171.65].forEach((fs, i) =>
  part(() => cyl(0.012, 0.01, "z"), ["airframe"], {
    pos: PV(onSkin(X(fs), Y(50), -1, 1.01)),
    color: "#E0B040",
    name: "Leveling screws",
    note: "Left side of the tailcone at FS 139.65 and 171.65; lateral leveling uses the upper door sills (POH 6-6, 8-11).",
    ext: true,
    pin: i === 0,
  }),
);
part(rearRoofGeo, ["airframe", "cabin"], {
  color: "#141B22",
  fairing: true,
  name: "Rear window",
  note: "Fixed wraparound rear window over the tailcone behind the wing; with the rear side windows it can't be opened (POH 7-26).",
  ext: true,
  pin: true,
});
[1, -1].forEach((s) => {
  // refueling steps and assist handles on the forward fuselage sides, arm 15.2 (POH 6-24, 4-6)
  part(() => box(0.1, 0.012, 0.05), ["airframe", "fuel"], {
    pos: PV(onSkin(X(15.2), Y(38), s, 1.0).add(V(0, 0, s * 0.02))),
    color: "#5C666E",
    name: "Refueling step",
    note: "Steps on both sides of the forward fuselage with an assist handle above; they simplify access to the upper wing for fuel checks and refueling (POH 4-6, 6-24).",
    ext: true,
    pin: s > 0,
  });
  part(
    () =>
      tubeGeo(
        [
          PV(onSkin(X(13.6), Y(57.5), s, 1.0)),
          PV(onSkin(X(14.5), Y(58.1), s, 1.0).add(V(0, 0, s * 0.03))),
          PV(onSkin(X(16.1), Y(58.1), s, 1.0).add(V(0, 0, s * 0.03))),
          PV(onSkin(X(17), Y(57.5), s, 1.0)),
        ],
        0.007,
      ),
    ["airframe", "fuel"],
    {
      color: "#8C959C",
      name: "Assist handle",
      note: "Handle above the refueling step, arm 15.2 (POH 6-24).",
      ext: true,
      pin: s > 0,
    },
  );
});
part(() => box(0.06, 0.04, 0.005), ["airframe", "cabin"], {
  pos: PV(onSkin(X(200), Y(50), -1, 1.01)),
  color: "#B8A46A",
  name: "Identification plate",
  note: "On the aft left tailcone; a secondary plate is on the lower part of the left forward door post (POH 8-4).",
  ext: true,
  pin: true,
});

/* ---------- cockpit: panel, pedestal, seats ---------- */
part(() => sectionSlab(X(17), Y(41.5), Y(67.4), 0.97, 0.035, X(17)), ["avionics", "cabin"], {
  color: "#2B3238",
  name: "Instrument panel",
  note: "Figure 7-2: PFD, GMA 1347 audio panel and MFD across the top; standby airspeed, attitude and altimeter, then the KAP 140, then throttle / propeller / mixture down the centre; switch, dimming and breaker panels at the lower left; ELT switch and Hobbs at the upper right (POH 7-10 – 7-14).",
});
part(() => sectionSlab(X(16.6), Y(66.4), Y(67.8), 0.97, 0.06, X(15.4)), ["cabin"], {
  color: "#20262B",
  name: "Glareshield",
  note: "Placard above the PFD: MANEUVERING SPEED – 110 KIAS (POH 2-20). The forward avionics fan blows warm air up the windshield through a screen in it (POH 7-69, 3-20).",
});
part(
  () => {
    // The housing needs an opening around the horizontal wheel; a solid box would bury its rim.
    // Keep the existing pedestal envelope, with an illustrative access slot derived from the wheel mount.
    const center = P3(21.5, 0, 33.5);
    const slotY = RUD_TRIM.wheel[1] - center[1],
      lo = slotY - 0.017,
      hi = slotY + 0.017,
      back = RUD_TRIM.wheel[0] - RUD_TRIM.r + 0.012 - center[0];
    return mergeGeos([
      box(0.28, 0.19 - hi, 0.15).translate(0, (hi + 0.19) / 2, 0),
      box(0.28, lo + 0.19, 0.15).translate(0, (lo - 0.19) / 2, 0),
      box(0.14 - back, hi - lo, 0.15).translate((back + 0.14) / 2, slotY, 0),
    ]);
  },
  ["cabin", "fuel"],
  {
    pos: P3(21.5, 0, 33.5),
    color: "#39424A",
    fairing: true,
    name: "Center pedestal",
    note: "Elevator and rudder trim wheels and indicators, cowl flap lever, 12V outlet, AUX AUDIO IN jack and microphone bracket; the fuel selector handle is at its base (POH 7-12). Housing and wheel-access opening dimensions are illustrative.",
  },
);
(
  [
    [
      41.5,
      -11,
      "Pilot seat",
      "Vertically adjusting crew seat: fore/aft handle below the centre of the frame, height crank under the right corner, seat-back release at the front centre (POH 7-21, 7-22). Occupant CG range FS 32–50 (POH 6-14).",
    ],
    [41.5, 11, "Front passenger seat", "Same as the pilot's seat. Front occupants at arm 37 for loading (POH 6-14)."],
    [
      82,
      0,
      "Rear bench seat",
      "Fixed one-piece bottom with an infinitely adjustable split back; rear passengers at arm 74. It can be removed to carry cargo (POH 7-22, 6-14).",
    ],
  ] as [number, number, string, string][]
).forEach(([fs, bl, name, note], i) => {
  const w = i === 2 ? 0.86 : 0.42;
  part(() => box(0.5, 0.1, w), ["cabin"], { pos: P3(fs, bl, 32.5), color: "#6B5A48", name, note, pin: true });
  part(() => box(0.09, 0.64, w * 0.92), ["cabin"], {
    pos: P3(fs + 11, bl, 45.5),
    rot: [0, 0, 0.18],
    color: "#6B5A48",
    name,
    note,
  });
});
