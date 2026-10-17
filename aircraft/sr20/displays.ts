/**
 * Live Perspective+ displays for the SR20 G6: PFD, MFD (Engine Strip + map) and reversionary mode drawn with the shared
 * Garmin renderer (lib/avionics/g1000, Perspective+ style), plus the MD302 standby (lib/avionics/md302.ts).
 *
 * The SR20 has no flight model or autopilot sim: attitude follows the yokes and the air data is a fixed cruise picture
 * (124 KIAS, 4,500 ft, heading 360°). Engine and electrical readings come from the sim (`live`, the electrical solution).
 */
import { type FlightData, type Gauge, type PfdData, type SpeedBands } from "@/lib/avionics/g1000";
import { f0, f1, gauge, sgn } from "@/lib/avionics/g1000/gauges";
import { drawMd302 } from "@/lib/avionics/md302";
import { cruiseFlight, perspectiveScreens, pw } from "../cirrus/displays";
import { clamp } from "@/lib/math";
import { casMessages, live, mapInHg, type Elec, type Sim } from "./model";

export { drawOff } from "@/lib/canvas";

type Ctx = CanvasRenderingContext2D;

/**
 * Airspeed tape, POH 2-5 markings: white 62–110, green 71–164, yellow 164–201, red line 201 KIAS. Cyan references:
 * Vr 71 (short-field rotation, 4-16), Vx 81 (best angle, 50% flaps, 4-22), Vy 96 (sea level, 4-3), best glide 100 KIAS (3,150 lb, 3-8).
 */
export const SPEEDS: SpeedBands = {
  white: [62, 110],
  green: [71, 164],
  yellow: [164, 201],
  red: 201,
  vr: 71,
  vx: 81,
  vy: 96,
  vg: 100,
};

/** Fixed cruise picture the SR20 displays have always shown. */
const IAS = 124,
  TAS = 131,
  ALT = 4500,
  HDG = 360,
  BARO = 29.92;

/** Under the CAPS canopy the airspeed shows dashes. */
const ias = () => (live.capsT >= 0 ? 0 : IAS);

const flight = (s: Sim, E: Elec): FlightData =>
  cruiseFlight(s, E, {
    ias: ias(),
    tas: TAS,
    alt: ALT,
    hdg: HDG,
    baro: BARO,
    // ADAHRS 1 (ESS BUS 1) or 2 (MAIN BUS 2) feeds attitude, heading and air data; with both lost they show red X's
    fail: E.ahrs1 || E.ahrs2 ? undefined : { att: true, air: true, hdg: true },
  });

/**
 * Percent power, estimated from RPM and manifold pressure (illustrative: the model has no power calculation). A straight-line
 * fit to the POH 5-31 cruise table at 4,000 ft ISA (2,500 RPM: 76% at 25.2 in., 54% at 19.7 in.), scaled with RPM.
 * Null without ENGINE INSTR power, like the rest of the engine data.
 */
const pctPower = (s: Sim, E: Elec) => {
  if (!E.eisPwr) return null;
  const rpm = live.rpm;
  return rpm < 200 ? 0 : clamp(4 * (rpm / 2500) * (mapInHg(s, rpm) - 6.2), 0, 100);
};

// No AFCS status: the model has no autopilot sim, and with the flight director off the Perspective+ AFCS row is blank (PG Fig 2-1).
const pfdData = (s: Sim, E: Elec): PfdData => ({
  f: flight(s, E),
  speeds: SPEEDS,
  alerts: casMessages(s, E),
  pctPower: pctPower(s, E),
  style: "perspective",
});

