import { afterEach, describe, expect, it } from "vitest";
import * as THREE from "three";
import { animatePart, brakeAnim, glowAnim, magAnim } from "@/lib/anims";
import { Catalogue } from "@/lib/catalogue";
import { mats, shellMat } from "@/lib/materials";
import { useView } from "@/lib/view";

const originalView = useView.getState();
afterEach(() => useView.setState(originalView));

const appearance = (material: THREE.Material, overrides = {}) => ({
  material,
  active: true,
  focused: false,
  ghost: false,
  ...overrides,
});

describe("scene material policy after live animation", () => {
  it("keeps a located magneto highlighted on every frame, then restores its live appearance", () => {
    useView.setState({ sys: "engine" });
    const mesh = new THREE.Mesh();
    const spec = { anim: magAnim(() => false) };
    const color = mats("#3E4A52");
    for (let frame = 0; frame < 5; frame++) {
      animatePart(mesh, frame, spec, appearance(color.hi, { focused: true }));
      expect(mesh.material).toBe(color.hi);
    }
    animatePart(mesh, 6, spec, appearance(color.on));
    expect(mesh.material).toBe(color.on);
  });

  it("dims a braking disc outside its system while preserving the live glow in its own view", () => {
    const mesh = new THREE.Mesh();
    const spec = { anim: brakeAnim(() => 1) };
    const dim = mats("#9AA3AA").dim;
    animatePart(mesh, 0, spec, appearance(dim, { active: false }));
    expect(mesh.material).toBe(dim);
    animatePart(mesh, 1, spec, appearance(mats("#9AA3AA").on));
    expect(mesh.material).toBe(mats("#FF6A2A").hi);
  });

  it("keeps solid parts opaque when the animation's live view is not selected", () => {
    useView.setState({ sys: "electrical", xray: false });
    const mesh = new THREE.Mesh();
    const spec = { anim: glowAnim("#5C4A8A", () => true, ["flaps"]) };
    // The actuator belongs to both Electrical and Flaps, but only glows in Flaps.
    animatePart(mesh, 0, spec, appearance(mats("#5C4A8A").on));
    expect(mesh.material).toBe(mats("#5C4A8A").on);
    expect((mesh.material as THREE.Material).transparent).toBe(false);
  });

  it("retains ghost material and live motion, and reveals a hidden part only while focused", () => {
    const mesh = new THREE.Mesh();
    const spec = {
      anim: (m: THREE.Mesh) => {
        m.position.x = 0.5;
        m.visible = false;
        m.material = mats("#FF0000").hi;
      },
    };
    animatePart(mesh, 0, spec, appearance(shellMat, { ghost: true }));
    expect(mesh.material).toBe(shellMat);
    expect(mesh.position.x).toBe(0.5);
    expect(mesh.visible).toBe(false);
    const hi = mats("#FFFFFF").hi;
    animatePart(mesh, 1, spec, appearance(hi, { focused: true }));
    expect(mesh.visible).toBe(true);
    expect(mesh.material).toBe(hi);
    animatePart(mesh, 2, spec, appearance(shellMat, { ghost: true }));
    expect(mesh.visible).toBe(false);
  });
});

describe("catalogue label indexes", () => {
  const geo = () => new THREE.BoxGeometry();
  it("includes registrations after a view has already populated its indexes", () => {
    const cat = new Catalogue("test");
    const first = cat.part(geo, ["controls"], { name: "First", pin: true, parent: "group" });
    expect(cat.pinned("controls")).toEqual([first]);
    expect(cat.isPinned(first, "controls")).toBe(true);
    expect(cat.partsFor("group")).toEqual([first]);
    const next = cat.part(geo, ["controls"], { name: "Next", pin: true, parent: "group" });
    cat.part(geo, ["controls"], { name: "First", pin: true });
    expect(cat.pinned("controls")).toEqual([first, next]);
    expect(cat.isPinned(next, "controls")).toBe(true);
    expect(cat.partsFor("group")).toEqual([first, next]);
  });

  it("switches between desktop and phone label policies without changing system", () => {
    const cat = new Catalogue("test", { quiet: { controls: ["Quiet"] }, narrow: { controls: ["Quiet"] } });
    const desktop = cat.part(geo, ["controls"], { name: "Desktop", pin: true });
    const quiet = cat.part(geo, ["controls"], { name: "Quiet", pin: true });
    expect(cat.isPinned(desktop, "controls", false)).toBe(true);
    expect(cat.isPinned(quiet, "controls", false)).toBe(false);
    expect(cat.isPinned(desktop, "controls", true)).toBe(false);
    expect(cat.isPinned(quiet, "controls", true)).toBe(true);
    expect(cat.isPinned(desktop, "controls", false)).toBe(true);
  });
});
