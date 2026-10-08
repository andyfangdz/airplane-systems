import type { Vec3 } from "@/lib/math";
import { brakeAmount, brakeAnim } from "@/lib/anims";
import { box, cyl, fs, pantGeo, tubeGeo } from "../geometry";
import { PEDALS } from "../rig";
import { part, sim } from "./catalogue";

/* ---------- landing gear (track 2.97 m, AFM 1-7) ---------- */
export const MG = { x: fs(2.73), y: -1.045, z: 1.485, r: 0.19 };
[1, -1].forEach((s) => {
  const top: Vec3 = [fs(2.62), -0.6, s * 0.62],
    mid: Vec3 = [fs(2.66), -0.66, s * 0.92];
  part(() => tubeGeo([top, mid, [MG.x + 0.02, MG.y + 0.04, s * (MG.z - 0.12)]], 0.03, 0.2), ["gear"], {
    color: "#6E7A84",
    name: "Main gear leg (spring steel)",
    note: "Sprung steel strut — the only shock absorption on the mains (AFM 7-13). Walk-around: strut, fairing, tyre, brake, brake line and slip marks (AFM 4A-6).",
    ext: true,
    pin: s > 0,
  });
  part(() => cyl(MG.r, 0.15, "z", 28), ["gear"], {
    pos: [MG.x, MG.y, s * MG.z],
    color: "#2A2F33",
    name: "Main wheel",
    note: "15 × 6.0-6 tyre (with the thin or tall MLG strut) or 6.00-6. Pressure 2.5 bar / 36 psi (AFM 1-7, 4A-6).",
    ext: true,
    pin: s > 0,
  });
  part(() => pantGeo(0.95, 0.2), ["gear"], {
    pos: [MG.x + 0.02, MG.y + 0.03, s * MG.z],
    scale: [1, 1, 0.65],
    fairing: true,
    color: "#F3F5F6",
    name: "Wheel fairing",
    note: "Removable; without the fairings cruise speed drops by about 5 % (AFM 5-17).",
    ext: true,
    pin: s > 0,
  });
  part(() => cyl(0.11, 0.03, "z", 20), ["gear"], {
    pos: [MG.x, MG.y, s * (MG.z - 0.1)],
    color: "#9AA3AA",
    ext: true,
    anim: brakeAnim(() => brakeAmount(sim().s.gear, s > 0 ? "R" : "L")),
    name: "Disc brake (Cleveland 30-239)",
    note: "Hydraulic single-disc brake on each main wheel, operated by the toe pedals (AFM 7-13, 6-23).",
    pin: s > 0,
  });
  part(
    () =>
      tubeGeo(
        [
          [fs(1.6), -0.55, s * 0.25],
          [fs(2.3), -0.58, s * 0.3],
          [fs(2.55), -0.56, s * 0.5],
          top,
          mid,
          [MG.x + 0.02, MG.y + 0.07, s * (MG.z - 0.13)],
        ],
        0.008,
      ),
    ["gear"],
    {
      name: "Brake line (" + (s > 0 ? "R" : "L") + ")",
      note: "Parking-brake valve → brake cylinder at the wheel (AFM 7-14 hydraulic schematic).",
    },
  );
});
/** Nose-gear leg: pivot at the bottom of the engine mount (≈ FS 1.36), raked steeply forward to the fork (axle ≈ FS 1.03, wheelbase per AFM 1-7). */
export const NOSE_GEAR: Vec3 = [fs(1.36), -0.5, 0];
export const NOSE_CASTER: Vec3 = [0.33, -0.52, 0];
part(
  () =>
    tubeGeo(
      [
        [0, 0, 0],
        [0.1, -0.12, 0],
        [0.33, -0.5, 0],
      ],
      0.03,
    ),
  ["gear"],
  {
    parent: "noseGear",
    color: "#6E7A84",
    name: "Nose gear strut",
    note: "Free-castering nose wheel sprung by an elastomer package (AFM 7-13). There is no nose-wheel steering: steer with rudder and differential braking.",
    ext: true,
    pin: true,
  },
);
part(() => cyl(0.06, 0.16, "y", 14), ["gear"], {
  parent: "noseGear",
  pos: [0.05, -0.06, 0],
  rot: [0, 0, 0.69],
  color: "#2A2F33",
  name: "Elastomer package",
  note: "Stack of elastomer discs that springs the nose gear (AFM 7-13).",
  ext: true,
  pin: true,
});
part(() => cyl(0.178, 0.12, "z", 24), ["gear"], {
  parent: "caster",
  pos: [0.0, -0.005, 0],
  color: "#2A2F33",
  name: "Nose wheel",
  note: "5.00-5 tyre, 2.0 bar / 29 psi (AFM 1-7, 4A-9).",
  ext: true,
  pin: true,
});
part(() => pantGeo(0.72, 0.18), ["gear"], {
  parent: "caster",
  pos: [0.02, 0.02, 0],
  scale: [1, 1, 0.66],
  fairing: true,
  color: "#F3F5F6",
  name: "Nose wheel fairing",
  note: "Has the holes for the tow bar. Remove the tow bar before starting the engine (AFM 8-3).",
  ext: true,
});
part(() => box(0.06, 0.12, 0.03), ["gear", "environment"], {
  pos: [fs(1.86), -0.36, 0.05],
  color: "#B53A3A",
  anim: (m) => {
    m.rotation.z = sim().s.gear.park ? -0.6 : 0.3;
  },
  name: "PARKING BRAKE lever",
  note: "On the small centre console under the panel. Up = released. To set: pull down until it catches, then pump the toe brakes (AFM 7-13).",
  pin: true,
});
part(() => box(0.06, 0.05, 0.06), ["gear"], {
  pos: [fs(1.9), -0.58, 0.05],
  color: "#7E8A93",
  name: "Parking brake valve (Cleveland 60-59)",
  note: "Between the master cylinders and the wheel brake cylinders; traps pressure while set (AFM 7-14, 6-23). Location assumed.",
});
PEDALS.z.forEach((z, i) => {
  const parent = i % 2 === 0 ? "rig:pedL" : "rig:pedR"; // outer-left and inner-right pedals are the left pedals
  part(() => box(0.035, 0.16, 0.08), ["gear", "controls"], {
    chan: ["rudder"],
    parent,
    pos: [PEDALS.x, PEDALS.y, z],
    rot: [0, 0, 0.3],
    color: "#30363B",
    name: "Rudder pedal / toe brake",
    note: "Pedals with toe brakes at both front seats; adjustable fore/aft on the ground only — electrically on the XLS with a rocker switch on the leg-room rear wall (AFM 7-8, 7-9).",
    pin: i === 0,
  });
  part(() => cyl(0.014, 0.1), ["gear"], {
    parent,
    pos: [PEDALS.x + 0.05, PEDALS.y + 0.01, z],
    color: "#8C959C",
    name: "Brake master cylinder (Cleveland 10-54)",
    note: "Four: each pilot pedal cylinder is plumbed in series with the co-pilot's on the same side; the co-pilot cylinders carry the small reservoirs (AFM 7-14).",
    pin: i === 0,
  });
});
part(() => box(0.05, 0.03, 0.06), ["gear", "cabin"], {
  pos: [fs(1.95), -0.52, -0.3],
  color: "#3F4B54",
  name: "Pedal adjustment rocker + breaker",
  note: "XLS electric pedal adjustment (OAM 40-251): rocker on the leg-room rear wall, its circuit breaker just below. Runaway → pull that breaker (AFM 7-9, 4B-10). Rating and bus not in the documents.",
});
