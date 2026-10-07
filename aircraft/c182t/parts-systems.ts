/**
 * C182T catalogue, part 2: flap drive, fuel, electrical, avionics and the KAP 140, pitot-static and stall warning, vacuum,
 * lighting, cabin heat/ventilation and cabin equipment. Imported for its side effects (adds to CAT).
 * Fore/aft positions are the POH Figure 6-9 equipment-list arms; butt lines and heights are placed from the descriptions in
 * Section 7 and Figure 7-2 (the POH gives no BL or WL).
 */
import * as THREE from "three";
import type { PartAnim } from "@/lib/catalogue";
import { mergeGeos } from "@/lib/geometry";
import { mats } from "@/lib/materials";
import { V, type Vec3 } from "@/lib/math";
import { kap140Phase } from "@/lib/avionics/kap140";
import { AF, X, Y, Z, box, cyl, onSkin, sph, botY, tubeGeo, wingP, wLE, wC, fLE } from "./geometry";
import { live } from "./model";
import { glowAnim as glow, pushPull, sysNow } from "@/lib/anims";
import { CAT, KNOB, P3, PV } from "./parts";
import { RIG_SPEC } from "./rig";
import { useC182 } from "./store";
import { IN } from "../cessna/airframe";
import {
  GDU_H,
  GDU_KEYS_Y,
  GDU_W,
  GMA_KNOB_Y,
  GMA_W,
  NAV3_BL,
  cbHeads,
  gduKeys,
  gduKnobs,
  gmaKeys,
  gmaKnob,
  switchRows,
} from "../cessna/faceplate";

const { part } = CAT;
const S = () => useC182.getState().s,
  EL = () => useC182.getState().E;
const wp = (bl: number, c: number, up = 0, dy = 0): Vec3 => PV(wingP(Z(bl), c, up).add(V(0, dy, 0)));
/** Chord fraction of a fuselage station on the wing at BL (for equipment-list arms in the wing). */
const cAt = (fs: number, bl: number) => {
  const z = Z(bl);
  return (wLE(z) - X(fs)) / wC(z);
};

/* ---------- flaps: electric drive in the right wing root, cable interconnect to the left (POH 7-20, Figure 7-3) ---------- */
export const FLAP_LEVER = { fs: 18.2, bl: 8.8, h: 47.4, travel: 0.075 };
part(() => box(0.012, 0.06, 0.02), ["flaps"], {
  pos: P3(FLAP_LEVER.fs, FLAP_LEVER.bl, FLAP_LEVER.h),
  color: "#E8ECEE",
  anim: (m) => {
    m.position.y = Y(FLAP_LEVER.h) - (S().flaps.cmd / 38) * FLAP_LEVER.travel;
  },
  name: "Wing flap switch lever",
  note: "Lower right side of the center panel, in a slotted panel with mechanical stops at 10° and 20° — move it right to pass them. Placard: UP–10° 140 KIAS (dark blue), 10°–20° 120 KIAS (light blue), 20°–FULL 100 KIAS (white) (POH 7-20, 2-20).",
  pin: true,
});
part(() => box(0.008, 0.008, 0.012), ["flaps"], {
  pos: P3(FLAP_LEVER.fs + 0.3, FLAP_LEVER.bl - 1.4, FLAP_LEVER.h),
  color: "#FFD34D",
  anim: (m) => {
    m.position.y = Y(FLAP_LEVER.h) - (live.flapAng / 38) * FLAP_LEVER.travel;
  },
  name: "Flap position indicator",
  note: "Scale and pointer to the left of the flap lever: actual flap travel in degrees. No G1000 flap display or annunciation (POH 7-20).",
  pin: true,
});
part(() => box(0.16, 0.08, 0.09), ["flaps", "electrical"], {
  pos: wp(30, 0.62),
  color: "#7C57CF",
  anim: glow("#7C57CF", () => S().flaps.moving, ["flaps", "electrical"], "#B9A3F0"),
  name: "Flap motor and actuator",
  note: "At the inboard end of the RIGHT flap (Figure 7-3): drives a bellcrank that moves the flap through a push-pull rod. 10 A FLAP breaker on ELECTRICAL BUS 1. Motor type and transit time are not in the POH.",
  pin: true,
});
[1, -1].forEach((s) =>
  part(() => box(0.08, 0.05, 0.03), ["flaps"], {
    pos: wp(s * 24, 0.67),
    color: "#9F85E6",
    name: "Flap bellcrank",
    note: "At the inboard end of each flap; a push-pull rod drives the flap. The left bellcrank follows the right through the cross-cabin cables (Fig. 7-3).",
    pin: s > 0,
  }),
);
part(() => tubeGeo([wp(-24, 0.67), wp(-12, 0.65, 0, -0.03), wp(12, 0.65, 0, -0.03), wp(24, 0.67)], 0.006), ["flaps"], {
  color: "#9F85E6",
  name: "Flap interconnect cables",
  note: "Cables across the cabin top (several pulleys) tie the left flap to the right-wing drive so both move together (Fig. 7-3).",
  pin: true,
});
part(
  () =>
    tubeGeo(
      [
        P3(16.5, 9, 47),
        P3(15.5, 20.0, 60),
        P3(29.0, 20.0, 60.5),
        P3(29.5, 19.7, 76),
        P3(33, 17.6, 79.6),
        wp(26, 0.55, 0, -0.03),
      ],
      0.004,
    ),
  ["flaps"],
  {
    color: "#B9A3F0",
    name: "Flap follow-up / control cable",
    note: "Figure 7-3 draws a single line from behind the panel up to the right wing root drive — the follow-up or wiring between the lever and the actuator (unlabeled in the POH).",
  },
);

