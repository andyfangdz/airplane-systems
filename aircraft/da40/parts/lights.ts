import { V, toVec3, type Vec3 } from "@/lib/math";
import { PANEL_X, ROLLBAR_X, box, sph, wingP } from "../geometry";
import { part, sim, glow } from "./catalogue";

/* ---------- lights ---------- */
const tipLE = (s: number): Vec3 => toVec3(wingP(s * 5.62, 0.05, 0));
export const LIGHTS = {
  tipL: tipLE(-1),
  tipR: tipLE(1),
  aftL: toVec3(wingP(-5.95, 1.0, 0).add(V(-0.02, 0, 0))),
  aftR: toVec3(wingP(5.95, 1.0, 0).add(V(-0.02, 0, 0))),
  /**
   * Landing and taxi lights built into the left wing leading edge, outboard of the pitot mast: the AFM walk-around checks
   * them after the pitot probe and just before the wing tip (AFM 4A-7). Span stations not in the documents.
   */
  land: toVec3(wingP(-4.45, 0, 0).add(V(0.01, 0, 0))),
  taxi: toVec3(wingP(-4.7, 0, 0).add(V(0.01, 0, 0))),
  flood: [PANEL_X + 0.06, 0.18, 0] as Vec3,
  instr: [PANEL_X - 0.05, 0.05, -0.1] as Vec3,
  map: [ROLLBAR_X + 0.03, 0.42, -0.2] as Vec3,
};
(
  [
    [LIGHTS.tipL, "Left wing tip: position (red) + strobe", "Whelen A600-PR-D-28"],
    [LIGHTS.tipR, "Right wing tip: position (green) + strobe", "Whelen A600-PG-D-28"],
  ] as [Vec3, string, string][]
).forEach(([pos, name, pn]) =>
  part(() => sph(0.035), ["lighting"], {
    pos,
    color: "#D9D9D9",
    name,
    note: `Combined position and strobe (anti-collision) light, ${pn} (AFM 7-44, 6-24). POSITION and STROBE 5 A breakers on MAIN.`,
    pin: true,
    ext: true,
  }),
);
[LIGHTS.aftL, LIGHTS.aftR].forEach((pos, i) =>
  part(() => sph(0.022), ["lighting"], {
    pos,
    color: "#D9D9D9",
    name: "Aft position light (white)",
    note: "Rear-facing white position light; no separate tail light is listed, so it is assumed to be in the wing-tip units (unverified).",
    pin: i === 0,
    ext: true,
  }),
);
part(() => box(0.03, 0.05, 0.12), ["lighting"], {
  pos: LIGHTS.land,
  color: "#F2F2E8",
  name: "Landing light",
  note: "Built into the left wing (AFM 7-44): Whelen 70346 or an HID lamp. LANDING 5 A on ESSENTIAL — it stays available on ESS BUS. Placed outboard of the pitot mast, following the walk-around order (AFM 4A-7); exact station not documented.",
  pin: true,
  ext: true,
});
part(() => box(0.03, 0.05, 0.1), ["lighting"], {
  pos: LIGHTS.taxi,
  color: "#F2F2E8",
  name: "Taxi light",
  note: "Next to the landing light in the left wing. TAXI/MAP 5 A on MAIN — lost on ESS BUS.",
  pin: true,
  ext: true,
});
[1, -1].forEach((s) =>
  part(() => box(0.12, 0.05, 0.06), ["lighting", "electrical"], {
    pos: toVec3(wingP(s * 1.45, 0.3, 0)),
    color: "#7A6A3A",
    name: "Strobe power supply",
    note: "Whelen A490ATS, LH and RH, arm 2.566 m (AFM 6-24).",
    pin: s > 0,
  }),
);
part(() => box(0.03, 0.01, 0.7), ["lighting"], {
  pos: LIGHTS.flood,
  color: "#E8C46A",
  anim: glow(
    "#6A5A30",
    "#FFE7B0",
    () => {
      const { s, E } = sim();
      return E.floodPwr && (s.lights.flood > 0 || s.elec.emerg);
    },
    ["lighting", "electrical"],
  ),
  name: "Flood light (glareshield EL panel)",
  note: "Electroluminescent panel above the instrument panel lighting all instruments, levers and switches; FLOOD knob. Emergency-battery powered with HORIZON EMERGENCY ON (AFM 7-42, 7-44).",
  pin: true,
});
part(() => sph(0.02), ["lighting", "cabin"], {
  pos: LIGHTS.map,
  color: "#E8C46A",
  name: "Map / reading light",
  note: "Crew map/reading light (Rivoret), on the TAXI/MAP breaker (AFM 6-24, 1-13). Location not in the documents.",
});
