/** M20C heating and ventilation: junction box, scoops, overhead scoop and ceiling outlets, defroster, foot outlets, radio grill, controls. */

import { FW, PANEL_X, box, cyl, onSkin, sph } from "../geometry";
import { OVERHEAD_OUTLETS, ROOF_SCOOP, scoopAngle } from "../placement";

import { P, knobAnim, part, sim } from "./catalogue";

/* ---------- heating & ventilation ---------- */
part(() => box(0.14, 0.14, 0.12), ["environment"], {
  id: "parts.environment.heat-vent-junction-box.001",
  pos: [FW - 0.1, -0.3, 0.35],
  color: "#E0522B",
  name: "Heat / vent junction box",
  note: "On the aft side of the firewall, co-pilot's side: hot air from the muff and cool air from the right flush scoop are mixed here by their two controls, then ducted to the pilots' feet, the defroster, the rear seats and the baggage compartment (OM p. 10–11).",
  pin: true,
});
part(() => box(0.16, 0.04, 0.014), ["environment"], {
  id: "parts.environment.right-flush-air-scoop.002",
  pos: P(onSkin(1.85, -0.1, 1, 0.985)),
  color: "#149C94",
  name: "Right flush air scoop",
  note: "Flush scoop on the right side feeds cool air to the junction box and the radio-vent grill on the firewall (OM p. 10–11). CABIN VENT control.",
  ext: true,
  pin: true,
});
part(() => box(0.12, 0.04, 0.014), ["environment"], {
  id: "parts.environment.left-side-air-scoop.003",
  pos: P(onSkin(1.5, -0.2, -1, 0.985)),
  color: "#149C94",
  name: "Left side air scoop",
  note: "One adjustable eyeball outlet near the pilot's knee plus two outlets behind the upholstery for radio cooling (OM p. 11). Not on 1962–64 airplanes.",
  ext: true,
  pin: true,
});
part(
  () => box(ROOF_SCOOP.length, ROOF_SCOOP.thickness, ROOF_SCOOP.width).translate(ROOF_SCOOP.length / 2, 0, 0),
  ["environment"],
  {
    id: "parts.environment.overhead-ram-air-scoop-retractable.004",
    pos: ROOF_SCOOP.hinge,
    rot: [0, 0, scoopAngle(0)],
    color: "#149C94",
    anim: (m) => {
      m.rotation.z = scoopAngle(sim().s.env.scoop);
    },
    name: "Overhead ram-air scoop (retractable)",
    note: "Retractable scoop on top of the cabin feeding four individually controlled ceiling outlets; the knob above the pilot turns counter-clockwise to extend it — only as far as needed, for drag (OM p. 11). Hinge position and opening travel are schematic.",
    ext: true,
    pin: true,
  },
);
OVERHEAD_OUTLETS.forEach(({ id: outletId, pos }, i) =>
  part(() => sph(0.022), ["environment"], {
    id: "parts.environment.ceiling-outlet.005",
    instance: [outletId],
    pos,
    color: "#149C94",
    name: "Ceiling outlet",
    note: "Four individually controlled ceiling outlets: inner knob for volume, rotate to aim (OM p. 11).",
    pin: i === 0,
  }),
);
part(() => box(0.04, 0.012, 0.5), ["environment"], {
  id: "parts.environment.windshield-defroster-outlets.006",
  pos: [PANEL_X + 0.12, 0.25, 0],
  color: "#149C94",
  name: "Windshield defroster outlets",
  note: "Fed from the junction box; with the pilot deflectors off, all the air goes to the defrosters and the aft outlets (OM p. 11).",
  pin: true,
});
(
  [
    ["member-1", [-0.3, "Pilot's foot outlet"]],
    ["member-2", [0.3, "Co-pilot's foot outlet"]],
  ] as const
).forEach(([instance1, [z, name]]) =>
  part(() => box(0.06, 0.04, 0.08), ["environment"], {
    id: "parts.environment.part.007",
    instance: [instance1],

    pos: [1.72, -0.56, z as number],
    color: "#149C94",
    name: name as string,
    note: "Deflectors direct the flow or act as volume controls (OM p. 11).",
    pin: (z as number) < 0,
  }),
);
part(() => box(0.1, 0.06, 0.12), ["environment", "electrical"], {
  id: "parts.environment.radio-cooling-grill.008",
  pos: [FW - 0.05, 0.05, 0.0],
  color: "#149C94",
  name: "Radio cooling grill",
  note: "Firewall-mounted grill directly forward of the centre radio panel, fed by the right scoop; valve near the scoop for cold weather (OM p. 11).",
  pin: true,
});
(
  [
    ["cabin-heat-control", ["Cabin heat control", 0.2, () => sim().s.env.heat] as [string, number, () => number]],
    ["cabin-vent-control", ["Cabin vent control", 0.26, () => sim().s.env.vent] as [string, number, () => number]],
  ] as const
).forEach(([instance2, [name, z, v]]) =>
  part(() => cyl(0.012, 0.03, "x", 14), ["environment"], {
    id: "parts.environment.part.009",
    instance: [instance2],

    pos: [PANEL_X - 0.02, -0.25, z],
    color: "#1B1F23",
    anim: knobAnim(PANEL_X - 0.02, v, 0.05),
    name,
    note: "Push-pull controls under the panel on the co-pilot's side mix warm and cool air at the junction box (OM p. 10–11). Engine fire: cabin heat OFF.",
    pin: true,
  }),
);
