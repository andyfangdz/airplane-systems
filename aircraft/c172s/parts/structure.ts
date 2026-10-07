/** C172S catalogue: structure (firewall, baggage walls, spars, struts, door posts, tiedowns, steps) and the cockpit panel, pedestal and seats. */
import * as THREE from "three";
import { V } from "@/lib/math";
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

/* ---------- structure ---------- */
part(() => planeRing(X(0)), ["airframe", "engine"], {
  plate: true,
  pin: true,
  name: "Firewall — FS 0 (datum)",
  note: "Reference datum: lower portion of the front face of the firewall (POH 2-9). Battery, J-box and external-power receptacle are on its left forward side.",
});
part(() => planeRing(X(108), 0.97), ["airframe", "cabin"], {
  plate: true,
  pin: true,
  name: "Aft baggage wall — FS 108",
  note: "End of baggage area A (FS 82–108, 120 lb). Area B runs to FS 142 (50 lb); A + B 120 lb maximum (POH 2-8, 6-13).",
});
part(() => planeRing(X(142), 0.97), ["airframe", "cabin"], {
  plate: true,
  name: "Aft baggage wall — FS 142",
  note: "End of baggage area B. ELT and the remote avionics sit aft of the cabin partition.",
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
        [-21, 0, 21].map((b) => wingP(Z(b), c, 0)),
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
        [21, 60, 100, 140, 180, 205].map((b) => wingP(s * Z(b), FSPAR, 0)),
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
        [21, 60, 100, 135].map((b) => wingP(s * Z(b), RSPAR, 0)),
        0.018,
      ),
    ["airframe"],
    {
      color: "#3D5A73",
      name: "Wing rear spar (partial span)",
      note: "The aft spars are partial-span spars with wing-to-fuselage fittings (POH 7-5).",
      pin: s > 0,
    },
  );
  // lift strut: base of the forward door post → front spar at about BL 99 (Fig 1-1)
  const lo = PV(onSkin(X(30), Y(29.5), s, 1.0)),
    hi = PV(wingP(s * Z(99), FSPAR, -1).add(V(0, -0.02, 0)));
  part(() => strutGeo(lo, hi, 0.15, 0.04), ["airframe"], {
    color: "#E9EDF0",
    name: "Wing strut",
    note: "One streamlined lift strut per side from the fitting at the base of the forward door post to the front spar (POH 7-5). Use the struts as push points when moving the airplane by hand (POH 7-22).",
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
    }),
  );
  part(
    () => tubeGeo([PV(onSkin(X(30.8), Y(30), s, 0.955)), PV(onSkin(X(31.6), Y(76), s, 0.955))], 0.012),
    ["airframe", "cabin"],
    {
      color: "#5C6E7E",
      name: "Forward door post",
      note: "Strut attach fitting at its base; aileron cables and fuel lines run inside it.",
    },
  );
  part(
    () => tubeGeo([PV(onSkin(X(65.3), Y(30), s, 0.955)), PV(onSkin(X(65.3), Y(76.5), s, 0.955))], 0.012),
    ["airframe", "cabin"],
    { color: "#5C6E7E", name: "Rear door post", note: "Main gear bulkhead and forgings at its base (POH 7-5)." },
  );
  part(() => box(0.1, 0.05, 0.16), ["airframe", "gear"], {
    pos: P3(61, s * 13, 28),
    color: "#E0522B",
    name: "Main gear bulkhead / forging",
    note: "Takes the spring-steel main gear leg at the base of the rear door post (POH 7-5).",
  });
  part(() => new THREE.TorusGeometry(0.02, 0.006, 6, 12), ["airframe"], {
    pos: PV(wingP(s * Z(99), FSPAR + 0.08, -1).add(V(0, -0.03, 0))),
    color: "#8C959C",
    name: "Wing tiedown ring",
    note: "Wing, tail and nose tiedowns: 700 lb rope or chain (POH 8-10).",
    ext: true,
  });
});
part(() => new THREE.TorusGeometry(0.02, 0.006, 6, 12), ["airframe"], {
  pos: P3(250, 0, 42.9),
  color: "#8C959C",
  name: "Tail tiedown ring",
  note: "Tail tiedown under the tailcone; the tail rests on it when the nose is raised (POH 8-10).",
  ext: true,
  pin: true,
});
[108, 142].forEach((fs, i) =>
  part(() => cyl(0.012, 0.01, "z"), ["airframe"], {
    pos: PV(onSkin(X(fs), Y(52), -1, 1.01)),
    color: "#E0B040",
    name: "Leveling screws",
    note: "Left side of the tailcone at FS 108.00 and 142.00; lateral leveling uses the upper door sills (POH 6-4).",
    ext: true,
    pin: i === 0,
  }),
);
part(rearRoofGeo, ["airframe", "cabin"], {
  color: "#26323C",
  fairing: true,
  name: "Rear window",
  note: "Fixed wraparound rear window over the tailcone behind the wing; with the rear side windows it is not openable (POH 7-28).",
  ext: true,
});
[1, -1].forEach((s) => {
  // refueling steps and assist handles on the forward fuselage sides, arm 16.3 (POH 6-22 equipment list 53-01-S, walkaround 4-6 NOTE)
  part(() => box(0.1, 0.012, 0.05), ["airframe", "fuel"], {
    pos: PV(onSkin(X(16.3), Y(40), s, 1.0).add(V(0, 0, s * 0.02))),
    color: "#5C666E",
    name: "Refueling step",
    note: "Steps on both sides of the forward fuselage with an assist handle above; use them to reach the upper wing for fuel checks and refueling (POH 4-6).",
    ext: true,
    pin: s > 0,
  });
  part(
    () =>
      tubeGeo(
        [
          PV(onSkin(X(14.6), Y(57), s, 1.0)),
          PV(onSkin(X(15.5), Y(57.6), s, 1.0).add(V(0, 0, s * 0.03))),
          PV(onSkin(X(17.1), Y(57.6), s, 1.0).add(V(0, 0, s * 0.03))),
          PV(onSkin(X(18), Y(57), s, 1.0)),
        ],
        0.007,
      ),
    ["airframe", "fuel"],
    {
      color: "#8C959C",
      name: "Assist handle",
      note: "Handle above the refueling step, arm 16.3 (POH 6-22).",
      ext: true,
      pin: s > 0,
    },
  );
});
part(() => box(0.06, 0.04, 0.005), ["airframe", "cabin"], {
  pos: PV(onSkin(X(200), Y(52), -1, 1.01)),
  color: "#B8A46A",
  name: "Identification plate",
  note: "On the aft left tailcone; Finish and Trim plate on the lower left forward doorpost (POH 8-4).",
  ext: true,
});

