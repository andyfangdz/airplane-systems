import { DOOR, FW, PANEL_X, ROLLBAR_X, box, fs, onSkin, sph, tubeGeo, wingP } from "../geometry";
import { part, sim, relTo } from "./catalogue";
import { CANOPY_HINGE, DOOR_HINGE } from "./airframe";
import { DEFROST_X, RB_NOZZLE } from "./cabin";

/* ---------- environment: heating & ventilation ---------- */
part(() => box(0.03, 0.08, 0.02), ["environment"], {
  pos: [fs(1.87), -0.31, -0.035],
  color: "#E0522B",
  anim: (m) => {
    m.rotation.z = (sim().s.env.heat - 0.5) * 1.4;
  },
  name: "CABIN HEAT lever",
  note: "Left lever on the small centre console: up = heating ON, down = OFF (AFM 7-18). OFF dumps the heated air overboard at the bottom of the cowling.",
  pin: true,
});
part(() => box(0.03, 0.08, 0.02), ["environment"], {
  pos: [fs(1.87), -0.31, 0.0],
  color: "#149C94",
  anim: (m) => {
    m.rotation.z = (sim().s.env.dist - 0.5) * 1.4;
  },
  name: "DEFROST / FLOOR lever",
  note: "Centre lever: up = airflow to the canopy (defrost), down = to the floor (AFM 7-18).",
  pin: true,
});
// on the engine side of the firewall (its overboard outlet is in the cowling); must match HV in flows.ts
part(() => box(0.08, 0.1, 0.12), ["environment"], {
  pos: [FW + 0.045, -0.4, 0.12],
  color: "#E0522B",
  name: "Heat valve",
  note: "On the firewall: sends muffler-heated air through the firewall to the distributor valve, or overboard at the bottom of the cowling when OFF (unofficial technical description). Shown on the engine side; its position is approximate.",
  pin: true,
});
part(() => box(0.08, 0.1, 0.18), ["environment"], {
  pos: [FW - 0.14, -0.42, 0.0],
  color: "#149C94",
  name: "Floor / defrost distributor valve",
  note: "Behind the firewall under the panel; the distribution lever splits the air between the canopy defrost outlet and the floor outlets.",
  pin: true,
});
// on top of the glareshield (y 0.20–0.26) along its forward edge, where the canopy starts
part(() => box(0.04, 0.012, 0.44), ["environment"], {
  pos: [DEFROST_X, 0.267, 0],
  color: "#149C94",
  name: "Defrost outlet",
  note: "Outlet at the base of the canopy, fed from the floor / defrost distributor: with the distribution lever up, air goes to the canopy to keep mist and frost off it (AFM 7-18). The outlet's position comes from an unofficial technical description and is approximate.",
});
[1, -1].forEach((s) =>
  part(() => sph(0.03), ["environment"], {
    pos: [PANEL_X - 0.02, -0.03, s * 0.485],
    color: "#149C94",
    name: "Panel air nozzle",
    note: "Movable ventilation nozzle at each end of the panel; spherical nozzles open and close by twisting (AFM 7-12).",
    pin: s > 0,
  }),
);
[1, -1].forEach((s) =>
  part(() => sph(0.025), ["environment"], {
    pos: [ROLLBAR_X, RB_NOZZLE.y, s * RB_NOZZLE.z],
    color: "#149C94",
    name: "Roll-bar air nozzle",
    note: "Spherical nozzles in the roll bar beside the front seats and on the central console above the passengers' heads (AFM 7-12).",
    pin: s > 0,
  }),
);
part(() => box(0.22, 0.012, 0.08), ["environment"], {
  pos: [fs(2.25), wingP(-0.85, 0.08, -1).y - 0.005, -0.85],
  color: "#149C94",
  name: "Fresh-air inlet (NACA)",
  note: "Fresh air enters through an inlet on the bottom of the left stub wing (Suppl. E7; AFM 4A-6 'air intake on lower surface'). A winter baffle may be fitted below 15 °C.",
  ext: true,
  pin: true,
});
part(() => box(0.05, 0.12, 0.03), ["environment", "cabin"], {
  parent: "canopy",
  pos: relTo(onSkin(fs(2.35), 0.18, -1, 1.03), CANOPY_HINGE),
  color: "#149C94",
  anim: (m) => {
    m.rotation.y = sim().s.env.window ? 0.6 : 0;
  },
  name: "Canopy emergency window",
  note: "Opening window on the left of the canopy for ventilation or as an emergency window; close it if the alternate static valve is open (AFM 7-17, 2-29).",
  pin: true,
});

/* ---------- canopy / door hardware ---------- */
part(() => box(0.04, 0.03, 0.12), ["cabin"], {
  parent: "canopy",
  pos: relTo(onSkin(fs(2.5), -0.03, -1, 1.02), CANOPY_HINGE),
  color: "#30363B",
  name: "Canopy handle (left)",
  note: "Locks the front canopy; position 2 latches the bolts with a cooling gap (ground only). Optional key lock — the placard says it must be unlocked in flight (AFM 7-17, 2-31).",
  pin: true,
});
part(
  () =>
    tubeGeo(
      [
        [DOOR.x0 - 0.15, 0.25, -0.44],
        [DOOR.x0 - 0.25, -0.05, -0.47],
      ],
      0.01,
    ),
  ["cabin"],
  {
    name: "Rear door gas strut",
    note: "Gas-pressure damper that holds the rear door open; hold the door in strong wind (AFM 7-18).",
  },
);
part(() => box(0.04, 0.03, 0.05), ["cabin"], {
  parent: "door",
  pos: relTo(onSkin(fs(3.55), 0.0, -1, 1.02), DOOR_HINGE),
  color: "#C83A3A",
  name: "Rear door safety lever",
  note: "Extra lever against unintentional opening. Never try to lock the rear door in flight — it can come off; the airplane flies fine without it (AFM 7-18, 3-40).",
  pin: true,
});
