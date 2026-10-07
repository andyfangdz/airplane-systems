/** Landing gear: main and nose gear, wheels and pants, brakes and brake lines, parking brake, rudder pedals / toe brakes. */
import { V, type Vec3 } from "@/lib/math";
import { brakeAmount, brakeAnim } from "@/lib/anims";
import { box, cyl, pantGeo, tubeGeo, wingP } from "../geometry";
import { useSR20 } from "../store";
import { part } from "./catalogue";

/* ---------- landing gear (track ≈ 2.8 m per POH Fig. 1-1) ---------- */
export const MG = { x: 1.12, y: -1.2, z: 1.42 };
[1, -1].forEach((s) => {
  const top = wingP(s * 1.0, 0.28, -1);
  part(
    () =>
      tubeGeo(
        [
          [top.x, top.y + 0.02, s * 1.0],
          [1.14, -0.9, s * 1.22],
          [MG.x, -1.1, s * 1.36],
        ],
        0.04,
      ),
    ["gear"],
    { name: "Main gear strut", note: "Composite strut bolted to the wing between spar and shear web.", ext: true },
  );
  part(() => cyl(0.19, 0.15, "z", 28), ["gear"], {
    pos: [MG.x, MG.y, s * MG.z],
    color: "#2A2F33",
    name: "Main wheel",
    note: "15 × 6.00 × 6 tubeless tire.",
    ext: true,
  });
  part(() => pantGeo(0.92, 0.19), ["gear"], {
    pos: [MG.x, -1.17, s * MG.z],
    scale: [1, 1, 0.75],
    fairing: true,
    name: "Wheel pant",
    note: "Removable; access plugs allow tire inflation checks.",
    ext: true,
  });
  part(() => cyl(0.12, 0.03, "z", 20), ["gear"], {
    pos: [MG.x, MG.y, s * (MG.z - 0.1)],
    color: "#9AA3AA",
    ext: true,
    anim: brakeAnim(() => brakeAmount(useSR20.getState().s.gear, s > 0 ? "R" : "L")),
    name: "Disc brake",
    note: "Single-disc caliper with pads. An orange temperature tab on the caliper turns brown if the brake overheated — inspect. Brake temp sensor also feeds the CAS alerts.",
  });
  part(
    () =>
      tubeGeo(
        [
          [2.4, -0.6, s * 0.3],
          [1.8, -0.58, s * 0.34],
          [1.28, -0.6, s * 0.8],
          wingP(s * 1.0, 0.33, -1).add(V(0, 0.012, 0)),
        ],
        0.011,
      ),
    ["gear"],
    {
      name: "Brake line (" + (s > 0 ? "R" : "L") + ")",
      note: "Master cylinder at each pedal → parking-brake valve → caliper.",
    },
  );
  // down the aft face of the strut (r 0.04), clear of it, to the caliper on the inboard side of the disc
  part(
    () =>
      tubeGeo(
        [wingP(s * 1.0, 0.33, -1), [MG.x - 0.04, -0.9, s * 1.22], [MG.x - 0.06, -1.13, s * (MG.z - 0.12)]],
        0.011,
      ),
    ["gear"],
    {
      name: "Brake line (" + (s > 0 ? "R" : "L") + ")",
      note: "Runs down the aft side of the gear leg to the caliper (routing on the leg approximate).",
      ext: true,
    },
  );
});
export const NOSE_GEAR: Vec3 = [3.06, -0.52, 0];
export const NOSE_CASTER: Vec3 = [0.22, -0.68, 0];
part(
  () =>
    tubeGeo(
      [
        [0, 0, 0],
        [0.09, -0.34, 0],
        [0.22, -0.66, 0],
      ],
      0.035,
    ),
  ["gear"],
  {
    parent: "noseGear",
    name: "Nose gear strut",
    note: "Tubular steel on the engine mount; oleo shock absorber. Plastic fairing.",
    ext: true,
  },
);
part(() => cyl(0.17, 0.11, "z", 24), ["gear"], {
  parent: "caster",
  pos: [0.02, 0, 0],
  color: "#2A2F33",
  name: "Nose wheel",
  note: "5.00 × 5 tire. Free-castering ±85°; steer with differential braking.",
  ext: true,
});
part(() => pantGeo(0.7, 0.17), ["gear"], {
  parent: "caster",
  pos: [0.02, 0.02, 0],
  scale: [1, 1, 0.7],
  fairing: true,
  name: "Nose wheel pant",
  note: "",
  ext: true,
});
part(() => box(0.04, 0.025, 0.07), ["gear"], {
  pos: [2.16, -0.17, -0.17],
  name: "PARK BRAKE handle",
  note: "Right side kick plate by the pilot's right knee. Set toe brakes, then pull aft. Never set in flight.",
  pin: true,
});
[-0.36, -0.14, 0.14, 0.36].forEach((z) => {
  const parent = z < 0 ? "rig:pedL" : "rig:pedR";
  part(() => box(0.04, 0.18, 0.09), ["gear", "controls"], {
    chan: ["rudder"],
    parent,
    pos: [2.42, -0.52, z],
    rot: [0, 0, 0.35],
    name: "Rudder pedal / toe brake",
    note: "Top half is the toe brake. Either pilot's left or right toe brake applies that side's brake. Pushing a pedal forward pulls its rudder cable (POH Fig. 7-3).",
  });
  part(() => cyl(0.018, 0.1), ["gear"], {
    parent,
    pos: [2.45, -0.58, z],
    color: "#8C959C",
    name: "Brake master cylinder",
    note: "One per pedal. Pressing the toe brake pressurizes that side's brake line.",
  });
});
