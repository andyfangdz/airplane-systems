/** M20C electrical: battery, master relay, alternator and regulator, switch-breaker row, breaker panel, radios; antennas (not original). */

import { FW, PANEL_X, box, botY, cyl, topY } from "../geometry";

import { glow, part, sim } from "./catalogue";

/* ---------- electrical ---------- */
part(() => box(0.18, 0.18, 0.14), ["electrical"], {
  pos: [FW + 0.25, -0.2, -0.36],
  color: "#D9960F",
  name: "Battery — 12 V, 35 Ah",
  note: "On the forward left side of the firewall (TCDS arm +2.5 in), reached through the access panel in the left cowling (OM p. 3, 26). Check fluid every 25 h or 30 days.",
  pin: true,
});
part(() => box(0.06, 0.05, 0.06), ["electrical"], {
  pos: [FW + 0.25, -0.08, -0.3],
  color: "#6E5A2A",
  anim: glow("#6E5A2A", "#FFD24A", () => sim().s.elec.master, ["electrical"]),
  name: "Master relay (at the battery)",
  note: "The master switch on the left of the flight panel actuates a relay located at the battery; it turns off every electrical accessory — but the engine's magnetos keep it running (OM p. 3).",
  pin: true,
});
part(() => box(0.08, 0.06, 0.04), ["electrical"], {
  pos: [FW + 0.12, 0.15, -0.3],
  color: "#5A5040",
  name: "Voltage regulator",
  note: "On the firewall (TCDS arm +7 in): adjusts the alternator field to hold 14 V as the load changes. Over-voltage: radios off, master off and on to reset; if it recurs, pull ALT FIELD (Ranger 2-15).",
  pin: true,
});
part(() => box(0.02, 0.045, 0.018), ["electrical"], {
  pos: [PANEL_X - 0.03, 0.0, -0.58],
  color: "#B53A3A",
  anim: (m) => {
    m.rotation.z = sim().s.elec.master ? -0.35 : 0.35;
  },
  name: "Master switch",
  note: "Left-hand side of the flight panel (OM p. 3). With it ON for the start the green gear light, the Low Vacuum light and the electric turn and bank come alive (OM p. 15).",
  pin: true,
});
part(() => box(0.02, 0.045, 0.14), ["electrical", "lighting"], {
  pos: [PANEL_X - 0.03, -0.22, -0.46],
  color: "#3F4B54",
  name: "Switch-breakers (lower left panel)",
  note: "Seven toggle switches that are also breakers: fuel pump, two optional, pitot heat, rotating beacon, navigation lights, landing light. An overload flips the switch off (OM p. 4).",
  pin: true,
});
part(() => box(0.02, 0.1, 0.12), ["electrical"], {
  pos: [PANEL_X - 0.03, -0.15, 0.45],
  color: "#3A3F44",
  name: "Push-to-reset breaker panel",
  note: "Lower right of the co-pilot's panel, under a special cover: push-to-reset breakers for the radios, instruments and warning circuits (OM p. 4). Names in the Electrical panel are inferred from the Ranger schematic.",
  pin: true,
});
part(() => box(0.1, 0.08, 0.3), ["electrical", "cabin"], {
  pos: [PANEL_X - 0.04, -0.03, 0.05],
  color: "#1B1F23",
  name: "Radios (centre stack)",
  note: "Nav/com radios in the centre panel, cooled by the firewall grill and the left-scoop tubes (OM p. 11). Not original to 1967 — whatever N6947N carries today.",
  pin: true,
  pinIn: ["electrical"],
});
part(() => box(0.02, 0.03, 0.03), ["electrical", "lighting"], {
  pos: [PANEL_X + 0.1, -0.4, -0.3],
  color: "#B85A2A",
  name: "Fuel selector light",
  note: "Small light under the panel on the left lights the selector; rotate the lens housing to dim (OM p. 3).",
  pin: true,
  pinIn: ["lighting"],
});

/* ---------- antennas (not original — placed from N6947N photos) ---------- */
const ANT = "#C8399F";
part(
  () => {
    const g = cyl(0.005, 0.35);
    g.rotateZ(0.4);
    return g;
  },
  ["electrical"],
  {
    pos: [-0.55, topY(-0.55) + 0.16, 0],
    color: ANT,
    name: "COM antenna",
    note: "Whip on the aft cabin roof (photos).",
    ext: true,
  },
);
part(() => box(0.08, 0.06, 0.01), ["electrical"], {
  pos: [0.4, botY(0.4) - 0.03, 0.1],
  color: ANT,
  name: "Transponder antenna",
  note: "Blade under the belly (photos).",
  ext: true,
});
