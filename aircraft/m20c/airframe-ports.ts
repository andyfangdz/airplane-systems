/** Narrow physical openings: MAN 106 §§ 4-10–11/IPC 205 Fig. 36; pitot/static: IPC 205 Fig. 44;
 * engine breather: Lycoming 60297-12 § 4. Radii allow only each schematic throat and tube wall. */
import type { Vec3 } from "@/lib/math";
import { FUSE, onSkin, wingP } from "./geometry";
export const ventOpening = (side: number): Vec3 => {
  const p = wingP(side * 2.4, 0.3, -1);
  p.y -= 0.02;
  return p.toArray() as Vec3;
};
export const selectorDrain: Vec3 = [1.35, FUSE.lowerSkinY(1.35, -0.3) - 0.004, -0.3];
export const breatherOpening: Vec3 = [2.09, FUSE.lowerSkinY(2.09, 0.1) - 0.005, 0.1];
export const pumpDrainOpening: Vec3 = [2.15, FUSE.lowerSkinY(2.15, 0.13) - 0.005, 0.13];
export const AIRFRAME_PORTS: Record<string, readonly { point: Vec3; reach: number }[]> = {
  ventL: [{ point: ventOpening(-1), reach: 0.028 }],
  ventR: [{ point: ventOpening(1), reach: 0.028 }],
  static: [-1, 1].map((side) => ({ point: onSkin(-2.65, -0.3, side, 1.003).toArray() as Vec3, reach: 0.018 })),
  pitot: [{ point: wingP(-2.2, 0.3, -1).toArray() as Vec3, reach: 0.025 }],
  dBreather: [{ point: breatherOpening, reach: 0.015 }],
  dFuelPumpDrain: [{ point: pumpDrainOpening, reach: 0.012 }],
  dSelectorDrain: [{ point: selectorDrain, reach: 0.014 }],
};