/* ---------- fuel system (POH Figure 7-6, 7-38 – 7-46) ---------- */
const FUEL = "#2F7FE6";
/** Integral tank span (BL, in) used by the tank volumes in Airplane.tsx: between the spars of the constant-chord inboard panel. */
export const TANK_BL = [24, 100] as const;
[1, -1].forEach((s) => {
  part(() => cyl(0.04, 0.012), ["fuel"], {
    pos: wp(s * 92, 0.2, 1, 0.006),
    color: FUEL,
    name: "Fuel filler cap",
    note: "Top of each wing. Placard: FUEL 100LL/100 MIN. GRADE AVIATION GASOLINE CAP. 43.5 U.S. GAL. USABLE, CAP. 32.0 U.S. GAL. USABLE TO BOTTOM OF FILLER INDICATOR TAB. Vacuum-vented caps open if the overboard vents block (POH 2-19, 7-44).",
    ext: true,
    pin: s > 0,
  });
  part(() => box(0.02, 0.05, 0.02), ["fuel"], {
    pos: wp(s * 92, 0.2, 1, -0.04),
    color: "#7EB3F5",
    name: "Filler indicator tab",
    note: "Inside the filler neck: filling to its bottom gives 32.0 gal usable per tank (64.0 total) (POH 7-39).",
  });
  part(() => box(0.03, 0.03, 0.03), ["fuel"], {
    pos: wp(s * 24.5, 0.62, -1, 0.02),
    color: FUEL,
    name: "Tank outlet screen",
    note: "Aft inboard corner of each tank: “aft pickup only” into the fuel manifold in the aft door post (POH 7-40). With ¼ tank or less, slips or skids can uncover the outlet (POH 7-39).",
    pin: s > 0,
  });
  part(() => cyl(0.012, 0.08), ["fuel"], {
    pos: wp(s * 62, cAt(56.3, 62)),
    color: "#0B3A80",
    name: "Fuel quantity transmitter",
    note: "Float type, one per tank, arm 56.3 → GEA 71 → FUEL QTY GAL. Reads 0 with 2.5 gal unusable left; float travel ends at ≈ 36 gal (green arc top) — check the tanks visually before every flight (POH 7-40, 6-22).",
    pin: s > 0,
  });
  [26, 44, 62, 80, 97].forEach((b, i) =>
    part(() => sph(0.018), ["fuel"], {
      pos: wp(s * b, 0.5, -1, -0.012),
      color: "#0B3A80",
      name: "Fuel tank sump quick drain",
      note: "Figure 7-6 labels “DRAIN VALVE (5 TOTAL)” under each tank; the checklist drains “each sump location” on both wings (POH 4-9, 4-11). Their exact positions are not in the POH.",
      ext: true,
      pin: s > 0 && i === 0,
    }),
  );
  // overboard vent: below the wing behind the strut, slightly below the upper strut attach point (POH 7-44)
  part(() => tubeGeo([wp(s * 100, 0.36, -1, 0.01), wp(s * 100, 0.38, -1, -0.07)], 0.007), ["fuel"], {
    color: FUEL,
    name: "Overboard fuel vent (check valve)",
    note: "One per tank, protruding from the bottom of the wing behind the strut, slightly below the upper strut attach point. Complete blockage starves the engine; the vacuum-vented filler caps are the backup (POH 7-44). Preflight: check for blockage.",
    ext: true,
    pin: s > 0,
  });
  // fuel manifold down each aft door post (FS 65.30) to the selector, with the return line beside it
  part(
    () =>
      tubeGeo(
        [
          wp(s * 24.5, 0.62, -1, 0.02),
          P3(65, s * 19.4, 78),
          P3(65, s * 19.4, 30),
          P3(40, s * 8, 26.8),
          P3(27.5, s * 2.5, 25.4),
        ],
        0.008,
      ),
    ["fuel"],
    {
      color: FUEL,
      name: "Fuel manifold (aft door post)",
      note: "“Two fuel manifolds (one in each aft doorpost)”: gravity feed from each tank outlet down the door post and under the floor to the selector (POH 7-38, Fig. 7-6).",
      pin: s > 0,
    },
  );
});
part(
  () =>
    tubeGeo([wp(-90, 0.14, 1, -0.02), wp(-23, 0.14, 1, -0.02), wp(23, 0.14, 1, -0.02), wp(90, 0.14, 1, -0.02)], 0.006),
  ["fuel"],
  {
    color: "#7EB3F5",
    name: "Fuel vent interconnect",
    note: "Vent line joining the tanks' air spaces: fuel may slosh between nearly full tanks if the wings aren't level — park with the selector on LEFT or RIGHT to stop crossfeeding (POH 7-45, 4-24).",
    pin: true,
  },
);
/** Fuel selector handle on the floor at the base of the pedestal (Fig 7-2 item 28); the valve body is below the floor. */
export const FSEL: Vec3 = P3(27.4, 0, 27.6);
part(() => cyl(0.05, 0.02), ["fuel"], {
  pos: FSEL,
  color: "#20262B",
  name: "Fuel selector valve",
  note: "Dual-stack, four-position valve: BOTH (87.0 gal, takeoff, landing, all flight attitudes), LEFT and RIGHT (43.5 gal, level flight only), and OFF — push the handle down to rotate to OFF. The bottom (supply) section feeds the engine; the top (return) section sends return fuel only to the selected tank(s) (POH 7-44, 2-19).",
  pin: true,
});
part(
  () => {
    const g = box(0.09, 0.014, 0.024);
    g.translate(0.03, 0, 0);
    return g;
  },
  ["fuel"],
  {
    pos: [FSEL[0], FSEL[1] + 0.02, FSEL[2]],
    color: "#F2F5F7",
    anim: (m) => {
      const sel = S().fuel.sel;
      m.rotation.y = sel === "BOTH" ? 0 : sel === "LEFT" ? Math.PI / 2 : sel === "RIGHT" ? -Math.PI / 2 : Math.PI;
    },
  },
);
part(() => cyl(0.04, 0.05), ["fuel"], {
  pos: P3(27.2, 0, 24.6),
  color: FUEL,
  name: "Selector valve (supply / return stacks)",
  note: "Below the floor: supply and return portions are isolated from each other, so “fuel returns only to the tank that is selected as the feed tank” (POH 7-43).",
});
part(() => sph(0.014), ["fuel"], {
  pos: P3(25.8, -2, 21.4),
  color: "#0B3A80",
  name: "Fuel selector drain",
  note: "Drain it, with the return-line drain, when contamination is found in the other samples — and take samples from all drain points (POH 4-10, 8-20).",
  ext: true,
});
part(() => sph(0.014), ["fuel"], {
  pos: P3(22.5, 3, 21.4),
  color: "#0B3A80",
  name: "Fuel return line drain",
  note: "“One drain is added to properly drain the return system” (POH 7-43); its position is not given.",
  ext: true,
  pin: true,
});
part(() => cyl(0.035, 0.12, "x"), ["fuel", "electrical"], {
  pos: P3(-12, 5, 31),
  color: "#5D8FD6",
  anim: glow("#5D8FD6", () => EL().fuelPumpOn, ["fuel", "electrical"], "#A9CCFF"),
  name: "Auxiliary fuel pump",
  note: "Electric, arm −12.0 (forward of the firewall). Primes through the injection system before start; vapor suppression; replaces a failed engine-driven pump at maximum continuous power. Left on with the MASTER on, mixture rich and the engine stopped, it floods the engine. FUEL PUMP breaker, ELECTRICAL BUS 1 (POH 7-43, 6-22).",
  pin: true,
});
part(() => cyl(0.035, 0.08), ["fuel"], {
  pos: P3(-7, 7, 29),
  color: FUEL,
  name: "Fuel strainer",
  note: "Between the aux pump and the engine-driven pump, the low point of the system (POH 7-40).",
  pin: true,
});
part(() => sph(0.014), ["fuel"], {
  pos: P3(-7, 8, 23.3),
  color: "#0B3A80",
  name: "Fuel strainer quick drain",
  note: "“Located on lower right side of engine cowling” — drain at the NOSE station on preflight (POH 4-10).",
  ext: true,
});
part(() => cyl(0.035, 0.08, "x"), ["fuel", "engine"], {
  pos: P3(-6, -6, 44),
  color: FUEL,
  anim: glow(FUEL, () => S().eng.fail.edp, ["fuel", "engine"], "#E0263B"),
  name: "Engine-driven fuel pump",
  note: "On the accessory case; feeds the fuel/air control unit. A failure shows as a sudden FFLOW drop just before a loss of power — FUEL PUMP ON gives enough fuel for maximum continuous power (POH 3-31, 7-43).",
  pin: true,
});
part(() => cyl(0.018, 0.06, "x"), ["fuel", "engine"], {
  pos: P3(-12.4, 0, 57.5),
  color: "#0B3A80",
  name: "Fuel flow transducer",
  note: "Turbine type “mounted on the centerline of the engine”, arm −12.4, between the fuel/air control unit and the distribution unit → FFLOW GPH; it sees only metered fuel, not the return flow (POH 7-41, 6-25).",
  pin: true,
});
export const DIVIDER: Vec3 = P3(-24, 0, 59.5);
part(() => box(0.06, 0.04, 0.06), ["fuel", "engine"], {
  pos: DIVIDER,
  color: FUEL,
  name: "Fuel distribution unit (flow divider)",
  note: "Top of the engine: distributes metered fuel evenly to the six air-bleed nozzles (POH 7-36, 7-40; Fig. 7-6 draws 6 outlets).",
  pin: true,
});
part(() => box(0.03, 0.04, 0.03), ["fuel", "cabin"], {
  pos: P3(49.5, -11, 42),
  color: "#7EB3F5",
  name: "Fuel sampler cup",
  note: "Stowed in the pilot's seat back, arm 49.5 (POH 6-21). Sample every drain point before each flight and after refueling, airplane in the normal ground attitude (POH 4-6, 7-45).",
});

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

