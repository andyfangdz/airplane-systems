/**
 * The replay: the flight data at any moment of the video, the states the animation shows as words (gear handle, slat
 * locks), the stick shaker the slat fault disabled, the track over the ground for the 3D view, and the moments the page's
 * timeline marks. Times are seconds into the video, so the cockpit audio, the data and the account share one clock.
 */
import { FDR, FDR_DT, FDR_T0 } from "./fdr";
import { C5_DIEGO_GARCIA, LACKLEN, ANIMATION } from "./spec";
import { TRACE } from "./trace";

export const T_START = FDR_T0;
export const T_END = FDR_T0 + (FDR.ias.length - 1) * FDR_DT;
/** The whole video, title cards included. */
export const DURATION = C5_DIEGO_GARCIA.video.duration;

/** The gear handle as the animation's "GEAR HDL" shows it: [from, position]. */
export const GEAR_HANDLE: readonly (readonly [number, "UP" | "DOWN"])[] = [
  [0, "UP"],
  [26.7, "DOWN"],
  [95.7, "UP"],
];

/** The slats' retract lock shows LOCKED until they start out; afterwards NO LOCK to the end. */
export const SLAT_RET_LOCKED_UNTIL = 9.3;

/** When the slats' extend lock shows LOCKED: [from, to). Every other time it shows NO LOCK. */
export const SLAT_EXT_LOCKED: readonly (readonly [number, number])[] = [
  [122.3, 134.6],
  [142.7, 143.3],
  [145.3, Infinity],
];

/** The animation's airspeed never reads below this; at it the airplane was this slow or slower. */
export const IAS_FLOOR = 50;

const FT = 0.3048,
  KT = 1852 / 3600;

export interface Frame {
  /** Seconds into the video. */
  t: number;
  /** False on the title cards, before the data starts: the values are the first sample's. */
  data: boolean;
  ias: number;
  /** The airspeed is at the animation's floor: 50 kt or less. */
  iasFloor: boolean;
  alt: number;
  /** Vertical speed, ft/min: the slope of the altitude over VS_WINDOW_S. The animation doesn't show one, and in the
   * spiral its altitude holds and then drops hundreds of feet in a second, so this is an average, not a VSI. */
  vs: number;
  hdg: number;
  pitch: number;
  /** Right wing down positive. */
  bank: number;
  aoa: number;
  /** The AOA is off the top of the animation's tape. */
  aoaPegged: boolean;
  n1: [number, number, number, number];
  flaps: number;
  gear: "UP" | "DOWN";
  slatExtLocked: boolean;
  slatRetLocked: boolean;
  /** The gear's travel as drawn, 0 up to 1 down: it follows the handle over GEAR_TRANSIT_S (schematic). */
  gearTravel: number;
  /** The slats' travel as drawn: 0 retracted, SLAT_SHORT out but not seated, 1 seated and locked (schematic). */
  slats: number;
  /** The angle of the flight path through the air, degrees up, from the vertical speed and the true airspeed. */
  path: number;
  /** In the cloud: above its base (the tops aren't published). Lacklen: visual again passing 1,500 ft. */
  inCloud: boolean;
}

export const newFrame = (): Frame => ({
  t: 0,
  data: false,
  ias: 0,
  iasFloor: false,
  alt: 0,
  vs: 0,
  hdg: 0,
  pitch: 0,
  bank: 0,
  aoa: 0,
  aoaPegged: false,
  n1: [0, 0, 0, 0],
  flaps: 0,
  gear: "UP",
  slatExtLocked: false,
  slatRetLocked: true,
  gearTravel: 0,
  slats: 0,
  path: 0,
  inCloud: true,
});

const last = FDR.ias.length - 1;

/** The span the vertical speed is a least-squares slope over, centred on each sample. */
export const VS_WINDOW_S = 4;
/** The vertical speed at each sample, ft/min (the window shortens at the ends of the data). */
const VS = (() => {
  const half = Math.round(VS_WINDOW_S / 2 / FDR_DT),
    out = new Float32Array(FDR.alt.length);
  for (let k = 0; k <= last; k++) {
    const a = Math.max(0, k - half),
      b = Math.min(last, k + half);
    let sx = 0,
      sy = 0,
      sxx = 0,
      sxy = 0;
    for (let j = a; j <= b; j++) {
      const x = (j - k) * FDR_DT;
      sx += x;
      sy += FDR.alt[j];
      sxx += x * x;
      sxy += x * FDR.alt[j];
    }
    const n = b - a + 1;
    out[k] = ((n * sxy - sx * sy) / (n * sxx - sx * sx)) * 60;
  }
  return out;
})();
/** The sample index and the fraction toward the next, clamped to the data. */
function at(t: number): [number, number] {
  const x = Math.min(Math.max((t - FDR_T0) / FDR_DT, 0), last);
  const i = Math.min(Math.floor(x), last - 1);
  return [i, x - i];
}
const lerpCh = (ch: readonly number[], i: number, f: number) => ch[i] + (ch[i + 1] - ch[i]) * f;
/** Headings across north: the short way round. */
function lerpHdg(i: number, f: number) {
  const a = FDR.hdg[i],
    d = ((((FDR.hdg[i + 1] - a) % 360) + 540) % 360) - 180;
  return (a + d * f + 360) % 360;
}

