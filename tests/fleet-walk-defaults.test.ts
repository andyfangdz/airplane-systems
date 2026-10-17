/**
 * The opt-in walk framing and halos (createFleetWalk's `fitEveryPart` and `sizedHalos`, used by the SR22T) leave the
 * other airplanes' walks as they were: for the SR20, C172S, C182T, DA40 and M20C, every item's camera pose and the
 * halos it would get with `emphasis`, base items and configuration variants, against a baseline taken from main b2aa8635
 * before the options were added.
 *
 * Numbers are stored to 1e-9 and compared within TOL: the framing's trigonometry can differ in the last bit between
 * runtimes (see scene-snapshot.test.ts).
 *
 * Update only for an intended framing change: UPDATE_WALK_BASELINE=1 npx vitest run tests/fleet-walk-defaults.test.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { walk as c172s } from "@/aircraft/c172s/walk";
import { walk as c182t } from "@/aircraft/c182t/walk";
import { walk as da40 } from "@/aircraft/da40/walk";
import { walk as m20c } from "@/aircraft/m20c/walk";
import { walk as sr20 } from "@/aircraft/sr20/walk";
import { HALO_R, type FleetWalk, type FleetWalkStep } from "@/lib/fleet-walk";

// Read through fs below. Listing it to Vite (never loading it) makes it a dependency, so `vitest --changed` reruns this
// file when it changes.
import.meta.glob("./fleet-walk-defaults.baseline.json");
const BASELINE = new URL("./fleet-walk-defaults.baseline.json", import.meta.url);
/** Absolute tolerance, m. */
const TOL = 1e-6;

/** Each step's pose (eye, then target) and the centre and radius of each halo it would get with `emphasis`, by
 * "station:item" ("…/variant" for an item's configuration variant). */
function rows<S>(walk: FleetWalk<S>) {
  const out: Record<string, number[]> = {};
  const add = (key: string, step: FleetWalkStep<S>) => {
    const { p, t } = walk.stepPose(step);
    const halos = walk.emphasisHalos({ station: step.station, item: { ...step.item, emphasis: true } });
    out[key] = [...p, ...t, ...halos.flatMap(({ p, r }) => [p.x, p.y, p.z, r])].map((x) => Math.round(x * 1e9) / 1e9);
  };
  for (const step of walk.steps) {
    const key = `${step.station.n}:${step.item.id}`;
    add(key, step);
    if (step.item.variant) {
      const { when: _when, ...fields } = step.item.variant;
      add(`${key}/variant`, { station: step.station, item: { ...step.item, ...fields } });
    }
  }
  return out;
}
const current = () => ({
  sr20: rows(sr20),
  c172s: rows(c172s),
  c182t: rows(c182t),
  da40: rows(da40),
  m20c: rows(m20c),
});
type Rows = ReturnType<typeof current>;

if (process.env.UPDATE_WALK_BASELINE) {
  const lines = Object.entries(current()).map(
    ([id, steps]) =>
      `${JSON.stringify(id)}: {\n${Object.entries(steps)
        .map(([key, values]) => `${JSON.stringify(key)}: ${JSON.stringify(values)}`)
        .join(",\n")}\n}`,
  );
  writeFileSync(BASELINE, `{\n${lines.join(",\n")}\n}\n`);
}
const baseline = JSON.parse(readFileSync(BASELINE, "utf8")) as Rows;
const now = current();

describe("other airplanes keep the standard walk framing and halos", () => {
  for (const id of Object.keys(now) as (keyof Rows)[])
    it(`${id}: every step's pose and halos match main's`, () => {
      expect(Object.keys(now[id])).toEqual(Object.keys(baseline[id]));
      for (const [key, values] of Object.entries(now[id])) {
        const expected = baseline[id][key];
        expect(values, key).toHaveLength(expected.length);
        values.forEach((v, i) => expect(Math.abs(v - expected[i]), `${key}[${i}]`).toBeLessThanOrEqual(TOL));
        // every halo keeps the one size
        for (let i = 9; i < values.length; i += 4) expect(values[i], key).toBe(HALO_R);
      }
    });

  it("compares halos, not only poses, on each airplane", () => {
    for (const steps of Object.values(now)) expect(Object.values(steps).some((v) => v.length > 6)).toBe(true);
  });
});