/* ---------- electrical (POH 7-46 – 7-57, Figure 7-7) ---------- */
const ELEC = "#D9960F";
export const JBOX: Vec3 = P3(-2.5, -15, 43);
part(() => box(0.2, 0.18, 0.17), ["electrical"], {
  pos: P3(132.1, -5, 37),
  color: ELEC,
  anim: glow(ELEC, () => EL().mBatt < -0.5, ["electrical"], "#FF8A3D"),
  name: "Main battery — 24 V",
  note: "In the tailcone, arm 132.1: 24 V, 12.75 Ah (POH 6-20; the 2007 edition lists 8 Ah). Its cable runs forward to the battery relay in the J-box; the starter draws upstream of the M BATT shunt (POH 7-46, Fig. 7-7 Sheet 1).",
  pin: true,
});
part(() => box(0.1, 0.16, 0.14), ["electrical"], {
  pos: JBOX,
  color: "#8A7A3A",
  name: "Power distribution module (J-box)",
  note: "Left forward side of the firewall, arm −2.5: battery relay (MASTER BAT), starter relay, alternator relay, the Alternator Control Unit, the M BATT current shunt, the external power relay and three push-to-reset feeder breakers — “A” for BUS 2, “B” for BUS 1, one spare (POH 7-46, 6-20).",
  pin: true,
});
part(() => box(0.05, 0.05, 0.04), ["electrical"], {
  pos: P3(-1.5, -12.5, 46),
  color: "#C9B98F",
  name: "Alternator Control Unit (ACU)",
  note: "Inside the J-box: regulates the alternator field, opens the ALT FIELD breaker above about 31.75 V and sends LOW VOLTS below 24.5 V. It can nuisance-trip during a start — reset once (POH 7-55, 3-34).",
  pin: true,
});
part(() => box(0.03, 0.03, 0.05), ["electrical"], {
  pos: P3(-2, -16.5, 47),
  color: "#8C959C",
  name: "Main battery current shunt",
  note: "Ammeter transducer, arm −2.0 → M BATT AMPS (+ charging, − discharging) (POH 6-20, 7-53).",
});
part(() => box(0.07, 0.08, 0.015), ["electrical"], {
  pos: PV(onSkin(X(-3), Y(40), -1, 1.012)),
  color: ELEC,
  name: "External power receptacle",
  note: "Integral to the J-box, behind a door on the left side of the cowl near the firewall. MASTER and AVIONICS OFF before connecting; it supplies the buses and charges the battery through the battery relay (POH 7-55, 4-13).",
  ext: true,
  pin: true,
});
/** Belt plane just ahead of the engine block's front face (FS −40.5): crankshaft pulley on the thrust line, alternator pulley on its shaft. */
const BELT = { fs: -41.2, crank: { bl: 0, h: 50.4, r: 2.6 }, alt: { bl: 9, h: 41.5, r: 1.4 } };
/** Closed belt path round two pulleys in a plane of constant FS: the long arc of the crank pulley, then the far arc of the alternator's. */
const beltPath = (): Vec3[] => {
  const { fs, crank: a, alt: b } = BELT,
    th = Math.atan2(b.h - a.h, b.bl - a.bl),
    ph = Math.acos((a.r - b.r) / Math.hypot(b.bl - a.bl, b.h - a.h));
  const arc = (c: typeof a, from: number, span: number, n: number) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const t = from + (span * i) / n;
      return P3(fs, c.bl + c.r * Math.cos(t), c.h + c.r * Math.sin(t));
    });
  const pts = [...arc(a, th + ph, 2 * Math.PI - 2 * ph, 14), ...arc(b, th - ph, 2 * ph, 6)];
  return [...pts, pts[0]];
};
/** Alternator body at its equipment-list arm, plus a short shaft carrying its pulley forward into the belt plane. */
const alternatorGeo = () => {
  const reach = X(BELT.fs) - X(-33.4),
    shaft = cyl(0.008, reach - 0.06, "x"),
    pulley = cyl(BELT.alt.r * IN - 0.004, 0.014, "x");
  shaft.translate((reach + 0.06) / 2, 0, 0);
  pulley.translate(reach, 0, 0);
  return mergeGeos([cyl(0.06, 0.12, "x"), shaft, pulley]);
};
part(alternatorGeo, ["electrical", "engine"], {
  pos: P3(-33.4, 9, 41.5),
  color: ELEC,
  anim: glow(ELEC, () => EL().altOn, ["electrical", "engine", "overview"], "#FFD34D"),
  name: "Alternator — 28 V, 60 A",
  note: "Belt driven, front of the engine, arm −33.4. 60 A standard (24-01-R) or 95 A optional (24-02-O) — which N8050J and N21200 have is not in the POH. Field through the ALT FIELD breaker (CROSSFEED BUS) and MASTER (ALT) (POH 7-46, 6-20). The pulley and shaft are drawn to line up with the belt; their sizes are approximate.",
  pin: true,
});
part(() => tubeGeo(beltPath(), 0.006), ["electrical", "engine"], {
  color: "#20262B",
  name: "Alternator belt",
  note: "Crankshaft pulley to the alternator pulley at the front of the engine (layout approximate). A broken belt is one of the alternator failures behind the LOW VOLTS procedure (POH 3-33).",
});
part(() => box(0.14, 0.12, 0.16), ["electrical"], {
  pos: P3(10.8, -14, 50.5),
  color: ELEC,
  anim: glow(ELEC, () => EL().stbyOnline, ["electrical"], "#FF8A3D"),
  name: "Standby battery",
  note: "Between the firewall and the instrument panel, arm 10.8. Feeds only the ESSENTIAL BUS — automatically when the main bus falls below 20 V, for at least 30 minutes; it cannot power the transponder (POH 7-47, 3-15, 3-35).",
  pin: true,
});
part(() => box(0.06, 0.05, 0.08), ["electrical"], {
  pos: P3(12, -9.5, 54),
  color: "#8A7A3A",
  name: "Standby battery controller",
  note: "On/off control, test load with an overheat switch, and a current shunt for S BATT; it senses main bus voltage through the WARN breaker; 25 A fuse at the battery (Fig. 7-7 Sheet 3).",
});
part(() => box(0.012, 0.025, 0.02), ["electrical"], {
  pos: P3(18.1, -18.3, 64.7),
  color: "#C9D0D5",
  anim: (m) => {
    const v = S().elec.stby;
    m.rotation.z = v === "ARM" ? 0.5 : v === "TEST" ? -0.5 : 0;
  },
  name: "STBY BATT switch",
  note: "Upper left corner of the pilot's panel: ARM – OFF – TEST (TEST momentary). Before start: TEST 20 s (hold; the green lamp must not go off) — then ARM (the PFD comes on) and check BUS E ≥ 24 V, M BUS ≤ 1.5 V, BATT S negative, STBY BATT shown (POH 7-10, 4-13).",
  pin: true,
});
part(() => sph(0.008), ["electrical"], {
  pos: P3(18.1, -17.2, 64.7),
  color: "#1E5A2A",
  anim: glow("#1E5A2A", () => EL().testLamp, ["electrical"], "#33FF66"),
  name: "STBY BATT TEST lamp",
  note: "Green lamp right of the switch; it must stay lit through the 20-second test (POH 4-13).",
});
// MASTER and AVIONICS side by side below STBY BATT, left of the PFD (POH Fig. 7-2; photos)
part(() => box(0.012, 0.04, 0.03), ["electrical"], {
  pos: P3(18.1, -18.4, 60.9),
  color: "#C8313B",
  anim: (m) => {
    m.rotation.z = S().elec.bat ? 0.3 : -0.3;
  },
  name: "MASTER switch (ALT | BAT)",
  note: "Red two-pole rocker below STBY BATT, AVIONICS to its right: BAT controls the battery relay, ALT the alternator field; ALT can't be ON without BAT (POH 7-51).",
  pin: true,
});
part(() => box(0.012, 0.04, 0.03), ["electrical", "avionics"], {
  pos: P3(18.1, -16.9, 60.9),
  color: "#E8ECEE",
  anim: (m) => {
    m.rotation.z = S().elec.avn1 ? 0.3 : -0.3;
  },
  name: "AVIONICS switch (BUS 1 | BUS 2)",
  note: "Two-pole rocker for AVIONICS BUS 1 and BUS 2 — both OFF before the MASTER is turned on or off, for starting and for external power (POH 7-47).",
  pin: true,
});
// both just below the switch panel, under the control wheel, with panel below them to the lower edge (NAV III panel photos)
part(() => box(0.012, 0.07, 0.075), ["electrical"], {
  pos: P3(17.9, -16.6, 50),
  color: "#3A3424",
  name: "Circuit breaker panel (BUS 1 · BUS 2 · X-FEED)",
  note: "Below the switch panel, outboard end (low-confidence position): ELECTRICAL BUS 1, BUS 2 and X-FEED breakers are non-pullable — they can only trip and be pushed back in (POH 7-11, 7-55).",
  pin: true,
});
part(() => box(0.012, 0.07, 0.15), ["electrical", "avionics"], {
  pos: P3(17.9, -11.4, 50),
  color: "#3A3424",
  name: "Circuit breaker panel (ESS · AVN 1 · AVN 2)",
  note: "Below the switch panel, inboard of the other breaker panel: ESSENTIAL BUS, AVN BUS 1 and AVN BUS 2 breakers, all pullable (POH 7-11, 7-55).",
  pin: true,
});
part(() => box(0.012, 0.07, 0.12), ["electrical", "lighting"], {
  pos: P3(17.9, -13.3, 53.8),
  color: "#2F3A42",
  name: "Switch panel",
  note: "Below the lower left corner of the PFD, internally lit: LIGHTS (BEACON, LAND, TAXI, NAV, STROBE) across the top, FUEL PUMP, PITOT HEAT and CABIN PWR 12V (if installed) below. Up = ON (POH 7-10, 7-57). Where CABIN PWR 12V sits on the panel is approximate.",
  pin: true,
});
part(() => box(0.08, 0.06, 0.1), ["electrical", "cabin"], {
  pos: P3(12, 16, 50),
  color: "#8A7A3A",
  name: "12 V power converter",
  note: "Cabin side of the firewall, forward of the right panel: 28 → 12 V, up to 10 A to the POWER OUTLET 12V – 10A on the pedestal. CABIN LTS/PWR breaker; Fig. 7-7 marks the 12V CAB PWR switch “if installed” (POH 7-73, 7-49).",
});
part(() => cyl(0.012, 0.02, "x"), ["electrical", "cabin"], {
  pos: P3(27.3, 2, 36),
  color: "#20262B",
  name: "POWER OUTLET 12V–10A",
  note: "Center pedestal (Fig. 7-2 item 29). Not for flight-critical devices; off for takeoff and landing (POH 7-73, 2-19).",
});

