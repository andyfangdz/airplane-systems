/** C172S catalogue: cabin heat and ventilation (POH 7-62, Figure 7-8) and cabin and safety equipment (POH 7-24 – 7-28, 7-79 – 7-80). */
import { glowAnim as glow, pushPull } from "@/lib/anims";
import type { Vec3 } from "@/lib/math";
import { X, Y, box, cyl, onSkin, sph, topY } from "../geometry";
import { live } from "../model";
import { P3, PV, part, S, EL, wp } from "./catalogue";

/* ---------- cabin heat and ventilation (POH 7-62, Figure 7-8) ---------- */
const AIR = "#149C94";
/** Approximate height above the rudder bars; the POH locates the manifold just aft of the firewall. */
export const MANIFOLD: Vec3 = P3(5, 0, 33);
part(() => box(0.08, 0.08, 0.08), ["environment"], {
  pos: P3(0.6, 5, 37.5),
  color: "#E0522B",
  anim: (m) => {
    m.rotation.x = S().env.heat * 1.2;
  },
  name: "Heater control valve",
  note: "At the firewall; mechanically linked to the CABIN HT knob — meters shroud-heated air into the cabin manifold (Fig. 7-8).",
  pin: true,
});
part(() => box(0.08, 0.08, 0.08), ["environment"], {
  pos: P3(0.6, 14, 36.5),
  color: AIR,
  anim: (m) => {
    m.rotation.x = S().env.air * 1.2;
  },
  name: "Ventilating air door",
  note: "Ram air from a second inlet on the right side; linked to the CABIN AIR knob, blending with the heated air (Fig. 7-8).",
  pin: true,
});
part(() => box(0.08, 0.06, 0.6), ["environment"], {
  pos: MANIFOLD,
  color: AIR,
  name: "Cabin manifold",
  note: "Behind the firewall: outlet holes across it just forward of the front occupants' feet; two ducts to the defroster outlets; one duct down each side to the rear cabin floor (POH 7-62).",
  pin: true,
});
part(() => cyl(0.012, 0.03, "x"), ["environment"], {
  pos: P3(18.4, 15.5, 48.5),
  color: "#E0522B",
  anim: pushPull(X(18.4), () => 1 - S().env.heat, 0.04),
  name: "CABIN HT knob",
  note: "Push-pull, double-button lock: pull for heat; maximum heat = CABIN HT out, CABIN AIR in. Placard CABIN HT PULL ON (POH 7-62, Fig. 7-8).",
  pin: true,
});
part(() => cyl(0.012, 0.03, "x"), ["environment"], {
  pos: P3(18.4, 15.5, 46.5),
  color: AIR,
  anim: pushPull(X(18.4), () => 1 - S().env.air, 0.04),
  name: "CABIN AIR knob",
  note: "Pull full out for ventilation. CO LVL HIGH: CABIN HT off, CABIN AIR on, vents and windows open (POH 7-62, 3-24).",
  pin: true,
});
[1, -1].forEach((s) => {
  part(() => box(0.03, 0.012, 0.12), ["environment"], {
    pos: P3(15.5, s * 7, 66),
    color: AIR,
    name: "Defroster outlet",
    note: "Two outlets at the lower edge of the windshield; each has a knob-operated sliding valve (POH 7-62).",
    pin: s > 0,
  });
  part(() => cyl(0.025, 0.02, "y"), ["environment"], {
    pos: wp(s * 19, 0.01, 0, -0.005),
    color: AIR,
    name: "Wing-root fresh air inlet",
    note: "Ram air at the wing root feeds the forward cabin upper and lower outlets and ducts to the rear cabin upper outlets — none of it passes through the heater (Fig. 7-8).",
    ext: true,
    pin: s > 0,
  });
  part(() => sph(0.025), ["environment"], {
    pos: P3(30, s * 18.5, 74),
    color: AIR,
    name: "Adjustable ventilator (forward)",
    note: "Near each upper corner of the windshield for the pilot and front passenger (POH 7-62).",
    pin: s > 0,
  });
  part(() => sph(0.022), ["environment"], {
    pos: P3(72, s * 18, 75),
    color: AIR,
    name: "Rear cabin ventilator",
    note: "Two ventilators for the rear cabin (POH 7-62).",
  });
});
part(() => box(0.05, 0.04, 0.06), ["environment", "cabin"], {
  pos: P3(14, 4, 50.5),
  color: "#E0263B",
  anim: glow("#E0263B", () => live.coPpm >= 50, ["environment", "cabin"], "#FF5050"),
  name: "CO detector",
  note: "Single detector behind the panel, integrated with the G1000: CO LVL HIGH (red, flashing, continuous tone) at 50 PPM or more (POH 7-80).",
  pin: true,
});

