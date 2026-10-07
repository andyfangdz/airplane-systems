/** M20C vacuum system and Positive Control: regulator, filter, warning lights, turn coordinator, PC servos, cut-off valve and roll trim. */

import { FW, PANEL_X, box, cyl, sph } from "../geometry";
import { live, pcEngaged } from "../model";
import { SERVO } from "../rig";
import { glow, part, sim } from "./catalogue";

/* ---------- vacuum & flight instruments ---------- */
part(() => box(0.06, 0.05, 0.05), ["vacuum"], {
  pos: [FW - 0.08, 0.1, -0.15],
  color: "#3A9448",
  name: "Vacuum regulator",
  note: "Holds the pump output between 4.50 and 5.00 in Hg (OM p. 10). 1962–64 airplanes: 3.5–5.0.",
  pin: true,
});
part(() => cyl(0.03, 0.06, "x"), ["vacuum"], {
  pos: [FW - 0.1, 0.0, -0.35],
  color: "#3A9448",
  name: "Vacuum filter",
  note: "Air entering the gyros is filtered; a clogged element makes them sluggish (Ranger 2-7).",
  pin: true,
});
part(() => box(0.02, 0.014, 0.014), ["vacuum"], {
  pos: [PANEL_X - 0.03, 0.02, -0.4],
  color: "#3F4B54",
  name: "Vacuum light test switch",
  note: "Press to test the red low/high vacuum lights on the artificial horizon; turn the lens housings clockwise to dim (OM p. 10).",
  pin: true,
});
(
  [
    [-0.34, "#FF2A2A", "LOW VACUUM light (red)", () => sim().E.vacWarn && live.vac < 4.05],
    [-0.3, "#FF2A2A", "HIGH VACUUM light (red)", () => sim().E.vacWarn && live.vac > 5.2],
  ] as [number, string, string, () => boolean][]
).forEach(([z, c, name, on]) =>
  part(() => sph(0.007), ["vacuum", "electrical"], {
    pos: [PANEL_X - 0.02, 0.09, z],
    color: c,
    anim: glow("#3A4249", c, on, ["vacuum"]),
    name,
    note: "Red lights on the artificial horizon: vacuum below 4.05 or above 5.20 in Hg (OM p. 10). With low vacuum the PC system is automatically inoperative (OM p. 8).",
    pin: true,
    pinIn: ["vacuum"],
  }),
);
part(() => box(0.08, 0.07, 0.07), ["vacuum", "autopilot"], {
  pos: [PANEL_X + 0.05, 0.0, -0.44],
  color: "#C8399F",
  name: "Turn coordinator (electric & vacuum)",
  note: "The PC system's sensor: an electro-vacuum turn coordinator supplies the pneumatic signal to the servos (Ranger 2-9). The roll-trim knob is on its face. TURN & BANK breaker.",
  pin: true,
});

/* ---------- Positive Control (Brittain) ---------- */
[1, -1].forEach((s) =>
  part(() => cyl(0.057, 0.06, "y", 18), ["autopilot", "controls"], {
    pos: s > 0 ? [SERVO.roll[0], SERVO.roll[1], -SERVO.roll[2]] : SERVO.roll,
    color: "#C8399F",
    anim: glow("#7A3866", "#C8399F", () => pcEngaged(sim().s) && Math.abs(live.pcRoll) > 0.02, [
      "autopilot",
      "controls",
    ]),
    name: "PC aileron servo (Brittain BI-706)",
    note: "One 4½ in vacuum servo can in the outer third of each wing on a riveted panel: suction from the turn coordinator's pick-off pulls the rubber diaphragm, and a chain from it pulls the aileron linkage to level the wings (OM p. 8; Ranger 2-9; Brittain service notes). Easily overpowered by the pilot.",
    pin: s < 0,
    chan: ["aileron"],
  }),
);
[1, -1].forEach((s) =>
  part(() => cyl(0.057, 0.06, "z", 18), ["autopilot", "controls"], {
    pos: [SERVO.yaw[0], SERVO.yaw[1], s * 0.1],
    color: "#C8399F",
    anim: glow("#7A3866", "#C8399F", () => pcEngaged(sim().s) && Math.abs(live.pcYaw) > 0.02, [
      "autopilot",
      "controls",
    ]),
    name: "PC rudder servo (Brittain BI-706)",
    note: "Two servo cans in the tail cone pull cables on the rudder linkage: PC gives roll and yaw stability (Ranger 2-9). Leaking diaphragms are the usual fault — Brittain closed in 2019; seal kits still come from a former employee.",
    pin: s > 0,
    chan: ["rudder"],
  }),
);
part(() => box(0.02, 0.03, 0.015), ["autopilot", "controls"], {
  parent: "wheel:L",
  pos: [0.0, 0.06, -0.12],
  color: "#B53A3A",
  anim: glow("#6E2424", "#FF4A4A", () => sim().s.pc.cutoff, ["autopilot"]),
  name: "PC cut-off valve (left grip)",
  note: "Button / trigger in the pilot's left-hand wheel grip: hold it down to cut PC off for manoeuvring; release and the airplane returns to wings level (OM p. 8).",
  pin: true,
});
part(() => cyl(0.012, 0.02, "x", 12), ["autopilot"], {
  pos: [PANEL_X - 0.035, -0.03, -0.44],
  color: "#1B1F23",
  anim: (m) => {
    m.rotation.x = sim().s.pc.rollTrim * 1.5;
  },
  name: "Roll trim knob",
  note: "On the turn coordinator: clockwise trims right, counter-clockwise left — aileron trim through the PC system for asymmetric loads (OM p. 8; Ranger 4-9).",
  pin: true,
});