/* ---------- avionics (POH 7-66 – 7-70) ---------- */
const AVX = "#C8399F";
part(() => box(0.03, GDU_H, GDU_W), ["avionics"], {
  pos: P3(18.1, NAV3_BL.pfd, 61.4),
  color: "#1A1F23",
  name: "PFD — GDU 1040",
  note: "In front of the pilot, arm 15.0. PFD breakers on the ESSENTIAL BUS and AVIONICS BUS 1 (with the deckskin and PFD fans). Shows the EIS during engine start, reversion or DISPLAY BACKUP (POH 7-10, 7-66).",
});
part(() => box(0.03, GDU_H, GDU_W), ["avionics"], {
  pos: P3(18.1, NAV3_BL.mfd, 61.4),
  color: "#1A1F23",
  name: "MFD — GDU 1040",
  note: "Right of the audio panel: moving map with the EIS strip on its left edge. MFD breaker (with the MFD fan), AVIONICS BUS 2 (POH 7-66, 7-49).",
});
part(() => box(0.03, GDU_H, GMA_W), ["avionics"], {
  pos: P3(18.1, NAV3_BL.gma, 61.4),
  color: "#24292E",
  name: "GMA 1347 audio panel",
  note: "Between the PFD and MFD: audio, intercom and marker beacon; it also controls reversionary mode. AUDIO breaker, AVIONICS BUS 2 — no autopilot use with it inoperative (no disconnect tone, S3-13). Split COM 1/2 is not approved (POH 7-66, 2-16).",
  pin: true,
});
part(() => box(0.012, 0.014, 0.022), ["avionics"], {
  pos: P3(18.7, NAV3_BL.gma, 57.8),
  color: "#D32626",
  anim: (m) => {
    m.material = S().avx.backup ? mats("#FF4040").hi : mats("#B32020").on;
  },
  name: "DISPLAY BACKUP button",
  note: "Red button on the lower face of the GMA 1347: PFD instruments plus the EIS on both displays; press again to cancel (POH 7-11, CRG 109).",
  pin: true,
});
(
  [
    [
      136,
      -4.5,
      "GIA 63 #1",
      "Integrated avionics unit in the tailcone racks behind the baggage curtain, arm 134.0: GPS, VHF NAV/COM and main processor. NAV 1 ENG (ESS and AVN BUS 1) and COMM 1 (ESS) breakers (POH 7-67, 6-20).",
    ],
    [
      136,
      4.5,
      "GIA 63 #2",
      "Second integrated avionics unit: NAV 2 and COMM 2 on AVIONICS BUS 2. The first GIA to get a 3-D GPS fix is the active GPS source. The KAP 140 takes its NAV, HDG and GPS roll-steering signals through GIA #2 (POH 7-67; Fig. S3-1).",
    ],
  ] as [number, number, string, string][]
).forEach(([fs, bl, name, note]) =>
  part(() => box(0.24, 0.07, 0.13), bl > 0 ? ["avionics", "autopilot"] : ["avionics"], {
    pos: P3(fs, bl, 49.5),
    color: AVX,
    name,
    note,
    pin: true,
  }),
);
part(() => box(0.12, 0.08, 0.1), ["avionics", "pitot"], {
  pos: P3(140, 0, 43.5),
  color: AVX,
  name: "GRS 77 AHRS",
  note: "Tailcone, arm 134.0: accelerometers, tilt and rate sensors for attitude and heading. ADC AHRS breakers on the ESS bus and AVN BUS 1. The KAP 140 doesn't use it for attitude — it has its own turn coordinator — but HDG mode needs its heading (POH 7-67, 3-26).",
  pin: true,
});
part(() => box(0.12, 0.06, 0.1), ["avionics", "pitot"], {
  pos: P3(11.4, NAV3_BL.mfd, 61.5),
  color: AVX,
  name: "GDC 74A air data computer",
  note: "Behind the panel just forward of the MFD, arm 11.4: pressure altitude, airspeed, TAS, vertical speed and OAT from the pitot-static system and the OAT probe (POH 7-67, 6-23).",
  pin: true,
});
part(() => box(0.1, 0.07, 0.12), ["avionics", "engine"], {
  pos: P3(11.4, -3, 57),
  color: AVX,
  name: "GEA 71 engine/airframe unit",
  note: "Forward of the panel, arm 11.4: RPM, MAP, fuel flow, oil, CHT/EGT, fuel quantity, vacuum and bus voltages to the EIS. NAV 1 ENG breakers (ESS and AVN BUS 1) (POH 7-28, 7-67).",
  pin: true,
});
part(() => box(0.14, 0.06, 0.12), ["avionics"], {
  pos: P3(140, 5, 52.5),
  color: AVX,
  name: "GTX 33 transponder",
  note: "Mode S, in the tailcone racks, arm 134.0; controlled from the PFD. XPNDR breaker, AVIONICS BUS 2 — not available on the standby battery (POH 7-67, 3-35).",
  pin: true,
});
part(() => box(0.06, 0.03, 0.06), ["avionics"], {
  pos: wp(-170, cAt(44, 170)),
  color: AVX,
  name: "GMU 44 magnetometer",
  note: "Inside the left wing panel, arm 44.0 (spanwise station not given): heading reference for the AHRS (POH 7-67, 6-23).",
  pin: true,
});
part(() => box(0.12, 0.05, 0.1), ["avionics"], {
  pos: P3(11.4, NAV3_BL.mfd, 55),
  color: "#9C4C88",
  name: "GDL 69A data link",
  note: "XM weather and radio, behind the panel just forward of the MFD, arm 11.4; FIS breaker, AVIONICS BUS 1 (if installed) (POH 7-68, 6-23).",
});
part(() => box(0.06, 0.05, 0.1), ["avionics", "electrical"], {
  pos: P3(12.7, 0, 63),
  color: "#5A6168",
  anim: glow("#5A6168", () => EL().fwdFan, ["avionics", "electrical"], "#9FE3FF"),
  name: "Forward avionics cooling fan",
  note: "Forward of the panel, arm 12.7: draws air from between the firewall and the panel and blows it up the inside of the windshield; on the AVN BUS 1 PFD breaker. Preflight: AVIONICS BUS 1 on — verify the fan is heard (POH 7-69, 4-7).",
  pin: true,
});
part(() => box(0.06, 0.08, 0.08), ["avionics", "electrical"], {
  pos: P3(125.5, 0, 55),
  color: "#5A6168",
  anim: glow("#5A6168", () => EL().aftFan, ["avionics", "electrical"], "#9FE3FF"),
  name: "Aft avionics cooling fan",
  note: "Tailcone, arm 125.5: forced air to the GIAs and the transponder; NAV 2 breaker, AVIONICS BUS 2. None of the four fans runs on the standby battery (POH 7-69).",
  pin: true,
});
part(() => box(0.06, 0.06, 0.06), ["avionics", "autopilot"], {
  pos: P3(15.5, 4, 53),
  color: "#9C4C88",
  anim: glow("#9C4C88", () => S().avx.tcFail, ["avionics", "autopilot"], "#E0263B"),
  name: "DC turn coordinator (KAP 140)",
  note: "“A DC electric powered turn coordinator, installed forward of the instrument panel and not visible to the pilot, provides a roll rate signal to the KAP 140”, arm 15.5. Its loss disengages the autopilot (POH 7-12, 6-23).",
  pin: true,
});
/* ---------- faceplate detail (POH Figure 7-2; CRG): GDU 1040 knobs and softkeys, GMA 1347 keys, switch rockers, breaker heads ---------- */
[NAV3_BL.pfd, NAV3_BL.mfd].forEach((bl) => {
  const c = P3(18.1, bl, 61.4),
    x = c[0] - 0.015 - 0.006; // just aft of the bezel face
  part(() => gduKnobs(), ["avionics"], { pos: [x, c[1], c[2]], color: "#3A4046" });
  part(gduKeys, ["avionics"], { pos: [x + 0.003, c[1] + GDU_KEYS_Y, c[2]], color: "#4A525A" });
});
part(gmaKeys, ["avionics"], { pos: [X(18.1) - 0.018, Y(61.4), Z(NAV3_BL.gma)], color: "#4A525A" });
part(gmaKnob, ["avionics"], { pos: [X(18.1) - 0.02, Y(61.4) + GMA_KNOB_Y, Z(NAV3_BL.gma)], color: "#3A4046" });
// switch panel rockers, up = ON (POH 7-10): BEACON, LAND, TAXI, NAV, STROBE on top; FUEL PUMP, PITOT HEAT, CABIN PWR 12V below
switchRows([
  [
    () => S().lights.beacon,
    () => S().lights.land,
    () => S().lights.taxi,
    () => S().lights.nav,
    () => S().lights.strobe,
  ],
  [() => S().fuel.pump, () => S().pitot.heat, () => S().lights.cabinPwr],
]).forEach(([y, z, on]) =>
  part(() => box(0.01, 0.022, 0.012), ["electrical", "lighting"], {
    pos: [X(17.9) - 0.011, Y(53.8) + y, Z(-13.3) + z],
    color: "#D8DDE0",
    anim: (m) => {
      m.rotation.z = on() ? -0.3 : 0.3;
    },
  }),
);
part(() => cbHeads(4), ["electrical"], { pos: [X(17.9) - 0.009, Y(50), Z(-16.6)], color: "#1A1D20" });
part(() => cbHeads(8), ["electrical", "avionics"], { pos: [X(17.9) - 0.009, Y(50), Z(-11.4)], color: "#1A1D20" });

