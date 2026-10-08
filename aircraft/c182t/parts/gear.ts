import { tireGeo } from "@/lib/geometry";
/** C182T catalogue: landing gear — main legs, wheels, fairings, brakes, nose strut and steering, parking brake, tow bar. */
import { V, type Vec3 } from "@/lib/math";
import { brakeAnim } from "@/lib/anims";
import { box, cyl, taperTubeGeo, tubeGeo, wheelFairingGeo } from "../geometry";
import { IN } from "../../cessna/airframe";
import { P3, braking, fairingAnim, part } from "./catalogue";

/* ---------- landing gear: track 9'-0" (POH 1-3), wheelbase 66.5 in, main axles FS 58.9, nose axle ≈ FS −7.6 (POH 1-4, 6-22) ---------- */
export const MG = { fs: 58.9, bl: 54, h: 8.7 };
[1, -1].forEach((s) => {
  const top = P3(64.8, s * 17.5, 23.6),
    axle = P3(MG.fs, s * (MG.bl - 4.4), MG.h + 1.4);
  part(() => taperTubeGeo(top, axle, 1.2 * IN, 0.85 * IN), ["gear", "airframe"], {
    color: "#AEB6BC",
    name: "Main gear leg (spring steel)",
    note: "Tubular spring-steel main landing gear strut, attached by a bulkhead and forgings at the base of the rear door posts (FS 65.30) (POH 7-5, 7-21). Its step bracket has the jack pad (POH 8-10).",
    ext: true,
    pin: s > 0,
  });
  {
    const sb = V(...top).lerp(V(...axle), 0.34);
    part(() => box(0.1, 0.012, 0.09), ["gear", "cabin"], {
      pos: [sb.x - 0.05, sb.y + 0.01, sb.z],
      color: "#5C666E",
      name: "Main gear step bracket",
      note: "Step on each main gear strut; its jack pad lets one main wheel be jacked at a time — the strut flexes and the wheel slides inboard. Don't jack both mains at once (POH 8-10).",
      ext: true,
      pin: s > 0,
    });
  }
  part(() => tireGeo(8.75 * IN, 6 * IN), ["gear"], {
    pos: P3(MG.fs, s * MG.bl, MG.h),
    color: "#2A2F33",
    name: "Main wheel and tire",
    note: "6.00-6, 6-ply rated, 42 PSI, with tube; Cleveland 40-75B wheel, arm 58.9 (POH 8-21, 6-22).",
    ext: true,
    pin: s > 0,
  });
  part(() => cyl(4.05 * IN, 4.7 * IN, "z", 32), ["gear"], {
    pos: P3(MG.fs, s * MG.bl, MG.h),
    color: "#D6DADD",
    ext: true,
  });
  part(() => cyl(1.35 * IN, 4.9 * IN, "z", 24), ["gear"], {
    pos: P3(MG.fs, s * MG.bl, MG.h),
    color: "#7C858B",
    ext: true,
  });
  part(
    () => wheelFairingGeo({ len: 38, height: 20, width: 11, axle: 0.42, lift: 0.6, cut: 3.2 - MG.h, tail: 1.1 }),
    ["gear"],
    {
      pos: P3(MG.fs, s * (MG.bl - 0.8), MG.h),
      color: "#EEF1F3",
      anim: fairingAnim,
      fairing: true,
      name: "Wheel fairing",
      note: "Main fairings, set of 2, arm 60.6 (equipment item 32-03-A). Optional in the 2005 POH (standard in 2007); worth ≈ 3 knots (POH v, 7-21). N8050J is shown without fairings in the current flyingclub.org photo; toggle the optional fairings in the Gear panel.",
      ext: true,
      pin: s > 0,
    },
  );
  part(() => cyl(4.4 * IN, 0.25 * IN, "z", 24), ["gear"], {
    pos: P3(MG.fs, s * (MG.bl - 3.8), MG.h),
    color: "#9AA3AA",
    anim: brakeAnim(braking(s > 0 ? "R" : "L")),
    name: "Brake disc",
    note: "Single-disc, hydraulically actuated brake on the inboard side of each main wheel; Cleveland 30-52, arm 55.5 (POH 7-46, 7-21, 6-22).",
    ext: true,
    pin: s > 0,
  });
  part(() => box(0.08, 0.06, 0.04), ["gear"], {
    pos: P3(MG.fs - 2.5, s * (MG.bl - 4.8), MG.h + 3),
    color: "#C8313B",
    name: "Brake caliper",
    note: "MIL-H-5606 fluid (POH 8-21). Fading, noisy or dragging brakes, soft or spongy pedals: release and reapply hard; pump to build pressure; with one brake weak use the other sparingly with opposite rudder (POH 7-46).",
    ext: true,
  });
  part(
    () =>
      tubeGeo(
        [
          P3(8.5, s * 8, 27.2),
          P3(30, s * 11, 26.4),
          P3(55, s * 13, 25.6),
          P3(63.5, s * 16.5, 24.0),
          [top[0], top[1] - 0.01, top[2]],
          [axle[0] + 0.05, axle[1] + 0.05, axle[2] - s * 0.03],
        ],
        0.006,
      ),
    ["gear"],
    {
      name: "Brake line",
      note: "From the master cylinder on each of the pilot's pedals, down the gear leg to the wheel cylinder (POH 7-46).",
    },
  );
});
/** Top of the nose strut inside the cowl. The strut rakes forward: the axle (FS −7.6, which keeps the POH 66.5 in wheelbase) sits about
 *  4.6 in ahead of where the strut leaves the cowl (182T photos). The noseGear group is tilted by NOSE_RAKE so its y axis runs
 *  down the strut and the steering turns about the strut. */