/* ---------- cockpit: panel, pedestal, seats ---------- */
part(() => sectionSlab(X(16.8), Y(44.5), Y(67.2), 0.97, 0.035, X(16.8)), ["avionics", "cabin"], {
  color: "#2B3238",
  name: "Instrument panel",
  note: "Figure 7-2 Sheet 1 (serials 172S10656 thru 172S12700): PFD, audio panel, MFD; standby airspeed, attitude and altimeter below; switch and breaker panels lower left.",
});
part(() => sectionSlab(X(16.5), Y(66.2), Y(67.6), 0.97, 0.06, X(15.3)), ["cabin"], {
  color: "#20262B",
  name: "Glareshield",
  note: "Placard above the PFD: MANEUVERING SPEED: 105 KIAS (POH 2-26).",
});
part(() => box(0.26, 0.5, 0.2), ["cabin", "fuel"], {
  pos: P3(20.5, 0, 35.5),
  color: "#39424A",
  fairing: true,
  name: "Center pedestal",
  note: "Elevator trim wheel and position indicator, fuel shutoff knob, fuel selector at its base, 12 V outlet, hand mic (POH 7-13).",
});
(
  [
    [
      42,
      -10,
      "Pilot seat",
      "Vertically adjusting crew seat: fore/aft handle under the center of the frame, height crank under the right corner, seat-back angle button (POH 7-24).",
    ],
    [42, 10, "Front passenger seat", "Same as the pilot seat. Average occupant CG FS 37 (range 34–46) (POH 6-10)."],
    [
      79.5,
      0,
      "Rear bench seat",
      "Fixed one-piece bottom, three-position reclining back; rear passengers FS 73 (POH 7-24, 6-13).",
    ],
  ] as [number, number, string, string][]
).forEach(([fs, bl, name, note], i) => {
  const w = i === 2 ? 0.82 : 0.4;
  part(() => box(0.48, 0.1, w), ["cabin"], { pos: P3(fs, bl, 33), color: "#6B5A48", name, note, pin: true });
  part(() => box(0.09, 0.62, w * 0.92), ["cabin"], {
    pos: P3(fs + 10.5, bl, 45.5),
    rot: [0, 0, 0.18],
    color: "#6B5A48",
    name,
    note,
  });
});