/** Top of the wing centre section over the cabin (antennas sit on it). */
const ANT = "#C8399F",
  top = (fs: number, bl = 0) => wingP(Z(bl), cAt(fs, bl), 1).y;
/** Swept blade antenna, base on the skin: base chord 0.14 m, tip chord 0.06 m, 0.22 m tall, leading edge swept ≈ 30°. */
const bladeAnt = () => {
  const sh = new THREE.Shape();
  sh.moveTo(0.07, 0);
  sh.lineTo(-0.057, 0.22);
  sh.lineTo(-0.117, 0.22);
  sh.lineTo(-0.07, 0);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: false });
  g.translate(0, 0, -0.003);
  return g;
};
part(bladeAnt, ["avionics"], {
  pos: [X(61.2), top(61.2, 7) - 0.005, Z(7)],
  color: ANT,
  name: "COM 1 / GPS 1 antenna",
  note: "Top of the cabin, right side, arm 61.2 (POH 7-69).",
  ext: true,
  pin: true,
});
part(bladeAnt, ["avionics"], {
  pos: [X(61.2), top(61.2, -7) - 0.005, Z(-7)],
  color: ANT,
  name: "COM 2 / GPS 2 / XM antenna",
  note: "Top of the cabin, left side, arm 61.2 (POH 7-69).",
  ext: true,
  pin: true,
});
[1, -1].forEach((s) =>
  part(() => box(0.36, 0.02, 0.006), ["avionics"], {
    pos: [fLE(Y(88)) - 0.12, Y(88), s * 0.06],
    rot: [s * 0.5, 0, -0.1],
    color: ANT,
    name: "VOR/GS navigation antenna",
    note: "Blade-type element on either side of the vertical stabilizer (POH 7-69).",
    ext: true,
    pin: s > 0,
  }),
);
part(() => box(0.28, 0.012, 0.08), ["avionics"], {
  pos: [X(131.5), botY(X(131.5)) - 0.006, 0],
  color: ANT,
  name: "Marker beacon antenna",
  note: "Bottom of the tailcone, arm 131.5 (POH 7-70).",
  ext: true,
  pin: true,
});
part(() => cyl(0.006, 0.08), ["avionics"], {
  pos: [X(86.5), botY(X(86.5)) - 0.04, Z(2)],
  color: ANT,
  name: "Transponder antenna",
  note: "Bottom of the cabin, arm 86.5 (POH 7-70).",
  ext: true,
  pin: true,
});
part(() => box(0.08, 0.05, 0.008), ["avionics"], {
  pos: [X(114.5), botY(X(114.5)) - 0.026, Z(-2)],
  color: "#9C4C88",
  name: "DME antenna (if installed)",
  note: "Bottom of the tailcone, arm 114.5 (KN 63 option, POH 6-23).",
  ext: true,
});
part(() => box(0.05, 0.045, 0.06), ["avionics", "cabin"], {
  pos: P3(19.5, 0, 68.3),
  color: "#20262B",
  anim: glow("#20262B", () => EL().lit.stbyInd, ["avionics", "cabin"], "#E8C46A"),
  name: "Magnetic compass (non-stabilized)",
  note: "Arm 18.0 (cockpit position not in the POH — modelled on top of the glareshield, inside the windshield). Required for all operations (KOEL) and the heading source after an AHRS failure; lit by the STDBY IND dimmer; deviation card in 30° steps (POH 2-13, 3-28, 7-59).",
  pin: true,
});
part(() => box(0.065, 0.008, 0.035), ["avionics", "cabin"], { pos: P3(18.4, 0, 67.3), color: "#20262B" }); // compass bracket on the glareshield

