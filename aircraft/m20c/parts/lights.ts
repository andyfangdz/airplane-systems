/** M20C lighting: navigation lights, belly beacon, landing light, spot and dome lights, instrument lights and their switches. */
import * as THREE from "three";

import { type Vec3 } from "@/lib/math";

import { PANEL_X, box, botY, cyl, sph, wingP } from "../geometry";
import { OVERHEAD } from "../placement";

import { P, glow, part, relTv, sim } from "./catalogue";

/* ---------- lighting ---------- */
const tipLE = (s: number): Vec3 => P(wingP(s * 5.28, 0.05, 0));
export const LIGHTS = {
  tipL: tipLE(-1),
  tipR: tipLE(1),
  tail: [-3.74, -0.5, 0] as Vec3,
  beacon: [-0.9, botY(-0.9) - 0.035, 0] as Vec3,
  landing: [2.96, -0.12, -0.13] as Vec3,
  spotL: OVERHEAD.spotL,
  spotR: OVERHEAD.spotR,
  dome: OVERHEAD.dome,
  instr: [PANEL_X - 0.05, 0.05, -0.2] as Vec3,
};
(
  [
    [LIGHTS.tipL, "Left navigation light (red)"],
    [LIGHTS.tipR, "Right navigation light (green)"],
  ] as [Vec3, string][]
).forEach(([pos, name]) =>
  part(() => sph(0.03), ["lighting"], {
    pos,
    color: "#D9D9D9",
    name,
    note: "Wing-tip navigation light on the NAV LIGHTS switch-breaker (OM p. 3–4). Check the lights on the walk-around for a night flight (OM p. 15).",
    pin: true,
    ext: true,
  }),
);
part(() => sph(0.022), ["lighting"], {
  parent: "tail",
  pos: relTv(LIGHTS.tail),
  color: "#D9D9D9",
  name: "Tail navigation light (white)",
  note: "White light at the rudder trailing edge, moving with the tail.",
  pin: true,
  ext: true,
});
part(() => cyl(0.035, 0.06, "y", 12), ["lighting"], {
  pos: LIGHTS.beacon,
  color: "#D9442A",
  name: "Rotating beacon",
  note: "'Rotating beacon (if installed)' (OM p. 3): on N6947N it is on the belly behind the wing, as on most 1960s Mooneys. BEACON switch-breaker.",
  pin: true,
  ext: true,
});
part(
  () => {
    const g = new THREE.CircleGeometry(0.06, 20);
    g.rotateY(Math.PI / 2);
    return g;
  },
  ["lighting"],
  {
    pos: LIGHTS.landing,
    color: "#F2F2E8",
    name: "Landing light",
    note: "Single 250 W sealed-beam lamp in the nose bowl below the spinner (N6947N photos; OM p. 3; 100 W → 250 W with the 1962 M20C). LANDING LIGHT switch-breaker, rightmost on the row.",
    pin: true,
    ext: true,
  },
);
[LIGHTS.spotL, LIGHTS.spotR].forEach((pos, i) =>
  part(() => sph(0.02), ["lighting"], {
    pos,
    color: "#E8C46A",
    anim: glow("#6A5A30", "#FFE7B0", () => sim().E.bus > 0 && sim().s.lights.spot > 0, ["lighting"]),
    name: "Adjustable spot light",
    note: "Two adjustable spot lights on the headliner light the panel; rheostat on the headliner beside them (OM p. 3).",
    pin: i === 0,
  }),
);
part(() => sph(0.025), ["lighting", "cabin"], {
  pos: LIGHTS.dome,
  color: "#E8C46A",
  anim: glow("#6A5A30", "#FFE7B0", () => sim().E.bus > 0 && sim().s.lights.cabin, ["lighting", "cabin"]),
  name: "Cabin dome light",
  note: "On the headliner near the centre of the cabin — also the backup panel light if the instrument lights fail (OM p. 3).",
  pin: true,
});
part(() => box(0.03, 0.01, 0.6), ["lighting"], {
  pos: [PANEL_X + 0.03, 0.2, -0.1],
  color: "#E8C46A",
  anim: glow("#6A5A30", "#FFE7B0", () => sim().E.instLts && sim().s.lights.instr > 0, ["lighting"]),
  name: "Instrument lights",
  note: "Instrument lighting with the rheostat on the panel; INST LTS breaker.",
  pin: true,
});
[
  ["BEACON", -0.5, "beacon"],
  ["NAV LTS", -0.48, "nav"],
  ["LDG LT", -0.44, "landing"],
  ["PITOT HEAT", -0.52, "pitotHeat"],
].forEach(([name, z, k]) =>
  part(() => box(0.02, 0.045, 0.018), ["lighting", "electrical"], {
    pos: [PANEL_X - 0.03, -0.22, z as number],
    color: "#3F4B54",
    anim: (m) => {
      m.rotation.z = sim().s.sw[
        k as keyof typeof sim extends never ? never : "beacon" | "nav" | "landing" | "pitotHeat"
      ]
        ? -0.35
        : 0.35;
    },
    name: name + " switch-breaker",
    note: "On the lower-left switch row (OM p. 4).",
    pin: k !== "pitotHeat",
    pinIn: [],
  }),
);
