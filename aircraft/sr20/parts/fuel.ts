/** Fuel system hardware (the tanks are rendered separately). */
import { V, toVec3 } from "@/lib/math";
import { box, cyl, sph, wingP } from "../geometry";
import { part } from "./catalogue";

/* ---------- fuel system hardware (tanks are rendered separately) ---------- */
[1, -1].forEach((s) => {
  part(() => box(0.2, 0.07, 0.16), ["fuel"], {
    pos: toVec3(wingP(s * 0.72, 0.45, 0)),
    name: (s > 0 ? "Right" : "Left") + " collector tank / sump",
    note: "Tank fuel gravity-feeds through strainers and a flapper valve into the collector. Flush drain.",
  });
  part(() => box(0.08, 0.012, 0.12), ["fuel"], {
    pos: toVec3(wingP(s * 5.1, 0.45, -1).add(V(0, -0.006, 0))),
    color: "#2F7FE6",
    name: "NACA fuel vent",
    note: "Under the wing near the tip. A blocked vent starves the engine — check it preflight.",
    ext: true,
  });
  part(() => sph(0.025), ["fuel"], {
    pos: toVec3(wingP(s * 1.3, 0.3, -1)),
    color: "#0B3A80",
    name: "Tank drain",
    note: "One of 5 drains: 2 tank, 2 collector, 1 gascolator. Sample before every flight.",
    ext: true,
  });
  part(() => cyl(0.045, 0.012), ["fuel"], {
    pos: toVec3(wingP(s * 2.7, 0.38, 1)),
    color: "#2F7FE6",
    name: "Filler cap",
    note: "Top of each wing. Filling to the tab = 13 gal usable per side.",
    ext: true,
  });
});
part(() => box(0.1, 0.08, 0.1), ["fuel"], {
  pos: [1.66, -0.62, 0.1],
  name: "Electric boost pump",
  note: "Single-speed, continuous 23 psi boost for priming, vapor suppression and backup. 5 A FUEL PUMP, MAIN BUS 2.",
  pin: true,
});
part(() => cyl(0.045, 0.1), ["fuel"], {
  pos: [2.7, -0.52, 0.08],
  name: "Gascolator",
  note: "Filter/sump at the low point ahead of the firewall. Drain preflight.",
  pin: true,
});
part(() => cyl(0.045, 0.09, "x"), ["fuel", "engine"], {
  pos: [2.8, -0.3, 0.12],
  name: "Engine-driven fuel pump",
  note: "Draws fuel from the selected collector and pressure-feeds the servo.",
});
part(() => box(0.07, 0.05, 0.07), ["fuel", "engine"], {
  pos: [3.1, 0, 0],
  name: "Flow divider (“the spider”) + FF transducer",
  note: "Top of the engine. Distributes metered fuel to four injector nozzles; fuel flow is measured just upstream.",
  pin: true,
});
