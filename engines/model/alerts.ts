/**
 * Operating limits the engine is past or near, from the spec's `limits` (IOM Table A-2 and the operating procedures).
 * These are limit flags for study, not an airplane's CAS: an installation's own annunciations come from its POH.
 */
import type { Band, EngineSpec, Marking } from "../types";
import type { EngineState, Environment } from "./engine";
import { f0 } from "@/lib/format";

export interface LimitFlag {
  level: "warn" | "caut";
  text: string;
  src: string;
}

export function limitFlags(spec: EngineSpec, s: EngineState, env: Environment): LimitFlag[] {
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
