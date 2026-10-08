/** Schematic belt-driven alternator shared by the NAV III Cessnas. Dimensions are illustrative. */
import { cyl, mergeGeos, tubeGeo } from "@/lib/geometry";
import type { Vec3 } from "@/lib/math";
import { IN } from "./airframe";

type Pulley = { bl: number; h: number; r: number };

export function alternatorDrive(
  point: (fs: number, bl: number, h: number) => Vec3,
  spec: { bodyFs: number; beltFs: number; crank: Pulley; alt: Pulley },
) {
  const { bodyFs, beltFs, crank: a, alt: b } = spec;
  const position = point(bodyFs, b.bl, b.h);
  const reach = point(beltFs, b.bl, b.h)[0] - position[0];
  const th = Math.atan2(b.h - a.h, b.bl - a.bl);
  const ph = Math.acos((a.r - b.r) / Math.hypot(b.bl - a.bl, b.h - a.h));
  const arc = (c: Pulley, from: number, span: number, n: number) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const t = from + (span * i) / n;
      return point(beltFs, c.bl + c.r * Math.cos(t), c.h + c.r * Math.sin(t));
    });
  const pts = [...arc(a, th + ph, 2 * Math.PI - 2 * ph, 14), ...arc(b, th - ph, 2 * ph, 6)];
  return {
    position,
    bodyGeo: () => {
      const shaft = cyl(0.008, reach - 0.06, "x");
      const pulley = cyl(b.r * IN - 0.004, 0.014, "x");
      shaft.translate((reach + 0.06) / 2, 0, 0);
      pulley.translate(reach, 0, 0);
      return mergeGeos([cyl(0.06, 0.12, "x"), shaft, pulley]);
    },
    beltGeo: () => tubeGeo([...pts, pts[0]], 0.006),
  };
}
