/**
 * Operating limits the engine is past or near. These are limit flags for study, not an airplane's CAS: an
 * installation's own annunciations come from its POH.
 *
 * Without instrument markings the flags read the spec's `limits` (IOM Table A-2 and the operating procedures). With
 * the POH's markings (`spec.markings`, POH Section 2) a band that names a crew-alerting message raises a flag carrying
 * that message's text exactly as the POH prints it (`cas`), at the band edges the monitor colours the gauge by; the
 * spec's other limits (minimum manifold pressure at altitude, the TIT transient, turbine speed, takeoff oil
 * temperature, leaning, oil quantity, cranking) add study flags of their own, without one.
 */
import type { Band, EngineSpec, Marking } from "../types";
import type { Controls, EngineState, Environment, Failures } from "./engine";
import { remainingOilQt } from "./oil";
import { titContinuousMaxF, turbineRpmLimit } from "./turbo";
import { f0 } from "@/lib/format";

export interface LimitFlag {
  level: "warn" | "caut";
  text: string;
  src: string;
  /** For a flag the POH names: the annunciation's text exactly as the POH prints it; `text` then starts with it. */
  cas?: string;
}

/** What the page knows beyond the engine state: the failures (a failed TIT probe reads nothing) and the controls. */
export interface FlagContext {
  failures?: Failures;
  controls?: Controls;
}

export function limitFlags(spec: EngineSpec, s: EngineState, env: Environment, ctx: FlagContext = {}): LimitFlag[] {
  return spec.markings ? markingFlags(spec, spec.markings, s, env, ctx) : legacyFlags(spec, s, env);
}

/** The flags of an engine whose spec has no POH instrument markings. */
function legacyFlags(spec: EngineSpec, s: EngineState, env: Environment): LimitFlag[] {
  const L = spec.limits,
    out: LimitFlag[] = [];
  const add = (level: LimitFlag["level"], text: string, src: string) => out.push({ level, text, src });

  if (s.rpm > L.rpmMax.value + 25)
    add("warn", `Overspeed: ${f0(s.rpm)} rpm (maximum ${f0(L.rpmMax.value)})`, L.rpmMax.src);

  const cht = Math.max(...s.cyl.map((c) => c.cht));
  const hot = s.cyl.findIndex((c) => c.cht === cht) + 1;
  const best = s.pct > 75 ? L.chtBestAbove75 : L.chtBestAt75;
  if (cht > L.chtMax.value)
    add("warn", `CHT ${f0(cht)} °F on cylinder ${hot}: above the ${L.chtMax.value} °F maximum`, L.chtMax.src);
  else if (cht > best.value && s.running)
    add("caut", `CHT ${f0(cht)} °F: above ${best.value} °F, the limit for maximum engine life at this power`, best.src);

  if (s.oilT > L.oilTempMax.value)
    add("warn", `Oil temperature ${f0(s.oilT)} °F: above the ${L.oilTempMax.value} °F maximum`, L.oilTempMax.src);

  if (s.rpm > 100) {
    if (s.oilP < L.oilPressMinIdle.value)
      add(
        "warn",
        `Oil pressure ${f0(s.oilP)} psi: below the ${L.oilPressMinIdle.value} psi minimum`,
        L.oilPressMinIdle.src,
      );
    else if (s.oilP < L.oilPressNormal.min && s.rpm > L.idleRpm.max + 300)
      add(
        "caut",
        `Oil pressure ${f0(s.oilP)} psi: below the ${L.oilPressNormal.min}–${L.oilPressNormal.max} psi normal range`,
        L.oilPressNormal.src,
      );
    if (s.oilP > L.oilPressMaxStart.value)
      add(
        "warn",
        `Oil pressure ${f0(s.oilP)} psi: above the ${L.oilPressMaxStart.value} psi starting limit`,
        L.oilPressMaxStart.src,
      );
    else if (s.oilP > L.oilPressNormal.max)
      add(
        "caut",
        `Oil pressure ${f0(s.oilP)} psi: above normal; allowed while starting and warming up`,
        L.oilPressMaxStart.src,
      );
  }

  if (env.oilQt < L.oilMinQt.value)
    add("warn", `Oil quantity ${env.oilQt} qt: below the ${L.oilMinQt.value} qt minimum`, L.oilMinQt.src);
  const starter = L.starterMaxS;
  if (starter && s.starterS > starter.value)
    add(
      "caut",
      `Starter engaged ${Math.floor(s.starterS)} s: release after ${starter.value} s and let it cool`,
      starter.src,
    );
  if (spec.fuelSystem.kind === "carburetor" && s.ice > 0.08 && s.running)
    add(
      "caut",
      `Carburetor ice: ${Math.round(s.ice * 100)} % of the bore. Apply full carburetor heat`,
      spec.refs.carbHeat ?? spec.doc,
    );
  return out;
}