/** A channel at `t`, linearly between samples. */
export function channel(name: Exclude<keyof typeof FDR, "n1" | "hdg">, t: number): number {
  const [i, f] = at(t);
  return lerpCh(FDR[name], i, f);
}

export const gearAt = (t: number) => {
  let g: "UP" | "DOWN" = "UP";
  for (const [from, pos] of GEAR_HANDLE) if (t >= from) g = pos;
  return g;
};
export const slatExtLockedAt = (t: number) => SLAT_EXT_LOCKED.some(([a, b]) => t >= a && t < b);

/**
 * How the 3D view moves the gear and the slats. The animation shows only the gear handle and the slats' two locks; how
 * long the gear and the slats take to travel isn't in these sources, so these times are the drawing's, not the C-5's.
 */
export const GEAR_TRANSIT_S = 8;
export const SLAT_TRANSIT_S = 4;
/** Where the slats are drawn while neither lock holds: short of seated, the shortfall exaggerated to be seen. */
export const SLAT_SHORT = 0.8;

const toward = (a: number, b: number, d: number) => (b > a ? Math.min(b, a + d) : Math.max(b, a - d));
/** A position that heads for each command's target at a fixed rate from the command's time. */
function travel(commands: readonly (readonly [number, number])[], transit: number, t: number) {
  let pos = commands[0][1],
    from = commands[0][0],
    target = pos;
  for (let k = 1; k < commands.length && commands[k][0] <= t; k++) {
    pos = toward(pos, target, (commands[k][0] - from) / transit);
    [from, target] = commands[k];
  }
  return toward(pos, target, Math.max(t - from, 0) / transit);
}

const GEAR_COMMANDS = GEAR_HANDLE.map(([t, g]) => [t, g === "DOWN" ? 1 : 0] as const);
const SLAT_COMMANDS: readonly (readonly [number, number])[] = [
  [0, 0],
  [SLAT_RET_LOCKED_UNTIL, SLAT_SHORT],
  ...SLAT_EXT_LOCKED.flatMap(([a, b]) => [[a, 1] as const, ...(Number.isFinite(b) ? [[b, SLAT_SHORT] as const] : [])]),
];
export const gearTravel = (t: number) => travel(GEAR_COMMANDS, GEAR_TRANSIT_S, t);
export const slatTravel = (t: number) => travel(SLAT_COMMANDS, SLAT_TRANSIT_S, t);

/** Fill `out` with the replay at `t` (seconds into the video). */
export function sample(t: number, out: Frame = newFrame()): Frame {
  const [i, f] = at(t);
  out.t = t;
  out.data = t >= T_START;
  out.ias = lerpCh(FDR.ias, i, f);
  out.iasFloor = out.ias <= IAS_FLOOR + 0.05;
  out.alt = lerpCh(FDR.alt, i, f);
  out.vs = VS[i] + (VS[i + 1] - VS[i]) * f;
  out.hdg = lerpHdg(i, f);
  out.pitch = lerpCh(FDR.pitch, i, f);
  out.bank = lerpCh(FDR.bank, i, f);
  out.aoa = lerpCh(FDR.aoa, i, f);
  out.aoaPegged = out.aoa >= 29.5;
  for (let k = 0; k < 4; k++) out.n1[k] = lerpCh(FDR.n1[k], i, f);
  out.flaps = lerpCh(FDR.flaps, i, f);
  out.gear = gearAt(t);
  out.slatExtLocked = slatExtLockedAt(t);
  out.slatRetLocked = t < SLAT_RET_LOCKED_UNTIL;
  out.gearTravel = gearTravel(t);
  out.slats = slatTravel(t);
  out.path = (Math.atan2((out.vs / 60) * FT, tas(out.ias, out.alt)) * 180) / Math.PI;
  out.inCloud = out.alt > C5_DIEGO_GARCIA.cloudBaseFt;
  return out;
}

// ---------------------------------------------------------------- the track over the ground

