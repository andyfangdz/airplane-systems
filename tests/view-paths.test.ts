import { expect, it } from "vitest";
import { FLEET } from "@/aircraft";
import { FLEET_META, VIEW_PATHS, viewPathsOf } from "@/aircraft/metas";
import { AIRCRAFT_IDS } from "@/lib/systems";

it("lists every airplane's route paths from the systems its full definition carries", () => {
  expect(VIEW_PATHS).toEqual([
    "/",
    ...AIRCRAFT_IDS.flatMap((ac) => {
      const def = FLEET.find((def) => def.id === ac)!;
      return [`/${ac}`, ...def.systems.map((sys) => `/${ac}/${sys.id}`)];
    }),
  ]);
});

it("exports the root, each airplane and every source-defined system without duplicates", () => {
  expect(VIEW_PATHS[0]).toBe("/");
  expect(new Set(VIEW_PATHS).size).toBe(VIEW_PATHS.length);
  expect(VIEW_PATHS).toHaveLength(1 + FLEET_META.reduce((count, meta) => count + 1 + meta.systems.length, 0));
  for (const meta of FLEET_META) {
    expect(viewPathsOf(meta)[0]).toBe(`/${meta.id}`);
    for (const path of viewPathsOf(meta)) expect(VIEW_PATHS).toContain(path);
  }
  expect(VIEW_PATHS).toContain("/sr20/overview");
  expect(VIEW_PATHS).toContain("/sr22t/electrical");
  expect(VIEW_PATHS).not.toContain("/sr22t/bogus");
});
