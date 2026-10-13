/** Electrical/avionics runs use the fixed forward post, never the door aperture.
 * These lanes are illustrative; aircraft-specific endpoints retain their connection topology. */
import { cabinHarness } from "@/lib/cabinRouting";
import type { Vec3 } from "@/lib/math";
export function cessnaCabinHarness(
  shape: Parameters<typeof cabinHarness>[0] & { X: (fs: number) => number },
  a: Vec3,
  b: Vec3,
  panelBack: number,
  side = a[2] + b[2] < 0 ? -1 : 1,
) {
  return cabinHarness(shape, a, b, panelBack, side, 0.02, { x: shape.X(27), from: shape.X(69), to: shape.X(27) });
}
