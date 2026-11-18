import { merge, rod, slab, tube, type Dims } from "../kit";
import { plate, section, type Detail, type Point } from "../io390/shapes";
import { detail } from "./installation";

export const firewallX = (d: Dims, cessna: boolean) => d.accRear - (cessna ? 0.19 : 0.23);

/** Both batteries sit forward of the firewall, on opposite sides of the two installations. */
export function installedBattery(d: Dims, cessna: boolean, coolingTap?: Point): Detail[] {
  const x = firewallX(d, cessna),
    side = cessna ? -1 : 1,
    z = side * 0.35;
  const ref = cessna ? "C172S POH 7-47 and 172 Series MM 24-30-00 Fig. 201" : "DA40 AMM 24-31 Fig. 1";
  const box = (x0: number, x1: number, y0: number, y1: number, halfWidth: number) =>
    slab(x + x0, x + x1, y0, y1, z - halfWidth, z + halfWidth, 0.006);
  const tray = [box(0, 0.113, -0.066, -0.061, 0.082)];
  for (const k of [-1, 1]) {
    const flange = section([
      [x, -0.12],
      [x + 0.108, -0.066],
      [x, -0.066],
    ]);
    tray.push(plate(flange, z + k * 0.073 - 0.0015, z + k * 0.073 + 0.0015));
  }
  const parts = [
    detail(
      "Main battery",
      "black",
      box(0.006, 0.108, -0.061, 0.068, 0.076),
      [-0.42, 0.09, side * 0.27],
      `The main battery supplies starting power. It sits on the ${cessna ? "left" : "right"} side of the firewall (${ref}).`,
    ),
    detail(
      "Battery terminals",
      "steel",
      merge(
        [-1, 1].map((k) =>
          rod(0.006, 0.017)
            .rotateZ(Math.PI / 2)
            .translate(x + 0.087, 0.076, z + k * 0.063),
        ),
      ),
      [-0.37, 0.18, side * 0.36],
      `The battery cables attach at these terminals (${ref}).`,
    ),
    detail(
      "Battery mounting tray",
      "shroud",
      merge(tray),
      [-0.46, -0.16, side * 0.32],
      `The tray supports the battery at the firewall (${ref}).`,
    ),
    detail(
      "Battery cover",
      "acc",
      box(0.004, 0.075, 0.068, 0.08, 0.078),
      [-0.4, 0.23, side * 0.29],
      `The cover fits over the top of the main battery (${ref}).`,
    ),
    detail(
      "Battery hold-down",
      "steel",
      merge([
        box(0.046, 0.059, 0.08, 0.084, 0.082),
        ...[-1, 1].map((k) =>
          tube(
            [
              [x + 0.052, -0.064, z + k * 0.08],
              [x + 0.052, 0.086, z + k * 0.08],
            ],
            0.0025,
            1,
          ),
        ),
      ]),
      [-0.43, 0.32, side * 0.32],
      `A hold-down secures the battery and its cover to the mounting frame (${ref}).`,
    ),
  ];
  if (coolingTap) {
    parts.push(
      detail(
        "Battery cooling hose",
        "fuelHose",
        tube(
          [
            coolingTap,
            [d.front - 0.094, -0.139, d.headOut + 0.018],
            [d.caseRear, -0.151, d.headOut - 0.002],
            [x + 0.165, -0.043, z],
            [x + 0.108, 0.04, z],
          ],
          0.009,
          40,
        ),
        [-0.23, -0.21, 0.54],
        "A branch of the right cowling inlet carries cooling air to the firewall battery (DA40 AMM 71-00, 71-10).",
      ),
    );
  }
  return parts;
}
