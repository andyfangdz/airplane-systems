/** Side trim and the forward post provide clearance around the M20C's narrow seat/floor section.
 * These are schematic drawing lanes, not surveyed installation or maintenance dimensions. */
import { cabinHarness } from "@/lib/cabinRouting";
import type { Vec3 } from "@/lib/math";
import { FUSE, PANEL_X } from "./geometry";

export const cabinRoute = (a: Vec3, b: Vec3, side = a[2] + b[2] < 0 ? -1 : 1, inset = 0.02) =>
  cabinHarness(FUSE, a, b, PANEL_X + 0.17, side, inset, { x: PANEL_X + 0.17, from: -0.5, to: PANEL_X - 0.05 });
