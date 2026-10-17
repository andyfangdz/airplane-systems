/** M20C landing gear: manual Johnson bar and its sockets, torque tube, mains and nose gear with rubber discs, brakes, lights and horn. */

import { V, type Vec3 } from "@/lib/math";

import { FW, PANEL_X, box, cyl, sph, tubeGeo, wingP } from "../geometry";
import { gearHorn, gearLights, live } from "../model";
import { JBAR, PEDALS, PEDAL_STATIONS, johnsonTip } from "../rig";
import { GEAR_BUNGEE, MG, NG, NOSE_WELL, mainAxle, mainWellGeo, noseDoorGeo } from "../placement";
export { MG, NG } from "../placement";
import { brake, glow, knobAnim, part, sim } from "./catalogue";

/* ---------- landing gear: manual Johnson bar, rubber shock discs ---------- */
[1, -1].forEach((s) => {
  const parent = s > 0 ? "mainR" : "mainL",
    nm = s > 0 ? "Right" : "Left",
    axle = mainAxle(s);
  // Near-vertical leg from the spar trunnion to the dimensioned ground axle.
  part(() => tubeGeo([[0, 0, 0], [axle[0] * 0.35, axle[1] * 0.35, axle[2] * 0.35], axle], 0.03, 0.2), ["gear"], {
    instance: [s, parent],
    id: "parts.gear.part.001",
    parent,
    color: "#6E7A84",
    name: nm + " main gear leg",
    note: "Welded steel-tube gear structure on a trunnion immediately aft of the main spar; retracts inboard into the wing well by direct mechanical linkage from the cabin lever (OM p. 6). Track and wheelbase follow the three-view; the trunnion mounting offset, leg recess and folding linkage are schematic fits, not maintenance rigging dimensions.",
    ext: true,
    pin: s > 0,
  });
  (
    [
      ["member-1", 0.32],
      ["member-2", 0.4],
      ["member-3", 0.48],
      ["member-4", 0.56],
    ] as const
  ).forEach(([instance1, t], i) =>
    part(() => cyl(0.05, 0.03, "y", 16), ["gear"], {
      id: "parts.gear.rubber-shock-discs.002",
      instance: [instance1, s, parent],
      parent,
      pos: [axle[0] * t, axle[1] * t, axle[2] * t],
      rot: [0, 0, -Math.atan2(axle[0], -axle[1])],
      color: "#1E2226",
      name: "Rubber shock discs",
      note: "Stacks of rubber discs are the only shock absorption — no oleos (OM p. 6). Aged discs sag and let the airplane sit low; check them on every walk-around (Ranger 3-3).",
      ext: true,
      pin: s > 0 && i === 0,
    }),
  );
  part(() => cyl(MG.r, MG.width, "z", 28), ["gear"], {
    instance: [s, parent],
    id: "parts.gear.part.003",
    parent,
    pos: axle,
    color: "#2A2F33",
    name: nm + " main wheel",
    note: "6.00 × 6 tyre, 30 psi (Ranger 1-4; OM p. 27).",
    ext: true,
    pin: s > 0,
  });
  part(() => cyl(0.12, 0.03, "z", 20), ["gear"], {
    instance: [s, parent],
    id: "parts.gear.disc-brake.004",
    parent,
    pos: [axle[0], axle[1], axle[2] - s * (MG.width / 2 + 0.02)],
    color: "#9AA3AA",
    anim: brake(s > 0 ? "R" : "L"),
    name: "Disc brake",
    note: "Hydraulic disc brake on each main wheel, worked independently by toe pressure on the rudder pedals (OM p. 10).",
    ext: true,
    pin: s > 0,
  });
  // Keep the upper edge and linkage placement; shorten the lower edge so the
  // door leaves the lower tyre exposed instead of nearly touching the ground.
  // Outline/clearance are visual approximations (GEOMETRY_AUDIT.md).
  part(() => box(0.5, 0.36, 0.012), ["gear"], {
    instance: [s, parent],
    id: "parts.gear.main-gear-door.005",
    parent,
    pos: [axle[0], axle[1] + 0.095, s * 0.065],
    color: "#C9D0D5",
    fairing: true,
    name: "Main gear door",
    note: "Gear door shown with the folding leg; it lies below the stowed tire in the wing well (OM p. 6; TCDS: mains retract inward). The lower tyre remains exposed with the gear down. Door outline, attachment and ground clearance are schematic; the wheel and door remain outside the cabin throughout retraction.",
    ext: true,
    pin: s > 0,
  });
  part(() => mainWellGeo(s), ["gear", "airframe"], {
    instance: [s],
    id: "parts.gear.part.006",
    name: nm + " main wheel well",
    note: "Wheel well behind the main spar and fuel bay, outside the cabin floor, with a narrow recess for the folded leg, shock discs and assist spring. Its walls follow the wing skins; the exact well outline is a schematic clearance envelope.",
    color: "#8C959C",
    fairing: true,
  });
  part(
    () =>
      tubeGeo(
        [
          [1.3, -0.6, s * 0.25],
          [0.9, -0.5, s * 0.3],
          [0.9, -0.47, s * 0.55],
          wingP(s * MG.trunnion[2], 0.39, 0).toArray() as Vec3,
        ],
        0.008,
      ),
    ["gear"],
    {
      instance: [s],
      id: "parts.gear.part.007",
      name: "Brake line (" + (s > 0 ? "R" : "L") + ")",
      note: "Master cylinder → wheel brake cylinder; fluid from the reservoir on the top aft side of the firewall, shared with the flap system (OM p. 10).",
    },
  );
  part(() => cyl(0.01, 0.16, "y"), ["gear"], {
    instance: [s, parent],
    id: "parts.gear.gear-assist-spring.008",
    parent,
    pos: [axle[0] * 0.3 + 0.03, axle[1] * 0.3, axle[2] * 0.3],
    color: "#E0B040",
    name: "Gear assist spring",
    ext: true,
    note: "Assist springs in the wing and bungee springs in the fuselage balance the weight of the gear so the bar can be swung by hand (OM p. 6).",
    pin: s > 0,
  });
});
part(
  () =>
    tubeGeo(
      [
        [0, 0, 0],
        [-0.1, -0.24, 0],
        [-0.12, -0.54, 0],
      ],
      0.03,
    ),
  ["gear"],
  {
    id: "parts.gear.nose-gear-strut.009",
    parent: "nose",
    color: "#6E7A84",
    name: "Nose gear strut",
    note: "Steel-tube nose gear with rubber shock discs, steered by the rudder pedals (OM p. 15). Retracts aft into the nose wheel well. The tow bar fits into its lower structure — never exceed the turn-limit marks (OM p. 25).",
    ext: true,
    pin: true,
  },
);
(
  [
    ["member-1", 0.14],
    ["member-2", 0.19],
  ] as const
).forEach(([instance2, h], i) =>
  part(() => cyl(0.045, 0.03, "y", 16), ["gear"], {
    id: "parts.gear.nose-gear-shock-discs.010",
    instance: [instance2],
    parent: "nose",
    pos: [-0.06, -h, 0],
    color: "#1E2226",
    name: "Nose gear shock discs",
    note: "Rubber discs, as on the mains.",
    ext: true,
    pin: i === 0,
  }),
);
part(() => cyl(NG.r, NG.width, "z", 24), ["gear"], {
  id: "parts.gear.nose-wheel.011",
  parent: "nose",
  pos: NG.wheel,
  color: "#2A2F33",
  name: "Nose wheel",
  note: "5.00 × 5 tyre, 30 psi (Ranger 1-4; OM p. 27). Linked directly to the rudder pedals for steering (OM p. 15).",
  ext: true,
  pin: true,
});
part(() => box(0.06, 0.03, 0.2), ["gear", "controls"], {
  id: "parts.gear.nose-wheel-steering-horn.012",
  parent: "nose",
  pos: [0.02, -0.03, 0],
  color: "#7C57CF",
  chan: ["rudder"],
  name: "Nose-wheel steering horn",
  ext: true,
  note: "Steering rods from the rudder pedals turn the strut; retraction disconnects the steering and centres the wheel (Ranger 2-12).",
  pin: true,
});
// Raised housing ahead of the panel, between the two footwells (OM p. 9).
part(() => box(0.5, 0.014, NOSE_WELL.halfWidth * 2), ["gear", "cabin"], {
  id: "parts.gear.nose-wheel-well.013",
  pos: [1.79, NOSE_WELL.roof, 0],
  color: "#8C959C",
  fairing: true,
  name: "Nose wheel well",
  note: "Raised wheel-well housing ahead of the panel, between the pilot's and co-pilot's footwells. Roof and wall dimensions are schematic clearance envelopes; the retracted tire stays below the roof.",
});
[-1, 1].forEach((s) =>
  part(() => box(0.5, 0.43, 0.012), ["gear", "cabin"], {
    instance: [s],
    id: "parts.gear.nose-wheel-well-side-wall.014",
    pos: [1.79, NOSE_WELL.roof - 0.215, s * NOSE_WELL.halfWidth],
    color: "#8C959C",
    fairing: true,
    name: "Nose wheel well side wall",
  }),
);
[-1, 1].forEach((s) =>
  part(() => noseDoorGeo(s), ["gear"], {
    instance: [s],
    id: "parts.gear.nose-gear-door.015",
    parent: "noseDoor" + (s > 0 ? "R" : "L"),
    color: "#C9D0D5",
    fairing: true,
    ext: true,
    name: "Nose gear door",
    note: "One of two curved nose wheel-well doors, fitted to the actual lower-cowl aperture. The schematic inclined hinges and 4 mm panel thickness are approximate; the linkage holds the doors open while the tire passes, then closes them over the retracted gear.",
  }),
);
// Johnson bar and its sockets
part(
  () => {
    const g = cyl(0.016, JBAR.len, "y");
    g.translate(0, JBAR.len / 2, 0);
    return g;
  },
  ["gear"],
  {
    id: "parts.gear.landing-gear-retraction-lever-johnson-bar.016",
    parent: "jbar",
    color: "#D32640",
    name: "Landing gear retraction lever (Johnson bar)",
    note: "Manual retraction: press the thumb latch, slide the handle out of the down-lock socket under the panel and swing it rapidly down to the floor into the up-lock socket. To lower: out of the floor socket and forward to the panel until it locks — check for the green light (OM p. 6–7). Easiest at low airspeed; max 120 mph.",
    pin: true,
  },
);
part(() => sph(0.03), ["gear"], {
  id: "parts.gear.gear-handle-safety-latch-thumb-button.017",
  parent: "jbar",
  pos: [0, JBAR.len, 0],
  color: "#1B1F23",
  name: "Gear handle safety latch (thumb button)",
  note: "Thumb-operated latch on the down socket prevents unlocking the gear unless deliberately released (OM p. 6). Not factory-fitted on s/n 1852, 1940–2050 (1962 supplement).",
  pin: true,
});
part(() => box(0.05, 0.06, 0.05), ["gear"], {
  id: "parts.gear.down-lock-socket.018",
  pos: johnsonTip(0)
    .add(V(0, 0.02, 0))
    .toArray() as Vec3,
  color: "#3F4B54",
  name: "Down-lock socket",
  note: "Under the instrument panel between the seats; the handle locks in here with the gear down. The red light means the handle is not sufficiently engaged (OM p. 6).",
  pin: true,
});
part(() => box(0.06, 0.03, 0.05), ["gear"], {
  id: "parts.gear.up-lock-socket.019",
  pos: johnsonTip(1)
    .add(V(0, 0.02, 0))
    .toArray() as Vec3,
  color: "#3F4B54",
  name: "Up-lock socket",
  note: "In the floor between the seats, aft of the pivot: the handle latches here with the gear up (OM p. 6). 'Clear floor for retraction handle clearance' is a pre-take-off item (OM p. 18).",
  pin: true,
});
part(() => cyl(0.014, 0.64, "z"), ["gear"], {
  id: "parts.gear.gear-torque-tube.020",
  pos: [JBAR.pivot[0], JBAR.pivot[1] + 0.025, 0],
  color: "#5C6E7E",
  name: "Gear torque tube",
  note: "The bar turns a torque tube under the floor; push-pull rods from it retract the two mains and the nose gear — 'direct mechanical linkage' (OM p. 6).",
  pin: true,
});
part(() => box(0.03, 0.1, 0.03), ["gear"], {
  id: "parts.gear.gear-bungee-springs.021",
  pos: GEAR_BUNGEE,
  color: "#E0B040",
  anim: (m) => {
    m.rotation.z = (1 - live.gearFrac) * 0.8 - 0.4;
  },
  name: "Gear bungee springs",
  note: "Bungee-type springs in the fuselage balance the gear weight through the retraction (OM p. 6). The package dimensions and mounting below the panel floor are schematic; its full travel stays inside the belly and clear of the floor.",
  pin: true,
});
// gear lights, horn and the throttle switch
(
  [
    ["gear-down-light-green", ["GEAR DOWN light (green)", 0.07, "#2FD35A", () => gearLights(sim().s, sim().E).green]],
    ["gear-unsafe-light-red", ["GEAR UNSAFE light (red)", 0.1, "#FF2A2A", () => gearLights(sim().s, sim().E).red]],
  ] as const
).forEach(([instance3, [name, z, c, on]]) =>
  part(() => sph(0.008), ["gear", "electrical"], {
    id: "parts.gear.part.022",
    instance: [instance3],
    pos: [PANEL_X - 0.02, 0.16, z as number],
    color: c as string,
    anim: glow("#3A4249", c as string, on as () => boolean, ["gear", "electrical"]),
    name: name as string,
    note: "Rotate the lens housing to dim at night; press it to test the bulb. If the green bulb fails in flight it can be screwed out and swapped with the red one (OM p. 6, 23).",
    pin: true,
    pinIn: ["gear"],
  }),
);
part(() => cyl(0.025, 0.03, "x", 16), ["gear", "electrical"], {
  id: "parts.gear.gear-warning-horn.023",
  pos: [PANEL_X + 0.08, 0.12, -0.2],
  color: "#5C6E7E",
  anim: glow("#3E4A52", "#FF4A4A", () => gearHorn(sim().s, sim().E), ["gear"]),
  name: "Gear warning horn",
  note: "Sounds when the throttle is retarded with the gear not down and locked — at about 10 in Hg manifold pressure (OM p. 23, 27).",
  pin: true,
});
part(() => box(0.03, 0.02, 0.02), ["gear", "engine"], {
  id: "parts.gear.throttle-warning-microswitch.024",
  pos: [PANEL_X + 0.05, -0.08, -0.03],
  color: "#5C6E7E",
  name: "Throttle warning microswitch",
  note: "Microswitch on the throttle control closes the horn circuit when the throttle is nearly closed with the gear up.",
  pin: true,
  pinIn: ["gear"],
});
part(() => box(0.03, 0.06, 0.02), ["gear"], {
  id: "parts.gear.parking-brake-lock-valve.025",
  pos: [PANEL_X - 0.02, -0.2, -0.12],
  color: "#B53A3A",
  anim: knobAnim(PANEL_X - 0.02, () => (sim().s.gear.park ? 1 : 0), 0.04),
  name: "Parking brake lock valve",
  note: "Depress the toe pedals and pull out the lock valve control on the panel to the right of the pilot's control column (OM p. 10). Don't set it with hot brakes (Ranger 2-12).",
  pin: true,
});
PEDAL_STATIONS.forEach(({ id: pedalId, z }, i) => {
  const parent = i % 2 === 0 ? "rig:pedL" : "rig:pedR";
  part(() => box(0.035, 0.16, 0.08), ["gear", "controls"], {
    id: "parts.gear.rudder-pedal-toe-brake.026",
    instance: [pedalId],
    chan: ["rudder"],
    parent,
    pos: [PEDALS.x, PEDALS.y, z],
    rot: [0, 0, 0.3],
    color: "#30363B",
    name: "Rudder pedal / toe brake",
    note: "Toe brakes on the pilot's pedals; co-pilot brakes were optional (OM p. 10). The co-pilot's pedals are removable (Ranger 1-3).",
    pin: i === 0,
  });
  if (i < 2)
    part(() => cyl(0.014, 0.1), ["gear"], {
      id: "parts.gear.brake-master-cylinder.027",
      instance: [pedalId],
      parent,
      pos: [PEDALS.x + 0.05, PEDALS.y + 0.01, z],
      color: "#8C959C",
      name: "Brake master cylinder",
      note: "One per pilot pedal, fed from the reservoir on the top aft side of the firewall (OM p. 10).",
      pin: i === 0,
    });
});
part(() => box(0.1, 0.08, 0.1), ["gear", "flaps"], {
  id: "parts.gear.brake-flap-hydraulic-reservoir.028",
  pos: [FW - 0.08, 0.1, 0.2],
  color: "#7C57CF",
  name: "Brake & flap hydraulic reservoir",
  note: "On the top aft side of the firewall: one reservoir serves both the brakes and the hand-pumped flaps (OM p. 9–10).",
  pin: true,
});
part(() => box(0.06, 0.04, 0.03), ["gear", "controls", "flaps"], {
  id: "parts.gear.trim-flap-position-indicator.029",
  pos: [1.62, -0.5, 0.0],
  color: "#F2F5F7",
  name: "Trim & flap position indicator",
  note: "Pointers on the aft side of the nose wheel well show stabilizer trim and flap position; the intermediate marks are the take-off settings (OM p. 9).",
  pin: true,
  pinIn: ["controls", "flaps"],
});
