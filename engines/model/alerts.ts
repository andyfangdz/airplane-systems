/**
 * Operating limits the engine is past or near, from the spec's `limits` (IOM Table A-2 and the operating procedures).
 * These are limit flags for study, not an airplane's CAS: an installation's own annunciations come from its POH.
 */
import type { EngineSpec } from "../types";
import type { EngineState, Environment } from "./engine";

export interface LimitFlag {
  level: "warn" | "caut";
  text: string;
  src: string;
}

const n = (v: number) => Math.round(v).toLocaleString("en-US");

export function limitFlags(spec: EngineSpec, s: EngineState, env: Environment): LimitFlag[] {
  const L = spec.limits,
    out: LimitFlag[] = [];
  const add = (level: LimitFlag["level"], text: string, src: string) => out.push({ level, text, src });

  if (s.rpm > L.rpmMax.value + 25)
    add("warn", `Overspeed: ${n(s.rpm)} rpm (maximum ${n(L.rpmMax.value)})`, L.rpmMax.src);

  const cht = Math.max(...s.cyl.map((c) => c.cht));
  const hot = s.cyl.findIndex((c) => c.cht === cht) + 1;
  const best = s.pct > 75 ? L.chtBestAbove75 : L.chtBestAt75;
  if (cht > L.chtMax.value)
    add("warn", `CHT ${n(cht)} °F on cylinder ${hot}: above the ${L.chtMax.value} °F maximum`, L.chtMax.src);
  else if (cht > best.value && s.running)
    add("caut", `CHT ${n(cht)} °F: above ${best.value} °F, the limit for maximum engine life at this power`, best.src);

  if (s.oilT > L.oilTempMax.value)
    add("warn", `Oil temperature ${n(s.oilT)} °F: above the ${L.oilTempMax.value} °F maximum`, L.oilTempMax.src);

  if (s.rpm > 100) {
    if (s.oilP < L.oilPressMinIdle.value)
      add(
        "warn",
        `Oil pressure ${n(s.oilP)} psi: below the ${L.oilPressMinIdle.value} psi minimum`,
        L.oilPressMinIdle.src,
      );
    else if (s.oilP < L.oilPressNormal.min && s.rpm > L.idleRpm.max + 300)
      add(
        "caut",
        `Oil pressure ${n(s.oilP)} psi: below the ${L.oilPressNormal.min}–${L.oilPressNormal.max} psi normal range`,
        L.oilPressNormal.src,
      );
    if (s.oilP > L.oilPressMaxStart.value)
      add(
        "warn",
        `Oil pressure ${n(s.oilP)} psi: above the ${L.oilPressMaxStart.value} psi starting limit`,
        L.oilPressMaxStart.src,
      );
    else if (s.oilP > L.oilPressNormal.max)
      add(
        "caut",
        `Oil pressure ${n(s.oilP)} psi: above normal; allowed while starting and warming up`,
        L.oilPressMaxStart.src,
      );
  }

  if (env.oilQt < L.oilMinQt.value)
    add("warn", `Oil quantity ${env.oilQt} qt: below the ${L.oilMinQt.value} qt minimum`, L.oilMinQt.src);
  if (s.starterS > L.starterMaxS.value)
    add(
      "caut",
      `Starter engaged ${Math.floor(s.starterS)} s: release after ${L.starterMaxS.value} s and let it cool`,
      L.starterMaxS.src,
    );
  return out;
}
