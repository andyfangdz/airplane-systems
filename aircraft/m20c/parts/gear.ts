/** M20C landing gear: manual Johnson bar and its sockets, torque tube, mains and nose gear with rubber discs, brakes, lights and horn. */

import { type Vec3 } from "@/lib/math";

import { FW, PANEL_X, box, botY, cyl, sph, tubeGeo, wY } from "../geometry";
import { gearHorn, gearLights, live } from "../model";
import { JBAR, PEDALS } from "../rig";
import { brake, glow, knobAnim, part, sim } from "./catalogue";

/* ---------- landing gear: manual Johnson bar, rubber shock discs ---------- */
/** Main gear: trunnion on the main spar at the wing root; the leg reaches outboard and down to the axle (track 9 ft 0¾ in). */
export const MG = { x: 0.6, y: -1.03, z: 1.38, r: 0.22, trunnion: [0.62, -0.5, 0.95] as Vec3 };
export const NG = { top: [2.3, -0.5, 0] as Vec3, wheel: [0.0, -0.57, 0] as Vec3, r: 0.18 };
[1, -1].forEach((s) => {
  const parent = s > 0 ? "mainR" : "mainL",
    nm = s > 0 ? "Right" : "Left";
  // leg from the trunnion (group origin) outboard and down to the axle
  part(
    () =>
      tubeGeo(
        [
          [0, 0, 0],
          [0.0, -0.14, s * 0.18],
          [-0.02, -0.53, s * 0.43],
        ],
        0.03,
        0.2,
      ),
    ["gear"],
    {
      parent,
      color: "#6E7A84",
      name: nm + " main gear leg",
      note: "Welded steel-tube gear structure on a trunnion at the main spar; retracts inboard into the wing well by direct mechanical linkage from the cabin lever (OM p. 6).",
      ext: true,
      pin: s > 0,
    },
  );
  [0.16, 0.2, 0.24, 0.28].forEach((h, i) =>
    part(() => cyl(0.05, 0.03, "y", 16), ["gear"], {
      parent,
      pos: [0, -h, s * (0.06 + h * 0.85)],
      rot: [0.5 * s, 0, 0],
      color: "#1E2226",
      name: "Rubber shock discs",
      note: "Stacks of rubber discs are the only shock absorption — no oleos (OM p. 6). Aged discs sag and let the airplane sit low; check them on every walk-around (Ranger 3-3).",
      ext: true,
      pin: s > 0 && i === 0,
    }),
  );
  part(() => cyl(MG.r, 0.15, "z", 28), ["gear"], {
    parent,
    pos: [-0.02, -0.53, s * 0.43],
    color: "#2A2F33",
    name: nm + " main wheel",
    note: "6.00 × 6 tyre, 30 psi (Ranger 1-4; OM p. 27).",
    ext: true,
    pin: s > 0,
  });
  part(() => cyl(0.12, 0.03, "z", 20), ["gear"], {
    parent,
    pos: [-0.02, -0.53, s * 0.34],
    color: "#9AA3AA",
    anim: brake(s > 0 ? "R" : "L"),
    name: "Disc brake",
    note: "Hydraulic disc brake on each main wheel, worked independently by toe pressure on the rudder pedals (OM p. 10).",
    ext: true,
    pin: s > 0,
  });
  part(() => box(0.5, 0.02, 0.3), ["gear"], {
    pos: [MG.trunnion[0] - 0.05, wY(s * 0.75) - 0.12, s * 0.7],
    color: "#C9D0D5",
    fairing: true,
    name: "Main gear door",
    note: "Clamshell doors at the wing root close the wheel well as the gear comes up; the wheel swings inboard and up to lie in the well beside the fuselage (OM p. 6; TCDS: mains retract inward).",
    ext: true,
    pin: s > 0,
  });
  part(() => tubeGeo([[1.3, -0.6, s * 0.25], [0.9, -0.66, s * 0.45], MG.trunnion], 0.008), ["gear"], {
    name: "Brake line (" + (s > 0 ? "R" : "L") + ")",
    note: "Master cylinder → wheel brake cylinder; fluid from the reservoir on the top aft side of the firewall, shared with the flap system (OM p. 10).",
  });
  part(() => cyl(0.01, 0.25, "z"), ["gear"], {
    parent,
    pos: [0.1, -0.05, s * 0.12],
    color: "#E0B040",
    name: "Gear assist spring",
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
    parent: "nose",
    color: "#6E7A84",
    name: "Nose gear strut",
    note: "Steel-tube nose gear with rubber shock discs, steered by the rudder pedals (OM p. 15). Retracts aft into the nose wheel well. The tow bar fits into its lower structure — never exceed the turn-limit marks (OM p. 25).",
    ext: true,
    pin: true,
  },
);
[0.14, 0.19].forEach((h, i) =>
  part(() => cyl(0.045, 0.03, "y", 16), ["gear"], {
    parent: "nose",
    pos: [-0.06, -h, 0],
    color: "#1E2226",
    name: "Nose gear shock discs",
    note: "Rubber discs, as on the mains.",
    ext: true,
    pin: i === 0,
  }),
);
part(() => cyl(NG.r, 0.11, "z", 24), ["gear"], {
  parent: "nose",
  pos: [-0.12, -0.57, 0],
  color: "#2A2F33",
  name: "Nose wheel",
  note: "5.00 × 5 tyre, 30 psi (Ranger 1-4; OM p. 27). Linked directly to the rudder pedals for steering (OM p. 15).",
  ext: true,
  pin: true,
});
part(() => box(0.06, 0.03, 0.2), ["gear", "controls"], {
  parent: "nose",
  pos: [0.02, -0.03, 0],
  color: "#7C57CF",
  chan: ["rudder"],
  name: "Nose-wheel steering horn",
  note: "Steering rods from the rudder pedals turn the strut; retraction disconnects the steering and centres the wheel (Ranger 2-12).",
  pin: true,
});
part(() => box(0.24, 0.012, 0.26), ["gear"], {
  pos: [2.15, botY(2.15) + 0.04, 0.14],
  color: "#C9D0D5",
  fairing: true,
  name: "Nose gear doors",
  note: "Two doors close the nose wheel well.",
  ext: true,
});
// Johnson bar and its sockets
part(
  () => {
    const g = cyl(0.016, JBAR.len, "y");
    g.translate(0, JBAR.len / 2, 0);
    return g;
  },
  ["gear"],
  {
    parent: "jbar",
    color: "#D32640",
    name: "Landing gear retraction lever (Johnson bar)",
    note: "Manual retraction: press the thumb latch, slide the handle out of the down-lock socket under the panel and swing it rapidly down to the floor into the up-lock socket. To lower: out of the floor socket and forward to the panel until it locks — check for the green light (OM p. 6–7). Easiest at low airspeed; max 120 mph.",
    pin: true,
  },
);
part(() => sph(0.03), ["gear"], {
  parent: "jbar",
  pos: [0, JBAR.len, 0],
  color: "#1B1F23",
  name: "Gear handle safety latch (thumb button)",
  note: "Thumb-operated latch on the down socket prevents unlocking the gear unless deliberately released (OM p. 6). Not factory-fitted on s/n 1852, 1940–2050 (1962 supplement).",
  pin: true,
});
part(() => box(0.05, 0.06, 0.05), ["gear"], {
  pos: [JBAR.pivot[0] + JBAR.len * Math.sin(JBAR.downAng), JBAR.pivot[1] + JBAR.len * Math.cos(JBAR.downAng) + 0.02, 0],
  color: "#3F4B54",
  name: "Down-lock socket",
  note: "Under the instrument panel between the seats; the handle locks in here with the gear down. The red light means the handle is not sufficiently engaged (OM p. 6).",
  pin: true,
});
part(() => box(0.06, 0.03, 0.05), ["gear"], {
  pos: [JBAR.pivot[0] - JBAR.len * 0.96, JBAR.pivot[1] + 0.02, 0],
  color: "#3F4B54",
  name: "Up-lock socket",
  note: "In the floor between the seats, aft of the pivot: the handle latches here with the gear up (OM p. 6). 'Clear floor for retraction handle clearance' is a pre-take-off item (OM p. 18).",
  pin: true,
});
part(() => cyl(0.02, 1.0, "z"), ["gear"], {
  pos: [JBAR.pivot[0], JBAR.pivot[1] - 0.02, 0],
  color: "#5C6E7E",
  name: "Gear torque tube",
  note: "The bar turns a torque tube under the floor; push-pull rods from it retract the two mains and the nose gear — 'direct mechanical linkage' (OM p. 6).",
  pin: true,
});
part(() => box(0.03, 0.1, 0.03), ["gear"], {
  pos: [JBAR.pivot[0] + 0.25, JBAR.pivot[1] - 0.01, 0],
  color: "#E0B040",
  anim: (m) => {
    m.rotation.z = (1 - live.gearFrac) * 0.8 - 0.4;
  },
  name: "Gear bungee springs",
  note: "Bungee-type springs in the fuselage balance the gear weight through the retraction (OM p. 6).",
  pin: true,
});
// gear lights, horn and the throttle switch
[
  ["GEAR DOWN light (green)", 0.07, "#2FD35A", () => gearLights(sim().s, sim().E).green],
  ["GEAR UNSAFE light (red)", 0.1, "#FF2A2A", () => gearLights(sim().s, sim().E).red],
].forEach(([name, z, c, on]) =>
  part(() => sph(0.008), ["gear", "electrical"], {
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
  pos: [PANEL_X + 0.08, 0.12, -0.2],
  color: "#5C6E7E",
  anim: glow("#3E4A52", "#FF4A4A", () => gearHorn(sim().s, sim().E), ["gear"]),
  name: "Gear warning horn",
  note: "Sounds when the throttle is retarded with the gear not down and locked — at about 10 in Hg manifold pressure (OM p. 23, 27).",
  pin: true,
});
part(() => box(0.03, 0.02, 0.02), ["gear", "engine"], {
  pos: [PANEL_X + 0.05, -0.08, -0.03],
  color: "#5C6E7E",
  name: "Throttle warning microswitch",
  note: "Microswitch on the throttle control closes the horn circuit when the throttle is nearly closed with the gear up.",
  pin: true,
  pinIn: ["gear"],
});
part(() => box(0.03, 0.06, 0.02), ["gear"], {
  pos: [PANEL_X - 0.02, -0.2, -0.12],
  color: "#B53A3A",
  anim: knobAnim(PANEL_X - 0.02, () => (sim().s.gear.park ? 1 : 0), 0.04),
  name: "Parking brake lock valve",
  note: "Depress the toe pedals and pull out the lock valve control on the panel to the right of the pilot's control column (OM p. 10). Don't set it with hot brakes (Ranger 2-12).",
  pin: true,
});
PEDALS.z.forEach((z, i) => {
  const parent = i % 2 === 0 ? "rig:pedL" : "rig:pedR";
  part(() => box(0.035, 0.16, 0.08), ["gear", "controls"], {
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
      parent,
      pos: [PEDALS.x + 0.05, PEDALS.y + 0.01, z],
      color: "#8C959C",
      name: "Brake master cylinder",
      note: "One per pilot pedal, fed from the reservoir on the top aft side of the firewall (OM p. 10).",
      pin: i === 0,
    });
});
part(() => box(0.1, 0.08, 0.1), ["gear", "flaps"], {
  pos: [FW - 0.08, 0.1, 0.2],
  color: "#7C57CF",
  name: "Brake & flap hydraulic reservoir",
  note: "On the top aft side of the firewall: one reservoir serves both the brakes and the hand-pumped flaps (OM p. 9–10).",
  pin: true,
});
part(() => box(0.06, 0.04, 0.03), ["gear", "controls", "flaps"], {
  pos: [1.62, -0.5, 0.0],
  color: "#F2F5F7",
  name: "Trim & flap position indicator",
  note: "Pointers on the aft side of the nose wheel well show stabilizer trim and flap position; the intermediate marks are the take-off settings (OM p. 9).",
  pin: true,
  pinIn: ["controls", "flaps"],
});