const SEVERITY = { green: 0, yellow: 1, red: 2 } as const;

/**
 * The band of a marking a value falls in, as the monitor colours the gauge: a band holds `from < v ≤ to`; the band
 * starting at the scale's bottom also holds its `from`, and a red band reaching the scale's top is open-ended (the POH
 * prints it "> x"). Where bands touch or overlap the more severe one wins. Undefined in no band.
 */
export function markingBand(m: Marking, v: number): Band | undefined {
  let pick: Band | undefined;
  for (const b of m.bands) {
    const above = v > b.from || (b.from === m.scale[0] && v >= b.from);
    const below = v <= b.to || (b.color === "red" && b.to >= m.scale[1]);
    if (above && below && (!pick || SEVERITY[b.color] > SEVERITY[pick.color])) pick = b;
  }
  return pick;
}

/** The POH's annunciations that no instrument marking carries (SR22T POH 3A-10/3-48, 3A-11), raised by the limit or
 * the door that is their subject. */
const START_ENGAGED = "START ENGAGED";
const ALT_AIR_OPEN = "ALT AIR OPEN";
/** The relief valve procedure's own target, SR22T POH 3-30 Overboost / Pressure Relief Valve step 1 ("reduce to
 * 30.5 in.Hg or less"). The POH 4-22 leaning limit prints the same number, but the two are separate limits. */
const RELIEF_REDUCE_TO_INHG = 30.5;

/**
 * The leaning limit (SR22T POH 4-22: "Cruise leaning … is only approved with manifold pressure settings of 30.5 in.Hg
 * or less") is a limit on the power setting, not an instantaneous trip. So the flag reads a sustained setting, not a
 * momentary excursion: the gauge must read above the limit for a net `LEAN_DWELL_S` seconds before it is raised (time
 * spent at or below counts back down), and it stays raised until that net time is back to zero. Interpretation, not a
 * published value: a pilot holding the lever above the limit sees the flag 3 s after the gauge passes it, and a lever
 * moved past the limit for a second raises none. The model's part-throttle manifold pressure settles (engines/types.ts
 * `controller.gainFalloff`), so the leaned cruise setups, aimed a tenth under the limit, stay below it.
 */
export const LEAN_DWELL_S = 3;

/** Whether the gauge reads past the leaning limit, as the monitor prints manifold pressure (0.1 in.Hg). */
export const leanGaugeAbove = (map: number, limit: number) => Math.round(map * 10) / 10 > limit;

/**
 * The leaning timer one step of `dt` seconds on (engine.ts keeps it in the state): net seconds above the limit and
 * the latched flag. Not leaned (full rich, or the engine stopped) there is no leaning limit: both reset.
 */
export function leanOverNext(
  prev: { s: number; on: boolean },
  leaned: boolean,
  above: boolean,
  dt: number,
): { s: number; on: boolean } {
  if (!leaned) return { s: 0, on: false };
  const t = Math.min(LEAN_DWELL_S, Math.max(0, prev.s + (above ? dt : -dt)));
  return { s: t, on: t >= LEAN_DWELL_S ? true : t <= 0 ? false : prev.on };
}

