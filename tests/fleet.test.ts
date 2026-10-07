/**
 * Fleet-wide invariants: what every airplane definition and parts catalogue must satisfy for the shared shell to show it.
 * These catch mistakes that would otherwise show up only in the browser (or only as a development console warning).
 */
import { describe, expect, it } from "vitest";
import { FLEET } from "@/aircraft";
import { AIRCRAFT_IDS, sysColor, type SysId } from "@/lib/systems";

const finite = (v: number[]) => v.length === 3 && v.every(Number.isFinite);

it("lists every airplane id exactly once", () => {
  expect(FLEET.map((a) => a.id).sort()).toEqual([...AIRCRAFT_IDS].sort());
});

describe.each(FLEET.map((a) => [a.id, a] as const))("%s", (_, def) => {
  const sysIds = def.systems.map((s) => s.id);
  const has = (id: SysId) => sysIds.includes(id);

  it("starts its rail with the overview and lists each system once", () => {
    expect(sysIds[0]).toBe("overview");
    expect(new Set(sysIds).size).toBe(sysIds.length);
  });

  it("gives every system a colour, a page, a blurb (bar the overview) and a finite camera", () => {
    for (const s of def.systems) {
      expect(sysColor(s.id, "light"), s.id).toMatch(/^#[0-9A-F]{6}$/i);
      expect(sysColor(s.id, "dark"), s.id).toMatch(/^#[0-9A-F]{6}$/i);
      expect(s.pg, s.id).not.toBe("");
      if (s.id !== "overview") expect(s.blurb, s.id).not.toBe("");
      expect(finite(s.cam[0]) && finite(s.cam[1]), s.id).toBe(true);
    }
  });

  it("has a side panel for every system", () => {
    for (const id of sysIds) expect(def.panels[id], id).toBeTypeOf("function");
    for (const id of Object.keys(def.panels)) expect(has(id as SysId), `panel for unknown system ${id}`).toBe(true);
  });

  const cat = def.labels?.cat;
  if (!cat) return;

  it("gives every part, shell and surface a unique id", () => {
    const ids = [...cat.parts.map((p) => p.id), ...cat.shells.map((s) => s.id), ...cat.surfaces.map((s) => s.key)];
    expect(ids.length - new Set(ids).size).toBe(0);
  });

  it("puts parts only in its own systems, and label pins only in views the part belongs to", () => {
    for (const p of cat.parts) {
      for (const s of p.sys) expect(has(s), `${p.id} in ${s}`).toBe(true);
      for (const s of p.pinIn ?? []) expect(p.sys.includes(s), `${p.id} pinned in ${s}`).toBe(true);
    }
    for (const s of cat.surfaces) for (const id of s.sys) expect(has(id), `${s.key} in ${id}`).toBe(true);
  });

  it("names only pinned parts of a view in its label lists", () => {
    for (const kind of ["quiet", "narrow"] as const) {
      for (const [sys, names] of Object.entries(cat.labels[kind] ?? {}) as [SysId, string[]][]) {
        expect(has(sys), `${kind} list for unknown system ${sys}`).toBe(true);
        const pinned = new Set(cat.pinned(sys).map((p) => p.name));
        for (const n of names)
          expect(pinned.has(n), `${kind} list for "${sys}" names "${n}", which is not a pinned part of that view`).toBe(
            true,
          );
      }
    }
  });
});
