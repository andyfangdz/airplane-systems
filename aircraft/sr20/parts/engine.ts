/**
 * Propeller and engine (IO-390): cylinders, plugs, magnetos, governor, oil, induction, exhaust and heat muff, alternators,
 * starter.
 */
import * as THREE from "three";
import type { Vec3 } from "@/lib/math";
import { magAnim, plugAnim, sparkPhase } from "@/lib/anims";
import { box, cyl } from "../geometry";
import { part, fires, altAnim, altDoorAnim } from "./catalogue";

/* ---------- propeller (74 in., 3 blade) ---------- */
export const PROP: Vec3 = [3.8, -0.14, 0];
const bladeGeo = () => {
  const sh = new THREE.Shape();
  sh.moveTo(-0.06, 0.12);
  sh.quadraticCurveTo(-0.09, 0.5, -0.045, 0.94);
  sh.lineTo(0.03, 0.94);
  sh.quadraticCurveTo(0.075, 0.5, 0.06, 0.12);
  sh.lineTo(-0.06, 0.12);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.018, bevelEnabled: false });
  g.translate(0, 0, -0.009);
  g.rotateY(Math.PI / 2);
  return g;
};
for (let i = 0; i < 3; i++)
  part(bladeGeo, ["propeller", "engine"], {
    parent: "blade:" + i,
    color: "#3A4148",
    name: "Propeller blade",
    note: "Hartzell three-blade, 74 in. constant-speed. Metal standard, composite optional.",
    ext: true,
  });

