/** Generic low-speed pneumatic teaching model; assumptions and references in SOURCES.md. */
import { atmosphere, INHG_PA, KT_MS, RHO0 } from "@/engines/model/atmosphere";

export interface Controls {
  tas: number;
  climb: number;
  baro: number;
  alternate: boolean;
  cabinDrop: number;
  inletBlocked: boolean;
  drainBlocked: boolean;
  staticBlocked: boolean;
  pitotLeak: boolean;
  staticLeak: boolean;
  icing: boolean;
  heat: boolean;
  heatFailed: boolean;
}
export const defaults: Controls = {
  tas: 120,
  climb: 0,
  baro: 29.92126,
  alternate: false,
  cabinDrop: 100,
  inletBlocked: false,
  drainBlocked: false,
  staticBlocked: false,
  pitotLeak: false,
  staticLeak: false,
  icing: false,
  heat: false,
  heatFailed: false,
};
export interface State {
  altitude: number;
  pitot: number;
  static: number;
  vsiCase: number;
  ice: number;
  elapsed: number;
}
export const pressureAltitude = (pa: number, baro = 29.92126) =>
  (1 - Math.pow(Math.max(1, pa) / (baro * INHG_PA), 1 / 5.25588)) / (2.25577e-5 * 0.3048);
export function environment(altitude: number, c: Controls) {
  const a = atmosphere(altitude);
  const ambient = a.p * INHG_PA;
  const dynamic = 0.5 * a.rho * (c.tas * KT_MS) ** 2;
  return { ambient, dynamic, total: ambient + dynamic, cabin: ambient - c.cabinDrop };
}
export function initialState(altitude = 5000, c: Controls = defaults): State {
  const e = environment(altitude, c);
  return { altitude, pitot: e.total, static: e.ambient, vsiCase: e.ambient, ice: 0, elapsed: 0 };
}
export function blocked(s: State, c: Controls) {
  return { inlet: c.inletBlocked || s.ice >= 0.8, drain: c.drainBlocked || s.ice >= 0.8 };
}
/** Fixed 50 ms ticks supplied by the UI; no singleton or browser dependencies. */
export function step(s: State, c: Controls, dt: number): State {
  if (dt <= 0) return s;
  const altitude = Math.max(0, Math.min(18000, s.altitude + (c.climb * dt) / 60));
  const e = environment(altitude, c);
  const heating = c.heat && !c.heatFailed;
  const ice = Math.max(0, Math.min(1, s.ice + dt * (heating ? -0.12 : c.icing ? 0.08 : 0)));
  const b = blocked({ ...s, ice }, c);
  const approach = (value: number, target: number, tau: number) => target + (value - target) * Math.exp(-dt / tau);
  // A clear inlet supplies total pressure despite its small drain. With inlet blocked,
  // an open drain vents to ambient. Both closed trap the last line pressure.
  let pitot = b.inlet ? (b.drain ? s.pitot : approach(s.pitot, e.ambient, 0.7)) : approach(s.pitot, e.total, 0.15);
  if (c.pitotLeak) pitot = approach(pitot, e.cabin, 0.3);
  const source = c.alternate ? e.cabin : c.staticBlocked ? null : e.ambient;
  let ps = source === null ? s.static : approach(s.static, source, 0.2);
  if (c.staticLeak) ps = approach(ps, e.cabin, 0.3);
  return { altitude, pitot, static: ps, vsiCase: approach(s.vsiCase, ps, 6), ice, elapsed: s.elapsed + dt };
}
export function indications(s: State, c: Controls) {
  const differential = s.pitot - s.static;
  return {
    ias: Math.sqrt((2 * Math.max(0, differential)) / RHO0) / KT_MS,
    altitude: pressureAltitude(s.static, c.baro),
    vsi: ((pressureAltitude(s.static) - pressureAltitude(s.vsiCase)) * 60) / 6,
    differential,
  };
}
export const scenarios = [
  {
    name: "Normal system",
    patch: {},
    lesson:
      "Change speed, then climb or descend. Only the ASI uses both pressure lines. Altimeter and VSI use static pressure alone.",
  },
  {
    name: "Pitot inlet blocked · drain open",
    patch: { inletBlocked: true },
    lesson:
      "The pitot line vents through the drain. IAS decays toward zero with normal static pressure; altimeter and VSI remain usable. Try climbing.",
  },
  {
    name: "Pitot inlet + drain blocked",
    patch: { inletBlocked: true, drainBlocked: true },
    lesson:
      "Total pressure is trapped. Speed changes no longer register. In a climb the ASI rises as outside static pressure falls; in a descent it falls. Altimeter and VSI remain normal.",
  },
  {
    name: "Static port blocked",
    patch: { staticBlocked: true },
    lesson:
      "Static pressure is trapped: altitude freezes and VSI settles to zero. Above the blockage altitude, IAS underreads; below it, IAS overreads. Select alternate static to recover.",
  },
  {
    name: "Both systems sealed",
    patch: { inletBlocked: true, drainBlocked: true, staticBlocked: true },
    lesson:
      "Both pressures are trapped: IAS and altitude freeze, VSI settles to zero. Alternate static restores altitude and VSI, but cannot restore the blocked pitot supply.",
  },
  {
    name: "Drain blocked only",
    patch: { drainBlocked: true },
    lesson:
      "A clear inlet still supplies total pressure, so there is no immediate indication error. Moisture cannot drain; subsequently blocking the inlet traps pressure.",
  },
  {
    name: "Pitot line leak",
    patch: { pitotLeak: true },
    lesson:
      "The pitot line leaks toward cabin pressure, reducing differential pressure and IAS. Altimeter and VSI remain normal. Leak magnitude here is illustrative.",
  },
  {
    name: "Static line leak",
    patch: { staticLeak: true },
    lesson:
      "A cabin leak biases static pressure even with a clear external port. Lower pressure raises indicated altitude and IAS and briefly drives a climb indication.",
  },
  {
    name: "Pitot icing",
    patch: { icing: true },
    lesson:
      "Watch ice accumulate and seal the inlet and drain. Working pitot heat melts simulated ice. It does not clear tape, debris, a cover, or a blocked static port.",
  },
  {
    name: "Pitot heat failure in icing",
    patch: { icing: true, heat: true, heatFailed: true },
    lesson:
      "The switch is ON but the heater is failed. Ice continues to accumulate. Switch position alone does not prove protection; alternate static cannot replace pitot pressure.",
  },
] satisfies { name: string; patch: Partial<Controls>; lesson: string }[];