/* ---------- KAP 140 (POH 7-12, Supplement 3) ---------- */
const tr = (g: THREE.BufferGeometry, x: number, y: number, z: number) => {
  g.translate(x, y, z);
  return g;
};
/** KAP 140 faceplate on the center panel below the standby instruments (Fig. 7-2 item 13); LCD drawn by Airplane.tsx. */
export const KAP = { fs: 18.15, bl: 0.6, h: 49.4, w: 0.16, hgt: 0.034 };
const kapOn = () => live.kap.powered;
const apBtn: PartAnim = (m) => {
  const k = live.kap,
    lit = k.powered && kap140Phase(k, live.fs.t).ph === "ready";
  m.material = !lit ? mats("#2B3035").on : k.ap ? mats("#7CFF8A").hi : mats("#3A4046").on;
};
part(() => box(0.02, KAP.hgt, KAP.w), ["autopilot", "avionics"], {
  pos: P3(KAP.fs - 0.4, KAP.bl, KAP.h),
  color: "#202428",
  name: "KAP 140 flight computer",
  pin: true,
  note: "Bendix/King KAP 140 two-axis autopilot with altitude preselect and GPS roll steering, arm 12.0 (22-01-S): display, mode keys, UP/DN, ARM, BARO and the altitude-select knobs in one panel-mounted unit. AUTO PILOT 5 A breaker, AVIONICS BUS 2 (POH 7-12, S3-10).",
});
(["AP", "HDG", "NAV", "APR", "REV", "ALT"] as const).forEach((k, i) =>
  part(() => box(0.008, 0.007, 0.014), ["autopilot"], {
    pos: [X(KAP.fs + 0.2), Y(KAP.h) - 0.011, Z(KAP.bl) - 0.062 + i * 0.019],
    color: "#3A4046",
    anim:
      k === "AP"
        ? apBtn
        : (m) => {
            const s = live.kap;
            const on = s.ap && (s.lat === k || s.vert === k || s.latArm === k);
            m.material = on ? mats("#7CFF8A").on : mats(kapOn() ? "#3A4046" : "#2B3035").on;
          },
    ...(i === 0
      ? {
          name: "KAP 140 mode keys",
          note: "AP (engage: ROL + VS), HDG, NAV, APR, REV and ALT. Lit here while the mode is active. AP needs the self-test complete and the red P out (≈ 30 s after power-up) (S3-8 – S3-12).",
        }
      : {}),
  }),
);
part(() => mergeGeos([0.011, 0.003, -0.006, -0.014].map((y) => tr(box(0.008, 0.007, 0.011), 0, y, 0))), ["autopilot"], {
  pos: [X(KAP.fs + 0.2), Y(KAP.h), Z(KAP.bl) + 0.0475],
  color: "#3A4046",
  name: "KAP 140 ARM, BARO, UP and DN keys",
  note: "ARM turns altitude arming on or off; BARO shows the baro setting for 3 s (hold 2 s: IN HG ↔ HPA); UP / DN change the VS reference 100 fpm a press (300 fpm/s held) or the ALT reference 20 ft (500 fpm held) (S3-10 – S3-12).",
});
part(() => cyl(0.012, 0.012, "x"), ["autopilot"], {
  pos: [X(KAP.fs + 0.25), Y(KAP.h), Z(KAP.bl) + 0.068],
  color: "#30353A",
  name: "Altitude select knobs",
  note: "Concentric rotary knobs: set the altitude alerter reference altitude, or the baro setting right after BARO is pressed (S3-11). Selecting an altitude with them while the autopilot is engaged arms ALT automatically (S3-12). Step sizes are not in the POH (1,000 / 100 ft modelled).",
});

