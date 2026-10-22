/** Shared calibration procedures. Every call owns its engine state; no cached state crosses test files. */
import { noFailures, type EngineState, type Failures } from "@/engines/model/engine";
import { warmStart, type Setup } from "@/engines/model/scenarios";
import { settle, type Hold } from "@/engines/model/trim";
import { TSIO550K } from "@/engines/tsio550k/spec";

const K = TSIO550K;

/** Gauge readings averaged over the second half of a look, the way a pilot reads them. */
export function lookAt(x: Setup, f: Failures, seconds: number, hold: Hold, thermal: number) {
  settle(K, x.s, x.c, x.env, f, seconds / 2, hold, thermal);
  const n = seconds / 2 / 0.25;
  const g = { map: 0, fuel: 0, hp: 0 };
  for (let k = 0; k < n; k++) {
    settle(K, x.s, x.c, x.env, f, 0.25, hold, thermal);
    g.map += x.s.map / n;
    g.fuel += x.s.fuel / n;
    g.hp += x.s.hp / n;
  }
  return g;
}

/**
 * A POH 5-32 to 5-34 cruise point flown as the POH's note says: the mixture leaned to the target fuel flow (λ =
 * lambdaTarget at the air the engine takes, POH 4-22) and the power lever moved until that fuel flow is the table's;
 * if that needs more than 30.5 in.Hg, the lever holds 30.5 (leaning is approved only there or below) and the mixture
 * is leaned to the table's fuel flow wherever λ lands (SOURCES.md C10). Readings are look means.
 */
export function cruisePoint(altFt: number, gph: number, tasKt: number, isaDevC = 0) {
  const x = warmStart(K);
  const f = noFailures(K);
  x.env = { ...x.env, altFt, isaDevC, tasKt };
  Object.assign(x.c, { boost: false, throttle: 0.6, mixture: 0.7 });
  const lbh = gph * 6,
    lamT = K.calibration.lambdaTarget!;
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  let capped = false,
    g = { map: 0, fuel: 0, hp: 0 };
  for (let i = 0; i < 16; i++) {
    const thermal = i < 8 ? 20 : 1;
    if (!capped) {
      g = lookAt(x, f, 20, { lambda: lamT }, thermal);
      x.c.throttle = clamp(x.c.throttle * (1 + clamp((lbh / g.fuel - 1) * 0.8, -0.15, 0.15)), 0.05, 1);
      if (g.map > 30.5) capped = true;
    } else {
      g = lookAt(x, f, 20, {}, thermal);
      x.c.mixture = clamp((x.c.mixture * lbh) / g.fuel, 0.03, 1);
      // aimed a tenth under 30.5, where the part-throttle manifold pressure now settles
      x.c.throttle = clamp(x.c.throttle + (30.4 - g.map) / 40, 0.05, 1);
    }
  }
  g = lookAt(x, f, 30, capped ? {} : { lambda: lamT }, 1);
  return { ...g, gph: g.fuel / 6, capped, x, f };
}
export const hottestCht = (s: EngineState) => Math.max(...s.cyl.map((cy) => cy.cht));
