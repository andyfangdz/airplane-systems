/** C182T catalogue: electrical system (POH 7-46 – 7-57, Figure 7-7). */
import type { Vec3 } from "@/lib/math";
import { glowAnim as glow } from "@/lib/anims";
import { X, Y, box, cyl, onSkin, sph } from "../geometry";
import { alternatorDrive } from "../../cessna/accessories";
import { EL, P3, PV, S, part } from "./catalogue";

/* ---------- electrical (POH 7-46 – 7-57, Figure 7-7) ---------- */
const ELEC = "#D9960F";
export const JBOX: Vec3 = P3(-2.5, -15, 43);
part(() => box(0.2, 0.18, 0.17), ["electrical"], {
  pos: P3(132.1, -5, 37),
  color: ELEC,
  anim: glow(ELEC, () => EL().mBatt < -0.5, ["electrical"], "#FF8A3D"),
  name: "Main battery — 24 V",
  note: "In the tailcone, arm 132.1: 24 V, 12.75 Ah (POH 6-20; the 2007 edition lists 8 Ah). Its cable runs forward to the battery relay in the J-box; the starter draws upstream of the M BATT shunt (POH 7-46, Fig. 7-7 Sheet 1). Case dimensions and lateral/vertical position are schematic.",
  pin: true,
});
part(() => box(0.1, 0.16, 0.14), ["electrical"], {
  pos: JBOX,
  color: "#8A7A3A",
  fairing: true,
  name: "Power distribution module (J-box)",
  note: "Left forward side of the firewall, arm −2.5: battery relay (MASTER BAT), starter relay, alternator relay, the Alternator Control Unit, the M BATT current shunt, the external power relay and three push-to-reset feeder breakers — “A” for BUS 2, “B” for BUS 1, one spare (POH 7-46, 6-20). Case dimensions and internal mounting positions are schematic.",
  pin: true,
});
part(() => box(0.05, 0.05, 0.04), ["electrical"], {
  pos: P3(-1.75, -14, 44.5),
  color: "#C9B98F",
  name: "Alternator Control Unit (ACU)",
  note: "Inside the J-box: regulates the alternator field, opens the ALT FIELD breaker above about 31.75 V and sends LOW VOLTS below 24.5 V. It can nuisance-trip during a start — reset once (POH 7-55, 3-34).",
  pin: true,
});
part(() => box(0.03, 0.03, 0.05), ["electrical"], {
  pos: P3(-2, -16.5, 41.5),
  color: "#8C959C",
  name: "Main battery current shunt",
  note: "Ammeter transducer, arm −2.0 → M BATT AMPS (+ charging, − discharging) (POH 6-20, 7-53).",
});
part(() => box(0.07, 0.08, 0.015), ["electrical"], {
  pos: PV(onSkin(X(-3), Y(40), -1, 1.012)),
  color: ELEC,
  name: "External power receptacle",
  note: "Integral to the J-box, behind a door on the left side of the cowl near the firewall. MASTER and AVIONICS OFF before connecting; it supplies the buses and charges the battery through the battery relay (POH 7-55, 4-13).",
  ext: true,
  pin: true,
});
/** Belt plane just ahead of the crankcase; documented alternator arm, schematic shaft/pulleys. */
const DRIVE = alternatorDrive(P3, {
  bodyFs: -33.4,
  beltFs: -41.2,
  crank: { bl: 0, h: 50.4, r: 2.6 },
  alt: { bl: 9, h: 41.5, r: 1.4 },
});
part(DRIVE.bodyGeo, ["electrical", "engine"], {
  pos: DRIVE.position,
  color: ELEC,
  anim: glow(ELEC, () => EL().altOn, ["electrical", "engine", "overview"], "#FFD34D"),
  name: "Alternator — 28 V, 60 A",
  note: "Belt driven, front of the engine, arm −33.4. 60 A standard (24-01-R) or 95 A optional (24-02-O) — which N8050J and N21200 have is not in the POH. Field through the ALT FIELD breaker (CROSSFEED BUS) and MASTER (ALT) (POH 7-46, 6-20). Case dimensions and internal mounting positions are schematic. The pulley and shaft are drawn to line up with the belt; their sizes are approximate.",
  pin: true,
});
part(DRIVE.beltGeo, ["electrical", "engine"], {
  color: "#20262B",
  name: "Alternator belt",
  note: "Crankshaft pulley to the alternator pulley at the front of the engine (layout approximate). A broken belt is one of the alternator failures behind the LOW VOLTS procedure (POH 3-33).",
});
part(() => box(0.14, 0.12, 0.16), ["electrical"], {
  pos: P3(10.8, -14, 50.5),
  color: ELEC,
  anim: glow(ELEC, () => EL().stbyOnline, ["electrical"], "#FF8A3D"),
  name: "Standby battery",
  note: "Between the firewall and the instrument panel, arm 10.8. Feeds only the ESSENTIAL BUS — automatically when the main bus falls below 20 V, for at least 30 minutes; it cannot power the transponder (POH 7-47, 3-15, 3-35).",
  pin: true,
});
part(() => box(0.06, 0.05, 0.08), ["electrical"], {
  pos: P3(12, -9.5, 54),
  color: "#8A7A3A",
  name: "Standby battery controller",
  note: "On/off control, test load with an overheat switch, and a current shunt for S BATT; it senses main bus voltage through the WARN breaker; 25 A fuse at the battery (Fig. 7-7 Sheet 3).",
});
part(() => box(0.012, 0.025, 0.02), ["electrical"], {
  pos: P3(18.1, -18.3, 64.7),
  color: "#C9D0D5",
  anim: (m) => {
    const v = S().elec.stby;
    m.rotation.z = v === "ARM" ? 0.5 : v === "TEST" ? -0.5 : 0;
  },
  name: "STBY BATT switch",
  note: "Upper left corner of the pilot's panel: ARM – OFF – TEST (TEST momentary). Before start: TEST 20 s (hold; the green lamp must not go off) — then ARM (the PFD comes on) and check BUS E ≥ 24 V, M BUS ≤ 1.5 V, BATT S negative, STBY BATT shown (POH 7-10, 4-13).",
  pin: true,
});
part(() => sph(0.008), ["electrical"], {
  pos: P3(18.1, -17.2, 64.7),
  color: "#1E5A2A",
  anim: glow("#1E5A2A", () => EL().testLamp, ["electrical"], "#33FF66"),
  name: "STBY BATT TEST lamp",
  note: "Green lamp right of the switch; it must stay lit through the 20-second test (POH 4-13).",
});
// MASTER and AVIONICS side by side below STBY BATT, left of the PFD (POH Fig. 7-2; photos)
part(() => box(0.012, 0.04, 0.03), ["electrical"], {
  pos: P3(18.1, -18.4, 60.9),
  color: "#C8313B",
  anim: (m) => {
    m.rotation.z = S().elec.bat ? 0.3 : -0.3;
  },
  name: "MASTER switch (ALT | BAT)",
  note: "Red two-pole rocker below STBY BATT, AVIONICS to its right: BAT controls the battery relay, ALT the alternator field; ALT can't be ON without BAT (POH 7-51).",
  pin: true,
});
part(() => box(0.012, 0.04, 0.03), ["electrical", "avionics"], {
  pos: P3(18.1, -16.9, 60.9),
  color: "#E8ECEE",
  anim: (m) => {
    m.rotation.z = S().elec.avn1 ? 0.3 : -0.3;
  },
  name: "AVIONICS switch (BUS 1 | BUS 2)",
  note: "Two-pole rocker for AVIONICS BUS 1 and BUS 2 — both OFF before the MASTER is turned on or off, for starting and for external power (POH 7-47).",
  pin: true,
});
// both just below the switch panel, under the control wheel, with panel below them to the lower edge (NAV III panel photos)
part(() => box(0.012, 0.07, 0.075), ["electrical"], {
  pos: P3(17.9, -16.6, 50),
  color: "#3A3424",
  name: "Circuit breaker panel (BUS 1 · BUS 2 · X-FEED)",
  note: "Below the switch panel, outboard end (low-confidence position): ELECTRICAL BUS 1, BUS 2 and X-FEED breakers are non-pullable — they can only trip and be pushed back in (POH 7-11, 7-55).",
  pin: true,
});
part(() => box(0.012, 0.07, 0.15), ["electrical", "avionics"], {
  pos: P3(17.9, -11.4, 50),
  color: "#3A3424",
  name: "Circuit breaker panel (ESS · AVN 1 · AVN 2)",
  note: "Below the switch panel, inboard of the other breaker panel: ESSENTIAL BUS, AVN BUS 1 and AVN BUS 2 breakers, all pullable (POH 7-11, 7-55).",
  pin: true,
});
part(() => box(0.012, 0.07, 0.12), ["electrical", "lighting"], {
  pos: P3(17.9, -13.3, 53.8),
  color: "#2F3A42",
  name: "Switch panel",
  note: "Below the lower left corner of the PFD, internally lit: LIGHTS (BEACON, LAND, TAXI, NAV, STROBE) across the top, FUEL PUMP, PITOT HEAT and CABIN PWR 12V (if installed) below. Up = ON (POH 7-10, 7-57). Where CABIN PWR 12V sits on the panel is approximate.",
  pin: true,
});
part(() => box(0.08, 0.06, 0.1), ["electrical", "cabin"], {
  pos: P3(12, 16, 50),
  color: "#8A7A3A",
  name: "12 V power converter",
  note: "Cabin side of the firewall, forward of the right panel: 28 → 12 V, up to 10 A to the POWER OUTLET 12V – 10A on the pedestal. CABIN LTS/PWR breaker; Fig. 7-7 marks the 12V CAB PWR switch “if installed” (POH 7-73, 7-49).",
});
part(() => cyl(0.012, 0.02, "x"), ["electrical", "cabin"], {
  pos: P3(27.3, 2, 36),
  color: "#20262B",
  name: "POWER OUTLET 12V–10A",
  note: "Center pedestal (Fig. 7-2 item 29). Not for flight-critical devices; off for takeoff and landing (POH 7-73, 2-19).",
});
