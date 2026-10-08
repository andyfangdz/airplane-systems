/** Shape checks against digitized POH/AFM Fig 1-1 / §1.7 outlines.
 * Tolerances account for line thickness, registration and light housings; they
 * are study-model regression limits, not manufacturer dimensional tolerances.
 * See aircraft/reference-traces/README.md for source pages and calibration.
 */
import { describe, expect, it } from "vitest";
import { FLEET } from "@/aircraft";
import traces from "@/aircraft/reference-traces/handbook-traces.json";
import * as c172 from "@/aircraft/c172s/geometry";
import * as c182 from "@/aircraft/c182t/geometry";
import * as da40 from "@/aircraft/da40/geometry";
import * as sr20 from "@/aircraft/sr20/geometry";

const cases = [
  { id: "c172s", wingTip: c172.Z(c172.SPEC.wing.tipBL), tailTip: c172.Z(c172.SPEC.stab.halfSpan) },
  { id: "c182t", wingTip: c182.Z(c182.SPEC.wing.tipBL), tailTip: c182.Z(c182.SPEC.stab.halfSpan) },
  { id: "da40", wingTip: da40.WTIP, tailTip: da40.SSPAN },
] as const;

for (const { id, wingTip, tailTip } of cases) {
  describe(`${id} assembled tip outlines`, () => {
    for (const [component, z] of [
      ["wing", wingTip],
      ["tail", tailTip],
    ] as const) {
      // DA40's winglet is oblique, so its projected chord is not a constant-z section.
      if (id === "da40" && component === "wing") continue;
      it(`${component} end-cap chord agrees with the handbook trace on both sides`, () => {
        const cat = FLEET.find((d) => d.id === id)!.labels!.cat;
        const shells = cat.shells.filter((s) =>
          component === "wing" ? /wing/i.test(s.name) : /horizontal stabilizer/i.test(s.name),
        );
        const moving = component === "tail" ? cat.surfaces.filter((s) => s.key.startsWith("elev")) : [];
        const geometry = [...shells.map((s) => s.geo()), ...moving.map((s) => s.geo().translate(...s.pivot))];
        const reference = traces[id].traces;
        const chord = reference[`${component}LE`].points.at(-1)![0] - reference[`${component}TE`].points.at(-1)![0];
        try {
          for (const side of [-1, 1]) {
            const xs: number[] = [];
            for (const g of geometry) {
              const p = g.attributes.position;
              for (let i = 0; i < p.count; i++) if (Math.abs(p.getZ(i) - side * z) < 1e-5) xs.push(p.getX(i));
            }
            expect(xs.length).toBeGreaterThan(10);
            const actual = Math.max(...xs) - Math.min(...xs);
            expect(Math.abs(actual - chord), `${id} ${component}: mesh ${actual}, drawing ${chord}`).toBeLessThan(0.15);
          }
        } finally {
          geometry.forEach((g) => g.dispose());
        }
      });
    }
  });
}

it("SR20 wing retains its chord out to the POH's short rounded tip", () => {
  // Fig 1-1 plan: before the last ~0.3 m, the LE is almost straight.
  // Sampled point near BL 5.57 m, using the stored digitization (not model constants).
  const [x, z] = traces.sr20.traces.wingLE.points[2];
  expect(Math.abs(sr20.wLE(z) - x)).toBeLessThan(0.06);
  const [tx, tz] = traces.sr20.traces.wingTE.points[3];
  expect(Math.abs(sr20.wLE(tz) - sr20.wC(tz) - tx)).toBeLessThan(0.06);
});

it("DA40 horizontal tail retains the AFM §1.4 total area after clipping its leading corners", () => {
  const n = 2000,
    dz = da40.SSPAN / n;
  let area = 0;
  for (let i = 0; i < n; i++) area += (da40.sC(i * dz) + da40.sC((i + 1) * dz)) * dz;
  expect(Math.abs(area - 2.34)).toBeLessThan(0.02);
});

it("C182 maintenance station drawing's dorsal fairing remains visible ahead of FS 185", () => {
  // 182/T182 MM 6-15-00 Fig 1 (PDF 121): the fillet starts near FS 140.
  // A shell that skips the shallow profile breaks used to clip this region off.
  const cat = FLEET.find((d) => d.id === "c182t")!.labels!.cat;
  const geo = cat.shells.find((s) => s.name === "Vertical stabilizer")!.geo();
  try {
    const p = geo.attributes.position;
    const visible: number[] = [];
    for (let i = 0; i < p.count; i++) {
      const fs = c182.FS(p.getX(i));
      if (p.getY(i) > c182.topY(p.getX(i)) + 0.005) visible.push(fs);
    }
    // Broad allowance for the junction hidden by the rounded tailcone, not a
    // manufacturer tolerance. The old assembled shell began aft of FS 200.
    expect(Math.min(...visible)).toBeGreaterThan(135);
    expect(Math.min(...visible)).toBeLessThan(165);
  } finally {
    geo.dispose();
  }
});

it("stored reference points reproduce their declared pixel calibration", () => {
  for (const reference of Object.values(traces)) {
    for (const trace of Object.values(reference.traces)) {
      const c = reference.calibrations[trace.view as keyof typeof reference.calibrations];
      trace.pixels.forEach(([x, y], i) => {
        for (const axis of [0, 1]) {
          const world = c.worldOrigin[axis] + c.u[axis] * (x - c.pixelOrigin[0]) + c.v[axis] * (y - c.pixelOrigin[1]);
          expect(Math.abs(trace.points[i][axis] - world)).toBeLessThan(0.00006);
        }
      });
    }
  }
});

it("Cessna side comparisons register the hub without stretching the drawing", () => {
  for (const id of ["c172s", "c182t"] as const) {
    const c = traces[id].calibrations.side;
    expect(c.worldOrigin[1]).toBe(0);
    expect(Math.abs(c.u[0])).toBe(Math.abs(c.v[1]));
  }
});
