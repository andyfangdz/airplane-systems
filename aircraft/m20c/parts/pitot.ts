/** M20C pitot-static and stall warning: pitot tube and drain, static ports and drain, alternate static valve, stall vane and horn. */
import * as THREE from "three";

import { mats } from "@/lib/materials";
import { V } from "@/lib/math";

import { PANEL_X, box, botY, cyl, onSkin, sph, tubeGeo, wingP } from "../geometry";
import { hornLevel } from "../model";
import { OVERHEAD } from "../placement";

import { P, glow, part, sim, sysNow } from "./catalogue";

/* ---------- pitot-static & stall warning ---------- */
export const PITOT_Z = -2.2;
export const pitotBase = wingP(PITOT_Z, 0.3, -1);
part(
  () => {
    const g = tubeGeo(
      [
        [0, 0, 0],
        [0, -0.1, 0],
        [0.12, -0.1, 0],
      ],
      0.009,
    );
    return g;
  },
  ["pitot"],
  {
    pos: P(pitotBase),
    color: "#3A9448",
    anim: (m) => {
      const hot = sim().E.pitotHeat;
      m.material =
        sysNow() === "pitot" || sysNow() === "overview"
          ? hot
            ? mats("#FF8A4A").hi
            : mats("#3A9448").on
          : mats("#3A9448").dim;
    },
    name: "Pitot tube",
    note: "On the lower surface of the left wing, picking up ram air for the airspeed indicator; heated pitot optional (OM p. 3; Ranger 2-7). Span station approximate.",
    ext: true,
    pin: true,
  },
);
part(() => sph(0.01), ["pitot"], {
  pos: P(wingP(-0.8, 0.15, -1)),
  color: "#0B1014",
  name: "Pitot system drain",
  note: "Drain valve on the forward bottom skin of the left wing just outboard of the fillet (Ranger 2-7).",
  ext: true,
  pin: true,
});
export const STAT_X = -2.65;
[1, -1].forEach((s) =>
  part(
    () => {
      const g = new THREE.CircleGeometry(0.012, 12);
      g.rotateY(s > 0 ? Math.PI / 2 : -Math.PI / 2);
      return g;
    },
    ["pitot"],
    {
      pos: P(onSkin(STAT_X, -0.3, s, 1.003)),
      color: "#0B1014",
      name: "Static port",
      note: "One on each side of the tail cone, tied together (Ranger 2-7). Walk-around: unobstructed. The static drain is in the belly below the tail-cone access door.",
      ext: true,
      pin: s > 0,
    },
  ),
);
part(() => sph(0.01), ["pitot"], {
  pos: [-2.4, botY(-2.4) - 0.005, 0],
  color: "#0B1014",
  name: "Static system drain",
  note: "On the fuselage bottom skin below the tail-cone access door (Ranger 2-7).",
  ext: true,
});
part(() => box(0.04, 0.03, 0.03), ["pitot"], {
  pos: [PANEL_X + 0.06, -0.28, -0.4],
  color: "#3A9448",
  anim: (m) => {
    m.rotation.z = sim().s.pitot.altStatic ? 0.8 : 0;
  },
  name: "Alternate static source valve (SB M20-158)",
  note: "Not factory-fitted on 1960s Mooneys — Service Bulletin M20-158 (1969) added a valve under the left side of the panel that opens the static line to the cabin (Ranger 2-7). Whether N6947N has it is not known; modelled as fitted.",
  pin: true,
});
export const STALL_Z = -1.9;
part(() => box(0.02, 0.012, 0.03), ["pitot"], {
  pos: P(wingP(STALL_Z, 0.0, 0).add(V(0.005, -0.01, 0))),
  color: "#E0263B",
  anim: (m) => {
    m.rotation.z = hornLevel(sim().s, sim().E) > 0 ? 0.6 : 0.0;
  },
  name: "Stall-warning vane (Safe-Flight Model R)",
  note: "Lift-detector vane in the left wing leading edge (TCDS 2A3): lifted by the airflow near the stall it closes the horn circuit (Ranger 2-7). Set to sound 5–10 mph above the stall (OM p. 23). Walk-around: lift the vane and listen.",
  ext: true,
  pin: true,
});
part(() => cyl(0.025, 0.03, "y", 16), ["pitot", "electrical"], {
  pos: OVERHEAD.horn,
  color: "#3A9448",
  anim: glow("#2A6A34", "#FF4A4A", () => hornLevel(sim().s, sim().E) > 0, ["pitot"]),
  name: "Stall warning horn",
  note: "Mounted in the cabin headliner (Ranger 2-7): intermittent, then steady at the stall. Electric — dead with the master off (OM p. 3 list).",
  pin: true,
});