/** KAP 140 servos (equipment list 22-01-S, POH 6-20): they glow while driving. */
const servo = (on: () => boolean): PartAnim => glow("#7C57CF", on, ["autopilot", "controls"], "#FFD34D");
const SV = RIG_SPEC.servo;
part(() => box(0.12, 0.08, 0.1), ["autopilot", "controls"], {
  pos: P3(SV.roll[0], SV.roll[1], SV.roll[2] - 2.6),
  color: "#7C57CF",
  chan: ["aileron"],
  anim: servo(() => live.kap.ap),
  name: "KS 271C roll servo",
  note: "Arm 52.0, on the aileron cables across the cabin top. Drives the ailerons — and so the control wheels — while the autopilot is engaged; easily overpowered (S3-7, POH 6-20).",
  pin: true,
});
part(() => box(0.12, 0.08, 0.1), ["autopilot", "controls"], {
  pos: P3(SV.pitch[0], SV.pitch[1] + 1.5, SV.pitch[2]),
  color: "#7C57CF",
  chan: ["elevator"],
  anim: servo(() => live.kap.ap),
  name: "KS-270C pitch servo",
  note: "Tailcone, arm 158.8, on the elevator cables. Pitch modes VS, ALT and GS move the elevator, and the control wheels with it (S3-7, POH 6-20).",
  pin: true,
});
part(() => box(0.1, 0.08, 0.09), ["autopilot", "controls"], {
  pos: P3(SV.trim[0], SV.trim[1] - 1.5, SV.trim[2]),
  color: "#7C57CF",
  chan: ["elevator"],
  anim: servo(() => live.kap.pt != null || (live.kap.ap && live.timers.trimRun > 0)),
  name: "KS-272C pitch trim servo",
  note: "Tailcone, arm 176.4, on the elevator trim cable: autotrim while engaged, manual electric trim (MET) otherwise — so the trim wheel turns. A trim fault lights PT and the red PITCH TRIM on the PFD (S3-11, S3-21).",
  pin: true,
});

/* ---------- pitot-static and stall warning (POH 7-62, 7-65) ---------- */
const PIT = "#3A9448";
/** Pitot mast under the left wing, inboard of the strut: BL ≈ 65 scaled from both Figure 1-1 front views (the text gives no station); heated head centred near arm 28.0. */
export const PITOT: Vec3 = wp(-65, 0.12, -1, -0.12);
part(() => tubeGeo([wp(-65, 0.18, -1, 0.01), [PITOT[0] - 0.05, PITOT[1], PITOT[2]]], 0.012), ["pitot"], {
  color: "#AEB6BC",
  name: "Pitot mast",
  note: "Under the left wing, inboard of the strut (POH 7-62; station scaled from Figure 1-1).",
  ext: true,
});
part(() => cyl(0.012, 0.26, "x"), ["pitot"], {
  pos: [PITOT[0] + 0.08, PITOT[1], PITOT[2]],
  color: "#AEB6BC",
  anim: glow("#AEB6BC", () => EL().pitotHeating, ["pitot"], "#FF6A2A"),
  name: "Heated pitot head",
  note: "“Heated total pressure (pitot) head mounted on the lower surface of the left wing”, arm 28.0. PITOT HEAT switch and 10 A breaker (ELECTRICAL BUS 2) also heat the stall vane. No annunciation: check it's warm within 30 s on preflight (POH 7-62, 4-8).",
  ext: true,
  pin: true,
});
/** External static ports on both sides of the forward fuselage (POH 7-62); station not in the POH. */
export const STATIC_PORTS: Vec3[] = [1, -1].map((s) => PV(onSkin(X(15), Y(44), s, 1.01)));
STATIC_PORTS.forEach((p, i) =>
  part(() => cyl(0.014, 0.006, "z"), ["pitot"], {
    pos: p,
    color: PIT,
    name: "Static port",
    note: "“External static ports mounted on both sides of the forward fuselage” — check each opening on preflight (POH 7-62, 4-10, 4-11). The two sides average out yaw errors.",
    ext: true,
    pin: i === 1,
  }),
);
part(() => cyl(0.012, 0.03, "x"), ["pitot"], {
  pos: P3(18.4, -4.6, KNOB.h),
  color: PIT,
  anim: pushPull(X(18.4), () => (S().pitot.altStatic ? 0 : 1), 0.03),
  name: "ALT STATIC AIR valve",
  note: "Next to the throttle (Fig. 7-2 item 32), arm 15.5: pull ON for cabin static pressure if the external source blocks. Maximum variation 5 kt and 80 ft with the windows closed; use Fig. 5-1 Sheet 2 and Fig. 5-2 (POH 7-62, 3-30).",
  pin: true,
});
part(() => cyl(0.006, 0.05), ["pitot", "avionics"], {
  pos: [X(41.5), top(41.5, -4) + 0.022, Z(-4)],
  color: PIT,
  name: "OAT probe (GTP 59)",
  note: "On top of the cabin, arm 41.5, connected to the air data computer (POH 7-67, 6-22).",
  ext: true,
  pin: true,
});
/** Electric stall warning vane in the left wing leading edge (wing unit S1672-9, arm 25.6). */
export const STALL_VANE: Vec3 = wp(-92, 0.015, -1, 0);
const vaneGlow = glow(PIT, () => live.horn, ["pitot"], "#FF5050");
part(() => box(0.03, 0.006, 0.03), ["pitot"], {
  pos: STALL_VANE,
  color: PIT,
  anim: (m, t) => {
    vaneGlow(m, t);
    m.rotation.z = live.horn ? 0.4 : 0;
  },
  name: "Stall warning vane",
  note: "Vane-type sensor in the left wing leading edge, arm 25.6: near the stall the airflow lifts the vane and closes a switch to the horn, 5–10 kt above the stall in all configurations. Heated by PITOT HEAT. Preflight: MASTER on, push the vane up — the horn must sound (POH 7-65, 4-8).",
  ext: true,
  pin: true,
});
part(() => cyl(0.025, 0.05, "x"), ["pitot", "cabin"], {
  pos: P3(40, -19, 78),
  color: PIT,
  anim: glow(PIT, () => live.horn, ["pitot", "cabin"], "#FF5050"),
  name: "Stall warning horn",
  note: "Electric horn in the headliner above the left cabin door, arm 40.0; powered through the WARN breaker on the CROSSFEED BUS (Fig. 7-7; the text calls it a 5 A STALL WARN breaker) (POH 7-65, 6-22).",
  pin: true,
});
part(() => sph(0.035), ["pitot"], {
  pos: wp(-92, 0.1, 1),
  color: "#E0263B",
  ext: true,
  name: "Stagnation point",
  anim: (m) => {
    const v = sysNow();
    m.visible = v === "pitot" && !S().ground;
    const slow = Math.max(0, Math.min(1, (live.fs.ias - 40) / 50));
    m.position.copy(wingP(Z(-92), 0.06 * slow, -1).add(V(0, -0.02 * (1 - slow), 0)));
  },
  note: "Moves down and aft under the leading edge as the angle of attack rises; near the stall the airflow around the vane lifts it.",
});

