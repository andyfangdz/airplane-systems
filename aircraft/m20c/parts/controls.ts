/** M20C flight-control mechanisms: bellcranks, horns, rudder lever; flap pump handle, control, cylinder and torque tube. */
import * as THREE from "three";

import { V, type Vec3 } from "@/lib/math";

import { AIL, FLAP, box, cyl, sph, wingP } from "../geometry";
import { live } from "../model";
import { ARMS, ELEV_HORN, FLAP_PUMP, RUD_HORN, rudHornPivot } from "../rig";
import { glow, part, relTv, sim, surfacePivot } from "./catalogue";

/* ---------- flight-control mechanisms ---------- */
const CTL = "#7C57CF";
const crank = (
  parent: string,
  chan: "elevator" | "aileron" | "rudder",
  name: string,
  note: string,
  arms: Vec3[],
  pin = true,
  axis: "y" | "z" = "z",
) => {
  part(() => cyl(0.02, 0.04, axis, 14), ["controls"], { parent, chan: [chan], color: CTL, name, note, pin });
  arms.forEach((a) =>
    part(
      () => {
        const v = V(...a),
          len = v.length(),
          g = box(0.014, len, 0.014);
        g.translate(0, len / 2, 0);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), v.normalize()));
        return g;
      },
      ["controls"],
      { parent, chan: [chan], color: CTL },
    ),
  );
};
crank(
  "rig:eIdle",
  "elevator",
  "Elevator tube idler",
  "Supports the long elevator push-pull tube under the rear cabin floor (position inferred).",
  [[0, -ARMS.e, 0]],
);
crank(
  "rig:eTail",
  "elevator",
  "Elevator bellcrank (tail cone)",
  "At the tail-cone bulkhead ahead of the empennage pivot: turns the fore-aft tube into the short rod to the elevator horn. The horn moves with the tail, so a trim change does not move the elevator — the trim bungees do that (OM p. 9).",
  [
    [0, -ARMS.e, 0],
    [-ARMS.e * 0.6, -ARMS.e * 0.3, 0],
  ],
);
crank(
  "rig:aFwd",
  "aileron",
  "Aileron bellcrank (forward)",
  "Under the floor below the control wheels: turns the wheel's rotation into the fore-aft aileron tube (inferred).",
  [
    [ARMS.a, 0, 0],
    [0, 0, -ARMS.a],
  ],
  true,
  "y",
);
crank(
  "rig:aCtr",
  "aileron",
  "Aileron centre bellcrank",
  "At the main-spar carry-through: splits the run into the two spanwise push-pull tubes in the wings (inferred).",
  [
    [0, 0, -ARMS.a],
    [ARMS.a * 0.6, 0, 0],
    [-ARMS.a * 0.6, 0, 0],
  ],
  true,
  "y",
);
[1, -1].forEach((s) =>
  crank(
    "rig:wb" + (s > 0 ? "R" : "L"),
    "aileron",
    "Aileron bellcrank (wing)",
    "In the wing behind the main spar: the spanwise tube ends here and a short rod with rod-end bearings drives the aileron horn (OM p. 8).",
    [
      [0.06, 0, 0],
      [0, 0, s * 0.06],
    ],
    s > 0,
    "y",
  ),
);
[1, -1].forEach((s) => {
  const key = "ail" + (s > 0 ? "R" : "L"),
    pv = surfacePivot(key),
    hz = wingP(s * (AIL.z0 + 0.16), AIL.hinge, -1);
  part(() => box(0.012, 0.05, 0.03), ["controls"], {
    chan: ["aileron"],
    parent: "surf:" + key,
    pos: [hz.x - pv[0], hz.y - 0.025 - pv[1], hz.z - pv[2]],
    color: CTL,
    name: "Aileron control horn",
    note: "Horn on the aileron driven by the push rod's self-aligning rod-end bearing (OM p. 8).",
    pin: s > 0,
  });
});
part(() => box(0.012, ELEV_HORN.len, 0.03), ["controls"], {
  parent: "surf:elev",
  chan: ["elevator"],
  pos: (() => {
    const pv = surfacePivot("elev"),
      w = relTv([ELEV_HORN.c[0], ELEV_HORN.c[1] - ELEV_HORN.len / 2, 0]);
    return [w[0] - pv[0], w[1] - pv[1], w[2] - pv[2]] as Vec3;
  })(),
  color: CTL,
  name: "Elevator horn",
  note: "Below the elevator hinge at the root, driven by the rod from the tail-cone bellcrank; the trim bungees attach here (OM p. 9).",
  pin: true,
});
{
  const rh = rudHornPivot(),
    pv = surfacePivot("rudder"),
    w = relTv([rh[0] - RUD_HORN.len / 2, rh[1] - 0.03, 0]);
  part(() => box(RUD_HORN.len, 0.025, 0.03), ["controls"], {
    chan: ["rudder"],
    parent: "surf:rudder",
    pos: [w[0] - pv[0], w[1] - pv[1], w[2] - pv[2]],
    color: CTL,
    name: "Rudder horn",
    note: "At the base of the rudder, driven by the rudder push-pull tube from the pedals (OM p. 8).",
    pin: true,
  });
}
crank(
  "rig:rFwd",
  "rudder",
  "Rudder pedal lever",
  "Pedal torque-tube lever: drives the rudder tube aft and the nose-wheel steering rods forward (OM p. 15; Ranger 2-12).",
  [
    [0, -0.06, 0],
    [0, 0, 0.1],
  ],
  true,
  "y",
);

