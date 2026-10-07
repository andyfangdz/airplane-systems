/** Environmental system: fresh-air inlet, mixing chamber, distribution manifold, A/C evaporator. */
import { box } from "../geometry";
import { part } from "./catalogue";

/* ---------- environmental ---------- */
part(() => box(0.1, 0.03, 0.02), ["environment"], {
  pos: [3.42, -0.38, 0.49],
  name: "NACA fresh-air inlet",
  note: "Lower right cowl. Ram air for ventilation and the heat muff.",
  pin: true,
  ext: true,
});
part(() => box(0.1, 0.12, 0.14), ["environment"], {
  pos: [2.54, -0.46, 0.3],
  name: "Mixing chamber",
  note: "Lower right firewall. Hot-air and fresh-air valves on the forward side set the blend.",
  pin: true,
});
// above the aileron push rod (y −0.2) and the central pulley sector below it; must match E0 in flows.ts
part(() => box(0.08, 0.12, 0.28), ["environment"], {
  pos: [2.52, -0.1, 0],
  name: "Distribution manifold + fan",
  note: "Mounted to the center, aft side of the firewall (POH 7-69, 7-70); its height on the firewall is approximate. Butterfly valves feed floor and defrost; the panel vents are always fed. Blower: OFF (ram air), 1, 2, 3.",
  pin: true,
});
part(() => box(0.2, 0.07, 0.2), ["environment"], {
  pos: [1.25, -0.58, 0.33],
  color: "#6EC9E6",
  name: "A/C evaporator (optional)",
  note: "Under the front passenger seat. Condensate drains overboard through the belly.",
});
