/** C172S catalogue: landing gear — main and nose gear, wheels, brakes, steering, parking brake and tow bar. */
import { V, type Vec3 } from "@/lib/math";
import { brakeAnim } from "@/lib/anims";
import { box, cyl, taperTubeGeo, tubeGeo, wheelFairingGeo } from "../geometry";
import { IN } from "../../cessna/airframe";
import { P3, part, braking } from "./catalogue";

/* ---------- landing gear: wheelbase 65.0 in, main axles FS 58.2, nose axle FS −6.8 (POH 1-4, 6-21) ---------- */
export const MG = { fs: 58.2, bl: 50, h: 8.6 };
[1, -1].forEach((s) => {
  const top = P3(60.5, s * 14.5, 25.8),
    axle = P3(MG.fs, s * (MG.bl - 4.2), MG.h + 1.4);
  part(() => taperTubeGeo(top, axle, 1.1 * IN, 0.8 * IN), ["gear", "airframe"], {
    color: "#AEB6BC",
    name: "Main gear leg (spring steel)",
    note: "Tubular spring-steel main landing gear strut attached by a bulkhead and forgings at the base of the rear door posts (POH 7-5, 7-23). Jack pad in the step bracket (POH 8-10).",
    ext: true,
    pin: s > 0,
  });
  {
    // step bracket about a third of the way down the strut, on its aft side; it carries the jack pad (POH 8-10)
    const sb = V(...top).lerp(V(...axle), 0.36);
    part(() => box(0.1, 0.012, 0.09), ["gear", "cabin"], {
      pos: [sb.x - 0.05, sb.y + 0.01, sb.z],
      color: "#5C666E",
      name: "Main gear step bracket",
      note: "Step on each main gear strut; the individual-gear jack pad is built into it (POH 8-10). Jack one main wheel at a time — the strut flexes and the wheel slides inboard.",
      ext: true,
      pin: s > 0,
    });
  }
  part(() => cyl(8.75 * IN, 6 * IN, "z", 28), ["gear"], {
    pos: P3(MG.fs, s * MG.bl, MG.h),
    color: "#2A2F33",
    name: "Main wheel and tire",
    note: "6.00 × 6, 6-ply tube type, 42 PSI (POH 8-21). Wheel assembly arm FS 58.2.",
    ext: true,
    pin: s > 0,
  });
  part(() => wheelFairingGeo({ len: 36, height: 20, width: 11, axle: 0.47, lift: 1, cut: 3 - MG.h }), ["gear"], {
    pos: P3(MG.fs, s * (MG.bl - 0.7), MG.h),
    fairing: true,
    name: "Wheel fairing",
    note: "Speed fairings are standard (POH 7-23) and worth about 2 knots (POH v); removable per the KOEL.",
    ext: true,
    pin: s > 0,
    color: "#EEF1F3",
  });
  part(() => cyl(4.2 * IN, 0.25 * IN, "z", 24), ["gear"], {
    pos: P3(MG.fs, s * (MG.bl - 3.6), MG.h),
    color: "#9AA3AA",
    anim: brakeAnim(braking(s > 0 ? "R" : "L")),
    name: "Brake disc",
    note: "Single-disc, hydraulically actuated brake on the inboard side of each main wheel (POH 7-46, 7-23).",
    ext: true,
    pin: s > 0,
  });
  part(() => box(0.08, 0.06, 0.04), ["gear"], {
    pos: P3(MG.fs - 2, s * (MG.bl - 4.6), MG.h + 3),
    color: "#C8313B",
    name: "Brake caliper",
    note: "MIL-H-5606 fluid (POH 8-21). Fading, spongy pedals or dragging brakes: release and reapply hard; pump to build pressure (POH 7-46).",
    ext: true,
  });
  part(
    () =>
      tubeGeo(
        [
          P3(9, s * 8, 27.5),
          P3(30, s * 11, 27),
          P3(55, s * 12, 27),
          P3(59.5, s * 14.5, 25.6),
          [top[0], top[1] - 0.01, top[2]],
          [axle[0] + 0.05, axle[1] + 0.05, axle[2] - s * 0.03],
        ],
        0.006,
      ),
    ["gear"],
    {
      name: "Brake line",
      note: "From the master cylinder on the pilot's pedal, down the gear leg to the wheel cylinder (POH 7-46).",
    },
  );
});
export const NOSE: Vec3 = P3(-10, 0, 31);
/** The steering group pivots at the strut top; the axle sits below and slightly aft (trail). */
export const NOSE_CASTER: Vec3 = [0, 0, 0];
const NA: Vec3 = (() => {
  const a = P3(-6.8, 0, 7.1);
  return [a[0] - NOSE[0], a[1] - NOSE[1], 0];
})();
part(() => cyl(0.034, 0.2), ["gear"], {
  parent: "noseGear",
  pos: [0, -0.06, 0],
  color: "#AEB6BC",
  name: "Nose gear shock strut (oleo)",
  note: "Air/oil shock strut: MIL-H-5606 and 45 PSI with no load on the strut; about 2 in of strut shows in the normal ground attitude (POH 7-23, 8-21, 1-4).",
  ext: true,
  pin: true,
});
part(
  () =>
    tubeGeo(
      [
        [0, -0.15, 0],
        [NA[0] * 0.5, -0.4, 0],
        [NA[0], NA[1] + 0.02, 0],
      ],
      0.022,
    ),
  ["gear"],
  {
    parent: "caster",
    color: "#C9D0D5",
    name: "Nose gear fork and torque link",
    note: "Turns with the steering bungee: about 10° each side with the pedals, up to 30° with differential braking (POH 7-22).",
    ext: true,
  },
);
part(() => cyl(7.1 * IN, 4.6 * IN, "z", 24), ["gear"], {
  parent: "caster",
  pos: NA,
  color: "#2A2F33",
  name: "Nose wheel and tire",
  note: "5.00 × 5, 6-ply tube type, 45 PSI; nose wheel arm FS −6.8 (POH 6-21, 8-21). Never turn more than 30° when towing (POH 7-22).",
  ext: true,
  pin: true,
});
part(() => wheelFairingGeo({ len: 32, height: 18, width: 9.5, axle: 0.47, lift: 1, cut: -4.5 }), ["gear"], {
  parent: "caster",
  pos: [NA[0], NA[1], 0],
  color: "#EEF1F3",
  fairing: true,
  name: "Nose wheel fairing",
  note: "Nose speed fairing, arm FS −3.5 (POH 6-21).",
  ext: true,
});
part(() => box(0.06, 0.03, 0.16), ["gear", "controls"], {
  parent: "caster",
  pos: [0.0, -0.02, 0],
  color: "#7C57CF",
  name: "Steering arm",
  note: "The spring-loaded steering bungees from the rudder bars attach here (POH 7-22).",
  chan: ["rudder"],
});
part(() => box(0.06, 0.03, 0.1), ["gear"], {
  pos: P3(18.6, -13.5, 43),
  color: "#C8313B",
  name: "Parking brake handle",
  note: "Under the left side of the panel: set the brakes with the pedals, pull the handle aft and rotate it 90° down (POH 7-46). Don't set it in cold weather or with hot brakes (POH 8-9).",
  pin: true,
});
part(() => box(0.5, 0.04, 0.04), ["gear", "cabin"], {
  pos: P3(121, 9.5, 36),
  color: "#8C959C",
  name: "Tow bar (stowed)",
  note: "Stowed on the side of the baggage area, arm 124.0 (POH 6-20, 8-9). Without it, push on the wing struts — never on the tail surfaces.",
  pin: true,
});
