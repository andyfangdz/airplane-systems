/** M20C heating and ventilation: junction box, scoops, overhead scoop and ceiling outlets, defroster, foot outlets, radio grill, controls. */

import { FW, PANEL_X, box, cyl, onSkin, sph, topY } from "../geometry";

import { P, knobAnim, part, sim } from "./catalogue";

/* ---------- heating & ventilation ---------- */
part(() => box(0.14, 0.14, 0.12), ["environment"], {
  pos: [FW - 0.1, -0.3, 0.35],
  color: "#E0522B",
  name: "Heat / vent junction box",
  note: "On the aft side of the firewall, co-pilot's side: hot air from the muff and cool air from the right flush scoop are mixed here by their two controls, then ducted to the pilots' feet, the defroster, the rear seats and the baggage compartment (OM p. 10–11).",
  pin: true,
});
part(() => box(0.16, 0.04, 0.014), ["environment"], {
  pos: P(onSkin(1.85, -0.1, 1, 0.985)),
  color: "#149C94",
  name: "Right flush air scoop",
  note: "Flush scoop on the right side feeds cool air to the junction box and the radio-vent grill on the firewall (OM p. 10–11). CABIN VENT control.",
  ext: true,
  pin: true,
});
part(() => box(0.12, 0.04, 0.014), ["environment"], {
  pos: P(onSkin(1.5, -0.2, -1, 0.985)),
  color: "#149C94",
  name: "Left side air scoop",
  note: "One adjustable eyeball outlet near the pilot's knee plus two outlets behind the upholstery for radio cooling (OM p. 11). Not on 1962–64 airplanes.",
  ext: true,
  pin: true,
});
part(() => box(0.14, 0.025, 0.1), ["environment"], {
  pos: [0.2, topY(0.2) - 0.005, 0],
  color: "#149C94",
  anim: (m) => {
    m.position.y = topY(0.2) - 0.012 + sim().s.env.scoop * 0.035;
  },
  name: "Overhead ram-air scoop (retractable)",
  note: "Retractable scoop on top of the cabin feeding four individually controlled ceiling outlets; the knob above the pilot turns counter-clockwise to extend it — only as far as needed, for drag (OM p. 11).",
  ext: true,
  pin: true,
});
[
  [0.3, 0.3, -0.2],
  [0.3, 0.3, 0.2],
  [0.95, 0.3, -0.25],
  [0.95, 0.3, 0.25],
].forEach(([x, dy, z], i) =>
  part(() => sph(0.022), ["environment"], {
    pos: [x, topY(x) - dy + 0.12, z],
    color: "#149C94",
    name: "Ceiling outlet",
    note: "Four individually controlled ceiling outlets: inner knob for volume, rotate to aim (OM p. 11).",
    pin: i === 0,
  }),
);
part(() => box(0.04, 0.012, 0.5), ["environment"], {
  pos: [PANEL_X + 0.12, 0.25, 0],
  color: "#149C94",
  name: "Windshield defroster outlets",
  note: "Fed from the junction box; with the pilot deflectors off, all the air goes to the defrosters and the aft outlets (OM p. 11).",
  pin: true,
});
[
  [-0.3, "Pilot's foot outlet"],
  [0.3, "Co-pilot's foot outlet"],
].forEach(([z, name]) =>
  part(() => box(0.06, 0.04, 0.08), ["environment"], {
    pos: [1.72, -0.56, z as number],
    color: "#149C94",
    name: name as string,
    note: "Deflectors direct the flow or act as volume controls (OM p. 11).",
    pin: (z as number) < 0,
  }),
);
part(() => box(0.1, 0.06, 0.12), ["environment", "electrical"], {
  pos: [FW - 0.05, 0.05, 0.0],
  color: "#149C94",
  name: "Radio cooling grill",
  note: "Firewall-mounted grill directly forward of the centre radio panel, fed by the right scoop; valve near the scoop for cold weather (OM p. 11).",
  pin: true,
});
(
  [
    ["Cabin heat control", 0.2, () => sim().s.env.heat],
    ["Cabin vent control", 0.26, () => sim().s.env.vent],
  ] as [string, number, () => number][]
).forEach(([name, z, v]) =>
  part(() => cyl(0.012, 0.03, "x", 14), ["environment"], {
    pos: [PANEL_X - 0.02, -0.25, z],
    color: "#1B1F23",
    anim: knobAnim(PANEL_X - 0.02, v, 0.05),
    name,
    note: "Push-pull controls under the panel on the co-pilot's side mix warm and cool air at the junction box (OM p. 10–11). Engine fire: cabin heat OFF.",
    pin: true,
  }),
);
