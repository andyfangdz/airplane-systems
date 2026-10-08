/** M20C fuel system: fillers, drains, senders, vents, selector valve with its drain ring, boost pump and switch. */
import * as THREE from "three";

import { V, type Vec3 } from "@/lib/math";

import { PANEL_X, box, cyl, sph, wingP } from "../geometry";

import { P, glow, part, sim } from "./catalogue";
import { EQUIPMENT } from "../placement";

/* ---------- fuel system ---------- */
[1, -1].forEach((s) => {
  const nm = s > 0 ? "Right" : "Left";
  part(() => cyl(0.04, 0.012), ["fuel"], {
    pos: P(wingP(s * 1.6, 0.22, 1).add(V(0, 0.005, 0))),
    color: "#2F7FE6",
    name: nm + " fuel filler cap",
    note: "On top of the wing over each 26 gal integral bay (OM p. 3). Fuel 91/98 min — today 100LL.",
    ext: true,
    pin: s > 0,
  });
  part(() => sph(0.02), ["fuel"], {
    pos: P(wingP(s * 0.85, 0.3, -1)),
    color: "#0B3A80",
    name: nm + " tank sump drain",
    note: "Under the wing near the root, forward of the wheel well: press the sampler cup's prong up into it to drain (OM p. 3; Ranger 7-5). Water settles under the blue fuel.",
    ext: true,
    pin: s > 0,
  });
  part(() => box(0.04, 0.03, 0.08), ["fuel", "electrical"], {
    pos: P(wingP(s * 1.3, 0.2, 0)),
    color: "#2F7FE6",
    name: nm + " fuel quantity sender",
    note: "Electric float transmitter in the tank driving the fuel gauge in the engine cluster; powered through the master switch (Ranger 2-5; OM p. 3 list).",
    pin: s > 0,
  });
  part(() => cyl(0.007, 0.05), ["fuel"], {
    pos: P(wingP(s * 2.4, 0.3, -1).add(V(0, -0.02, 0))),
    color: "#2F7FE6",
    name: "Tank overflow vent",
    note: "Overflow vents in each tank allow overflow and ventilation as fuel is used (OM p. 26). Check unobstructed on the walk-around (Ranger 3-4).",
    ext: true,
    pin: s > 0,
  });
});
export const SEL: Vec3 = [1.35, -0.63, -0.3];
part(() => cyl(0.045, 0.02, "y"), ["fuel"], {
  pos: SEL,
  name: "Fuel selector valve",
  note: "Two-way positive-setting selector on the floor ahead of the pilot's seat: LEFT, RIGHT or OFF — no BOTH (OM p. 3). Its sump drain is worked by the pull ring beside the handle (drain each tank before the first flight).",
  pin: true,
});
part(() => box(0.08, 0.012, 0.016), ["fuel"], {
  pos: [SEL[0], SEL[1] + 0.016, SEL[2]],
  color: "#F2F5F7",
  anim: (m) => {
    const sel = sim().s.fuel.sel;
    m.rotation.y = sel === "L" ? Math.PI * 0.75 : sel === "R" ? Math.PI * 0.25 : -Math.PI * 0.25;
  },
});
part(
  () => {
    const g = new THREE.TorusGeometry(0.015, 0.003, 6, 14);
    g.rotateX(Math.PI / 2);
    return g;
  },
  ["fuel"],
  {
    pos: [SEL[0] + 0.07, SEL[1] + 0.01, SEL[2]],
    color: "#9AA3AA",
    name: "Selector sump drain ring",
    note: "Pull the ring with the selector on each tank in turn to flush the selector sump and the lines; be sure it returns to closed (OM p. 3, 15).",
    pin: true,
  },
);
part(() => box(0.08, 0.07, 0.07), ["fuel", "electrical"], {
  pos: EQUIPMENT.boost,
  color: "#2F7FE6",
  anim: glow("#245C9E", "#7FB8FF", () => sim().E.fuelPump, ["fuel", "electrical"]),
  name: "Electric boost pump",
  note: "Under the floor just behind the firewall (TCDS arm +19 in), in the line between the selector and the engine-driven pump: on for take-off and landing to keep pressure if the engine pump fails, and for priming (OM p. 3, 15). FUEL PUMP switch-breaker.",
  pin: true,
});
part(() => box(0.02, 0.045, 0.018), ["fuel", "electrical"], {
  pos: [PANEL_X - 0.03, -0.22, -0.56],
  color: "#3F4B54",
  anim: (m) => {
    m.rotation.z = sim().s.sw.fuelPump ? -0.35 : 0.35;
  },
  pinIn: ["fuel"],
  name: "FUEL PUMP switch-breaker",
  note: "Leftmost of the switch-breakers on the lower left panel (OM p. 4).",
  pin: true,
});
