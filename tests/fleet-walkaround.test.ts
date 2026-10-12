/** Source inspection order and the locations a student actually sees, across all four new walks. */
import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { fleetStepSide, fleetWalkClock, type createFleetWalk } from "@/lib/fleet-walk";
import { walk as c172 } from "@/aircraft/c172s/walk";
import { walk as c182 } from "@/aircraft/c182t/walk";
import { walk as da40 } from "@/aircraft/da40/walk";
import { walk as mooney } from "@/aircraft/m20c/walk";

function sourceSuite<S>(walk: ReturnType<typeof createFleetWalk<S>>) {
  describe(`${walk.data.short} source-specific preflight`, () => {
    it("gives every study item a source and a resolvable spotlight or an explicit physical gap", () => {
      const unknown: string[] = [];
      for (const step of walk.steps) {
        expect(step.item.ref).toBeTruthy();
        for (const name of walk.stepParts(step).shown)
          if (!walk.inCatalogue(name)) unknown.push(`${step.item.id}: ${name}`);
      }
      expect(unknown).toEqual([]);
      expect(new Set(walk.steps.map((s) => s.item.id)).size).toBe(walk.steps.length);
      expect(walk.data.stations.map((s) => s.n)).toEqual(
        Array.from({ length: walk.data.stations.length }, (_, i) => i + 1),
      );
    });
    it("resolves each spotlight on the inspected side, with explicit target anchors", () => {
      const absent: string[] = [];
      for (const step of walk.steps) {
        const side = fleetStepSide(step);
        for (const name of walk.stepParts(step).shown)
          if (walk.inCatalogue(name) && !walk.nameCentres(name, side).length) absent.push(`${step.item.id}: ${name}`);
        const target = step.item.target;
        if (typeof target === "string") {
          const points = walk.nameCentres(target, side),
            centre = walk.stepCentroid(step);
          expect(points.length, `${step.item.id} target ${target}`).toBeGreaterThan(0);
          expect(
            centre?.distanceTo(points.reduce((sum, p) => sum.add(p), new Vector3()).multiplyScalar(1 / points.length)),
          ).toBeLessThan(1e-8);
        }
      }
      expect(absent).toEqual([]);
    });
    it("rejects foreign progress, strips unknown marks, and consumes only valid station links", () => {
      const id = walk.steps[0].item.id;
      expect(walk.parseProgress("broken")).toBeNull();
      expect(walk.parseProgress(JSON.stringify({ v: 1, at: "foreign", marks: {}, ms: 0 }))).toBeNull();
      expect(walk.parseProgress(JSON.stringify({ v: 1, at: id, marks: [], ms: 0 }))).toBeNull();
      expect(walk.parseProgress(JSON.stringify({ v: 1, at: id, marks: {}, ms: -1 }))).toBeNull();
      expect(
        walk.parseProgress(JSON.stringify({ v: 1, at: id, marks: { [id]: "ok", foreign: "ok" }, ms: 2000 })),
      ).toMatchObject({ marks: { [id]: "ok" }, done: false });
      expect(walk.walkParam("?walk")).toBe(1);
      expect(walk.walkParam(`?walk=${walk.data.stations.length}`)).toBe(walk.data.stations.length);
      expect(walk.walkParam(`?walk=${walk.data.stations.length + 1}`)).toBeNull();
    });
  });
}
sourceSuite(c172);
sourceSuite(c182);
sourceSuite(da40);
sourceSuite(mooney);
it("retains the distinct source checklists instead of copying a Cirrus inspection", () => {
  // Cessna 172SIMBUS-00 4-5/6; 182TPHAUS-04 4-7/8; DA40 AFM 4A-3–10; 1968 OM 3-3–5.
  expect(c172.data.stations.map((s) => s.items.length)).toEqual([28, 6, 2, 5, 7, 3, 5, 2]);
  expect(c182.data.stations.map((s) => s.items.length)).toEqual([29, 6, 2, 6, 8, 3, 5, 2]);
  expect(da40.data.stations.map((s) => s.items.length)).toEqual([19, 9, 19, 5, 7, 4, 15, 9, 22]);
  expect(mooney.data.stations.map((s) => s.items.length)).toEqual([3, 2, 2, 2, 5, 10, 5, 8, 6, 1]);
  expect(mooney.data.stations[1].side).toBe("R");
  expect(mooney.data.stations[3].side).toBe("L");
  expect(c172.steps.find((s) => s.item.text === "Stall warning inlet")?.item.note).toMatch(/pneumatic/);
  expect(c182.steps.find((s) => s.item.text === "Stall warning vane and horn")?.item.note).toMatch(/electrical/);
  expect(da40.steps.find((s) => s.item.text === "Engine oil")?.item.standard).toBe("MINIMUM 4 QT VFR / 6 QT IFR");
  expect(fleetWalkClock(125000)).toBe("2:05");
});
