/** C172S catalogue: fuel system (POH Figure 7-6). */
import type { Vec3 } from "@/lib/math";
import { glowAnim as glow, pushPull } from "@/lib/anims";
import { X, box, cyl, sph, tubeGeo } from "../geometry";
import { P3, part, S, EL, wp } from "./catalogue";

/* ---------- fuel system (POH Figure 7-6) ---------- */
const FUEL = "#2F7FE6";
[1, -1].forEach((s) => {
  part(() => cyl(0.04, 0.012), ["fuel"], {
    pos: wp(s * 36, 0.2, 1, 0.006),
    color: FUEL,
    name: "Fuel filler cap",
    note: "Top of each wing near the inboard end of the tank (BL ≈ 36, scaled from the Figure 1-1 top view), within reach of the refueling steps and assist handles on the forward fuselage (POH 4-3). Placard FUEL 100LL / 100 MIN. GRADE, 26.5 gal usable, 17.5 gal to the bottom of the filler indicator tab. Caps are vacuum vented (POH 2-24, 7-44).",
    ext: true,
    pin: s > 0,
  });
  part(() => box(0.02, 0.05, 0.02), ["fuel"], {
    pos: wp(s * 36, 0.2, 1, -0.04),
    color: "#7EB3F5",
    name: "Reduced capacity filler tab",
    note: "Inside the filler neck: filling to its bottom edge gives 17.5 gal usable per tank (POH 7-44).",
  });
  part(() => box(0.03, 0.03, 0.03), ["fuel"], {
    pos: wp(s * 23.5, 0.28, -1, 0.02),
    color: FUEL,
    name: "Tank outlet screen",
    note: "At each tank outlet (Fig. 7-6). At 1/4 tank or less, prolonged uncoordinated flight can uncover the outlets (POH 7-45).",
    pin: s > 0,
  });
  part(() => cyl(0.012, 0.08), ["fuel"], {
    pos: wp(s * 47, 0.36, 0, 0),
    color: "#0B3A80",
    name: "Fuel quantity transmitter",
    note: "One per tank (FS 47.4) → GEA 71 → FUEL QTY GAL. Reads 0 at 1.5 gal unusable; tops out at ~24 gal — check the tanks visually before flight (POH 7-39).",
    pin: s > 0,
  });
  [24, 42, 60, 78, 94].forEach((b, i) =>
    part(() => sph(0.018), ["fuel"], {
      pos: wp(s * b, 0.5, -1, -0.012),
      color: "#0B3A80",
      name: "Fuel tank sump drain",
      note: "Figure 7-6 labels “Fuel Tank Drain Valve (5 Total)” under each tank. Sample every sump before each flight and after refueling (POH 7-46, 4-7).",
      ext: true,
      pin: s > 0 && i === 0,
    }),
  );
});
part(
  () =>
    tubeGeo([wp(-23, 0.15, 1, -0.02), wp(-8, 0.15, 1, -0.04), wp(8, 0.15, 1, -0.04), wp(23, 0.15, 1, -0.02)], 0.006),
  ["fuel"],
  {
    color: "#7EB3F5",
    name: "Fuel vent interconnect",
    note: "Interconnecting vent line between the tanks (POH 7-44). Fuel can slosh between nearly full tanks if the wings aren't level — park with the selector on LEFT or RIGHT (POH 4-22).",
    pin: true,
  },
);
part(() => tubeGeo([wp(-92, 0.3, -1, 0.01), wp(-92, 0.3, -1, -0.08)], 0.008), ["fuel"], {
  color: FUEL,
  name: "Overboard fuel vent (check valve)",
  note: "Protrudes from the bottom of the LEFT wing just inboard of the strut fitting. A blocked vent starves the engine — check it on preflight (POH 7-44, 4-10).",
  ext: true,
  pin: true,
});
export const FSEL: Vec3 = P3(26.4, 0, 27);
part(() => cyl(0.05, 0.025), ["fuel"], {
  pos: FSEL,
  color: "#20262B",
  name: "Fuel selector valve",
  note: "BOTH / RIGHT / LEFT — no OFF. BOTH for takeoff, climb, landing and slips over 30 s; LEFT or RIGHT for level cruise only. Placard: BOTH 53.0 gal, LEFT/RIGHT 26.5 gal LEVEL FLIGHT ONLY (POH 7-45, 2-24).",
  pin: true,
});
part(() => box(0.1, 0.012, 0.022), ["fuel"], {
  pos: [FSEL[0], FSEL[1] + 0.02, FSEL[2]],
  color: "#F2F5F7",
  anim: (m) => {
    const sel = S().fuel.sel;
    m.rotation.y = sel === "BOTH" ? Math.PI / 2 : sel === "LEFT" ? 0 : Math.PI;
  },
});
part(() => sph(0.014), ["fuel"], {
  pos: P3(24, 0, 23.4),
  color: "#0B3A80",
  name: "Fuel selector drain",
  note: "Drain if water is found in the other samples (POH 4-8, 8-20).",
  ext: true,
});
part(() => box(0.12, 0.06, 0.12), ["fuel"], {
  pos: P3(14.5, 0, 25.6),
  color: FUEL,
  name: "Fuel reservoir tank",
  note: "Downstream of the selector; the fuel return line from the engine feeds it. Capacity and location are not given in the POH (placed under the floor here) (POH 7-39, 7-44).",
  pin: true,
});
part(() => sph(0.014), ["fuel"], {
  pos: P3(14.5, 0, 23.6),
  color: "#0B3A80",
  name: "Fuel reservoir drain",
  note: "Quick drain on the reservoir (POH 7-46).",
  ext: true,
});
part(() => cyl(0.035, 0.12, "x"), ["fuel", "electrical"], {
  pos: P3(9.5, -3, 26),
  color: "#5D8FD6",
  anim: glow("#5D8FD6", () => EL().fuelPumpOn, ["fuel", "electrical"], "#A9CCFF"),
  name: "Auxiliary fuel pump",
  note: "Electric, arm 9.5 (POH 6-21). For priming through the injection system, vapor suppression and a failed engine-driven pump. FUEL PUMP breaker, ELECTRICAL BUS 1 (POH 7-43).",
  pin: true,
});
part(() => cyl(0.025, 0.05), ["fuel"], {
  pos: P3(4.5, -2.5, 26.5),
  color: FUEL,
  name: "Fuel shutoff valve",
  note: "Between the aux pump and the strainer (Fig. 7-6); mechanically linked to the FUEL SHUTOFF knob.",
  pin: true,
});
part(() => cyl(0.014, 0.03, "x"), ["fuel"], {
  pos: P3(25.9, 2.2, 31),
  color: "#C8313B",
  anim: pushPull(X(25.9), () => (S().fuel.shutoff ? 1 : 0), 0.04),
  name: "FUEL SHUTOFF knob",
  note: "Pedestal: ON = pushed full in, OFF = pulled full out (POH 4-11, 3-6).",
  pin: true,
});
part(() => cyl(0.035, 0.08), ["fuel"], {
  pos: P3(-4, -4, 29),
  color: FUEL,
  name: "Fuel strainer",
  note: "Ahead of the firewall, the low point before the engine-driven pump; quick drain on the bottom of the fuselage (POH 7-39, 4-8).",
  pin: true,
});
part(() => sph(0.014), ["fuel"], {
  pos: P3(-4, -4, 24.8),
  color: "#0B3A80",
  name: "Fuel strainer quick drain",
  note: "Drain at the NOSE on preflight (POH 4-8).",
  ext: true,
});
// on the accessory case face (block aft face FS −6.4), outboard of the vacuum pump; must match the fuelEdp / fuelServo ends in flows.ts
part(() => cyl(0.035, 0.08, "x"), ["fuel", "engine"], {
  pos: P3(-5.8, -9, 45),
  color: FUEL,
  anim: glow(FUEL, () => S().eng.fail.edp, ["fuel", "engine"], "#E0263B"),
  name: "Engine-driven fuel pump",
  note: "Rear accessory case; feeds the fuel/air control unit. A failure shows as FFLOW suddenly dropping just before a power loss — FUEL PUMP ON (POH 3-34). Its place on the accessory case is approximate (not in the POH).",
  pin: true,
});
part(() => cyl(0.018, 0.06, "x"), ["fuel", "engine"], {
  pos: P3(-22.6, 3, 57),
  color: "#0B3A80",
  name: "Fuel flow transducer",
  note: "Turbine type, on top of the engine between the fuel/air control unit and the distribution unit → FFLOW GPH (POH 7-40).",
  pin: true,
});
part(() => box(0.06, 0.04, 0.06), ["fuel", "engine"], {
  pos: P3(-18, 0, 58.5),
  color: FUEL,
  name: "Fuel distribution unit (flow divider)",
  note: "Top of the engine; a spring-loaded diaphragm valve evenly distributes metered fuel to the four nozzles (POH 7-37).",
  pin: true,
});
part(() => cyl(0.012, 0.03), ["fuel"], {
  pos: P3(4, 3, 27.5),
  color: "#7EB3F5",
  name: "Fuel return check valve",
  note: "On the return line from the orifice in the top of the fuel/air control unit to the reservoir: lowers fuel temperature and vapor in hot weather (POH 7-44).",
});
part(() => box(0.03, 0.04, 0.03), ["fuel", "cabin"], {
  pos: P3(14.3, 12, 40),
  color: "#7EB3F5",
  name: "Fuel sampler cup (stowed)",
  note: "S2107-1, arm 14.3 (POH 6-20). Sample in the normal ground attitude.",
});