/** ISA density ratio at a pressure altitude, ft. */
const sigma = (ft: number) => Math.pow(1 - 6.8756e-6 * ft, 4.2559);
/** True airspeed, m/s, from the indicated (kt) at a pressure altitude (ft), in the ISA. */
const tas = (kias: number, ft: number) => (kias * KT) / Math.sqrt(sigma(ft));
const D2R = Math.PI / 180;

/**
 * The magnetic variation at the runway 31 end in the summer of 1998, degrees (negative west): the IGRF-14 main field
 * gives 7.96° W. The heading window reads magnetic. The animation flies that heading as if it were true, on runway 31
 * drawn at about 309°, its magnetic heading (SOURCES.md). Adding this turns both to true.
 */
export const VARIATION_DEG = -7.96;

/**
 * Where the airplane went: metres east and north of the runway 31 end, true, and its height (m). The animation's top
 * view, traced against its runway (`TRACE`), laid on runway 31; the height is the altitude. It is the 3D view's trail.
 */
export const TRACK = (() => {
  const n = FDR.ias.length;
  const east = new Float32Array(n),
    north = new Float32Array(n),
    up = new Float32Array(n);
  const rw = C5_DIEGO_GARCIA.airport.runway.heading31T * D2R,
    [s, c] = [Math.sin(rw), Math.cos(rw)];
  for (let k = 0, j = 0; k < n; k++) {
    const t = FDR_T0 + k * FDR_DT;
    while (j < TRACE.length - 2 && TRACE[j + 1][0] <= t) j++;
    const [t0, a0, r0] = TRACE[j],
      [t1, a1, r1] = TRACE[j + 1],
      x = Math.min(Math.max((t - t0) / (t1 - t0), 0), 1),
      along = a0 + (a1 - a0) * x,
      right = r0 + (r1 - r0) * x;
    east[k] = along * s + right * c;
    north[k] = along * c - right * s;
    up[k] = FDR.alt[k] * FT;
  }
  return { east, north, up };
})();

/** The track at `t`, between samples. */
export function trackAt(t: number): [east: number, north: number, up: number] {
  const [i, f] = at(t);
  const l = (a: Float32Array) => a[i] + (a[i + 1] - a[i]) * f;
  return [l(TRACK.east), l(TRACK.north), l(TRACK.up)];
}

// ---------------------------------------------------------------- runway 31's ILS

const NM = 1852;
const { airport } = C5_DIEGO_GARCIA;

/** Where the airplane is at `t` against runway 31: metres along it from its threshold (negative short of it) and right
 * of its centreline, the localizer's course. */
export function onRunway31(t: number): [along: number, right: number] {
  const [e, n] = trackAt(t);
  const rw = airport.runway.heading31T * D2R,
    [s, c] = [Math.sin(rw), Math.cos(rw)];
  return [e * s + n * c, e * c - n * s];
}

/**
 * The glideslope's height over runway 31's extended centreline, `along` metres from the threshold, ft: 3° up from the
 * threshold at the runway's elevation. The real glide path meets the runway beyond the threshold, abeam the
 * glideslope's antenna, which the sources don't place: it is a little higher than drawn.
 */
export const glideslopeFt = (along: number) =>
  airport.elevationFt + (Math.max(-along, 0) / FT) * Math.tan(airport.ils.glideslopeDeg * D2R);

/** The airplane against the ILS at `t`: nm short of the threshold, ft above the glideslope there, m right of the
 * localizer's course. */
export function ilsAt(t: number) {
  const [along, right] = onRunway31(t);
  return { nm: -along / NM, aboveFt: channel("alt", t) - glideslopeFt(along), right };
}

// ---------------------------------------------------------------- the timeline

export interface Moment {
  t: number;
  title: string;
  text: string;
}

/**
 * The moments the timeline marks. Numbers are the replay's data at that time unless the text gives them to Lacklen;
 * tests/c5-diego-garcia.test.ts checks each against the data.
 */
