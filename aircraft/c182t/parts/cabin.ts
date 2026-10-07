/**
 * C182T catalogue: cabin heat and ventilation (POH 7-60, Figure 7-8) and cabin and safety equipment (POH 7-21 – 7-27,
 * 7-74, Supplement 1).
 */
import type { Vec3 } from "@/lib/math";
import { glowAnim as glow, pushPull } from "@/lib/anims";
import { AF, X, Y, box, cyl, onSkin, sph } from "../geometry";
import { live } from "../model";
import { P3, PV, S, part, wp } from "./catalogue";

/* ---------- cabin heat and ventilation (POH 7-60, Figure 7-8) ---------- */
const AIR = "#149C94";
export const MANIFOLD: Vec3 = P3(4.5, 0, 30);
part(() => box(0.08, 0.08, 0.08), ["environment"], {
  pos: P3(0.6, -5, 39),
  color: "#E0522B",
  anim: (m) => {
    m.rotation.x = S().env.heat * 1.2;
  },
  name: "Heater valve",
  note: "On the firewall, linked to the CABIN HT knob: meters air heated in the exhaust muffler shrouds into the cabin manifold (Fig. 7-8).",
  pin: true,
});
part(() => box(0.08, 0.08, 0.08), ["environment"], {
  pos: P3(0.6, 13, 38),
  color: AIR,
  anim: (m) => {
    m.rotation.x = S().env.air * 1.2;
  },
  name: "Ventilating air door",
  note: "Ram air from a second inlet on the right side, linked to the CABIN AIR knob; blends with the heated air in the manifold (Fig. 7-8).",
  pin: true,
});
part(() => box(0.08, 0.06, 0.6), ["environment"], {
  pos: MANIFOLD,
  color: AIR,
  name: "Cabin manifold",
  note: "Just aft of the firewall: outlet holes across it forward of the front occupants' feet, two ducts to the defroster outlets on top of the glareshield and one duct down each side to an outlet just aft of the rudder pedals (POH 7-60).",
  pin: true,
});
const knobAt = (bl: number): Vec3 => P3(18.4, bl, 46);
part(() => cyl(0.012, 0.03, "x"), ["environment"], {
  pos: knobAt(12.6),
  color: AIR,
  anim: pushPull(X(18.4), () => 1 - S().env.air),
  name: "CABIN AIR knob",
  note: "Lower right panel, innermost of the three (Fig. 7-2 item 21): push-pull, double-button lock — pull out for ventilation. Maximum heat: CABIN HT out, CABIN AIR in (POH 7-60).",
  pin: true,
});
part(() => cyl(0.012, 0.03, "x"), ["environment"], {
  pos: knobAt(15),
  color: "#E0522B",
  anim: pushPull(X(18.4), () => 1 - S().env.heat),
  name: "CABIN HT knob",
  note: "Push-pull with a double-button lock: ¼ to ½ inch out for a little heat, farther for more; full in = no heat (Fig. 7-2 item 20, POH 7-60).",
  pin: true,
});
part(() => cyl(0.014, 0.02, "x"), ["environment"], {
  pos: knobAt(17.4),
  color: "#3E4A52",
  anim: (m) => {
    m.rotation.x = S().env.defrost * 2.4;
  },
  name: "DEFROST knob",
  note: "Rotating control (Fig. 7-2 item 19): clockwise ON, counter-clockwise OFF — regulates air to the windshield; defrost air is as warm as the cabin heat (POH 7-60).",
  pin: true,
});
part(() => box(0.012, 0.012, 0.03), ["environment"], {
  pos: knobAt(17.4),
  color: "#E8ECEE",
  anim: (m) => {
    m.rotation.x = S().env.defrost * 2.4;
  },
});
[1, -1].forEach((s) => {
  part(() => box(0.03, 0.012, 0.12), ["environment"], {
    pos: P3(17.0, s * 7, 67.35),
    color: AIR,
    name: "Defroster outlet",
    note: "Two outlets on top of the glareshield fed from the cabin manifold (POH 7-60).",
    pin: s > 0,
  });
  part(() => cyl(0.025, 0.02, "y"), ["environment"], {
    pos: wp(s * 19, 0.01, 0, -0.005),
    color: AIR,
    name: "Wing-root fresh air inlet",
    note: "Ram air at each wing root feeds the forward cabin upper and lower outlets and the duct to the rear cabin outlet — none of it passes the heater (Fig. 7-8).",
    ext: true,
    pin: s > 0,
  });
  part(() => sph(0.025), ["environment"], {
    pos: P3(30, s * 18.8, 76),
    color: AIR,
    name: "Adjustable ventilator (forward)",
    note: "Near each upper corner of the windshield for the pilot and front passenger (the gooseneck forward cabin upper outlet, arm 38.5) (POH 7-62, 6-20).",
    pin: s > 0,
  });
  part(() => cyl(0.022, 0.012, "z"), ["environment"], {
    pos: P3(31, s * 19.5, 34),
    color: AIR,
    name: "Forward cabin lower air outlet",
    note: "Round outlet below each wing-root duct, facing inboard (Fig. 7-8).",
  });
  part(() => sph(0.022), ["environment"], {
    pos: P3(74, s * 18, 76),
    color: AIR,
    name: "Rear cabin ventilator",
    note: "Two ventilators for the rear cabin, fed by the long ducts from the wing roots (POH 7-62, Fig. 7-8).",
  });
});
part(() => box(0.05, 0.04, 0.06), ["environment", "cabin"], {
  pos: P3(14, 4, 50.5),
  color: "#E0263B",
  anim: glow("#E0263B", () => live.coPpm >= 50, ["environment", "cabin"], "#FF5050"),
  name: "CO detector",
  note: "Integrated with the G1000 (if installed): CO LVL HIGH, red, flashing with a continuous tone at 50 PPM or more until the WARNING softkey (POH 7-75, 3-21).",
  pin: true,
});

