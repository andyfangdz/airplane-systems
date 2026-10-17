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
    id: "parts.pitot.pitot-tube.001",
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
  id: "parts.pitot.pitot-system-drain.002",
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
      instance: [s],
      id: "parts.pitot.static-port.003",
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
  id: "parts.pitot.static-system-drain.004",
  pos: [-2.4, botY(-2.4) - 0.005, 0],
  color: "#0B1014",
  name: "Static system drain",
  note: "On the fuselage bottom skin below the tail-cone access door (Ranger 2-7).",
  ext: true,
});
part(() => box(0.04, 0.03, 0.03), ["pitot"], {
  id: "parts.pitot.alternate-static-source-valve-sb-m20-158.005",
  pos: [PANEL_X + 0.06, -0.28, -0.4],
  color: "#3A9448",
  anim: (m) => {
    m.rotation.z = sim().s.pitot.altStatic ? 0.8 : 0;
  },
  name: "Alternate static source valve (SB M20-158)",
  note: "The actual 1968 OM scan p. 18 explicitly lists optional alternate static. A cabin-source valve is fitted in this study, but N6947N records are unverified; later SB M20-158 installation details must be checked for the aircraft.",
  pin: true,
});
export const STALL_Z = -1.9;
part(() => box(0.02, 0.012, 0.03), ["pitot"], {
  id: "parts.pitot.stall-warning-vane-safe-flight-model-r.006",
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
  id: "parts.pitot.stall-warning-horn.007",
  pos: OVERHEAD.horn,
  color: "#3A9448",
  anim: glow("#2A6A34", "#FF4A4A", () => hornLevel(sim().s, sim().E) > 0, ["pitot"]),
  name: "Stall warning horn",
  note: "Mounted in the cabin headliner (Ranger 2-7): steady tone, distinct from the intermittent gear horn (1968 OM scan p. 21). Electric — dead with the master off (OM p. 3 list).",
  pin: true,
});
