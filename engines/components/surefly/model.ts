/**
 * The SureFly SIM4P ignition module (a 4-cylinder impulse-coupled magneto replacement) as pure functions: the dip
 * switch table, the LED codes, the timing it fires at, the internal timing (sync) light and the spark events.
 *
 * Sources: SureFly SIM4P Installation Instructions SF1001 Rev B (cited "SF1001 p. n") and SureFly's tech page
 * (surefly.net/tech). SureFly sets the advance map at the factory and doesn't publish it; `ADVANCE_SHAPE` is an
 * illustrative shape between the documented limits, and every other assumption is marked. See SOURCES.md.
 */

/** Engine timings the dip switch can be set to, degrees BTDC, in the table's order (SF1001 §2.7 p. 8). */
export const TIMINGS = [30, 28, 26, 25, 24, 22, 20, 18] as const;
export type Timing = (typeof TIMINGS)[number];
export type Mode = "advance" | "fixed";

/** Dip switches 1–4: true is ON (up, toward the SIM shaft; SF1001 §2.7 h). */
export type Dip = [boolean, boolean, boolean, boolean];

/** "Up to 38° of advance may be reached by the SureFly SIM" (SF1001 §1.2 p. 4). */
export const MAX_ADVANCE = 38;
/** Supply the SIM needs to operate, volts (SF1001 §1.1 p. 3). */
export const SUPPLY = { min: 8.5, max: 30 };
/** Manifold pressure sensor range, inHg (tech page; a retailer's page says 6–74, see SOURCES.md). */
export const MAP_RANGE = { min: 5, max: 45 };
/** The internal TDC light goes out over a ½° window (SF1001 §2.9 g). */
export const LED_WINDOW = 0.5;
/** A synced SIM's light goes out within this many degrees of #1 TDC (SF1001 §2.11 c). */
export const SYNC_TOLERANCE = 2;
/** The code repeats for 4 cycles, then the LED goes inactive (SF1001 §3.3 d). */
export const LED_CYCLES = 4;
/** A fault blinks the LED at 12 per second: "stop and contact SureFly" (SF1001 §3.3 g). */
export const FAULT_BLINK_HZ = 12;

/**
 * Below this speed the SIM fires at top dead centre: "Retards spark to TDC w/full spark energy" (tech page). The
 * speed where it changes over isn't published; an assumption.
 */
export const START_RPM = 400;

/**
 * Illustrative advance shape (an assumption): SureFly says only that advance mode adds advance beyond the data-plate
 * timing "under specific RPM and MAP conditions", up to 38° (SF1001 §1.2), with the map "hard set at the factory"
 * (tech page). Here the extra advance grows as manifold pressure falls below `mapStart` (full at `mapFull`) and as
 * speed rises above `rpmStart` (full at `rpmFull`): more advance at part throttle, none at full throttle.
 */
export const ADVANCE_SHAPE = { mapStart: 25, mapFull: 17, rpmStart: 1200, rpmFull: 2000 };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** The dip switch setting for an engine timing and mode (SF1001 §2.7 table). */
export function dipFor(timing: Timing, mode: Mode): Dip {
  const i = TIMINGS.indexOf(timing);
  // switch 1 OFF selects advance; switches 2–4 count down the table with OFF as 1 (30° is ON ON ON, 18° OFF OFF OFF)
  return [mode === "fixed", !(i & 4), !(i & 2), !(i & 1)];
}

/** What a dip switch setting selects. */
export function readDip(dip: Dip): { mode: Mode; timing: Timing } {
  const i = (dip[1] ? 0 : 4) + (dip[2] ? 0 : 2) + (dip[3] ? 0 : 1);
  return { mode: dip[0] ? "fixed" : "advance", timing: TIMINGS[i] };
}

/**
 * The LED code for a dip setting, one blink per switch: a short blink for ON, a long one for OFF, as the table's
 * "LED Code" column writes them ("-" and "—"; SF1001 §2.7).
 */
