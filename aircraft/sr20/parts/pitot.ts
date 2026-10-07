/** Pitot-static and stall warning: pitot, static ports, alternate static, water traps, stall inlet, OAT probes. */
import { V, toVec3 } from "@/lib/math";
import { box, cyl, fus, sph, tubeGeo, wingP } from "../geometry";
import { part, suctionAnim, STALL_Z } from "./catalogue";

/* ---------- pitot-static & stall ---------- */
export const PITOT_Z = -3.2;
export const pitotBase = wingP(PITOT_Z, 0.3, -1);
part(() => tubeGeo([pitotBase, [pitotBase.x, pitotBase.y - 0.16, PITOT_Z]], 0.013), ["pitot"], {
  name: "Pitot mast",
  note: "Single heated pitot, left wing underside.",
  ext: true,
});
part(() => cyl(0.016, 0.28, "x"), ["pitot"], {
  pos: [pitotBase.x + 0.11, pitotBase.y - 0.16, PITOT_Z],
  name: "Heated pitot tube",
  note: "Element heated when PITOT HEAT is on. 7.5 A breaker on NON ESS BUS; current sensor drives PITOT HEAT FAIL.",
  pin: true,
  ext: true,
});
export const SPX = -1.6;
export const statR = fus(SPX);
[1, -1].forEach((s) =>
  part(() => cyl(0.025, 0.006, "z"), ["pitot"], {
    pos: [SPX, statR.cy, s * statR.hw],
    color: "#3A9448",
    name: "Static port (" + (s > 0 ? "R" : "L") + ")",
    note: "Dual static ports in the fuselage.",
    pin: s > 0,
    ext: true,
  }),
);
part(() => box(0.05, 0.05, 0.03), ["pitot"], {
  pos: [1.84, -0.3, -0.14],
  color: "#3A9448",
  name: "Alternate static valve",
  note: "Console, right of the pilot's leg. Uses cabin pressure; apply Section 5 corrections.",
  pin: true,
});
part(() => box(0.05, 0.04, 0.05), ["pitot"], {
  pos: [0.9, -0.62, 0],
  color: "#3A9448",
  name: "Water traps",
  note: "Drains at pitot/static low points under the cabin floor. Drain at annual or when water suspected.",
});
part(() => sph(0.025), ["pitot"], {
  pos: toVec3(wingP(STALL_Z, 0, 0)),
  color: "#3A9448",
  name: "Stall warning inlet",
  note: "Right wing leading edge. Sucks as the low-pressure peak moves forward near stall → pressure switch → horn, red STALL, autopilot disconnect.",
  pin: true,
  ext: true,
});
part(() => sph(0.04), ["pitot"], {
  pos: toVec3(wingP(STALL_Z, 0.3, 1)),
  color: "#E0263B",
  anim: suctionAnim,
  name: "Low-pressure peak",
  note: "Moves forward around the leading edge as angle of attack increases.",
  ext: true,
});
[-2.15, -2.3].forEach((z, i) => {
  const b = wingP(z, 0.45, -1);
  part(() => tubeGeo([b.clone().add(V(0, 0.01, 0)), b.clone().add(V(0.01, -0.07, 0))], 0.006), ["pitot", "avionics"], {
    color: "#8C959C",
    name: "OAT probes",
    note: "Two outside-air-temperature probes under the left wing feed the air data computers (location per Costanzo deck photo).",
    ext: true,
    pin: i === 0,
  });
});