/**
 * Engine Strip (PG 190-02183-03 Fig 3-2; markings POH 2-9, 2-10), top to bottom, for what the model has: % Pwr (estimated,
 * see pctPower), RPM and Man "Hg as digital rows, fuel quantity L/R with fuel flow beside it, Batt 1 A and Ess Bus V.
 * RPM, manifold pressure, fuel quantity and the electrical values come from the sim; fuel flow is illustrative (no
 * fuel-flow model). GAL Used, oil, CHT and EGT aren't simulated and are left off. Main-bus volts and alternator amps are on
 * the ENGINE page, not the strip (POH 7-53), so they aren't drawn here (the Electrical panel shows them). Everything comes
 * through the Engine Airframe Unit (POH 7-33, 7-42, 7-53), so every item shows a red X when it loses ENGINE INSTR power.
 */
export function eisGauges(s: Sim, E: Elec): Gauge[] {
  const ok = E.eisPwr,
    v = (x: number) => (ok ? x : null);
  const rpm = Math.round(live.rpm / 10) * 10;
  // fuel quantity: float sensors on the FUEL QTY breaker (MAIN BUS 1); red 0, yellow 0–10, green 10–28 gal (each tank's
  // pointer takes its band's colour); fuel flow beside it
  const fq = ok && pw(s, E, "main1", "FUEL QTY");
  const ff = s.eng.running ? 3 + s.eng.lever * 13 * s.eng.mix : 0; // illustrative fuel flow (no fuel-flow model)
  const fuel: Gauge = {
    key: "fuel",
    label: "GAL",
    style: "tanks",
    min: 0,
    max: 28,
    bands: [
      [0, 0.5, "red"],
      [0.5, 10, "yellow"],
      [10, 28, "green"],
    ],
    value: fq ? s.fuel.qL : null,
    value2: fq ? s.fuel.qR : null,
    side: gauge("ff", "FFlow GPH", "bar", 0, 25, [[0, 21, "green"]], v(ff), f1),
  };
  const pct = pctPower(s, E);
  return [
    gauge("pwr", "% Pwr", "dial", 0, 100, [[0, 100, "green"]], pct == null ? null : Math.round(pct), f0),
    // RPM warning above 2,730 (POH 2-9 note a; the sim never gets there)
    {
      ...gauge(
        "rpm",
        "RPM",
        "text",
        0,
        3000,
        [
          [500, 2700, "green"],
          [2700, 3000, "red"],
        ],
        v(rpm),
        f0,
      ),
      alert: ok && rpm > 2730 ? "warning" : null,
    },
    gauge("map", 'Man "Hg', "text", 10, 35, [[15, 29.5, "green"]], v(mapInHg(s, live.rpm)), f1),
    fuel,
    gauge(
      "b1",
      "Batt 1 A",
      "text",
      -59,
      59,
      [
        [-59, -5, "yellow"],
        [-4, 59, "green"],
      ],
      v(E.b1),
      sgn,
    ),
    gauge(
      "ess",
      "Ess Bus V",
      "text",
      0,
      36,
      [
        [0, 24.4, "red"],
        [24.5, 32, "green"],
        [32, 36, "red"],
      ],
      v(E.ess1),
      f1,
    ),
  ];
}

export { mfdReversion, pfdReversion } from "../cirrus/displays";
export const { drawPfdScreen, drawMfdScreen } = perspectiveScreens(pfdData, eisGauges);

/**
 * MD302 standby (lib/avionics/md302.ts): attitude follows the yokes, air data is the fixed cruise picture and the BARO box
 * follows the Garmin baro (POH 7-21). Colour bars from the POH 2-5 markings: green 71–164, yellow 164–201, red from 201,
 * white flap range 62–110.
 */
export function drawStandby(ctx: Ctx, W: number, H: number, s: Sim) {
  drawMd302(ctx, W, H, {
    roll: s.ctrl.roll * 25,
    pitch: s.ctrl.pitch * 10,
    ias: ias(),
    alt: ALT,
    baro: BARO,
    bands: { white: SPEEDS.white!, green: SPEEDS.green!, yellow: SPEEDS.yellow!, red: SPEEDS.red! },
  });
}