export const ledCode = (dip: Dip): ("short" | "long")[] => dip.map((on) => (on ? "short" : "long"));
export const ledCodeText = (dip: Dip) =>
  ledCode(dip)
    .map((b) => (b === "short" ? "-" : "—"))
    .join("");

/** What the SIM sees and is fed. */
export interface Inputs {
  dip: Dip;
  /** Supply voltage at the POWER terminal. */
  volts: number;
  /** Ignition switch ON: the p-lead is not grounded. OFF grounds it and stops the spark, as with a magneto. */
  ignition: boolean;
  rpm: number;
  /** Engine manifold pressure, inHg. */
  map: number;
  /** Ambient pressure, inHg: what the port reads with no hose on it. */
  ambient: number;
  /** The manifold pressure hose is connected. */
  hose: boolean;
  /** Internal fault: the LED blinks rapidly (SF1001 §3.3 g). How the spark behaves then isn't published. */
  fault?: boolean;
}

export const powered = (v: number) => v >= SUPPLY.min && v <= SUPPLY.max;

/** Manifold pressure the SIM reads: the engine's through the hose, else the open port's ambient; sensor-limited. */
export const sensedMap = (x: Pick<Inputs, "map" | "ambient" | "hose">) =>
  Math.min(MAP_RANGE.max, Math.max(MAP_RANGE.min, x.hose ? x.map : x.ambient));

/** Extra advance beyond the data-plate timing in advance mode, degrees (illustrative, see `ADVANCE_SHAPE`). */
export function extraAdvance(timing: number, rpm: number, map: number) {
  const s = ADVANCE_SHAPE;
  const fMap = clamp01((s.mapStart - map) / (s.mapStart - s.mapFull));
  const fRpm = clamp01((rpm - s.rpmStart) / (s.rpmFull - s.rpmStart));
  return (MAX_ADVANCE - timing) * fMap * fRpm;
}

export interface Firing {
  /** Plugs fire. */
  fires: boolean;
  /** Spark timing, degrees before top dead centre (0 while starting). */
  btdc: number;
  /** Why: shown on the page. */
  why: string;
  mode: Mode;
  timing: Timing;
  map: number;
}

/** When the SIM fires, and why. */
export function firing(x: Inputs): Firing {
  const { mode, timing } = readDip(x.dip);
  const map = sensedMap(x);
  const base = { mode, timing, map };
  if (!powered(x.volts))
    return {
      ...base,
      fires: false,
      btdc: 0,
      why: `No spark: the SIM needs ${SUPPLY.min}–${SUPPLY.max} V`,
    };
  if (!x.ignition) return { ...base, fires: false, btdc: 0, why: "No spark: the switch grounds the p-lead" };
  if (x.rpm <= 0) return { ...base, fires: false, btdc: 0, why: "Ready: fires when the shaft turns" };
  if (x.rpm < START_RPM) return { ...base, fires: true, btdc: 0, why: "Starting: spark retarded to TDC" };
  if (mode === "fixed") return { ...base, fires: true, btdc: timing, why: "Fixed mode: data-plate timing" };
  const extra = extraAdvance(timing, x.rpm, map);
  return {
    ...base,
    fires: true,
    btdc: timing + extra,
    why: extra > 0.05 ? "Advance mode: advanced for rpm and MAP" : "Advance mode: at data-plate timing",
  };
}

/**
 * Lycoming four-cylinder firing order 1-3-2-4: each cylinder's compression top dead centre in the 720° cycle, from #1.
 */
export const TDC: Record<number, number> = { 1: 0, 3: 180, 2: 360, 4: 540 };
/**
 * A wasted-spark system (tech page) fires a pair of plugs together: one on its compression stroke, its partner 360°
 * later in the cycle on its exhaust stroke. With the 1-3-2-4 order those pairs are 1 and 2, 3 and 4 (inferred).
 */
