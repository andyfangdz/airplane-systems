/** C182T catalogue: fuel system (POH Figure 7-6, 7-38 – 7-46). */
import type { Vec3 } from "@/lib/math";
import { glowAnim as glow } from "@/lib/anims";
import { box, cyl, sph, tubeGeo } from "../geometry";
import { EL, P3, S, cAt, part, wp } from "./catalogue";

/* ---------- fuel system (POH Figure 7-6, 7-38 – 7-46) ---------- */
const FUEL = "#2F7FE6";
/** Integral tank span (BL, in) used by the tank volumes in Airplane.tsx: between the spars of the constant-chord inboard panel. */
export const TANK_BL = [24, 100] as const;
/** Schematic aft-doorpost route, shared by the pipe and its fuel particles; the upper elbow enters under the wing root. */
export const fuelManifoldPath = (s: number): Vec3[] => [
  wp(s * 24.5, 0.62, -1, 0.02),
  P3(65, s * 18, 78),
  P3(65, s * 19.4, 30),
  P3(40, s * 8, 26.8),
  P3(27.5, s * 2.5, 25.4),
];
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
  part(() => tubeGeo(fuelManifoldPath(s), 0.008), ["fuel"], {
    color: FUEL,
    name: "Fuel manifold (aft door post)",
    note: "“Two fuel manifolds (one in each aft doorpost)”: gravity feed from each tank outlet down the door post and under the floor to the selector (POH 7-38, Fig. 7-6). The bends are schematic, entering the cabin under the wing root.",
    pin: s > 0,
  });
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
  pos: P3(49.5, -11, 44),
  color: "#7EB3F5",
  name: "Fuel sampler cup",
  note: "Stowed in the pilot's seat back, arm 49.5 (POH 6-21). Sample every drain point before each flight and after refueling, airplane in the normal ground attitude (POH 4-6, 7-45). Cup size, lateral position and height are approximate, clear of the seat-back cushion.",
});
