/** Named exterior source connections, not exemptions for an entire internal harness. */
import type { Vec3 } from "@/lib/math";
import { AF } from "./geometry";
import { PITOT, STATIC_PORTS } from "./parts/pitot";
import { wp } from "./parts/catalogue";
const { P3 } = AF;
export const AIRFRAME_PORTS: Record<string, readonly { point: Vec3; reach: number }[]> = {
  // POH7-44: vents project below wing; only the short check-valve outlet is exterior.
  ovbL: [{ point: wp(-100, 0.38, -1, -0.07), reach: 0.085 }],
  ovbR: [{ point: wp(100, 0.38, -1, -0.07), reach: 0.085 }],
  // POH7-62: total pressure head is on its mast below LH wing. Lead passes through mast into wing.
  pitot: [{ point: [PITOT[0] - 0.05, PITOT[1] + 0.02, PITOT[2]], reach: 0.14 }],
  // POH7-62: pressure ports are flush on forward fuselage; limited entry stub at skin only.
  staticR: [{ point: STATIC_PORTS[0], reach: 0.027 }],
  staticL: [{ point: STATIC_PORTS[1], reach: 0.027 }],
  // Fig7-9 pump exhaust terminates at a real overboard outlet; no interior vacuum hose exempted.
  vacOut: [{ point: P3(-6, 7, 23.2), reach: 0.055 }],
  // Fig7-7 external receptacle is behind a cowl-side door; connector terminal enters J-box.
  ext: [{ point: P3(-3, -21.4, 40), reach: 0.045 }],
};