/* ---------- engine (IO-390, ~0.87 m wide, inside the cowl) ---------- */
const EY = -0.16;
part(() => box(0.78, 0.26, 0.26), ["engine"], {
  pos: [3.14, EY, 0],
  name: "Lycoming IO-390-C3B6",
  note: "Four-cylinder, horizontally opposed, fuel-injected. 215 hp at 2,700 RPM; 2,200 hr TBO.",
  pin: true,
});
part(() => box(0.55, 0.12, 0.26), ["engine"], {
  pos: [3.08, -0.38, 0],
  name: "Oil sump",
  note: "Wet sump, 7 quart capacity. Filler cap/dipstick at right rear via cowl door.",
});
export const CYLS = [
  { n: 1, x: 3.36, s: 1 },
  { n: 2, x: 3.22, s: -1 },
  { n: 3, x: 2.99, s: 1 },
  { n: 4, x: 2.85, s: -1 },
];
CYLS.forEach((c) => {
  const parent = "cyl:" + c.n;
  part(() => cyl(0.085, 0.2, "z", 18), ["engine"], {
    parent,
    color: "#7C858C",
    name: "Cylinder " + c.n,
    note: (c.s > 0 ? "Right" : "Left") + " bank. Cooling fins; baffled ram-air cooling (no cowl flaps).",
  });
  for (let k = -2; k <= 2; k++)
    part(() => cyl(0.1, 0.01, "z", 18), ["engine"], { parent, pos: [0, 0, k * 0.035], color: "#8C959C" });
  part(() => box(0.19, 0.19, 0.07), ["engine"], {
    parent,
    pos: [0, 0, c.s * 0.13],
    color: "#6A737A",
    name: "Cylinder head " + c.n,
    note: "Two spark plugs, CHT probe; EGT probe in the exhaust.",
  });
  (
    [
      ["U", 0.065],
      ["L", -0.065],
    ] as const
  ).forEach(([pos, dy]) => {
    const mag = c.s > 0 === (pos === "L") ? "R" : "L";
    part(() => cyl(0.017, 0.06, "x", 10), ["engine"], {
      parent,
      pos: [-0.12, dy, c.s * 0.13],
      color: "#DADFE2",
      anim: plugAnim(fires(mag), sparkPhase(`${c.n}${pos}`)),
      name: `Spark plug — cyl ${c.n} ${pos === "U" ? "upper" : "lower"}`,
      note: `Fired by the ${mag === "R" ? "right" : "left"} magneto.`,
    });
  });
});
part(() => cyl(0.05, 0.13, "x"), ["engine"], {
  pos: [2.72, -0.04, 0.11],
  color: "#3E4A52",
  anim: magAnim(fires("R")),
  name: "Right magneto",
  note: "Fires lower-right and upper-left plugs. Also the tachometer's RPM pickup.",
  pin: true,
});
part(() => cyl(0.05, 0.13, "x"), ["engine"], {
  pos: [2.72, -0.04, -0.11],
  color: "#3E4A52",
  anim: magAnim(fires("L")),
  name: "Left magneto",
  note: "Fires lower-left and upper-right plugs.",
  pin: true,
});
part(() => box(0.1, 0.09, 0.12), ["engine", "propeller"], {
  pos: [3.55, -0.06, 0],
  color: "#C0602F",
  name: "Propeller governor",
  note: "Flyweights sense RPM; a cable from the power lever sets the target. Boosts engine oil pressure to move blade pitch.",
  pin: true,
});
part(() => box(0.08, 0.16, 0.12), ["engine"], {
  pos: [3.36, -0.1, -0.35],
  color: "#9A6A48",
  name: "Oil cooler",
  note: "Remote-mounted. Valve bypasses it below 170 °F or above an 18 psi pressure drop.",
});
part(() => box(0.1, 0.12, 0.14), ["engine"], {
  pos: [3.58, -0.15, 0.2],
  color: "#C9B98F",
  name: "Induction air filter",
  note: "Paper filter screen just inside the right cowl inlet. (Costanzo deck)",
  pin: true,
});
export const OIL_FILTER: Vec3 = [2.83, -0.02, 0.21];
part(() => cyl(0.045, 0.11, "x"), ["engine"], {
  pos: OIL_FILTER,
  color: "#1F3A5A",
  name: "Oil filter (full-flow)",
  note: "Spin-on filter at the accessory case, next to the magnetos. (Costanzo deck) Case dimensions and mounting coordinates are approximate.",
  pin: true,
});
// under the front of the engine, just forward of the oil sump (x ≤ 3.355) and above the cowl bottom; clear of ALT 1 / ALT 2 (|z| ≥ 0.15)
part(() => cyl(0.055, 0.14, "x"), ["engine", "fuel"], {
  pos: [3.43, -0.435, 0],
  color: "#7E8A93",
  name: "Throttle body / fuel servo",
  note: "The power lever's cable works the air throttle body on the fuel servo: its butterfly meters air, and the servo meters fuel in proportion to airflow and mixture (POH 7-36). The MAP sensor is on the bottom of the induction air manifold near the throttle body (POH 7-41). The POH doesn't locate the servo: shown under the front of the engine (approximate).",
  pin: true,
});
part(() => box(0.03, 0.08, 0.1), ["engine"], {
  pos: [3.514, -0.15, 0.2],
  color: "#E0B040",
  anim: altDoorAnim(3.514),
  name: "Alternate air door",
  note: "On the engine induction air manifold (POH Section 7, Alternate Air Control); shown on its face just aft of the filter, above ALT 1 — the exact position is approximate. The ALT AIR – PULL knob opens it: bypasses the filter with warm, unfiltered air.",
});
/** Representative exhaust assembly, outboard of the sump; exact mounting coordinates are not documented. */
export const MUFFLER: Vec3 = [3.04, -0.44, 0.285];
part(() => cyl(0.06, 0.28, "z"), ["engine", "environment"], {
  pos: MUFFLER,
  color: "#8A5A3C",
  name: "Muffler",
  note: "Single muffler; exhaust exits through the lower cowl. Placed on the right with the heat muff and mixing chamber per the POH environmental section and the Costanzo deck photo (the POH engine paragraph says left). Size and mounting coordinates are approximate.",
});
part(() => cyl(0.08, 0.2, "z"), ["environment", "engine"], {
  pos: MUFFLER,
  color: "#E0522B",
  fairing: true,
  name: "Heat exchanger (muff)",
  note: "Shroud around the muffler; heats ram air for the cabin.",
});
part(() => cyl(0.07, 0.12, "x"), ["electrical", "engine"], {
  pos: [3.5, -0.3, 0.22],
  color: "#D9960F",
  anim: altAnim("alt1"),
  name: "ALT 1 — 100 A",
  note: "Belt-driven, right front. Regulated to 27.7 V. Feeds Main Distribution Bus 1.",
  pin: true,
});
part(() => cyl(0.06, 0.11, "x"), ["electrical", "engine"], {
  pos: [3.5, -0.3, -0.22],
  color: "#D9960F",
  anim: altAnim("alt2"),
  name: "ALT 2 — 70 A",
  note: "Belt-driven, left front. Regulated to 28.7 V, so it carries the loads it shares with ALT 1.",
  pin: true,
});
part(() => box(0.1, 0.12, 0.14), ["engine"], {
  pos: [2.74, -0.24, 0],
  color: "#4B5860",
  name: "Starter / SlickSTART",
  note: "START energizes the starter and SlickSTART booster (retards timing, hotter spark). Spring-returns to BOTH.",
});