export const PARTNER: Record<number, number> = { 1: 2, 2: 1, 3: 4, 4: 3 };

const wrap = (a: number, m: number) => ((a % m) + m) % m;

/**
 * Crank angles (0 … 720) where each cylinder's plug fires on its compression stroke, for a timing and the SIM's sync
 * error (`err`: the crank angle, after #1 TDC, where its internal TDC falls; 0 when synced).
 */
export const sparkAngle = (cyl: number, btdc: number, err = 0) => wrap(TDC[cyl] - btdc + err, 720);

/**
 * The sparks while the crank turns `dist` degrees forward from `prev` (0 … 720), in the order they fire, a whole cycle
 * or more included: each event fires a cylinder on compression and its partner on exhaust. Returns [cylinder on
 * compression, wasted partner] pairs.
 */
export function sparksBetween(prev: number, dist: number, btdc: number, err = 0): [number, number][] {
  const events: [number, number, number][] = [];
  for (const cyl of [1, 3, 2, 4])
    for (let ahead = wrap(sparkAngle(cyl, btdc, err) - prev, 720); ahead < dist; ahead += 720)
      events.push([ahead, cyl, PARTNER[cyl]]);
  return events.sort((a, b) => a[0] - b[0]).map(([, cyl, partner]) => [cyl, partner]);
}

/**
 * The internal timing light, powered at the TIMING terminal (SF1001 §2.9): green, going out over a ½° window at the
 * SIM's internal TDC. `internal` is the shaft's angle from that point, degrees. The magneto drive turns at crank
 * speed on a four-cylinder Lycoming (magneto drive ratio 1.000:1, O-360 OM p. 2-7), so the point comes round once a
 * revolution, at #1's compression and exhaust top centres alike: which is why the SIM fires a wasted spark.
 */
export const syncLight = (internal: number, pLeadGrounded: boolean) =>
  // "The SIM LED will not turn on if the p-lead terminal is grounded" (§2.9 e)
  !pLeadGrounded && wrap(internal, 360) >= LED_WINDOW;

/** Assumed blink lengths, seconds: SF1001 gives the code's pattern, not its timing. */
export const BLINK = { short: 0.18, long: 0.6, gap: 0.3, pause: 1.4 };

/** One code cycle as [on, off] seconds per blink, the pause after the last blink. */
function cycle(dip: Dip) {
  return ledCode(dip).map((b, i, all) => [BLINK[b], i === all.length - 1 ? BLINK.pause : BLINK.gap] as const);
}

/** Length of one code cycle, seconds. */
export const cycleLength = (dip: Dip) => cycle(dip).reduce((t, [on, off]) => t + on + off, 0);

/**
 * The LED `t` seconds after the switch was turned on with power: the code blinks for 4 cycles, then the LED goes
 * inactive (SF1001 §3.3 c–d); a fault blinks at 12 per second (§3.3 g).
 */
export function codeLight(dip: Dip, t: number, fault = false) {
  if (t < 0) return false;
  if (fault) return wrap(t * FAULT_BLINK_HZ, 1) < 0.5;
  const len = cycleLength(dip);
  if (t >= len * LED_CYCLES) return false;
  let u = wrap(t, len);
  for (const [on, off] of cycle(dip)) {
    if (u < on) return true;
    u -= on + off;
    if (u < 0) return false;
  }
  return false;
}

/**
 * Data-plate timings the page offers as examples, from each engine's own manual. Whether a SIM model is approved for
 * an engine is SureFly's Approved Model List's call (SF1001 §2.1), not this page's.
 */
export const ENGINES = [
  { id: "o360", name: "Lycoming O-360-A1D", timing: 25 as Timing, ref: "O-360 Operator's Manual p. 2-1: 25° BTC" },
  { id: "io390", name: "Lycoming IO-390-C", timing: 20 as Timing, ref: "IO-390 IOM Table A-1: 20° BTC" },
];
