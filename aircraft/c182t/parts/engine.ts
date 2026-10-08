import { COWL_INLETS } from "../../cowl-inlets";
import { cowlOpeningGeo, mergeGeos } from "@/lib/geometry";
import { FUSE } from "../geometry";
/**
 * C182T catalogue: propeller and engine: IO-540, cylinders and plugs, magnetos, oil, induction, exhaust and heater shrouds,
 * cooling and cowl flaps, engine mount and engine controls.
 */
import * as THREE from "three";
import type { Vec3 } from "@/lib/math";
import { magAnim, plugAnim, pushPull, sparkPhase } from "@/lib/anims";
import { X, box, cyl, tubeGeo } from "../geometry";
import { IN } from "../../cessna/airframe";
import { P3, S, altDoorAnim, fires, part } from "./catalogue";

/* ---------- propeller: McCauley B3D36C431/80VSA-1, three blades, 79 in, constant speed (POH 1-5, 2-6) ---------- */
/** Prop plane at the propeller assembly arm (FS −47.5, POH 6-24), on the thrust line. */
export const PROP: Vec3 = P3(-47.8, 0, 50.375);
const bladeGeo = () => {
  const R = 39.5 * IN,
    sh = new THREE.Shape();
  sh.moveTo(-0.05, 0.13);
  sh.quadraticCurveTo(-0.14, R * 0.48, -0.065, R * 0.96);
  sh.quadraticCurveTo(-0.015, R * 1.005, 0.045, R * 0.965);
  sh.quadraticCurveTo(0.14, R * 0.48, 0.045, 0.13);
  sh.lineTo(-0.05, 0.13);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: false });
  g.translate(0, 0, -0.008);
  g.rotateY(Math.PI / 2);
  return g;
};
for (let i = 0; i < 3; i++)
  part(bladeGeo, ["propeller", "engine"], {
    parent: "blade:" + i,
    color: "#2E3439",
    name: "Propeller blade",
    note: "All-metal blade of the 3-blade McCauley B3D36C431/80VSA-1, 79 in. Hydraulically actuated: low pitch 14.9°, high pitch 31.7° at the 30-in station (POH 1-5, 2-6). Never use an alkaline cleaner on the blades (POH 8-23).",
    ext: true,
    pin: i === 0,
  });
part(() => cyl(0.075, 0.13, "x"), ["propeller"], {
  pos: P3(-45.5, 0, 50.375),
  color: "#8C959C",
  name: "Propeller hub (oil filled)",
  note: "P4317296-01 oil-filled hub, assembly 76.6 lb at arm −47.5 (POH 6-24). Governor oil pressure on its piston twists the blades toward high pitch (low RPM); centrifugal force and an internal spring twist them back toward low pitch (POH 7-37).",
  pin: true,
});