/* ---------- vacuum system and standby attitude (POH 7-63, Figure 7-9) ---------- */
const VAC = "#4FA8A0";
part(() => cyl(0.04, 0.08, "x"), ["vacuum", "engine"], {
  pos: P3(-5, 5.5, 47),
  color: VAC,
  anim: glow(VAC, () => S().vac.fail, ["vacuum", "engine"], "#E0263B"),
  name: "Engine-driven vacuum pump",
  note: "AA3215CC dry pump on the accessory case, arm −5.0, with a cooling shroud (−5.6); discharges overboard (POH 7-63, 6-24).",
  pin: true,
});
part(() => box(0.06, 0.05, 0.05), ["vacuum"], {
  pos: P3(2.1, 8, 56),
  color: VAC,
  name: "Vacuum regulator",
  note: "AA2H3-2, arm 2.1: holds vacuum in the 4.5–5.5 in.Hg green band (POH 6-24, 2-7).",
  pin: true,
});
part(() => cyl(0.04, 0.05), ["vacuum"], {
  pos: P3(11.5, 3, 58.5),
  color: "#C9D6D4",
  name: "Vacuum system air filter",
  note: "Arm 11.5, behind the panel: cabin air is drawn through it to the attitude indicator's rotor (Fig. 7-9).",
  pin: true,
});
part(() => box(0.03, 0.03, 0.03), ["vacuum"], {
  pos: P3(8.5, 6, 54),
  color: VAC,
  name: "Vacuum transducer",
  note: "P165-5786, arm 8.5 → GEA 71 → VAC on the EIS SYSTEM page; LOW VACUUM (amber) below 3.5 in.Hg (POH 7-63, 6-24).",
  pin: true,
});
part(() => tubeGeo([P3(-5, 5.5, 44.5), P3(-6, 6, 32), P3(-6, 7, 23.2)], 0.008), ["vacuum"], {
  color: VAC,
  name: "Vacuum pump overboard vent line",
  note: "Pump discharge air goes overboard (Fig. 7-9).",
  ext: true,
});

/* ---------- lighting (POH 7-57 – 7-60) ---------- */
const tipAt = (s: number): Vec3 => wp(s * 214, 0.2, 0, 0);
export const LIGHTS = {
  tipL: tipAt(-1),
  tipR: tipAt(1),
  /** White position light at the tip of the tailcone stinger (2005 POH 7-57; the 2007 edition says “tip of the rudder”). */
  tail: P3(259.2, 0, 45.6),
  /** Fin tip (Figure 1-1 side view); the equipment list gives arm 253.1. */
  beacon: [fLE(Y(109.4)) - 0.07, Y(110.9), 0] as Vec3,
  land: wp(-140.5, 0.0, 0, -0.01),
  taxi: wp(-135.5, 0.0, 0, -0.01),
  courtesyL: wp(-26, cAt(61.7, 26), -1, -0.01),
  courtesyR: wp(26, cAt(61.7, 26), -1, -0.01),
  flood: P3(48, 0, 77.6),
  dome: P3(70, 0, 77.6),
  map: P3(26, -14, 52.6),
};
(
  [
    ["tipL", "Left wing tip: red position light + strobe"],
    ["tipR", "Right wing tip: green position light + strobe"],
  ] as const
).forEach(([k, name]) =>
  part(() => sph(0.035), ["lighting"], {
    pos: LIGHTS[k],
    color: "#D9D9D9",
    name,
    note: "Navigation light and strobe anticollision light (arm 40.4) in each wing tip; NAV LTS and STROBE LTS breakers on ELECTRICAL BUS 2. Strobes required for all operations (KOEL). Don't use the strobes or beacon flying through cloud or overcast — vertigo (POH 7-57, 2-12).",
    ext: true,
    pin: true,
  }),
);
part(() => sph(0.02), ["lighting"], {
  pos: LIGHTS.tail,
  color: "#F2F2F2",
  name: "Tail position light (white)",
  note: "At the tip of the stinger (POH 7-57). NAV switch, NAV LTS breaker.",
  ext: true,
  pin: true,
});
part(() => cyl(0.03, 0.06), ["lighting"], {
  pos: LIGHTS.beacon,
  color: "#C8313B",
  name: "Flashing beacon",
  note: "On top of the vertical fin (equipment item 33-04-S, arm 253.1); BCN LT breaker, ELECTRICAL BUS 1. To save the battery in cold weather it can stay off until the engine is started (POH 7-57, 4-50).",
  ext: true,
  pin: true,
});
part(() => box(0.02, 0.06, 0.1), ["lighting"], {
  pos: LIGHTS.land,
  color: "#F5F2E4",
  name: "Landing light",
  note: "In the left wing leading edge (landing and taxi light assembly, arm 26.8); LAND switch, LAND LT breaker on ELECTRICAL BUS 1. Use only the taxi light in the pattern or en route to extend the landing light's life (POH 7-57; the taxi-light advice is on 4-32).",
  ext: true,
  pin: true,
});
part(() => box(0.02, 0.06, 0.1), ["lighting"], {
  pos: LIGHTS.taxi,
  color: "#F5F2E4",
  name: "Taxi light",
  note: "Beside the landing light; TAXI switch, TAXI LT breaker on ELECTRICAL BUS 2 (POH 7-57).",
  ext: true,
  pin: true,
});
[LIGHTS.courtesyL, LIGHTS.courtesyR].forEach((p, i) =>
  part(() => sph(0.018), ["lighting", "cabin"], {
    pos: p,
    color: "#E8C46A",
    name: "Courtesy light (under wing)",
    note: "Recessed in the lower surface of each wing to light the door area, arm 61.7; on the overhead push button shared with the rear dome light (POH 7-57, 7-58).",
    ext: true,
    pin: i === 0,
  }),
);
part(() => box(0.5, 0.03, 0.16), ["lighting", "cabin"], {
  pos: P3(58, 0, 78.3),
  color: "#39424A",
  name: "Overhead console",
  note: "One dimmable, rotatable front flood light with its dimmer (serials 18280945 – 18281741 — both club airplanes), the rear dome light with its push button (also the courtesy lights) and the overhead speaker (POH 7-58, 7-70).",
  pin: true,
});
part(() => cyl(0.022, 0.022), ["lighting"], {
  pos: LIGHTS.flood,
  color: "#E8C46A",
  name: "Flood light",
  note: "Front crew flood light: dimmable and rotatable for the pilot or front passenger. Placard “Flood Light” near its control (POH 7-58, 2-21).",
  pin: true,
});
part(() => cyl(0.03, 0.012), ["lighting"], {
  pos: LIGHTS.dome,
  color: "#E8C46A",
  name: "Rear dome light",
  note: "Fixed light for the rear cabin; on/off push button on the overhead console, shared with the courtesy lights (POH 7-58).",
  pin: true,
});
part(() => box(0.012, 0.06, 0.06), ["lighting"], {
  pos: P3(17.9, -17.8, 53.8),
  color: "#2F3A42",
  name: "DIMMING panel",
  note: "Below the MASTER and AVIONICS switches: SW/CB PANELS, PEDESTAL, AVIONICS (full counter-clockwise = photocell) and STDBY IND (POH 7-58, 7-59).",
  pin: true,
});

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
// the Kap140 faceplate's position is shared with the screen in Airplane.tsx
export const KAP_LCD = { pos: P3(KAP.fs + 0.05, KAP.bl - 0.6, KAP.h + 0.3), size: [0.085, 0.0213] as [number, number] };
