/**
 * C182T catalogue: propeller governor and the throttle, propeller and mixture cables (POH 7-27, 7-37, 6-24); the knobs
 * are in engine.ts.
 */
import type { Vec3 } from "@/lib/math";
import { glowAnim as glow } from "@/lib/anims";
import { cyl, tubeGeo } from "../geometry";
import { P3, S, part } from "./catalogue";
import { KNOB } from "./engine";

/* ---------- propeller governor and engine control cables (POH 7-27, 7-37, 6-24) ---------- */
export const GOVERNOR: Vec3 = P3(-42.5, -7, 55.5);
part(() => cyl(0.04, 0.07), ["propeller", "engine"], {
  pos: GOVERNOR,
  color: "#8C959C",
  anim: glow("#8C959C", () => S().eng.fail.gov, ["propeller", "engine"], "#E0263B"),
  name: "Propeller governor",
  note: "C161031-0119, arm −42.5, front of the engine, fed with oil from the left oil gallery. The PROPELLER control sets the RPM to hold; the governing pump boosts engine oil to the hub piston to twist the blades toward high pitch (low RPM); with the pressure relieved, centrifugal force and a spring twist them toward low pitch (POH 7-37, 7-34).",
  pin: true,
});
part(
  () =>
    tubeGeo(
      [
        P3(KNOB.fs - 1, 2.0, KNOB.h),
        P3(12, 2.5, 44),
        P3(0, -2, 51),
        P3(-20, -6, 58.5),
        P3(-38, -7, 58),
        [GOVERNOR[0] + 0.03, GOVERNOR[1] + 0.03, GOVERNOR[2]],
      ],
      0.0045,
    ),
  ["propeller"],
  {
    color: "#2F64C8",
    name: "Propeller control cable",
    note: "Push-pull cable from the blue PROPELLER knob through the firewall to the governor arm: in = high RPM (low pitch), out = low RPM (POH 7-38).",
    pin: true,
  },
);
part(
  () =>
    tubeGeo([P3(KNOB.fs - 1, -1.8, KNOB.h), P3(10, -2, 42), P3(0, -2, 39), P3(-14, -2, 36), P3(-21, -1, 35.5)], 0.004),
  ["engine"],
  {
    color: "#3E4A52",
    name: "Throttle cable",
    note: "Throttle knob → fuel/air control unit throttle valve (POH 7-27, 7-35).",
  },
);
part(
  () => tubeGeo([P3(KNOB.fs - 1, 5.8, KNOB.h), P3(10, 5, 42), P3(0, 3, 38.5), P3(-14, 2, 35), P3(-21, 1, 35)], 0.004),
  ["engine"],
  {
    color: "#C8313B",
    name: "Mixture cable",
    note: "Mixture knob → fuel/air control unit: full in = RICH, full out = IDLE CUTOFF (POH 7-28).",
  },
);
