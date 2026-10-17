import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { Catalogue } from "@/lib/catalogue";
import { spotsPart } from "@/lib/spot";

const box = () => new THREE.BoxGeometry();
describe("authored catalogue identity", () => {
  it("survives a label edit, same-named insertion and different registration order", () => {
    const a = new Catalogue("test"),
      b = new Catalogue("test");
    a.part(box, ["electrical"], { id: "battery.main", name: "Main battery" });
    a.part(box, ["electrical"], { id: "battery.backup", name: "Battery" });
    b.part(box, ["electrical"], { id: "battery.backup", name: "Battery" });
    b.part(box, ["electrical"], { id: "battery.extra", name: "Battery" });
    b.part(box, ["electrical"], { id: "battery.main", name: "Renamed battery" });
    expect(a.byId("battery.main")?.id).toBe(b.byId("battery.main")?.id);
    expect(b.assembly().parts.map((p) => p.id)).toEqual([
      "test/battery.backup",
      "test/battery.extra",
      "test/battery.main",
    ]);
    expect(b.parts[0].id).toBe("test/battery.backup"); // compiling never reorders the scene
  });
  it("preserves member identity across row reorder, insertion and geometric edits", () => {
    const build = (rows: { key: string; x: number }[]) => {
      const cat = new Catalogue("test");
      for (const row of rows) cat.part(box, ["airframe"], { id: "rib", instance: row.key, pos: [row.x, 0, 0] });
      return cat;
    };
    const before = build([
      { key: "inner", x: 1 },
      { key: "outer", x: 2 },
    ]);
    const after = build([
      { key: "outer", x: 3 },
      { key: "middle", x: 1.5 },
      { key: "inner", x: 0.8 },
    ]);
    expect(after.parts[0].id).toBe(before.parts[1].id);
    expect(after.parts[2].id).toBe(before.parts[0].id);
    expect(after.parts[0].pos).not.toEqual(before.parts[1].pos);
  });
  it("rejects duplicate explicit identities even if their labels differ", () => {
    const cat = new Catalogue("test");
    cat.part(box, ["electrical"], { id: "battery", name: "Battery" });
    expect(() => cat.part(box, ["electrical"], { id: "battery", name: "Other label" })).toThrow(
      "duplicate catalogue identity",
    );
  });
  it("selects the exact repeated instance and applies label policies by ID", () => {
    const cat = new Catalogue("test", { quiet: { electrical: ["battery.left"] } });
    const left = cat.part(box, ["electrical"], { id: "battery.left", name: "Battery", pin: true });
    const right = cat.part(box, ["electrical"], { id: "battery.right", name: "Battery", pin: true });
    const geo = box();
    try {
      const spot = { names: [], ids: [left.id], side: 0 as const };
      expect(spotsPart(spot, left, geo, cat)).toBe(true);
      expect(spotsPart(spot, right, geo, cat)).toBe(false);
      expect(cat.isPinned(left, "electrical")).toBe(false);
      left.name = "New wording";
      expect(spotsPart(spot, left, geo, cat)).toBe(true);
    } finally {
      geo.dispose();
    }
  });
});
