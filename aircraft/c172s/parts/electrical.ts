/** C172S catalogue: electrical system (POH 7-47, Figure 7-7) — batteries, J-box, alternator, switch and breaker panels. */
import { glowAnim as glow } from "@/lib/anims";
import type { Vec3 } from "@/lib/math";
import { X, Y, Z, box, cyl, onSkin, sph } from "../geometry";
import { alternatorDrive } from "../../cessna/accessories";
import { cbHeads, switchRows } from "../../cessna/faceplate";
import { P3, PV, part, S, EL } from "./catalogue";

/* ---------- electrical (POH 7-47, Figure 7-7) ---------- */
const ELEC = "#D9960F";
// Retain the equipment-list arm. Approximate BL/height put the complete case inside the rounded cowl,
// below the upper-left mount tube and above the J-box. Share the bottom terminal with its cable.
export const MAIN_BATTERY: Vec3 = P3(-5, -15.5, 50.5);
export const BATTERY_TERMINAL: Vec3 = [MAIN_BATTERY[0], MAIN_BATTERY[1] - 0.1, MAIN_BATTERY[2]];
export const JBOX: Vec3 = P3(-2.5, -15, 43);
part(() => box(0.12, 0.2, 0.18), ["electrical"], {
  pos: MAIN_BATTERY,
  color: ELEC,
  anim: glow(ELEC, () => EL().mBatt < -0.5, ["electrical"], "#FF8A3D"),
  name: "Main battery — 24 V",
  note: "Inside the engine cowling on the left firewall (POH 7-47), arm −5.0; case dimensions, height and distance from the centreline are approximate. Equipment list: 24 V, 8.0 Ah (POH 6-19; the KAP 140 edition lists 12.75 Ah).",
  pin: true,
});
part(() => box(0.1, 0.16, 0.14), ["electrical"], {
  pos: JBOX,
  color: "#8A7A3A",
  fairing: true,
  name: "Power distribution module (J-box)",
  note: "Left forward firewall: battery relay (master contactor), starter contactor, alternator relay, the Alternator Control Unit, main battery current shunt, external power relay and three push-to-reset bus feeder breakers (POH 7-47, 7-57). Case dimensions and internal mounting positions are schematic.",
  pin: true,
});
part(() => box(0.05, 0.05, 0.04), ["electrical"], {
  pos: P3(-1.75, -14, 44.5),
  color: "#C9B98F",
  name: "Alternator Control Unit (ACU)",
  note: "Inside the J-box: regulates the alternator and opens the ALT FIELD breaker if voltage passes about 31.75 V; signals LOW VOLTS below 24.5 V (POH 3-36, 7-55).",
  pin: true,
});
part(() => box(0.03, 0.03, 0.05), ["electrical"], {
  pos: P3(-2, -16.5, 41.5),
  color: "#8C959C",
  name: "Main battery current shunt",
  note: "Ammeter transducer → M BATT AMPS. The starter draws upstream of it, so cranking current doesn't show (Fig. 7-7 Sheet 1).",
});
part(() => box(0.07, 0.08, 0.015), ["electrical"], {
  pos: PV(onSkin(X(-3), Y(40), -1, 1.012)),
  color: ELEC,
  name: "External power receptacle",
  note: "Integral to the J-box, door on the left side of the cowl near the firewall. MASTER and AVIONICS off before connecting; regulated 28 V for avionics work (POH 7-58, 4-13).",
  ext: true,
  pin: true,
});
const DRIVE = alternatorDrive(P3, {
  bodyFs: -29,
  beltFs: -33.4,
  crank: { bl: 0, h: 50.375, r: 2.6 },
  alt: { bl: 9.5, h: 39.1, r: 1.4 },
});
export const ALTERNATOR = DRIVE.position;
part(DRIVE.bodyGeo, ["electrical", "engine"], {
  pos: ALTERNATOR,
  color: ELEC,
  anim: glow(ELEC, () => EL().altOn, ["electrical", "engine", "overview"], "#FFD34D"),
  name: "Alternator — 28 V, 60 A",
  note: "Belt driven, front of the engine (POH 7-29, 7-47), arm −29.0. Field through the ALT FIELD breaker and MASTER (ALT). Lateral/vertical position, shaft and pulley dimensions are schematic: the body sits clear of the crankcase and sump, with both pulleys in one plane.",
  pin: true,
});
part(DRIVE.beltGeo, ["electrical", "engine"], {
  color: "#20262B",
  name: "Alternator belt",
  note: "A broken belt is a common cause of alternator failure (POH 3-36).",
});
part(() => box(0.14, 0.12, 0.16), ["electrical"], {
  pos: P3(11.2, -14, 51),
  color: ELEC,
  anim: glow(ELEC, () => EL().stbyOnline, ["electrical"], "#FF8A3D"),
  name: "Standby battery",
  note: "Between the firewall and the panel, arm 11.2 (POH 7-47, 6-19). Feeds only the ESSENTIAL BUS — automatically when M BUS falls below 20 V, for at least 30 minutes; it can't run the transponder (POH 3-17, 3-38).",
  pin: true,
});
part(() => box(0.06, 0.05, 0.08), ["electrical"], {
  pos: P3(12, -9.5, 54.7),
  color: "#8A7A3A",
  name: "Standby battery controller",
  note: "On/off control, test load and overheat switch, current shunt with two 5 A fuses; senses main bus voltage through the WARN breaker. 25 A fuse at the battery (Fig. 7-7 Sheet 3).",
});
part(() => box(0.012, 0.025, 0.02), ["electrical"], {
  pos: P3(18.1, -18.3, 64.4),
  color: "#C9D0D5",
  anim: (m) => {
    const v = S().elec.stby;
    m.rotation.z = v === "ARM" ? 0.5 : v === "TEST" ? -0.5 : 0;
  },
  name: "STBY BATT switch",
  note: "Upper left corner of the pilot panel: ARM – OFF – TEST (TEST is momentary). Before start: TEST 10 s (green lamp stays on), then ARM and check BUS E ≥ 24 V, M BUS ≤ 1.5 V, BATT S negative, STBY BATT shown (POH 4-12).",
  pin: true,
});
// right of the switch, short of the PFD's left edge (BL −15.9)
part(() => sph(0.008), ["electrical"], {
  pos: P3(18.1, -17.2, 64.4),
  color: "#1E5A2A",
  anim: glow("#1E5A2A", () => EL().testLamp, ["electrical"], "#33FF66"),
  name: "STBY BATT TEST lamp",
  note: "Green LED right of the switch; must not go out during the 10 s test (POH 4-12). It may not light in cold weather (POH 4-47).",
});
// MASTER and AVIONICS side by side below STBY BATT (POH 7-10, Fig. 7-2; photos)
part(() => box(0.012, 0.04, 0.03), ["electrical"], {
  pos: P3(18.1, -18.4, 60.6),
  color: "#C8313B",
  anim: (m) => {
    m.rotation.z = S().elec.bat ? 0.3 : -0.3;
  },
  name: "MASTER switch (ALT | BAT)",
  note: "Two-pole rocker: BAT controls the battery relay, ALT the alternator field. ALT can't be ON without BAT (POH 7-51).",
  pin: true,
});
part(() => box(0.012, 0.04, 0.03), ["electrical", "avionics"], {
  pos: P3(18.1, -16.9, 60.6),
  color: "#E8ECEE",
  anim: (m) => {
    m.rotation.z = S().elec.avn1 ? 0.3 : -0.3;
  },
  name: "AVIONICS switch (BUS 1 | BUS 2)",
  note: "Two-pole rocker for AVIONICS BUS 1 and BUS 2 — both OFF before MASTER on/off, starting, or external power (POH 7-52).",
  pin: true,
});
// three rows just below the switch panel, under the control wheel, with panel below them to the lower edge (NAV III panel photos)
part(() => box(0.012, 0.075, 0.25), ["electrical"], {
  pos: P3(17.8, -10.2, 49.6),
  color: "#3A3424",
  name: "Circuit breaker panel",
  note: "Below the switch panel, under the pilot's control wheel: CROSSFEED, BUS 1, BUS 2 on the left; ESS, AVN BUS 1, AVN BUS 2 on the right. Only ESS and AVN breakers can be pulled (POH 7-11, 7-57).",
  pin: true,
});
part(() => box(0.012, 0.07, 0.12), ["electrical", "lighting"], {
  pos: P3(17.8, -13.3, 53.4),
  color: "#2F3A42",
  name: "Switch panel",
  note: "Below the lower left corner of the PFD: LIGHTS (BEACON, LAND, TAXI, NAV, STROBE) across the top, FUEL PUMP, PITOT HEAT and CABIN PWR 12V below. Up = ON (POH 7-11, 7-59). Where CABIN PWR 12V sits on the panel is approximate.",
  pin: true,
});
// switch panel rockers, up = ON (POH 7-11): BEACON, LAND, TAXI, NAV, STROBE on top; FUEL PUMP, PITOT HEAT, CABIN PWR 12V below
switchRows([
  [
    () => S().lights.beacon,
    () => S().lights.land,
    () => S().lights.taxi,
    () => S().lights.nav,
    () => S().lights.strobe,
  ],
  [() => S().fuel.pump, () => S().pitot.heat, () => S().lights.cabinPwr],
]).forEach(([y, z, on]) =>
  part(() => box(0.01, 0.022, 0.012), ["electrical", "lighting"], {
    pos: [X(17.8) - 0.011, Y(53.4) + y, Z(-13.3) + z],
    color: "#D8DDE0",
    anim: (m) => {
      m.rotation.z = on() ? -0.3 : 0.3;
    },
  }),
);
// breaker heads: CROSSFEED, BUS 1 and BUS 2 on the left, ESS, AVN BUS 1 and AVN BUS 2 on the right
part(() => cbHeads(13), ["electrical", "avionics"], { pos: [X(17.8) - 0.009, Y(49.6), Z(-10.2)], color: "#1A1D20" });
part(() => box(0.08, 0.06, 0.1), ["electrical", "cabin"], {
  pos: P3(12, 16, 50),
  color: "#8A7A3A",
  name: "12 V power converter",
  note: "Forward of the right panel: 28 → 12 V, up to 10 A to the POWER OUTLET 12V–10A on the pedestal. CABIN PWR 12V switch; not for flight-critical devices; off for takeoff and landing (POH 7-77, 2-19).",
});
part(() => cyl(0.012, 0.02, "x"), ["electrical", "cabin"], {
  pos: P3(25.9, -1, 33.5),
  color: "#20262B",
  name: "POWER OUTLET 12V–10A",
  note: "Center pedestal (POH 7-77). CABIN LTS/PWR breaker, ELECTRICAL BUS 1.",
});
