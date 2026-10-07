/** Structure: firewall, aft bulkhead, spar, roll cage, wing attach points. */
import * as THREE from "three";
import { V, type Vec3 } from "@/lib/math";
import { AB, FW, WR, planeRing, sph, tubeGeo, wC, wLE, wY, fRing } from "../geometry";
import { part } from "./catalogue";

/* ---------- structure ---------- */
part(() => planeRing(FW), ["airframe"], {
  plate: true,
  pin: true,
  name: "Firewall — FS 100",
  note: "Forward cabin boundary. Lower firewall has a 20° bevel for crashworthiness.",
});
part(() => planeRing(AB), ["airframe", "cabin"], {
  plate: true,
  pin: true,
  name: "Aft bulkhead — FS 222",
  note: "Rear of the baggage compartment. Avionics bay, BAT 2, ELT and CAPS sit aft of it.",
});
part(
  () => {
    const pts: THREE.Vector3[] = [];
    for (let z = -5.3; z <= 5.31; z += 0.5) {
      const az = Math.max(Math.abs(z), WR);
      pts.push(V(wLE(az) - 0.3 * wC(az), wY(az) + 0.02 * wC(az), z));
    }
    return tubeGeo(pts, 0.04);
  },
  ["airframe"],
  {
    name: "Main spar",
    note: "Laminated carbon/epoxy C-section, continuous tip to tip. Passes under the front seats.",
    pin: true,
  },
);
[0.75, 2.2].forEach((x) =>
  part(() => tubeGeo(fRing(x, 0.93, 30, -0.25, Math.PI + 0.25, false), 0.025), ["airframe"], {
    name: "Composite roll cage",
    note: "Built into the fuselage to protect occupants in a rollover.",
    pin: x === 0.75,
  }),
);
(
  [
    [1.3, -0.62, 0.4],
    [1.3, -0.62, -0.4],
    [0.2, -0.4, 0.49],
    [0.2, -0.4, -0.49],
  ] as Vec3[]
).forEach((p, i) =>
  part(() => sph(0.05), ["airframe"], {
    pos: p,
    color: "#E0522B",
    name: "Wing attach point",
    note:
      i < 2
        ? "Spar attaches under the front seats."
        : "Rear shear web attaches to the sidewall just aft of the rear seats.",
    pin: i === 0 || i === 2,
  }),
);