export const NOSE: Vec3 = P3(-3, 0, 30.5);
const AXLE: Vec3 = P3(-7.6, 0, 7.1);
export const NOSE_RAKE = Math.atan2(AXLE[0] - NOSE[0], NOSE[1] - AXLE[1]);
/** The steering group pivots at the strut top, about the strut axis. */
export const NOSE_CASTER: Vec3 = [0, 0, 0];
/** Axle in the strut frame (on the strut line). */
const NA: Vec3 = [0, -Math.hypot(AXLE[0] - NOSE[0], AXLE[1] - NOSE[1]), 0];
part(() => cyl(0.036, 0.22), ["gear"], {
  parent: "noseGear",
  pos: [0, -0.07, 0],
  color: "#AEB6BC",
  name: "Nose gear shock strut (air/oil)",
  note: "Air/oil shock strut: MIL-H-5606 and 55–60 PSI with no load on the strut; about 2 in of strut shows in the normal ground attitude (POH 7-21, 8-21, 1-4). A deflated strut raises the tail when towing (POH 8-9).",
  ext: true,
  pin: true,
});
// fork: a stem from the strut down to a crown above the tire, two legs either side of the wheel to the axle
[1, -1].forEach((s) =>
  part(
    () =>
      tubeGeo(
        [
          [0, NA[1] + 0.21, s * 0.075],
          [0, NA[1], s * 0.075],
        ],
        0.012,
      ),
    ["gear"],
    { parent: "caster", color: "#C9D0D5" },
  ),
);
part(() => box(0.035, 0.03, 0.17), ["gear"], { parent: "caster", pos: [0, NA[1] + 0.215, 0], color: "#C9D0D5" });
part(
  () =>
    tubeGeo(
      [
        [0, -0.16, 0],
        [0.01, NA[1] * 0.55, 0],
        [0, NA[1] + 0.22, 0],
      ],
      0.022,
    ),
  ["gear"],
  {
    parent: "caster",
    color: "#C9D0D5",
    name: "Nose gear fork and torque link",
    note: "Turns with the steering bungee: about 11° each side with the pedals, up to 29° with differential braking (POH 7-19).",
    ext: true,
    pin: true,
  },
);
part(() => tireGeo(7.1 * IN, 5 * IN), ["gear"], {
  parent: "caster",
  pos: NA,
  color: "#2A2F33",
  name: "Nose wheel and tire",
  note: "5.00-5, 6-ply rated, 49 PSI, with tube; Cleveland 40-77 wheel, arm −7.1 (POH 8-21, 6-22). Never turn it more than 29° either side when towing (POH 7-19).",
  ext: true,
  pin: true,
});
part(() => cyl(3.3 * IN, 3.9 * IN, "z", 32), ["gear"], {
  parent: "caster",
  pos: NA,
  color: "#D6DADD",
  ext: true,
});
part(() => cyl(1.1 * IN, 4.1 * IN, "z", 24), ["gear"], {
  parent: "caster",
  pos: NA,
  color: "#7C858B",
  ext: true,
});
part(
  () => wheelFairingGeo({ len: 32, height: 16, width: 8.5, axle: 0.42, lift: 0.6, cut: -4.6, tail: 1.1 }),
  ["gear"],
  {
    parent: "caster",
    pos: [NA[0], NA[1], 0],
    rot: [0, 0, -NOSE_RAKE],
    color: "#EEF1F3",
    anim: fairingAnim,
    fairing: true,
    name: "Nose wheel fairing",
    note: "Nose speed fairing, arm −6.0 (equipment item 32-03-A, optional in 2005). Check fairings for mud, snow or slush (POH 4-26).",
    ext: true,
  },
);
part(() => box(0.06, 0.03, 0.16), ["gear", "controls"], {
  parent: "caster",
  pos: [0.0, -0.02, 0],
  color: "#7C57CF",
  name: "Steering arm",
  note: "The spring-loaded steering bungees from the rudder bars attach here (POH 7-19).",
  chan: ["rudder"],
  pin: true,
});
part(() => box(0.06, 0.03, 0.1), ["gear"], {
  pos: P3(18.6, -13.5, 40.4),
  color: "#C8313B",
  name: "Parking brake handle",
  note: "Under the left side of the panel (Fig 7-2 item 37): set the brakes with the pedals, pull the handle aft and rotate it 90° down (POH 7-46). Not in cold weather with moisture, nor with hot brakes (POH 8-9).",
  pin: true,
});
part(() => box(0.5, 0.04, 0.04), ["gear", "cabin"], {
  pos: P3(108, 11.5, 36),
  color: "#8C959C",
  name: "Tow bar (stowed)",
  note: "Stowed on the side of the baggage area, arm 108.0 (POH 8-9, 6-21). Without it, push on the wing struts — never on the tail surfaces (POH 7-19).",
  pin: true,
});
