import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { beginParts, BUILD_IN_MS, endParts, markAdded, skipBuild } from "@/lib/build";
import { Catalogue } from "@/lib/catalogue";
import { mats, shellMat } from "@/lib/materials";
import { PartAnimations } from "@/lib/scene/part-animations";

const cat = new Catalogue("animations");
const color = "#778899";
const appearance = (overrides = {}) => ({
  material: mats(color).on,
  active: true,
  focused: false,
  ghost: false,
  ...overrides,
});
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.useFakeTimers({ toFake: ["performance"] });
});
afterEach(() => {
  endParts(cat);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("scene-owned part animation scheduling", () => {
  it("does no per-frame work for settled static parts", () => {
    const scheduler = new PartAnimations();
    const spec = cat.part(() => new THREE.BoxGeometry(), ["engine"], { id: "tests.part-animations.test.part.001" });
    const mesh = new THREE.Mesh();
    const unregister = scheduler.register(mesh, spec, appearance(), color);
    expect(mesh.material).toBe(mats(color).on);
    expect(scheduler.counts).toEqual({ animated: 0, glowing: 0 });
    expect(scheduler.step(1)).toBe(0);
    unregister();
  });

  it("schedules a static build glow only until it ends, including skip", () => {
    const scheduler = new PartAnimations();
    const spec = cat.part(() => new THREE.BoxGeometry(), ["engine"], { id: "tests.part-animations.test.part.002" });
    const mesh = new THREE.Mesh();
    beginParts(cat);
    markAdded(spec);
    const unregister = scheduler.register(mesh, spec, appearance(), color);
    expect(mesh.material).toBe(mats(color).hi);
    expect(scheduler.step(0)).toBe(1);
    vi.advanceTimersByTime(BUILD_IN_MS);
    scheduler.step(1);
    expect(mesh.material).toBe(mats(color).on);
    expect(scheduler.step(2)).toBe(0);
    unregister();
    markAdded(spec);
    scheduler.register(mesh, spec, appearance(), color);
    skipBuild();
    scheduler.step(3);
    expect(mesh.material).toBe(mats(color).on);
    expect(scheduler.counts.glowing).toBe(0);
  });

  it("keeps animation motion while enforcing focus and ghost policy", () => {
    const scheduler = new PartAnimations();
    const spec = cat.part(() => new THREE.BoxGeometry(), ["engine"], {
      id: "tests.part-animations.test.part.003",
      anim: (mesh, time) => {
        mesh.position.x = time;
        mesh.visible = false;
        mesh.material = mats("#FF0000").on;
      },
    });
    const mesh = new THREE.Mesh();
    const old = scheduler.register(mesh, spec, appearance({ material: shellMat, ghost: true }), color);
    scheduler.step(2);
    expect(mesh.position.x).toBe(2);
    expect(mesh.material).toBe(shellMat);
    expect(mesh.visible).toBe(false);
    const release = scheduler.register(mesh, spec, appearance({ material: mats(color).hi, focused: true }), color);
    old(); // A cleanup from an older registration cannot remove its replacement.
    scheduler.step(3);
    expect(mesh.visible).toBe(true);
    expect(mesh.material).toBe(mats(color).hi);
    expect(scheduler.counts.animated).toBe(1);
    release();
    expect(scheduler.step(4)).toBe(0);
  });

  it("drops all references when the scene is released", () => {
    const scheduler = new PartAnimations();
    const spec = cat.part(() => new THREE.BoxGeometry(), ["engine"], {
      id: "tests.part-animations.test.part.004",
      anim: () => {},
    });
    scheduler.register(new THREE.Mesh(), spec, appearance(), color);
    scheduler.clear();
    expect(scheduler.counts).toEqual({ animated: 0, glowing: 0 });
  });
});
