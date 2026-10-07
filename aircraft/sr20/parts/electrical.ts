/** Electrical hardware: Master Control Unit, batteries, ground service receptacle. */
import { box } from "../geometry";
import { part } from "./catalogue";

/* ---------- electrical ---------- */
part(() => box(0.07, 0.18, 0.14), ["electrical"], {
  pos: [2.66, -0.08, -0.33],
  name: "Master Control Unit",
  note: "Left firewall. Regulates both alternators, houses the three distribution buses, fuses, the MDB1→MDB2 diode and the starter/external-power relays.",
  pin: true,
});
part(() => box(0.13, 0.17, 0.2), ["electrical"], {
  pos: [2.7, -0.04, 0.34],
  name: "BAT 1 — 24 V, 11 Ah",
  note: "Lead-acid, right firewall. Charged from Main Dist Bus 1; used for starting (POH 7-49).",
  pin: true,
});
part(() => box(0.2, 0.13, 0.26), ["electrical"], {
  pos: [-0.76, 0, 0],
  name: "BAT 2 — 2 × 12 V, 7 Ah",
  note: "Sealed lead-acid pair in series, aft of FS 222 below the parachute canister. Charged from ESS BUS 1.",
  pin: true,
});
part(() => box(0.08, 0.07, 0.02), ["electrical"], {
  pos: [2.45, -0.3, -0.6],
  name: "Ground service receptacle",
  note: "Left side just aft of the cowl. Regulated 28 V; works only with BAT 1 on.",
  ext: true,
});
