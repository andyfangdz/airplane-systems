// External Lycoming lines in engine coordinates. The ends and bulkhead penetrations share the installed component stations.
import type { CylinderDef, EngineSpec } from "@/engines/types";
import { bank, headPoints, toWorld, tube, type Dims } from "../kit";
import type { Point } from "./shapes";

export function nozzleLinePoints(c: CylinderDef, d: Dims, [x, y]: Point): Point[] {
  const n = toWorld(c, headPoints(d).nozzleTop),
    k = bank(c);
  return [
    [x + (c.n < 3 ? 0.01 : -0.01), y + 0.006, k * 0.028],
    [n[0], y + 0.005, k * 0.13],
    [n[0], n[1] + 0.03, n[2] * 0.92],
    n,
  ];
}

/** Center of each upper lead’s drilled passage through the IO-360 rear baffle. */
export function ignitionFeedthrough(d: Dims, c: CylinderDef): Point {
  const lane = c.n <= 2 ? 0.012 : -0.012;
  return [d.caseRear + 0.005, 0.146 + lane, bank(c) * (0.303 + lane)];
}

export function plugLead(
  d: Dims,
  c: CylinderDef,
  end: Point,
  destination: Point,
  upper: boolean,
  airframeBaffles = false,
) {
  const k = bank(c);
  const lane = c.n <= 2 ? 0.012 : -0.012;
  const root: Point = [end[0] - 0.019, end[1] + (upper ? 0.017 : -0.017), end[2] + lane];
  const aft = end[0] - (upper ? 0.048 : 0.071) - lane + (airframeBaffles ? 0.022 + (!upper && k > 0 ? 0.015 : 0) : 0);
  const [rear, passY, passZ] = ignitionFeedthrough(d, c);
  const route: Point[] = upper
    ? [
        [aft, root[1] + 0.03, root[2]],
        [aft, 0.193 + lane + k * 0.026, root[2] * 0.7],
        [d.accRear - 0.045, 0.195 + lane + k * 0.026, k * 0.089],
        ...(airframeBaffles
          ? [-0.03, 0, 0.03].map((dx): Point => [rear + dx, passY, passZ])
          : [[d.caseRear, 0.164 + lane, k * (0.226 + lane)] as Point]),
        ...(airframeBaffles ? [[d.caseRear + 0.06, 0.192 + lane, k * (0.305 + lane)] as Point] : []),
        [destination[0] - 0.03, (airframeBaffles ? 0.187 : 0.164) + lane, k * (0.254 + lane)],
      ]
    : [
        [aft, root[1] - 0.018, root[2]],
        [aft, -0.083, k * (0.144 + lane)],
        ...(airframeBaffles ? [[d.accRear - 0.087, -0.127, k * (0.136 + lane)] as Point] : []),
        [d.accRear - 0.04, -0.152 + lane, k * (0.166 + lane)],
        [d.caseRear + 0.04, -0.154 + lane, k * (0.22 + lane)],
        [destination[0] - 0.032, -0.151 + lane, k * 0.253],
      ];
  return tube(
    [
      root,
      [root[0] - 0.017, root[1], root[2]],
      ...route,
      [destination[0] - 0.01, destination[1] + (upper ? 0.009 : -0.009), destination[2] - k * 0.015],
      destination,
    ],
    0.0037,
    64,
    10,
  );
}

export function servoHoses(
  d: Dims,
  ix: number,
  iy: number,
  m: Point,
  installation?: EngineSpec["illustratedInstallation"],
) {
  const px = d.accRear - 0.03;
  const updraft = installation === "c172s",
    diamond = installation === "da40";
  return [
    tube(
      [
        [diamond ? px - 0.029 : px, diamond ? -0.077 : -0.087, -0.11],
        [diamond ? px - 0.024 : px, -0.13, -0.131],
        [d.caseRear + 0.015, updraft ? -0.262 : -0.157, -0.144],
        [d.caseRear + 0.07, updraft ? -0.257 : -0.187, -0.142],
        [updraft ? ix - 0.047 : d.front - 0.126, updraft ? -0.257 : -0.192, -0.139],
        [ix, updraft ? iy : -0.211, -0.115],
        [ix, iy, -0.068],
        [ix, iy, -0.042],
      ],
      0.0055,
      58,
      12,
    ),
    tube(
      [
        [ix, iy, 0.063],
        [ix, iy, 0.089],
        [ix - 0.01, -0.192, 0.138],
        [d.caseRear + 0.09, -0.168, 0.151],
        [d.caseRear + 0.037, -0.073, 0.201],
        [d.caseRear + 0.035, 0.051, 0.204],
        [d.caseRear + 0.071, 0.15, 0.174],
        [d.caseRear + 0.109, 0.201, 0.147],
        [m[0] - 0.056, m[1], 0.035],
        [m[0] - 0.023, m[1], 0],
      ],
      0.005,
      70,
      12,
    ),
  ];
}
