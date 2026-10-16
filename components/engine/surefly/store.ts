"use client";
/**
 * The SureFly page's state. What the user sets lives in a zustand store, the view toggles in another; the bench itself
 * (crank angle, speed, the LED, the last spark at each plug) is a mutable object advanced every animation frame and
 * read by the scene in `useFrame` and by panels through `useLiveSnapshot`.
 */
import { create } from "zustand";
import {
  codeLight,
  dipFor,
  ENGINES,
  firing,
  START_RPM,
  sparksBetween,
  syncLight,
  type Dip,
  type Inputs,
} from "@/engines/components/surefly/model";
import { createViewStore, useSimLoop } from "../sim";

/** Speed the starter turns the engine on the bench, rpm (an assumption; below `START_RPM`). */
export const CRANK_RPM = 150;
/** Ambient pressure on the bench (sea level), inHg. */
export const AMBIENT = 29.92;
/** How far the ear slots let the body turn either way, degrees (not published; schematic). */
export const CLOCK_RANGE = 8;

export type Stage = "time" | "run";

export interface Ui {
  stage: Stage;
  /** Engine whose data-plate timing the dip switch is set for (`ENGINES`). */
  engine: string;
  dip: Dip;
  // ---- install and time (SF1001 §2.8–2.11)
  /** Temporary power on the TIMING terminal. */
  timingPower: boolean;
  /** SIM mounted on the engine. */
  mounted: boolean;
  /** Drive gear angle by hand before mounting, degrees from the SIM's internal TDC. */
  gear: number;
  /** Engine crank angle by hand, degrees after #1 compression TDC (0 … 720). */
  hand: number;
  /** Shaft angle from internal TDC minus crank angle, set by where the gear meshed when mounted. */
  mesh: number;
  /** Body turned in the ear slots, degrees (moves internal TDC later in crank angle). */
  clock: number;
  // ---- run
  ignition: boolean;
  volts: number;
  rpm: number;
  cranking: boolean;
  map: number;
  hose: boolean;
  fault: boolean;
  set: (p: Partial<Omit<Ui, "set">>) => void;
}

/** `slow` draws the crank slowly enough to see each spark (the bench runs at full speed). */
export const useSfView = createViewStore({ xray: true, labels: true, slow: false, paused: false });

const o360 = ENGINES[0];

export const useUi = create<Ui>((set, get) => ({
  stage: "run",
  engine: o360.id,
  dip: dipFor(o360.timing, "advance"),
  timingPower: true,
  mounted: true,
  gear: 30,
  hand: 0,
  mesh: 0,
  clock: 0,
  ignition: true,
  volts: 13.8,
  rpm: 2400,
  cranking: false,
  map: 22,
  hose: true,
  fault: false,
  set: (p) => {
    const before = get();
    // switching on with power starts the LED code over (SF1001 §3.3 d: cycle the switch to see it again)
    if (p.ignition && !before.ignition) bench.onAt = bench.t;
    set(p);
  },
}));

/** The bench, advanced every frame. */
export const bench = {
  /** Seconds since the page opened. */
  t: 0,
  /** When the switch last went on, for the LED code. */
  onAt: 0,
  rpm: 2400,
  /** Crank angle after #1 compression TDC, 0 … 720 (what the scene draws: slowed in slow motion). */
  crank: 0,
  /** Shaft angle from the SIM's internal TDC, 0 … 360. */
  shaft: 0,
  led: false,
  /** Timing now, degrees BTDC, and whether it fires. */
  btdc: 0,
  fires: false,
  why: "",
  /** Manifold pressure the SIM reads. */
  sensed: 0,
  /** Crank angle where the SIM's internal TDC falls (0 when synced). */
  err: 0,
  /** Seconds since each plug (1–4) last fired, and whether that spark was on compression. */
  spark: [9, 9, 9, 9, 9],
  live: [false, false, false, false, false],
};
export type Bench = typeof bench;

export const inputsOf = (u: Ui): Inputs => ({
  dip: u.dip,
  volts: u.volts,
  ignition: u.ignition,
  rpm: bench.rpm,
  map: bench.rpm > 0 && !u.cranking ? u.map : AMBIENT,
  ambient: AMBIENT,
  hose: u.hose,
  fault: u.fault,
});

/** Sync error: the crank angle (after #1 TDC) where the internal TDC falls, −180 … 180. */
export const syncError = (u: Pick<Ui, "mesh" | "clock">) => ((((u.clock - u.mesh + 180) % 360) + 360) % 360) - 180;

/** Slow motion draws the crank at most this fast, rpm. */
const SLOW_RPM = 12;

export function advance(d: number) {
  const u = useUi.getState(),
    view = useSfView.getState();
  if (view.paused) return;
  const b = bench;
  b.t += d;
  b.spark = b.spark.map((x) => x + d);
  b.err = u.mounted ? syncError(u) : 0;
  if (u.stage === "time") {
    // the engine and drive gear turned by hand; the light runs off the TIMING terminal
    b.rpm = 0;
    b.crank = u.hand;
    b.shaft = u.mounted ? (((u.hand + u.mesh - u.clock) % 360) + 360) % 360 : u.gear;
    b.led = u.timingPower && syncLight(b.shaft, !u.ignition);
    const f = firing({ ...inputsOf(u), rpm: 0 });
    Object.assign(b, { fires: false, btdc: f.btdc, why: "Timing: power on the TIMING terminal", sensed: f.map });
    return;
  }
  const target = u.cranking ? CRANK_RPM : u.rpm;
  // the engine spins up and down over a second or so (schematic)
  b.rpm += (target - b.rpm) * Math.min(1, d * 3);
  if (Math.abs(target - b.rpm) < 1) b.rpm = target;
  const f = firing(inputsOf(u));
  // off the engine, nothing turns the shaft and the plug leads go nowhere
  if (!u.mounted) Object.assign(f, { fires: false, why: "Not mounted: mount it under Install and time" });
  Object.assign(b, { fires: f.fires, btdc: f.btdc, why: f.why, sensed: f.map });
  const prev = b.crank;
  const shown = view.slow ? Math.min(b.rpm, SLOW_RPM) : b.rpm;
  const dist = shown * 6 * d;
  b.crank = (prev + dist) % 720;
  b.shaft = u.mounted ? (((b.crank - b.err) % 360) + 360) % 360 : u.gear;
  if (f.fires && b.rpm > 0)
    for (const [cyl, partner] of sparksBetween(prev, dist, f.btdc, b.err)) {
      b.spark[cyl] = 0;
      b.live[cyl] = true;
      b.spark[partner] = 0;
      b.live[partner] = false;
    }
  const powered = u.volts >= 8.5 && u.volts <= 30;
  b.led = powered && u.ignition && codeLight(u.dip, b.t - b.onAt, u.fault);
}

export const startRpm = START_RPM;

/** Run the bench on animation frames while the page is mounted. */
export const useBenchLoop = () => useSimLoop(advance, 0.25);
