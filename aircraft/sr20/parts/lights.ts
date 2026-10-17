/** Lights: convenience lights inside, wingtip nav/strobe, aft position, landing and ice lights. */
import { V, toVec3, type Vec3 } from "@/lib/math";
import { box, cyl, onSkin, sph, wC, wLE, wY, wingP } from "../geometry";
import { part } from "./catalogue";

/* ---------- lights ---------- */
const tipAt = (s: number): Vec3 => [wLE(5.84) - 0.5 * wC(5.84), wY(5.84), s * 5.85];
const iceAt = (s: number) => onSkin(2.02, -0.34, s);
export const LIGHTS = {
  // wingtip assemblies: forward nav + strobe, aft-facing white position light, leading-edge landing light
  tipL: tipAt(-1),
  tipR: tipAt(1),
  aftL: toVec3(wingP(-5.8, 0.93, 0).add(V(-0.02, 0, -0.01))),
  aftR: toVec3(wingP(5.8, 0.93, 0).add(V(-0.02, 0, 0.01))),
  landL: toVec3(wingP(-5.5, 0, 0).add(V(0.01, 0, 0))),
  landR: toVec3(wingP(5.5, 0, 0).add(V(0.01, 0, 0))),
  /** Ice inspection lights on the fuselage sides, aimed at each wing leading edge. */
  iceL: toVec3(iceAt(-1)),
  iceR: toVec3(iceAt(1)),
  iceAimL: toVec3(wingP(-2.4, 0.02, 1)),
  iceAimR: toVec3(wingP(2.4, 0.02, 1)),
  dome: [1.2, 0.64, 0] as Vec3,
  foot: [
    [2.2, -0.55, -0.35],
    [2.2, -0.55, 0.35],
    [0.8, -0.56, -0.35],
    [0.8, -0.56, 0.35],
  ] as Vec3[],
  step: [
    [1.55, -0.74, -0.52],
    [1.55, -0.74, 0.52],
  ] as Vec3[],
  bag: [-0.3, 0.48, 0] as Vec3,
};
(
  [
    ["dome", "Dome light", LIGHTS.dome, false],
    ["footwell", "Footwell light", LIGHTS.foot[0], false],
    ["entry", "Entry step light", LIGHTS.step[0], true],
    ["baggage", "Baggage light", LIGHTS.bag, false],
  ] as [string, string, Vec3, boolean][]
).forEach(([key, name, pos, ext]) =>
  part(() => sph(0.022), ["lighting"], {
    id: "parts.lights.part.001",
    instance: key,
    pos,
    color: "#E8C46A",
    name,
    note: "Convenience lighting, 5 A CONV LIGHTS breaker on the CONV bus (BAT 1 direct).",
    pin: true,
    ext,
  }),
);
const EXT = "#D9D9D9";
(
  [
    ["left", LIGHTS.tipL, "Left wingtip: nav (red) + strobe"],
    ["right", LIGHTS.tipR, "Right wingtip: nav (green) + strobe"],
  ] as [string, Vec3, string][]
).forEach(([key, pos, name]) =>
  part(() => sph(0.035), ["lighting"], {
    id: "parts.lights.part.002",
    instance: key,

    pos,
    color: EXT,
    name,
    note: "LED position light and anti-collision strobe in one wingtip assembly. NAV and STROBE switches on the bolster; breakers on NON ESS BUS.",
    pin: true,
    ext: true,
  }),
);
(
  [
    ["left", LIGHTS.aftL],
    ["right", LIGHTS.aftR],
  ] as const
).forEach(([key, pos], i) =>
  part(() => sph(0.025), ["lighting"], {
    id: "parts.lights.aft-position-light-white.003",
    instance: key,
    pos,
    color: EXT,
    name: "Aft position light (white)",
    note: "White rear-facing position light in the wingtip trailing edge, on the NAV switch. It does the tail light's job: there is no light on the rudder or tailcone.",
    pin: i === 0,
    ext: true,
  }),
);
(
  [
    ["left", LIGHTS.landL],
    ["right", LIGHTS.landR],
  ] as const
).forEach(([key, pos], i) =>
  part(() => box(0.03, 0.035, 0.14), ["lighting"], {
    id: "parts.lights.wingtip-landing-light.004",
    instance: key,
    pos,
    color: EXT,
    name: "Wingtip landing light",
    note: "LED landing light behind the clear lens in the wingtip leading edge, one per side. The G6 has no cowl landing light: both are on the LAND switch. LANDING LIGHTS breaker on MAIN BUS 3, fed from Main Dist Bus 1 (POH 7-48), so after an ALT 1 failure it lasts only as long as BAT 1.",
    pin: i === 1,
    ext: true,
  }),
);
(
  [
    ["left", LIGHTS.iceL],
    ["right", LIGHTS.iceR],
  ] as const
).forEach(([key, pos], i) =>
  part(() => cyl(0.022, 0.02, "z"), ["lighting"], {
    id: "parts.lights.ice-inspection-light.005",
    instance: key,
    pos,
    color: EXT,
    name: "Ice inspection light",
    note: "Fuselage-side light aimed at the wing leading edge so you can check for ice at night. ICE switch on the bolster; ICE LIGHTS breaker on MAIN BUS 1 (POH 7-47). Position on the model is approximate.",
    pin: i === 1,
    ext: true,
  }),
);