export const MOMENTS: readonly Moment[] = [
  {
    t: 7,
    title: "Configuring for the approach",
    text: `4,600 ft and 207 kt, turning right with 25° of bank; “Flaps 40” is called. The slats are retracted and locked (${ANIMATION}).`,
  },
  {
    t: 9.3,
    title: "The slats leave their retract lock",
    text: `The slats extend, but their “target” pads don't seat: the extend lock never shows LOCKED, the slat annunciator warns, and the fault disables the stick-shaker stall warning (${LACKLEN}). The flaps start down at the same time and reach 40% at about 52 s.`,
  },
  {
    t: 26.7,
    title: "Gear handle down",
    text: `The animation shows the gear handle DOWN 2.6 s before “Gear down” is heard (29.3 s); the gear coming up shows the same lead. Whether the animation's data leads its audio isn't known; the replay keeps its timing.`,
  },
  {
    t: 38.6,
    title: "“Still an in-transit on our slats”",
    text: `The crew notices the slats haven't locked. The scanner is sent to look at them (66.6 s; ${LACKLEN}: the flight engineer sent him).`,
  },
  {
    t: 62,
    title: "Power up, but no descent",
    text: `N1 rises from about 28% to 77% by 70 s; the airplane stays level near 4,560 ft at 121 kt. ${LACKLEN}: the pilot was in level flight and advanced the throttles to hold his airspeed instead of beginning descent, his attention on what was wrong with his INS.`,
  },
  {
    t: 69.8,
    title: "“Descend”",
    text: `The copilot calls for the descent: they are configured and past the final approach fix (${LACKLEN}). The crew had set up runway 31's ILS (“310 both sides, 109.3”). Its 3° glideslope, 2.0 nm from the threshold, is at about 650 ft; the airplane, at 4,556 ft, is about 3,900 ft above it. Neither record says why it was this high.`,
  },
  {
    t: 78.8,
    title: "The nose comes up",
    text: `Pitch passes 8° (“you're showing like a 10-degree climb” at 80 s). From 4,558 ft at 77 s the airplane climbs to 4,858 ft at 96 s as the airspeed falls from 124 to 89 kt; the AOA passes 17.`,
  },
  {
    t: 89.6,
    title: "Below 100 kt",
    text: `“That's not good” (90.3 s), “Accelerate, accelerate” (95.9 s); N1 stays in the low 80s.`,
  },
  {
    t: 95.7,
    title: "Gear handle up",
    text: `2.6 s before “Gear up” is heard. ${LACKLEN}: probably the start of a missed approach, but the throttles don't move at first; the gear being up may have saved them over the lagoon.`,
  },
  {
    t: 102.2,
    title: "Airspeed at the 50 kt floor",
    text: `For 15 s the airspeed reads 50 kt, the lowest the animation shows; the AOA runs off the top of its tape (30) at 104.6 s. No stall warning: the stick shaker is disabled (${LACKLEN}: the stall begins at 1:46, at 50 kt).`,
  },
  {
    t: 104,
    title: "Highest point, about 4,920 ft",
    text: `${LACKLEN}: 4,900 ft. The copilot has called “TRT” twice at 102 s with N1 at 86%; the throttles go forward, N1 passing 95% at 110.6 s and reaching about 101% at 114 s.`,
  },
  {
    t: 115.3,
    title: "“Put the nose down”",
    text: `In a full stall and falling: about 4,060 ft, 860 ft below the top. ${LACKLEN}: almost 1,000 ft lost; reportedly the pilot is holding full back pressure, with no stick shaker telling him the airplane is stalled.`,
  },
  {
    t: 118,
    title: "Rolling right, 58°",
    text: `The animation's attitude indicator; ${LACKLEN} recalls a near 90° right bank at 1:58, the airspeed having been at 50 kt for 15 s. The nose is falling through level.`,
  },
  {
    t: 122.3,
    title: "Slats lock extended",
    text: `EXT: LOCKED for the first time, diving at 102 kt. It drops out at 134.6 s, comes back briefly at 142.7 s, and holds from 145.3 s.`,
  },
  {
    t: 126,
    title: "90° left bank, nose low, 3,000 ft",
    text: `${LACKLEN} at 2:06: 10° nose low, 90° left bank, passing through 3,000 ft (the animation: 90° left, 5–7° nose down at 3,069–2,862 ft). Silence on the interphone: “We were all saying our prayers.”`,
  },
  {
    t: 134,
    title: "94° right bank, 1,900 ft",
    text: `${LACKLEN} at 2:14: back in a right bank of 110°, passing 2,000 ft, airspeed 105 kt; aerodynamic control is returning. The animation's attitude indicator shows about 94°, the airspeed 96 kt.`,
  },
  {
    t: 135.8,
    title: "Out of the cloud at 1,500 ft",
    text: `${LACKLEN}: passing 1,500 ft the crew regains visual conditions. The tower saw the two wingtip lights one above the other, like a weather balloon rising. “Put the nose down! You've got altitude to work with!”`,
  },
  {
    t: 139.2,
    title: "GPWS: “Terrain”",
    text: `The ground proximity warning as the ocean comes up. The pull-out holds the AOA at 15–18: ${LACKLEN} says the pilot had only two degrees to work with, another stall above 18, and pulled perfectly to 18. The airspeed reaches 150 kt at 140 s.`,
  },
  {
    t: 144.2,
    title: "Lowest point, about 770 ft",
    text: `${LACKLEN}: recovery established at 2:27 at 733 ft above the lagoon. From here the airplane climbs away; the power comes back from 152.6 s, N1 settling near 79%.`,
  },
];
