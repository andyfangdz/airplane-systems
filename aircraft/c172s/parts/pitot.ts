/** C172S catalogue: pitot-static, stall warning and vacuum systems (POH 7-64 – 7-67, Figure 7-9). */
import type { Vec3 } from "@/lib/math";
import { glowAnim as glow, pushPull, sysNow } from "@/lib/anims";
import { X, Y, Z, box, cyl, onSkin, sph, tubeGeo, wingP } from "../geometry";
import { live } from "../model";
import { P3, PV, part, S, EL, wp, top } from "./catalogue";

/* ---------- pitot-static and stall warning (POH 7-64, 7-67) ---------- */
const PIT = "#3A9448";
/** Pitot under the left wing, inboard of the strut: BL ≈ 65 scaled from both Figure 1-1 front views (the text gives no station). */
export const PITOT: Vec3 = wp(-65, 0.18, -1, -0.12);
part(() => tubeGeo([wp(-65, 0.25, -1, 0.01), [PITOT[0] - 0.05, PITOT[1], PITOT[2]]], 0.012), ["pitot"], {
  color: "#AEB6BC",
  name: "Pitot mast",
  note: "Under the left wing, inboard of the strut (POH 7-64; station scaled from Figure 1-1).",
  ext: true,
});
part(() => cyl(0.012, 0.26, "x"), ["pitot"], {
  pos: [PITOT[0] + 0.08, PITOT[1], PITOT[2]],
  color: "#AEB6BC",
  anim: glow("#AEB6BC", () => EL().pitotHeating, ["pitot"], "#FF6A2A"),
  name: "Heated pitot head",
  note: "Heating element built into the head; PITOT HEAT switch and breaker (ELECTRICAL BUS 2). Preflight: warm to the touch within 30 s; no annunciation monitors it (POH 7-64, 4-6).",
  ext: true,
  pin: true,
});
export const STATIC_PORT: Vec3 = PV(onSkin(X(15), Y(45), -1, 1.01));
part(() => cyl(0.014, 0.006, "z"), ["pitot"], {
  pos: STATIC_PORT,
  color: PIT,
  name: "Static port",
  note: "External static port on the left side of the forward fuselage (POH 7-64). If the airplane has been waxed, check the hole (POH 4-23).",
  ext: true,
  pin: true,
});
part(() => cyl(0.012, 0.03, "x"), ["pitot"], {
  pos: P3(18.4, -3.5, 50.5),
  color: PIT,
  anim: pushPull(X(18.4), () => (S().pitot.altStatic ? 0 : 1), 0.03),
  name: "ALT STATIC AIR valve",
  note: "Adjacent to the throttle: pull ON for cabin static pressure if the external source blocks. With it on, the Section 5 table shows airspeed 0–4 kt high (Fig. 5-1 Sheet 2); POH 3-32 states a maximum variation of 11 kt and 50 ft, and doesn't explain the difference (POH 7-64, 3-15).",
  pin: true,
});
part(() => cyl(0.006, 0.05), ["pitot", "avionics"], {
  pos: [X(41.5), top(41.5, -4) + 0.022, Z(-4)],
  color: PIT,
  name: "OAT probe (GTP 59)",
  note: "On top of the cabin, arm 41.5; feeds the air data computer and the PFD OAT window (POH 7-67, 6-21).",
  ext: true,
  pin: true,
});
/** Stall warning opening in the left leading edge beside the fuel vent: BL ≈ 91 scaled from Figure 1-1. */
export const STALL_INLET: Vec3 = wp(-91, 0.0, 0, 0);
part(() => sph(0.02), ["pitot"], {
  pos: STALL_INLET,
  color: PIT,
  anim: glow(PIT, () => live.horn, ["pitot"], "#FF5050"),
  name: "Stall warning inlet",
  note: "In the LEFT wing leading edge. Near the stall the low pressure moves forward around the leading edge and draws air through the horn (POH 7-67). Test: handkerchief over the opening and apply suction (POH 4-10).",
  ext: true,
  pin: true,
});
part(() => cyl(0.025, 0.05, "x"), ["pitot", "cabin"], {
  pos: P3(27, -17.4, 74.5),
  color: PIT,
  anim: glow(PIT, () => live.horn, ["pitot", "cabin"], "#FF5050"),
  name: "Stall warning horn",
  note: "Air-operated reed horn near the upper left corner of the windshield: sounds 5 to 10 knots above the stall in all configurations. The text describes it as purely pneumatic (POH 7-67), although Figure 7-7 lists “stall warning” among the WARN breaker loads.",
  pin: true,
});
part(() => sph(0.035), ["pitot"], {
  pos: wp(-91, 0.1, 1),
  color: "#E0263B",
  anim: (m) => {
    const v = sysNow();
    m.visible = v === "pitot" && !S().ground;
    const slow = Math.max(0, Math.min(1, (live.fs.ias - 40) / 50));
    m.position.copy(wingP(Z(-91), 0.05 + slow * 0.3, 1));
  },
  name: "Low-pressure peak",
  note: "Moves forward around the leading edge as the angle of attack increases.",
  ext: true,
});

/* ---------- vacuum system and standby attitude (POH 7-65, Figure 7-9) ---------- */
const VAC = "#4FA8A0";
part(() => cyl(0.04, 0.08, "x"), ["vacuum", "engine"], {
  pos: P3(-5, -5.5, 46.5),
  color: VAC,
  anim: glow(VAC, () => S().vac.fail, ["vacuum", "engine"], "#E0263B"),
  name: "Engine-driven vacuum pump",
  note: "One dry vacuum pump on the accessory case, arm −5.0, with a cooling shroud; discharges through an overboard vent line (POH 7-65, 6-23).",
  pin: true,
});
part(() => box(0.06, 0.05, 0.05), ["vacuum"], {
  pos: P3(2, 8, 56),
  color: VAC,
  name: "Vacuum regulator",
  note: "Arm 2.0, behind the panel; holds the vacuum in the 4.5–5.5 in.Hg green band (POH 7-65, 2-7).",
  pin: true,
});
part(() => cyl(0.04, 0.05), ["vacuum"], {
  pos: P3(2, 3, 58),
  color: "#C9D6D4",
  name: "Vacuum system air filter",
  note: "Cabin air enters through this filter on its way to the attitude indicator's rotor (Fig. 7-9).",
  pin: true,
});
part(() => box(0.03, 0.03, 0.03), ["vacuum"], {
  pos: P3(10.3, 6, 54),
  color: VAC,
  name: "Vacuum transducer",
  note: "Arm 10.3: signal to the GEA 71 → VAC on the EIS ENGINE page; LOW VACUUM (amber) below 3.5 in.Hg (POH 7-65).",
  pin: true,
});
part(() => tubeGeo([P3(-5, -5.5, 44), P3(-6, -6, 32), P3(-6, -8, 22.6)], 0.008), ["vacuum"], {
  color: VAC,
  name: "Vacuum pump overboard vent",
  note: "Pump discharge air goes overboard (Fig. 7-9).",
  ext: true,
});