/* ---------- engine: Lycoming IO-540-AB1A5, 230 BHP @ 2,400 RPM (POH 1-5) ---------- */
part(() => box(0.86, 0.3, 0.44), ["engine"], {
  pos: P3(-23.6, 0, 48.6),
  color: "#7E8890",
  name: "Lycoming IO-540-AB1A5",
  note: "Normally aspirated, direct drive, air-cooled, horizontally opposed, fuel injected, six cylinders, 541 cu in; 230 BHP at 2,400 RPM; wet sump; 400.4 lb at arm −23.6 (POH 1-5, 7-27, 6-24).",
  pin: true,
});
part(() => box(0.62, 0.12, 0.36), ["engine"], {
  pos: P3(-24, 0, 37.5),
  color: "#B85A2A",
  name: "Oil sump",
  note: "Wet sump on the bottom of the engine: 8 qt sump, 9 qt total (POH 1-7, 8-14; placard “OIL 9 QTS”) — never operate on less than 4 qt; fill to 8 qt for flights under 3 hours, 9 qt for extended flight (POH 7-34). Section 7 (p. 7-34) states the sump as 9 qt plus 1 qt in the filter; Sections 1 and 8 and the 9-qt placard govern.",
});
/** Cylinder positions: 1, 3, 5 right bank, 2, 4, 6 left (Lycoming numbering — the POH does not map numbers to positions). */
export const CYLS = [
  { n: 1, fs: -35.5, s: 1 },
  { n: 2, fs: -32.5, s: -1 },
  { n: 3, fs: -29.5, s: 1 },
  { n: 4, fs: -26.5, s: -1 },
  { n: 5, fs: -23.5, s: 1 },
  { n: 6, fs: -20.5, s: -1 },
];
CYLS.forEach((c) => {
  const base = P3(c.fs, c.s * 12, 50);
  part(() => cyl(0.058, 0.2, "z", 18), ["engine"], {
    pos: base,
    color: "#7C858C",
    name: "Cylinder " + c.n,
    note:
      (c.s > 0 ? "Right" : "Left") +
      " bank. Baffles route cooling air around the fins and out past the cowl flaps (POH 7-37). Numbering per Lycoming convention (not stated in the POH)." +
      (c.n === 3 ? " CHT 3 is the most critical: operation with CHT 3 inoperative is not allowed (POH 7-33)." : ""),
  });
  for (let k = -2; k <= 2; k++)
    part(() => cyl(0.072, 0.008, "z", 18), ["engine"], {
      pos: [base[0], base[1], base[2] + c.s * k * 0.03],
      color: "#8C959C",
    });
  part(() => box(0.14, 0.15, 0.07), ["engine"], {
    pos: [base[0], base[1] + 0.01, base[2] + c.s * 0.075],
    color: "#6A737A",
    name: "Cylinder head " + c.n,
    note: "Two spark plugs; CHT thermocouple in the head and EGT thermocouple in the exhaust pipe (POH 7-33). Engine page shows the hottest; the LEAN page shows all six.",
    pin: c.n === 1,
  });
  // upper plug on the top face of the head, lower plug on its bottom face (heads span y −0.065..+0.085 about base): along x they would
  // sit in the 0.5 in. gap to the next head aft
  (
    [
      ["U", 0.105],
      ["L", -0.085],
    ] as const
  ).forEach(([pos, dy]) => {
    // POH 7-35 (KAP 140 edition, image-verified): right magneto fires lower right + upper left; left magneto lower left + upper right
    const mag = c.s > 0 === (pos === "L") ? "R" : "L";
    part(() => cyl(0.013, 0.05, "y", 10), ["engine"], {
      pos: [base[0] - 0.03, base[1] + dy, base[2] + c.s * 0.075],
      color: "#DADFE2",
      anim: plugAnim(fires(mag), sparkPhase(`${c.n}${pos}`)),
      name: `Spark plug — cyl ${c.n} ${pos === "U" ? "upper" : "lower"}`,
      note: `Fired by the ${mag === "L" ? "left" : "right"} magneto. “The right magneto fires the lower right and upper left spark plugs, and the left magneto fires the lower left and upper right” (POH 7-35; the 2007 edition states the reverse).`,
    });
  });
  part(() => box(0.03, 0.03, 0.03), ["engine", "fuel"], {
    pos: [base[0] - 0.02, base[1] - 0.11, base[2] + c.s * 0.07],
    color: "#C9B98F",
    name: "Fuel injector nozzle",
    note: "Air-bleed type nozzle in the intake chamber of each cylinder, fed by the fuel distribution unit (POH 7-36, 7-40).",
  });
});
part(() => cyl(0.045, 0.12, "x"), ["engine"], {
  pos: P3(-4.5, -5.5, 55),
  color: "#3E4A52",
  anim: magAnim(fires("L")),
  name: "Left magneto",
  note: "Rear accessory case; fires the lower left and upper right plugs (POH 7-35). Self-powered: OFF grounds it, so with a loose P-lead the engine can fire when the propeller is turned (POH 4-49).",
  pin: true,
});
part(() => cyl(0.045, 0.12, "x"), ["engine"], {
  pos: P3(-4.5, 5.5, 55),
  color: "#3E4A52",
  anim: magAnim(fires("R")),
  name: "Right magneto",
  note: "Fires the lower right and upper left plugs (POH 7-35). Normal operation is BOTH; R and L are for checking and emergencies. Mag check at 1,800 RPM: ≤ 175 RPM drop, ≤ 50 RPM between (POH 4-17).",
  pin: true,
});
part(() => box(0.12, 0.1, 0.11), ["engine", "electrical"], {
  pos: P3(-39, -8, 42.5),
  color: "#4B5860",
  name: "Starter",
  note: "Front of the engine (POH 7-27). MAGNETOS to START with the MASTER on closes the starter contactor in the J-box. 10 s cranking, 20 s cool; three cycles then 10 minutes (POH 4-28).",
  pin: true,
});
part(() => cyl(0.04, 0.1, "x"), ["engine"], {
  pos: P3(-4.5, 0, 47.5),
  color: "#1F3A5A",
  name: "Oil filter (full flow)",
  note: "Rear of the accessory case; its adapter has a bypass valve for a plugged filter or very cold oil and carries the oil temperature sensor (POH 7-34, 7-32).",
  pin: true,
});
part(() => box(0.06, 0.15, 0.2), ["engine"], {
  pos: P3(-11.4, -13, 56),
  color: "#9A6A48",
  name: "Oil cooler",
  note: "Thermostatically controlled remote cooler, arm −11.4 (POH 7-34, 6-25). In extreme cold the oil congeals in it — preheat (POH 4-49). Lateral position assumed.",
});
part(() => cyl(0.012, 0.18, "y"), ["engine"], {
  pos: P3(-14, -9, 57),
  color: "#E0B040",
  name: "Oil dipstick / filler",
  note: "Upper LEFT side of the engine case, through a door in the left-centre upper cowling (POH 7-34). Don't operate below 4 qt; fill to 9 qt for extended flight (POH 4-10).",
  pin: true,
});
// on the outside of the crankcase box (BL ±8.66, top WL 54.5): sensors at their equipment-list arms; side and height are not in the POH
part(() => box(0.03, 0.03, 0.03), ["engine"], {
  pos: P3(-12.9, 9.31, 45),
  color: "#3A9448",
  name: "Oil pressure transducer",
  note: "Connected to the engine forward oil pressure port; P165-5281, arm −12.9 → OIL PRES on the EIS (POH 7-31, 6-25). Shown at that arm on the right side of the crankcase: the side and height are approximate (not in the POH). A separate switch drives the red OIL PRESSURE annunciation.",
  pin: true,
});
part(() => box(0.025, 0.025, 0.025), ["engine"], {
  pos: P3(-10.9, 9.21, 45),
  color: "#E0263B",
  name: "Low oil pressure switch",
  note: "Independent of the transducer: OIL PRESSURE (red, continuous tone) at 0–20 PSI — shown before start (POH 7-31, 4-7). The Hobbs runs above 20 PSI (POH 7-12). The POH doesn't locate the switch: shown beside the transducer (approximate).",
});
part(() => box(0.06, 0.05, 0.06), ["engine"], {
  pos: P3(-8, 0, 55.55),
  color: "#4B5860",
  name: "Tach sensor",
  note: "Speed sensor on the engine tachometer drive accessory pad, arm −8.0: digital RPM to the GEA 71 (POH 7-29, 6-25). Shown on top of the rear accessory case between the magnetos; the pad's exact position is approximate (not in the POH).",
  pin: true,
});
part(() => box(0.04, 0.04, 0.03), ["engine"], {
  pos: P3(-1.2, 7, 58),
  color: "#3A9448",
  name: "Manifold pressure transducer",
  note: "Absolute pressure transducer → MAN IN. POH 7-29 says “between the firewall and the instrument panel” but the equipment list gives arm −8.5 (forward of the firewall): placed on the firewall here (POH 6-25).",
  pin: true,
});
// induction (POH 7-35)
part(
  () => {
    const { y, z, width, height, exponent } = COWL_INLETS.c182t[2];
    return mergeGeos([true, false].map((lip) => cowlOpeningGeo(FUSE.frontX, y, z, width, height, exponent, lip)));
  },
  ["engine"],
  {
    color: "#1E2A33",
    name: "Induction air intake",
    note: "Ram air through an intake on the lower front of the cowling, covered by the air filter (POH 7-35).",
    ext: true,
    pin: true,
  },
);
part(() => box(0.08, 0.1, 0.2), ["engine"], {
  pos: P3(-35.2, 0, 39),
  color: "#C9B98F",
  name: "Induction air filter",
  note: "P106150, arm −35.2 (POH 6-24). Check for dust preflight (POH 4-10); replace as condition warrants, 500 h maximum (POH 8-23). Ice on the filter shows as an unexplained MAP loss (POH 3-29).",
  pin: true,
});
// the air box lies between the filter and the servo, under the oil sump (bottom h 35.1): the door hangs below the sump
part(() => box(0.1, 0.07, 0.03), ["engine"], {
  pos: P3(-29, -5, 33),
  color: "#E0B040",
  anim: altDoorAnim(X(-29)),
  name: "Alternate air door",
  note: "One spring-loaded door in the air box: if the filter blocks, engine suction opens it and draws unfiltered air from the lower cowl — about 10% power loss at full throttle. No cockpit control (POH 7-35). Where it sits on the air box is not in the POH (shown below the oil sump).",
  pin: true,
});
part(() => cyl(0.05, 0.12, "x"), ["engine", "fuel"], {
  pos: P3(-22, 0, 35),
  color: "#7E8A93",
  name: "Fuel/air control unit (servo)",
  note: "Under the engine: meters fuel in proportion to induction air flow; throttle and mixture act here. An orificed fitting in its top feeds the fuel return line (POH 7-35, 7-40, 7-43).",
  pin: true,
});
CYLS.forEach((c) =>
  part(() => tubeGeo([P3(-22, 0, 36.5), P3(c.fs, c.s * 6, 40), P3(c.fs + 1, c.s * 12, 45.5)], 0.015), ["engine"], {
    color: "#8A969E",
    name: "Intake manifold tube",
    note: "From the fuel/air control unit to each cylinder's intake port (POH 7-35).",
  }),
);
// exhaust and cabin heat (POH 7-36)
[1, -1].forEach((s) => {
  part(() => cyl(0.055, 0.32, "x"), ["engine", "environment"], {
    pos: P3(-24.2, s * 9.5, 33.5),
    color: "#8A5A3C",
    name: "Muffler",
    note: "Each cylinder's riser feeds a collector on its side below the engine, then a muffler; both go overboard through a single tailpipe. LEFT and RIGHT exhaust systems, arm −24.2 (POH 7-36, 6-25). Merge point not in the POH.",
  });
  part(() => cyl(0.072, 0.22, "x"), ["environment", "engine"], {
    pos: P3(-24.2, s * 9.5, 33.5),
    color: "#E0522B",
    fairing: true,
    name: "Muffler heater shroud",
    note: "Outside air flows through a shroud around each muffler and is heated for the cabin (POH 7-36). A cracked exhaust pipe inside a shroud can put CO in the cabin (POH 3-36).",
    pin: s > 0,
  });
});
// cooling and cowl flaps (POH 7-37)
COWL_INLETS.c182t.slice(0, 2).forEach((inlet) => {
  const { y, z, width, height, exponent } = inlet;
  const s = Math.sign(z);
  part(
    () => {
      return cowlOpeningGeo(FUSE.frontX, y, z, width, height, exponent, true);
    },
    ["engine", "airframe"],
    {
      color: "#1E2A33",
      ext: true,
      pin: s > 0,
      name: "Cooling air inlet",
      note: "Two intake openings in the front of the cowling; baffling directs the air around the cylinders and it leaves through the cowl flaps at the bottom aft edge (POH 7-37).",
    },
  );
  part(
    () => {
      return cowlOpeningGeo(FUSE.frontX, y, z, width, height, exponent);
    },
    ["engine", "airframe"],
    { color: "#0B1014", ext: true },
  );
});
part(() => box(0.36, 0.02, 0.56), ["engine"], {
  pos: P3(-26, 0, 56.5),
  color: "#B8BEC4",
  name: "Cylinder baffles",
  note: "Direct ram air from above the engine down around the cylinders (POH 7-37; GFC 7-40).",
});
/** Cowl flaps: two doors at the bottom aft edge of the cowl, hinged at their forward edge (count and travel NOT IN the POH). */
export const COWL_FLAP = { fs: -9.5, h: 24.2, bl: 8, len: 7.5 * IN, base: 0.2, open: 0.35 };
[1, -1].forEach((s) =>
  part(
    () => {
      const g = box(COWL_FLAP.len, 0.006, 9 * IN);
      g.translate(-COWL_FLAP.len / 2, 0, 0);
      return g;
    },
    ["engine"],
    {
      parent: "cowlFlap:" + (s > 0 ? "R" : "L"),
      color: "#D6DCE0",
      ext: true,
      pin: s > 0,
      name: "Cowl flap",
      note: "Mechanically operated from the cowl flap lever on the right side of the pedestal: OPEN for start, takeoff, climb and ground runs; CLOSED in cruise unless needed to hold CHT near two-thirds of the green arc; closed in long descents (POH 7-37, 4-12 – 4-24). Door count and angles are not in the POH (two doors modelled).",
    },
  ),
);
// engine mount
[1, -1].forEach((s) =>
  [1, -1].forEach((u) =>
    part(() => tubeGeo([P3(-0.5, s * 14, 48 + u * 10), P3(-10, s * 9, 47 + u * 4.5)], 0.009), ["engine", "airframe"], {
      color: "#5C6E7E",
      name: "Engine mount",
      note: "Welded tube mount bolted to the firewall at the four engine mount stringers (POH 7-5).",
      pin: s > 0 && u > 0,
    }),
  ),
);
// engine controls on the lower centre panel, left to right: throttle, propeller, mixture (Fig 7-2 items 31, 24, 23; GFC 7-29)
export const KNOB = { fs: 18.2, h: 43.2 };
part(() => cyl(0.016, 0.03, "x"), ["engine"], {
  pos: P3(KNOB.fs, -1.8, KNOB.h),
  color: "#1A1F23",
  anim: pushPull(X(KNOB.fs), () => S().eng.throttle),
  name: "Throttle (with friction lock)",
  note: "Smooth black knob at the centre of the panel below the radios: forward = open (MAP up), aft = closed. Friction lock at its base: clockwise to increase (POH 7-27).",
  pin: true,
});
part(
  () => {
    const g = new THREE.CylinderGeometry(0.016, 0.016, 0.03, 10);
    g.rotateZ(Math.PI / 2);
    return g;
  },
  ["engine", "propeller"],
  {
    pos: P3(KNOB.fs, 2.0, KNOB.h),
    color: "#2F64C8",
    anim: pushPull(X(KNOB.fs), () => S().eng.prop),
    name: "PROPELLER control (blue)",
    note: "Fluted blue knob right of the throttle, “PROPELLER, PUSH INCR RPM”: in = low pitch / high RPM, out = high pitch / low RPM. Rotate for fine adjustment; press the button on the end for large moves (POH 7-27, 7-38).",
    pin: true,
  },
);
part(() => cyl(0.016, 0.03, "x"), ["engine"], {
  pos: P3(KNOB.fs, 5.8, KNOB.h),
  color: "#C8313B",
  anim: pushPull(X(KNOB.fs), () => S().eng.mix),
  name: "Mixture (red, vernier)",
  note: "Red knob with raised points and a lock button: in = RICH, out = IDLE CUTOFF; rotate for fine adjustment (POH 7-28). Use FULL RICH above 80% power (POH 4-37).",
  pin: true,
});
part(() => cyl(0.016, 0.01, "x"), ["engine", "electrical"], { pos: P3(18.0, -19.4, 50.4), color: "#3E4A52" });
part(() => box(0.012, 0.032, 0.009), ["engine", "electrical"], {
  pos: P3(18.3, -19.4, 50.4),
  color: "#C9D0D5",
  anim: (m) => {
    const k = S().eng.mags;
    m.rotation.x = ({ OFF: -1, R: -0.5, L: 0, BOTH: 0.5, START: 1 } as const)[k];
  },
  name: "MAGNETOS switch",
  note: "Keyed rotary switch on the left switch and control panel (Fig 7-2 item 41): OFF – R – L – BOTH – START, spring-loaded from START back to BOTH (POH 7-35). The starter relay coil is fed through the WARN breaker.",
  pin: true,
});
