import { PANEL_X, box, cyl, fs, sectionSlab } from "../geometry";
import { ARMS, STICK } from "../rig";
import { part } from "./catalogue";

/* ---------- cockpit / cabin ---------- */
/** Panel layout (SMM Fig. 2-1; XLS panel photos): GMA 1347 between the displays, breaker panel right of the MFD. */
export const GMA_Z = -0.066,
  CBP_Z = 0.375;
/** Defrost outlet at the windshield base, and the roll-bar ventilation nozzles. */
export const DEFROST_X = PANEL_X + 0.14,
  RB_NOZZLE = { y: 0.22, z: 0.42 };
part(() => sectionSlab(PANEL_X, -0.26, 0.2, 0.96, 0.04, PANEL_X), ["avionics", "autopilot", "cabin"], {
  color: "#2B3238",
  name: "Instrument panel",
  note: "G1000 panel: PFD left, GMA 1347 centre, MFD right, breakers far right; standby instruments in the raised centre row (SMM Fig. 2-1). All panel items are at arm 1.78 m (AFM 6.5).",
});
part(() => sectionSlab(PANEL_X + 0.09, 0.2, 0.26, 0.95, 0.14, PANEL_X + 0.16), ["cabin", "lighting"], {
  color: "#2B3238",
  name: "Glareshield",
  note: "Projects over the panel; the electroluminescent flood-light panel is mounted under it.",
});
part(() => box(0.38, 0.14, 0.12), ["cabin", "environment", "gear"], {
  pos: [fs(1.86), -0.38, 0],
  color: "#39424A",
  name: "Small centre console",
  note: "Under the panel: CABIN HEAT lever (left), DEFROST/FLOOR lever (centre) and PARKING BRAKE lever (AFM 7-13, 7-18; SMM Fig. 2-1).",
});
part(() => box(0.7, 0.16, 0.18), ["cabin"], {
  pos: [fs(2.25), -0.42, 0],
  color: "#39424A",
  name: "Large centre console",
  note: "Throttle quadrant, trim wheel and fuel tank selector between the front seats.",
});
(
  [
    [fs(2.3), -0.26, "Pilot seat", 0.36],
    [fs(2.3), 0.26, "Front passenger seat", 0.36],
    [fs(3.25), -0.26, "Rear seat (L)", 0.36],
    [fs(3.25), 0.26, "Rear seat (R)", 0.36],
  ] as [number, number, string, number][]
).forEach(([x, z, name, w], i) => {
  part(() => box(0.46, 0.08, w), ["cabin"], {
    pos: [x, -0.47, z],
    color: "#6B5A48",
    name,
    note:
      i < 2
        ? "Carbon/Kevlar and GFRP seat with energy-absorbing foam; removable to inspect the control runs underneath (AFM 7-15). Front seat arm 2.30 m. Three-point Schroth harness."
        : "Rear seat (arm 3.25 m); the backs fold forward after pulling up the locking-bolt knob (AFM 7-15).",
    pin: i === 0 || i === 2,
  });
  part(() => box(0.08, 0.6, w * (i < 2 ? 0.92 : 0.8)), ["cabin"], {
    pos: [x - 0.26, -0.17, z],
    rot: [0, 0, 0.18],
    color: "#6B5A48",
    name,
    note:
      i < 2
        ? "Three-point safety harness (Schroth); AmSafe inflatable lap belts on some seats (AFM 7-15)."
        : "Three-point harness; seat back folds forward for long items.",
  });
});
part(() => box(0.5, 0.05, 0.74), ["cabin"], {
  pos: [fs(3.75), -0.46, 0],
  color: "#4A4F55",
  name: "Baggage compartment",
  note: "Behind the rear seats: 30 kg / 66 lb at 3.65 m; extended baggage (OAM 40-163, XLS) 45 kg / 100 lb total. No baggage without the net (AFM 2-11, 7-16).",
  pin: true,
});
part(() => cyl(0.09, 0.55, "x", 16), ["cabin"], {
  pos: [fs(4.35), -0.38, 0],
  color: "#4A4F55",
  name: "Baggage tube",
  note: "Aft of the standard compartment behind a cloth cover: 5 kg / 11 lb at 4.32 m (AFM 2-11, 7-16).",
  pin: true,
});
part(() => box(0.14, 0.06, 0.06), ["cabin"], {
  pos: [fs(2.79), -0.52, 0],
  color: "#D32640",
  name: "Fire extinguisher",
  note: "Portable: Amerex A620T (1.1 kg) or HAL1 (2.2 kg) at arm 2.794 m (AFM 6-22). Mounting position not in the documents.",
  pin: true,
});
part(() => box(0.32, 0.03, 0.06), ["cabin"], {
  pos: [fs(2.3), -0.55, -0.29],
  color: "#C84A2A",
  name: "Emergency axe",
  note: "OAM 40-326: on the floor panel under the pilot's seat — break through the canopy if it can't be opened (AFM 7-19).",
  pin: true,
});
part(() => box(0.16, 0.1, 0.1), ["cabin", "avionics"], {
  pos: [fs(4.4), -0.27, 0.22],
  color: "#EB7A12",
  name: "ELT",
  note: "Arm 4.40 m, behind the baggage-compartment frame, slightly low on the right (AFM 6-21). A 406 MHz Artex ME406 (OAM 40-284, AFM 6-21 equipment list; XLS brochure) is inferred for N949KC — its supplement is not available; Suppl. S1 covers the older 121.5/243 MHz ACK E-01. Post-flight, listen on 121.5 MHz for inadvertent activation (AFM 4A-39).",
  pin: true,
});
part(() => box(0.012, 0.03, 0.03), ["cabin", "environment"], {
  pos: [PANEL_X - 0.028, 0.12, 0.4],
  color: "#C83A3A",
  name: "CO detector alert light",
  note: "CO Guardian 452-201 (OAM 40-253, XLS standard). Flashes twice at power-up; stays on until CO < 50 ppm; one flash every 4 s = unit failure (AFM 7-55, 7-56).",
  pin: true,
});
// control sticks (moving)
(["L", "R"] as const).forEach((side) => {
  part(
    () => {
      const g = cyl(0.014, STICK.len, "y");
      g.translate(0, STICK.len / 2, 0);
      return g;
    },
    ["controls"],
    {
      parent: "stick:" + side,
      chan: ["elevator", "aileron"],
      color: "#30363B",
      name: "Control stick",
      note: "Centre stick at each front seat, with a boot to keep objects out of the controls. Each grip has a radio transmit switch (AFM 7-15, 7-54).",
      pin: side === "L",
    },
  );
  part(
    () => {
      const g = cyl(0.022, 0.12, "y");
      g.translate(0, STICK.len + 0.04, 0);
      return g;
    },
    ["controls", "autopilot"],
    {
      parent: "stick:" + side,
      chan: ["elevator", "aileron"],
      color: "#1B1F23",
      name: side === "L" ? "Pilot stick grip — AP DISC, CWS, MET" : "Co-pilot stick grip",
      note:
        side === "L"
          ? "Red AP DISC (also interrupts manual electric trim while held), CWS and the split AP TRIM (MET) switch: the left half is ARM, both halves together trim (AFMS p. 9–10; CRG 6-1)."
          : "PTT switch. The CRG says AP DISC and CWS are on both sticks; the AFMS says the pilot's stick — unconfirmed for N949KC.",
      pin: true,
    },
  );
  part(() => box(0.015, ARMS.a, 0.015), ["controls"], {
    parent: "stick:" + side,
    chan: ["aileron"],
    pos: [0, -ARMS.a / 2, 0],
    color: "#8C959C",
  });
});
part(() => cyl(0.014, STICK.z * 2, "z"), ["controls"], {
  parent: "rig:ett",
  chan: ["elevator"],
  color: "#8C959C",
  name: "Stick torque tube",
  note: "Ties both sticks together in pitch; a lever under it drives the elevator push rod aft under the seats (routing not in the AFM — inferred).",
  pin: true,
});
part(() => box(0.015, ARMS.e, 0.015), ["controls"], {
  parent: "rig:ett",
  chan: ["elevator"],
  pos: [0, -ARMS.e / 2, 0],
  color: "#7C57CF",
});