const SIDES = ["L", "R"] as const;
const unitText = (u: string) => (u === "inHg" ? "in.Hg" : u);
/** A gauge value as the monitor prints it: manifold pressure to 0.1 in.Hg, the rest whole. */
const gaugeText = (m: Marking, v: number) => (m.gauge === "map" ? v.toFixed(1) : f0(v));
/** The marking's page alone, without the note after it ("POH 13772-007 2-9 (bands); …" → "POH 13772-007 2-9"). */
const markingPage = (m: Marking) => m.src.replace(/\s*[(;].*$/, "");

/** What a marking's gauge reads: the hottest cylinder, each working TIT probe, or the one value. */
function readings(m: Marking, s: EngineState, tit: { side: string; v: number }[]): { where: string; v: number }[] {
  switch (m.gauge) {
    case "cht": {
      const cht = Math.max(...s.cyl.map((c) => c.cht));
      return [{ where: `cylinder ${s.cyl.findIndex((c) => c.cht === cht) + 1} at `, v: cht }];
    }
    case "tit":
      return tit.map(({ side, v }) => ({ where: `${side} `, v }));
    case "rpm":
      return [{ where: "", v: s.rpm }];
    case "map":
      return [{ where: "", v: s.map }];
    case "oilT":
      return [{ where: "", v: s.oilT }];
    case "oilP":
      // only with the engine turning, as without markings
      return s.rpm > 100 ? [{ where: "", v: s.oilP }] : [];
    default:
      return [];
  }
}

/** The flags of an engine whose spec carries its POH's instrument markings. */
function markingFlags(
  spec: EngineSpec,
  markings: Marking[],
  s: EngineState,
  env: Environment,
  ctx: FlagContext,
): LimitFlag[] {
  const L = spec.limits,
    out: LimitFlag[] = [];
  const add = (level: LimitFlag["level"], text: string, src: string, cas?: string) =>
    out.push(cas ? { level, text, src, cas } : { level, text, src });
  // a failed probe's side shows a red X and reads nothing (SR22T POH 3-31); `tit` itself stays computed
  const tit = SIDES.flatMap((side, i) => (s.tit && !ctx.failures?.titProbe?.[i] ? [{ side, v: s.tit[i] }] : []));

  // ---- the bands the POH names, at the edges the gauge is coloured by; the OIL PRESS caution only at and above the
  // POH's rpm (SR22T POH 3A-8)
  const oilCautionRpm = L.oilPressCautionMinRpm?.value ?? 0;
  for (const m of markings) {
    let worst: Band | undefined;
    let hits: { where: string; v: number }[] = [];
    for (const r of readings(m, s, tit)) {
      const b = markingBand(m, r.v);
      if (!b?.cas || !b.level) continue;
      if (m.gauge === "oilP" && b.level === "caution" && s.rpm < oilCautionRpm) continue;
      if (!worst || SEVERITY[b.color] > SEVERITY[worst.color]) ((worst = b), (hits = [r]));
      else if (b === worst) hits.push(r);
    }
    if (!worst) continue;
    const green = m.bands.find((b) => b.color === "green");
    const lower = green !== undefined && worst.to <= green.from;
    const u = unitText(m.unit);
    const what = hits.map((r) => `${r.where}${gaugeText(m, r.v)} ${u}`).join(" and ");
    const edge = lower ? `below the ${gaugeText(m, worst.to)}` : `above the ${gaugeText(m, worst.from)}`;
    add(
      worst.level === "warning" ? "warn" : "caut",
      `${worst.cas}: ${what}, ${edge} ${u} band edge (${markingPage(m)})`,
      `${m.src}: ${worst.cas}`,
      worst.cas,
    );
  }

  // ---- turbine inlet temperature past its continuous limit: above the maximum allowable, or for too long
  const tt = L.titTransient;
  // Per-side history survives probe failures and repairs; only working probes contribute a warning.
  // Older checkpoints may lack that history: retain the raw timer only when no probe has failed.
  const titOverS = s.titProbeOverS
    ? Math.max(0, ...s.titProbeOverS.map((seconds, i) => (ctx.failures?.titProbe?.[i] ? 0 : seconds)))
    : ctx.failures?.titProbe?.some(Boolean)
      ? 0
      : (s.titOverS ?? 0);
  if (tt && tit.length) {
    const over = tit.filter((x) => x.v > tt.value);
    const continuous = titContinuousMaxF(spec);
    if (over.length)
      add(
        "warn",
        `TIT ${over.map((x) => `${x.side} ${f0(x.v)} °F`).join(" and ")}: above the ${f0(tt.value)} °F maximum allowable`,
        tt.src,
      );
    else if (continuous !== undefined && titOverS > tt.seconds && tit.some((x) => x.v > continuous))
      add(
        "warn",
        `TIT above ${f0(continuous)} °F for ${Math.floor(titOverS)} s: more than the ${tt.seconds} s allowed`,
        tt.src,
      );
  }

  // ---- turbine speed against the limit for its TIT (the computed TIT: the speed limit is the turbine's, not a probe's)
  const tr = L.turbineRpmMax;
  if (tr && s.turboRpm && s.tit) {
    const over = SIDES.flatMap((side, i) => {
      const limit = turbineRpmLimit(spec, s.tit![i]);
      return s.turboRpm![i] > limit
        ? [`${side} ${f0(s.turboRpm![i])} rpm: above the ${f0(limit)} rpm limit at ${f0(s.tit![i])} °F TIT`]
        : [];
    });
    if (over.length) add("warn", `Turbine speed ${over.join("; ")}`, tr.src);
  }

  // ---- the starter: the POH's annunciation after 15 and 30 s, and the 10 s cranking limit
  const se = L.startEngaged;
  if (se && s.starterS > se.caution) {
    const warning = s.starterS > se.warning;
    add(
      warning ? "warn" : "caut",
      `${START_ENGAGED}: starter engaged for more than ${warning ? se.warning : se.caution} s`,
      se.src,
      START_ENGAGED,
    );
  }
  const starter = L.starterMaxS;
  if (starter && s.starterS > starter.value)
    add(
      "caut",
      `Starter engaged ${Math.floor(s.starterS)} s: release after ${starter.value} s and let it cool`,
      starter.src,
    );

  // ---- the automatic alternate-air door and the overboost relief valve
  if (spec.induction?.altAir === "automatic" && s.altAirOpen)
    add(
      "caut",
      `${ALT_AIR_OPEN}: the alternate induction door has opened by itself (induction filter obstructed)`,
      spec.refs.altAirOpen ?? spec.doc,
      ALT_AIR_OPEN,
    );
  if (spec.turbo && s.reliefOpen)
    add(
      "caut",
      `Overboost relief valve open: reduce manifold pressure to ${RELIEF_REDUCE_TO_INHG} in.Hg or less`,
      spec.refs.relief ?? spec.doc,
    );

  // ---- the POH's other operating limits
  const floor = L.mapMinAbove;
  if (floor && s.running && env.altFt > floor.altFt && s.map < floor.map)
    add(
      "caut",
      `Manifold pressure ${s.map.toFixed(1)} in.Hg above ${f0(floor.altFt)} ft: below the ${floor.map} in.Hg minimum`,
      floor.src,
    );
  const cold = L.oilTempMinTakeoff;
  // full power: the POH gives no figure; 90 % is below every rated full-throttle point
  if (cold && s.running && s.pct >= 90 && s.oilT < cold.value)
    add(
      "caut",
      `Oil temperature ${f0(s.oilT)} °F at full power: below the ${cold.value} °F minimum for takeoff`,
      cold.src,
    );
  const lean = L.leanMaxMap;
  // leaned off full rich with the gauge above the limit for the dwell (`LEAN_DWELL_S`; the engine keeps the timer);
  // while the flag holds the gauge may already read at or below the limit, the timer counting back down: the text then
  // names the limit, not the reading
  if (lean && ctx.controls && ctx.controls.mixture < 0.99 && s.running && s.leanOver) {
    const at = leanGaugeAbove(s.map, lean.value) ? `at ${s.map.toFixed(1)}` : `above ${lean.value}`;
    add("caut", `Leaned ${at} in.Hg: cruise leaning only at ${lean.value} in.Hg or less`, lean.src);
  }
  const qt = remainingOilQt(env.oilQt, s.oilLossQt);
  if (qt < L.oilMinQt.value)
    add("caut", `Oil quantity ${Number(qt.toFixed(1))} qt: below the ${L.oilMinQt.value} qt minimum`, L.oilMinQt.src);
  return out;
}