/* ---------- flaps ---------- */
part(
  () => {
    const g = cyl(0.014, FLAP_PUMP.len, "x");
    g.translate(-FLAP_PUMP.len / 2, 0, 0);
    return g;
  },
  ["flaps"],
  {
    parent: "pump",
    color: "#7C57CF",
    name: "Flap pump handle",
    note: "Hand-pump lever pivoted under the panel, lying aft between the seats just right of the gear bar (above the floor, where the bar lies with the gear up): with the flap control DOWN, lift and push it — two strokes give take-off flap, four and a half full (OM p. 9). Hydraulic fluid shared with the brakes.",
    pin: true,
  },
);
part(() => sph(0.018), ["flaps"], { parent: "pump", pos: [-FLAP_PUMP.len, 0, 0], color: "#1B1F23" });
part(() => box(0.04, 0.02, 0.03), ["flaps"], {
  pos: [FLAP_PUMP.pivot[0] - 0.06, FLAP_PUMP.pivot[1] + 0.04, FLAP_PUMP.pivot[2] + 0.05],
  color: "#F2F5F7",
  anim: (m) => {
    m.rotation.z = sim().s.flaps.valve === "DOWN" ? -0.5 : 0.5;
  },
  name: "Flap control (UP / DOWN)",
  note: "Flap-shaped lever beside the pump handle: DOWN to pump and hold the flaps, UP to let the relief valve bleed them up at a controlled rate — move it back to DOWN to stop part way (OM p. 9).",
  pin: true,
});
part(() => cyl(0.03, 0.22, "x"), ["flaps"], {
  pos: [0.25, -0.62, 0.0],
  color: "#7C57CF",
  anim: glow("#5C4A8A", "#B9A3F0", () => live.pumpAnim > 0.3, ["flaps"]),
  name: "Flap hydraulic cylinder",
  note: "Single hydraulic cylinder under the floor at the flap torque tube; the relief valve releases it as the springs and air load raise the flaps (OM p. 9).",
  pin: true,
});
part(() => cyl(0.018, 1.0, "z"), ["flaps"], {
  pos: [0.05, -0.6, 0],
  color: "#9F85E6",
  name: "Flap torque tube",
  note: "Joins the left and right flap drives so both move together.",
  pin: true,
});
[1, -1].forEach((s) => {
  const key = "flap" + (s > 0 ? "R" : "L"),
    pv = surfacePivot(key),
    hz = wingP(s * 0.7, FLAP.hinge, 0);
  part(() => box(0.012, 0.03, 0.03), ["flaps"], {
    parent: "surf:" + key,
    pos: [hz.x - pv[0], hz.y - 0.015 - pv[1], hz.z - pv[2]],
    color: CTL,
    name: "Flap horn",
    note: "Push rod from the torque-tube arm to the flap horn.",
    pin: s > 0,
  });
});
