/**
 * The IO-390's 3D model (components/engine/scene/): the moving parts keep time with the cycle model, and what the IOM
 * gives as a number (envelope, drive ratios) sets the drawing.
 */
import { layoutFor } from "@/components/engine/scene/layout";
import { makeSolidFinishes } from "@/components/engine/scene/io390/finishes";
import { describe, expect, test } from "vitest";
import { IO390 } from "@/engines/io390/spec";
import { mod, phaseOf, sideAngle, valveLift } from "@/engines/model/cycle";
import {
  bank,
  gearSpins,
  dims,
  disposeMats,
  GEAR_TEETH,
  IN,
  lobeAngle,
  magDrive,
  makeMats,
  oilPump,
  peakCrank,
  STARTER_TEETH,
  VT,
} from "@/components/engine/scene/kit";

const S = IO390;
const d = dims(S);

describe("IO-390 3D model", () => {
  test("solid surface maps survive the part-specific head and exhaust clones and release once per model", () => {
    const layout = layoutFor(S);
    const solid = makeSolidFinishes(layout);
    const study = makeMats(layout);
    const { mats } = solid;
    const head = mats.head.clone();
    const header = mats.exhaust.clone();
    header.userData.header = true;
    const tiles = [mats.case.map, mats.steel.map, mats.paper.map, mats.lead.map, mats.duct.map, mats.exhaust.map];
    let disposedTiles = 0;
    try {
      for (const tile of tiles) tile?.addEventListener("dispose", () => disposedTiles++);
      expect(tiles.every((tile) => tile?.generateMipmaps)).toBe(true);
      expect(head.map).toBe(mats.case.map);
      expect(header.map).toBe(mats.exhaust.map);
      expect(header.customProgramCacheKey()).not.toBe(mats.exhaust.customProgramCacheKey());
      expect(mats.propFlange.customProgramCacheKey()).not.toBe(mats.steel.customProgramCacheKey());
      expect(mats.oilHose.map).toBe(mats.lead.map);
      expect(mats.case.transparent).toBe(false);
      expect(study.case.map).toBeNull();
      expect(study.case.transparent).toBe(true);
      expect(study.ringSupport).toBe(study.acc);
    } finally {
      head.dispose();
      header.dispose();
      disposeMats(study);
      solid.dispose();
    }
    expect(disposedTiles).toBe(tiles.length);
  });

  test("the camshaft turns at half crankshaft speed and each lobe faces its tappet at that valve's peak lift", () => {
    for (const c of S.geometry.cylinders)
      for (const intake of [true, false]) {
        const crank = peakCrank(S, c, intake);
        // nose direction (0 up, 90 right) of a lobe on the idler-driven camshaft
        const nose = mod(90 + lobeAngle(S, c, intake) + crank / 2, 360);
        expect(nose).toBeCloseTo(sideAngle(c), 6);
        const lift = valveLift(S, phaseOf(S, c.n, crank));
        expect(intake ? lift.intake : lift.exhaust).toBeCloseTo(1, 6);
      }
  });

  test("no two cam lobes overlap along the camshaft", () => {
    const at = S.geometry.cylinders
      .flatMap((c) => [c.x + bank(c) * VT.xOff, c.x - bank(c) * VT.xOff])
      .sort((a, b) => a - b);
    for (let i = 1; i < at.length; i++) expect(at[i] - at[i - 1]).toBeGreaterThan(VT.lobeW);
  });

  test("the rockers are drawn 1:1, so the valve lifts as far as the tappet", () => {
    expect(VT.pushY - VT.pivotY).toBeCloseTo(VT.pivotY - VT.tipY, 6);
  });

  test("the cylinders fit the published overall width (Table A-1, 34.37 in)", () => {
    expect(d.headOut).toBeLessThanOrEqual((S.geometry.envelopeIn.width * IN) / 2);
    // the piston crown stays below the head at top centre
    expect(d.r + d.l + d.crown).toBeLessThan(d.deck);
  });

  test("a 149-tooth ring gear and 9-tooth pinion give the starter drive ratio (Table A-1, 16.556:1)", () => {
    expect(STARTER_TEETH.ring / STARTER_TEETH.pinion).toBeCloseTo(S.accessories.starterRatio, 3);
  });

  test("the alternator pulley gives the alternator drive ratio (Table A-4, 3.20:1 with a 3.10 in pulley)", () => {
    expect(d.altPulleyR * 2).toBeCloseTo(3.1 * IN, 4);
    expect(d.pulleyR / d.altPulleyR).toBeCloseTo(S.accessories.alternatorRatio, 6);
  });

  test("the left idler times the cam, and both idlers drive magnetos (MM 72-20 Fig. 93, IPC Figs. 8 and 27)", () => {
    const L = layoutFor(S);
    for (const side of ["L", "R"] as const) {
      const m = magDrive(S, d, L, side),
        i = m.idler!;
      expect(Math.hypot(i.y, i.z)).toBeCloseTo(d.crankGearR + i.r, 6);
      expect(Math.hypot(i.y - m.y, Math.abs(i.z) - m.z)).toBeCloseTo(i.r + m.r, 6);
      if (side === "L") expect(Math.hypot(i.y - d.camY, i.z)).toBeCloseTo(i.r + d.camGearR, 6);
    }
    expect(GEAR_TEETH.cam / GEAR_TEETH.crank).toBe(2);
    expect(gearSpins(S, d).spins.cam).toBe(0.5);
  });

  test("the pump shaft engages the crankshaft gear directly (MM 72-25 Fig. 5)", () => {
    const pump = oilPump(d, layoutFor(S));
    expect(pump.y).toBe(0);
    expect(pump.ratio).toBe(1);
    expect(gearSpins(S, d).spins.oilPump).toBe(1);
    expect(gearSpins(S, d).spins.oilPumpIdler).toBe(-1);
  });
});