/* ---------- cabin and safety (POH 7-24 – 7-28, 7-79 – 7-80) ---------- */
const CAB = "#6F7F8C";
part(() => cyl(0.04, 0.3), ["cabin"], {
  pos: P3(44, 0, 30),
  color: "#D32640",
  name: "Fire extinguisher",
  note: "Halon 1211, 5B:C, in a holder on the floor between the front seats; gage in the green arc (~125 psi), pin in place. Empties in about 8 s; ventilate after use (POH 7-79).",
  pin: true,
});
part(() => box(0.12, 0.08, 0.1), ["cabin"], {
  pos: P3(135.5, 6, 47),
  color: "#EB7A12",
  name: "ELT (Artex ME406)",
  note: "Standard ME406 two-frequency ELT aft of the cabin partition, arm 135.5; placard on the partition (POH 6-20, 2-27). Section 9 supplement covers operation.",
  pin: true,
});
part(() => box(0.012, 0.03, 0.03), ["cabin"], {
  pos: P3(18.1, 10.9, 63.5),
  color: "#EB7A12",
  name: "ELT remote switch",
  note: "ON / ARM / TEST-RESET at the upper inboard corner of the right panel next to the MFD (POH 7-13). Activate before a forced landing in remote areas (POH 3-27).",
  pin: true,
});
part(() => cyl(0.004, 0.18), ["cabin"], {
  pos: [X(130), topY(X(130)) + 0.09, 0],
  color: "#EB7A12",
  name: "ELT antenna",
  note: "Arm 130.0 (POH 6-20).",
  ext: true,
});
part(() => box(0.012, 0.025, 0.04), ["cabin", "engine"], {
  pos: P3(18.1, 12.5, 63.5),
  color: "#20262B",
  name: "Hour (Hobbs) meter",
  note: "Right of the ELT switch: records engine time while oil pressure is above 20 PSI; powered through the WARN breaker (POH 7-13, 7-49).",
  pin: true,
});
[1, -1].forEach((s) =>
  part(() => box(0.06, 0.06, 0.04), ["cabin"], {
    pos: P3(54, s * 3, 74.5),
    color: CAB,
    name: "Inertia reel (front seat)",
    note: "Integrated belt/harness: overhead inertia reels on the cabin centerline for the front seats, outboard for the rear (POH 7-25). Reel size and mounting positions are approximate, below the overhead console.",
    pin: s > 0,
  }),
);
part(() => box(0.4, 0.008, 0.6), ["cabin"], {
  pos: P3(95, 0, 28.8),
  color: "#B7A27E",
  name: "Baggage area A (FS 82–108)",
  note: "120 lb. Six baggage-net eyebolts: two on the floor at FS 90, two on the floor at FS 107 and two below the aft window at FS 107. Combined A + B 120 lb (POH 1-8, 6-9).",
  pin: true,
});
part(() => box(0.5, 0.008, 0.4), ["cabin"], {
  pos: P3(124, 0, 33.5),
  color: "#B7A27E",
  name: "Baggage area B (FS 108–142)",
  note: "50 lb, aft of the baggage door latch (placard, POH 2-25). Floor height is approximate, above the control cables.",
});
// the door outline is drawn on the skin (windowOutlines); this is its key lock and handle at the aft edge
part(() => box(0.07, 0.025, 0.012), ["cabin"], {
  pos: PV(onSkin(X(108.6), Y(44), -1, 1.012)),
  color: "#5C666E",
  name: "Baggage door",
  note: "Lockable door on the LEFT side, 15.25 × 22 in (POH 7-24, Fig. 6-6). Preflight: check, lock with key (POH 4-6).",
  ext: true,
  pin: true,
});
[1, -1].forEach((s) =>
  part(() => box(0.12, 0.025, 0.02), ["cabin"], {
    pos: PV(onSkin(X(60), Y(51), s, 1.02)),
    color: "#5C666E",
    name: "Cabin door handle",
    note: "Recessed outside handle near the door's aft edge; inside handle OPEN – CLOSE – LOCK (spring-loaded to CLOSE). Key lock on the left door only. Door open in flight: not an emergency (POH 7-27).",
    ext: true,
    pin: s < 0,
  }),
);
[1, -1].forEach((s) =>
  part(() => box(0.5, 0.008, 0.008), ["cabin"], {
    pos: PV(onSkin(X(48), Y(56), s, 1.012)),
    color: "#0B1014",
    name: "Openable door window",
    note: "Hinged at the top, latch at the lower edge; may be opened at any speed up to 163 KIAS. Rear side windows and rear window are fixed (POH 7-28, 2-4).",
    ext: true,
    pin: s < 0,
  }),
);
part(() => box(0.012, 0.13, 0.1), ["cabin"], {
  pos: P3(17.8, 17, 54),
  color: "#2B3238",
  name: "Glove box",
  note: "Right panel (Fig. 7-2 item 15).",
});
part(() => box(0.05, 0.045, 0.06), ["avionics", "cabin"], {
  pos: P3(18.2, 0, 68.2),
  color: "#20262B",
  anim: glow("#20262B", () => EL().lit.stbyInd, ["avionics", "cabin"], "#E8C46A"),
  name: "Magnetic compass (non-stabilized)",
  note: "Required for every kind of operation (KOEL) and the heading reference when the AHRS fails (POH 2-14, 3-21). Arm 18.0 (POH 6-22); its panel location isn't given — modelled on the glareshield. Lit by the STBY IND dimmer; a deviation card in 30° steps is required (POH 7-61, 2-26).",
  pin: true,
});
