/**
 * Each airplane is its own route (app/(fleet)/<id>/[[...sys]]/page.tsx) whose page imports only that airplane, so each
 * airplane's code is its own route chunk. These check that each light meta is the one its full definition carries, that
 * each route answers exactly /<id> and /<id>/<system> (anything else 404s), and, following the imports, that each route
 * reaches its own airplane's code and no other's, and that the root page and the shared shell reach none.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FLEET } from "@/aircraft";
import { FLEET_META, viewPathsOf } from "@/aircraft/metas";
import { AIRCRAFT_IDS } from "@/lib/systems";
import { routeSys, systemParams } from "@/app/(fleet)/airplane-route";

describe("airplane metas", () => {
  it("lists every airplane's meta in picker order, the same values its full definition carries", () => {
    expect(FLEET_META.map((m) => m.id)).toEqual(FLEET.map((d) => d.id));
    for (const [i, meta] of FLEET_META.entries()) {
      const def = FLEET[i];
      expect(meta, meta.id).toEqual({
        id: def.id,
        short: def.short,
        name: def.name,
        sub: def.sub,
        doc: def.doc,
        systems: def.systems,
      });
      expect(meta.systems, meta.id).toBe(def.systems);
    }
  });
});

const props = (sys?: string[]) => ({ params: Promise.resolve({ sys }) });

describe.each(FLEET_META.map((m) => [m.id, m] as const))("the %s route", (id, meta) => {
  it("prerenders /<id> and each of its systems", () => {
    const paths = systemParams(meta)().map(({ sys }) => ["", id, ...sys].join("/"));
    expect(paths).toEqual(viewPathsOf(meta));
  });

  it("names the system its path names, none at /<id>, and 404s anything else", async () => {
    expect(await routeSys(meta, props())).toBeUndefined();
    expect(await routeSys(meta, props([]))).toBeUndefined();
    for (const s of meta.systems) expect(await routeSys(meta, props([s.id]))).toBe(s.id);
    for (const sys of [["bogus"], ["overview", "extra"], ["Overview"]])
      await expect(routeSys(meta, props(sys)), sys.join("/")).rejects.toMatchObject({
        digest: expect.stringContaining("404"),
      });
  });
});

// Read through fs below. Listing them to Vite (never loading them) makes them dependencies, so `vitest --changed`
// reruns this file when one changes.
import.meta.glob(["../{app,components,lib,aircraft,engines}/**/*.{ts,tsx}"]);

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rel = (file: string) => file.slice(root.length + 1);

/** The project files a module imports at run time (type-only imports are erased), resolved to paths. */
function imports(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const specs = [
    ...[...src.matchAll(/(?:^|\n)\s*(?:import|export)\s+(type\s+)?([^;"']*?)\s*from\s*["']([^"']+)["']/g)]
      .filter(([, type, names]) => !type && !/^\{(\s*type\s+[\w$]+\s*,?)+\}$/.test(names.trim()))
      .map((m) => m[3]),
    ...[...src.matchAll(/(?:^|\n)\s*import\s*["']([^"']+)["']/g)].map((m) => m[1]),
    ...[...src.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]),
  ];
  return specs.flatMap((s) => {
    const base = s.startsWith("@/") ? resolve(root, s.slice(2)) : s.startsWith(".") ? resolve(dirname(file), s) : null;
    if (!base) return []; // a package
    const found = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]
      .map((x) => base + x)
      .find((f) => /\.tsx?$/.test(f) && existsSync(f));
    return found ? [found] : []; // CSS, JSON, workers' URLs
  });
}

/** Every project file reachable from `entry`. */
function reach(entry: string) {
  const seen = new Set<string>(),
    todo = [resolve(root, entry)];
  for (let f = todo.pop(); f; f = todo.pop())
    if (!seen.has(f)) {
      seen.add(f);
      todo.push(...imports(f));
    }
  return [...seen].map(rel);
}

/** The airplane folders whose code (anything but the light meta.ts and systems.ts) a module graph reaches. */
const airplanesIn = (files: string[]) =>
  AIRCRAFT_IDS.filter((id) => files.some((f) => f.startsWith(`aircraft/${id}/`) && !/\/(meta|systems)\.ts$/.test(f)));

describe("route code splitting", () => {
  it.each(AIRCRAFT_IDS)("the %s page reaches its own airplane's code and no other airplane's", (id) => {
    const files = reach(`app/(fleet)/${id}/[[...sys]]/page.tsx`);
    expect(files).toContain(`aircraft/${id}/index.tsx`);
    expect(airplanesIn(files)).toEqual([id]);
    expect(files).not.toContain("aircraft/index.ts");
  });

  it("the SR22T page starts its fuselage worker from a module of its own route (prepare.tsx), before it hydrates", () => {
    expect(reach("app/(fleet)/sr22t/[[...sys]]/page.tsx")).toContain("app/(fleet)/sr22t/[[...sys]]/prepare.tsx");
  });

  it("the root page, the airplanes' layout and error page, and the shell reach no airplane's code", () => {
    const entries = ["app/page.tsx", "app/layout.tsx", "app/(fleet)/layout.tsx", "app/(fleet)/error.tsx"];
    for (const entry of [...entries, "components/App.tsx"]) {
      const files = reach(entry);
      expect(airplanesIn(files), entry).toEqual([]);
      expect(files, entry).not.toContain("aircraft/index.ts");
    }
  });

  it("the root redirect does not download every aircraft's system descriptions", () => {
    const files = reach("components/OpenLastViewed.tsx");
    expect(files).not.toContain("aircraft/metas.ts");
    for (const id of AIRCRAFT_IDS) expect(files).not.toContain(`aircraft/${id}/systems.ts`);
  });
});