/* ---------- cabin and safety (POH 7-21 – 7-27, 7-74, Supplement 1) ---------- */
const CAB = "#6F7F8C";
// arm 29.0 puts it against the aft end of the pedestal, where the rudder trim wheel, its indicator and the fuel selector sit on the
// centreline: shown just left of them, standing on the floor (h ≈ 27)
part(() => cyl(0.04, 0.3), ["cabin"], {
  pos: P3(29, -5, 33),
  color: "#D32640",
  name: "Fire extinguisher",
  note: "Portable Halon 1211, 5B:C, in a holder on the floorboard between the front seats, arm 29.0; gage at the top. Gage in the green (≈ 125 psi), lever pin in place. Empties in about 8 s; ventilate promptly after use (POH 7-74, 4-8). The holder's lateral position is not in the POH (shown just left of the pedestal).",
  pin: true,
});
part(() => box(0.12, 0.08, 0.1), ["cabin"], {
  pos: P3(150.8, 7, 47),
  color: "#EB7A12",
  anim: glow("#EB7A12", () => S().cabin.elt === "ON", ["cabin"], "#FF3B30"),
  name: "ELT",
  note: "As delivered a Pointer 3000-11 (arm 150.8): five alkaline C cells, 121.5 / 243.0 MHz, behind the aft cabin partition on the right side of the tailcone. The airplanes may now carry another ELT (e.g. Artex C406-N, Supplement 7) (S1-4, POH 6-21).",
  pin: true,
});
part(() => box(0.012, 0.03, 0.03), ["cabin"], {
  pos: P3(18.1, 10.9, 64.2),
  color: "#EB7A12",
  anim: (m) => {
    const e = S().cabin.elt;
    m.rotation.z = e === "ON" ? 0.4 : e === "RESET" ? -0.4 : 0;
  },
  name: "ELT remote switch",
  note: "Upper inboard corner of the right panel next to the MFD: ON / AUTO / RESET rocker with a red light (Pointer 3000-11). Before a forced landing: ON (POH 7-12, 3-24, S1-6).",
  pin: true,
});
part(() => cyl(0.004, 0.18), ["cabin"], {
  pos: [X(152.6), AF.topY(X(152.6)) + 0.09, 0],
  color: "#EB7A12",
  name: "ELT antenna",
  note: "Top of the tailcone, arm 152.6 (POH 6-21, S1-5).",
  ext: true,
});
part(() => box(0.012, 0.025, 0.04), ["cabin", "engine"], {
  pos: P3(18.1, 12.5, 64.2),
  color: "#20262B",
  name: "Hour (Hobbs) meter",
  note: "Right of the ELT switch, arm 16.7: records engine time while oil pressure is above 20 PSI; powered through the WARN breaker (POH 7-12, 6-22, Fig. 7-7).",
  pin: true,
});
[1, -1].forEach((s) =>
  part(() => box(0.06, 0.06, 0.04), ["cabin"], {
    pos: P3(50.3, s * 3, 78),
    color: CAB,
    name: "Inertia reel (front seat)",
    note: "Integrated belt/shoulder harness: front inertia reels on the centerline of the upper cabin (arm 50.3), rear reels outboard of each passenger (arm 87.8). No more than one extra inch should pull out once the lap belt is fitted (POH 7-22, 6-21).",
    pin: s > 0,
  }),
);
part(() => box(0.68, 0.008, 0.6), ["cabin"], {
  pos: P3(95.5, 0, 29),
  color: "#B7A27E",
  name: "Baggage area A (FS 82–109)",
  note: "120 lb maximum, arm 97 (POH 1-8, 6-14). Placard: 120 lb forward of the baggage door latch, 80 lb aft of it, 200 lb combined (POH 2-20).",
  pin: true,
});
part(() => box(0.38, 0.008, 0.48), ["cabin"], {
  pos: P3(116.5, 0, 32),
  color: "#B7A27E",
  name: "Baggage area B (FS 109–124)",
  note: "Arm 116. Areas B and C together 80 lb maximum (POH 1-8, 2-8).",
  pin: true,
});
part(() => box(0.25, 0.008, 0.36), ["cabin"], {
  pos: P3(129, 0, 41),
  color: "#B7A27E",
  name: "Baggage area C (shelf)",
  note: "Shelf FS 124–134, arm 129: 80 lb maximum, and B + C ≤ 80 lb (POH 1-8, 6-14).",
  pin: true,
});
// the door outline is drawn on the skin (windowOutlines); this is its key lock and handle at the aft edge
part(() => box(0.07, 0.025, 0.012), ["cabin"], {
  pos: PV(onSkin(X(109.5), Y(40), -1, 1.012)),
  color: "#5C666E",
  name: "Baggage door",
  note: "Lockable door on the LEFT side: 15.75 in wide, 22.0 in high at the front and 20.5 at the rear. Preflight: check, lock with the key (POH 7-21, 6-15, 4-8).",
  ext: true,
  pin: true,
});
[1, -1].forEach((s) =>
  part(() => box(0.12, 0.025, 0.02), ["cabin"], {
    pos: PV(onSkin(X(60.3), Y(48.3), s, 1.02)),
    color: "#5C666E",
    name: "Cabin door handle",
    note: "Recessed outside handle near the aft edge of each door; it must be out whenever the door is open. Inside handle OPEN – CLOSE – LOCK; key lock on the left door only. A door opening in flight isn't a reason to land: trim ≈ 80 KIAS, push the door out slightly, slam and lock it (POH 7-25).",
    ext: true,
    pin: s < 0,
  }),
);
[1, -1].forEach((s) =>
  part(() => box(0.5, 0.008, 0.008), ["cabin"], {
    pos: PV(onSkin(X(48), Y(53), s, 1.012)),
    color: "#0B1014",
    name: "Openable door window",
    note: "Hinged door windows (arm 48.0) with a detent latch on the lower edge; open at any speed up to 175 KIAS. Rear side windows and the rear window are fixed (POH 7-26, 2-4).",
    ext: true,
    pin: s < 0,
  }),
);
// cowl flap lever, right side of the pedestal (Fig 7-2 item 26): down = CLOSED, right-then-up = OPEN
part(() => box(0.06, 0.012, 0.012), ["engine", "cabin"], {
  pos: P3(24.5, 3.3, 36),
  color: "#E8ECEE",
  anim: (m) => {
    m.rotation.z = -0.5 + S().eng.cowl * 1.0;
  },
  pinIn: ["engine"],
  name: "Cowl flap lever",
  note: "Right side of the pedestal: move right and up to OPEN, down to CLOSED. OPEN for start, takeoff, climb and ground runs; CLOSED in cruise unless needed to hold CHT near two-thirds of the green arc, and in long descents (POH 7-37, 4-15 – 4-24).",
  pin: true,
});
