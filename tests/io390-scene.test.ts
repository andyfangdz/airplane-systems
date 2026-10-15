/**
 * The IO-390's 3D model (components/engine/scene/): the moving parts keep time with the cycle model, and what the IOM
 * gives as a number (envelope, drive ratios) sets the drawing.
 */
import { describe, expect, test } from "vitest";
import { IO390 } from "@/engines/io390/spec";
import { mod, phaseOf, sideAngle, valveLift } from "@/engines/model/cycle";
import {
  bank,
  dims,
  GEAR_TEETH,
  IN,
  lobeAngle,
  magDrive,
  oilPump,
  peakCrank,
  STARTER_TEETH,
  VT,
} from "@/components/engine/scene/kit";

const S = IO390;
const d = dims(S);

describe("IO-390 3D model", () => {
  test("the camshaft turns at half crankshaft speed and each lobe faces its tappet at that valve's peak lift", () => {
    for (const c of S.geometry.cylinders)
      for (const intake of [true, false]) {
        const crank = peakCrank(S, c, intake);
        // nose direction (0 up, 90 right) of a lobe on a camshaft turned −crank/2
        const nose = mod(90 + lobeAngle(S, c, intake) - crank / 2, 360);
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

  test("every gear meshes with the one that drives it", () => {
    // camshaft gear on the crankshaft gear, twice the teeth: half speed
    expect(d.camY).toBeCloseTo(d.crankGearR + d.camGearR, 6);
    expect(GEAR_TEETH.cam / GEAR_TEETH.crank).toBeCloseTo(d.camGearR / d.crankGearR, 6);
    // magneto gears on the camshaft gear, at the magneto drive ratio (Table A-1, 1:1)
    const m = magDrive(S, d);
    expect(Math.hypot(m.y - d.camY, m.z)).toBeCloseTo(d.camGearR + m.r, 6);
    expect((0.5 * GEAR_TEETH.cam) / m.teeth).toBeCloseTo(S.accessories.magnetoRatio, 6);
    // oil pump drive gear under the crankshaft gear
    const p = oilPump(d);
    expect(-p.y).toBeCloseTo(d.crankGearR + p.driveR, 6);
    expect(GEAR_TEETH.crank / p.driveTeeth).toBeCloseTo(p.ratio, 6);
  });
});
