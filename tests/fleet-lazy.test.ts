// vitest: isolate
/**
 * The app loads each airplane's code on demand (aircraft/lazy.ts): only the light metas ship with the page. These check
 * that each meta is the one its full definition carries, that each loader yields that definition, the loading order the
 * shell relies on (walk boot and `prepare` before the definition renders; a failed load can be retried), and that the
 * shell never imports the whole fleet.
 */
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FLEET } from "@/aircraft";
import { FLEET_META, LOADERS } from "@/aircraft/lazy";
import type { AircraftDef } from "@/aircraft/types";
import { useBuild } from "@/lib/build";
import {
  aircraft,
  loadAircraft,
  loaded,
  loadFailed,
  registerFleet,
  retryLoad,
  selectAircraft,
  whenLoaded,
} from "@/lib/fleet";
import { useView } from "@/lib/view";

const initialView = useView.getState();
afterEach(() => {
  useView.setState(initialView);
  vi.restoreAllMocks();
});

describe("lazy fleet", () => {
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

  it.each(FLEET.map((d) => [d.id, d] as const))("loads %s's full definition", async (id, def) => {
    expect(await LOADERS[id]()).toBe(def);
  });
});

/** A stand-in airplane whose code arrives when the test says. */
function fakeFleet() {
  const [a, b] = FLEET;
  const order: string[] = [];
  let release: (d: AircraftDef) => void = () => {};
  let fail: (e: Error) => void = () => {};
  const loader = vi.fn(
    () =>
      new Promise<AircraftDef>((ok, no) => {
        release = ok;
        fail = no;
      }),
  );
  const def: AircraftDef = { ...b, prepare: () => order.push("prepare") };
  registerFleet([a, { id: b.id, short: b.short, name: b.name, sub: b.sub, doc: b.doc, systems: b.systems }], {
    [b.id]: loader,
  });
  return { a, b, def, order, loader, release: () => release(def), fail: (e: Error) => fail(e) };
}

describe("loading an airplane", () => {
  it("shows the meta at once, then runs prepare and queued callbacks before the definition is published", async () => {
    const f = fakeFleet();
    expect(loaded(f.b.id)).toBeUndefined();
    expect(aircraft(f.b.id).name).toBe(f.b.name);
    whenLoaded(f.b.id, (d) => f.order.push(`boot ${d.id} published=${loaded(d.id) !== undefined}`));
    const p = loadAircraft(f.b.id);
    expect(loadAircraft(f.b.id)).toBe(p); // one load
    expect(f.loader).toHaveBeenCalledTimes(1);
    f.release();
    expect(await p).toBe(f.def);
    expect(f.order).toEqual(["prepare", `boot ${f.b.id} published=false`]);
    expect(loaded(f.b.id)).toBe(f.def);
    // later callers get it at once
    let now = false;
    whenLoaded(f.b.id, () => (now = true));
    expect(now).toBe(true);
  });

  it("tries a failed load again on the next call", async () => {
    const f = fakeFleet();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const p = loadAircraft(f.b.id);
    f.fail(new Error("chunk failed"));
    await expect(p).rejects.toThrow("chunk failed");
    const again = loadAircraft(f.b.id);
    expect(f.loader).toHaveBeenCalledTimes(2);
    f.release();
    expect(await again).toBe(f.def);
  });

  it("marks a failed load for the shown airplane, and its Retry loads it again", async () => {
    const f = fakeFleet();
    vi.spyOn(console, "error").mockImplementation(() => {});
    useView.setState({ ac: f.a.id, sys: "overview" });
    selectAircraft(f.b.id);
    f.fail(new Error("chunk failed"));
    await vi.waitFor(() => expect(loadFailed(f.b.id)).toBe(true));
    expect(useBuild.getState().stage).toBe("code");
    retryLoad();
    expect(f.loader).toHaveBeenCalledTimes(2);
    expect(loadFailed(f.b.id)).toBe(false);
    f.release();
    await loadAircraft(f.b.id);
    expect(loaded(f.b.id)).toBe(f.def);
  });

  it("switching to an airplane whose code has not loaded shows its meta and the loader's first stage while it loads", async () => {
    const f = fakeFleet();
    useView.setState({ ac: f.a.id, sys: "overview" });
    selectAircraft(f.b.id, "electrical");
    expect(useView.getState()).toMatchObject({ ac: f.b.id, sys: "electrical" });
    expect(useBuild.getState().stage).toBe("code");
    expect(f.loader).toHaveBeenCalledTimes(1);
    f.release();
    await loadAircraft(f.b.id);
    expect(loaded(f.b.id)).toBe(f.def);
  });
});

// Read through fs below. Listing them to Vite (never loading them) makes them dependencies, so `vitest --changed`
// reruns this file when one changes.
const sources = import.meta.glob(["../{app,components,lib,aircraft}/**/*.{ts,tsx}", "!../aircraft/index.ts"]);

it("the app shell and the airplanes never import the whole fleet (aircraft/index.ts), only aircraft/lazy.ts", () => {
  const paths = Object.keys(sources);
  expect(paths).toContain("../components/App.tsx");
  const index = new URL("../aircraft/index", import.meta.url).href;
  const offenders = paths.flatMap((p) => {
    const file = new URL(p, import.meta.url);
    const specs = [...readFileSync(file, "utf8").matchAll(/(?:from|import\()\s*["']([^"']+)["']/g)].map((m) => m[1]);
    return specs
      .filter((s) => {
        const at = s.startsWith("@/")
          ? new URL(`../${s.slice(2)}`, import.meta.url)
          : s.startsWith(".") && new URL(s, file);
        return at && at.href.replace(/\/$/, "/index").replace(/\/aircraft$/, "/aircraft/index") === index;
      })
      .map((s) => `${p}: ${s}`);
  });
  expect(offenders).toEqual([]);
});
