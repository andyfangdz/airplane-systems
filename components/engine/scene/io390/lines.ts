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

/** SR20 upper leads enter through the aft wall at separate grommets. */
export function cirrusIgnitionFeedthrough(d: Dims, c: CylinderDef): Point {
  const lane = c.n <= 2 ? 0.012 : -0.012;
  return [d.caseRear, 0.164 + lane, bank(c) * (0.226 + lane)];
}

/** Fit the side-run harness to the cushioned clips visible above the rocker cover in the G6 close-up. */
export function sideLeadClamps(d: Dims, side: number): Point[] {
  const aft = Math.min(...d.cylinders.filter((c) => bank(c) === side).map((c) => c.x));
  return [-0.044, 0.025].map((dx) => [aft + dx, 0.15, side * (d.headOut - 0.0045)]);
}

function sideLead(d: Dims, side: number, [x, y, z]: Point): Point[] {
  const outer = d.headOut + 0.012;
  const [first, last] = sideLeadClamps(d, side);
  return [
    [d.accRear - 0.04, -0.126, side * 0.178],
    [d.caseRear + 0.012, -0.066, side * 0.23],
    [d.caseRear + 0.02, -0.035, side * 0.326],
    [d.caseRear + 0.032, 0.003, side * 0.403],
    [d.caseRear + 0.036, 0.067, side * outer],
    [d.caseRear + 0.049, 0.129, side * (outer - 0.002)],
    // Straight tangent through both clamps, including room for the tube tessellation at either end.
    [first[0] - 0.029, first[1], first[2]],
    [first[0] - 0.019, first[1], first[2]],
    [last[0] + 0.019, last[1], last[2]],
    [last[0] + 0.029, last[1], last[2]],
    [x - 0.017, 0.145, side * outer],
    [x + 0.005, 0.114, side * outer],
    [x + 0.008, 0.014, side * outer],
    [x + 0.002, -0.095, side * outer],
    [x, -0.163, side * (outer - 0.022)],
    [x, y - 0.028, z + side * 0.028],
  ];
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
  const outside = !airframeBaffles && !upper && c.n <= 2;
  const route: Point[] = upper
    ? [
        [aft, root[1] + 0.03, root[2]],
        [aft, 0.193 + lane + k * 0.026, root[2] * 0.7],
        [d.accRear - 0.045, 0.195 + lane + k * 0.026, k * 0.089],
        ...(airframeBaffles
          ? [-0.03, 0, 0.03].map((dx): Point => [rear + dx, passY, passZ])
          : [cirrusIgnitionFeedthrough(d, c)]),
        ...(airframeBaffles ? [[d.caseRear + 0.06, 0.192 + lane, k * (0.305 + lane)] as Point] : []),
        [destination[0] - 0.03, (airframeBaffles ? 0.187 : 0.164) + lane, k * (0.254 + lane)],
      ]
    : [
        [aft, root[1] - 0.018, root[2]],
        [aft, -0.083, k * (0.144 + lane)],
        ...(airframeBaffles ? [[d.accRear - 0.087, -0.127, k * (0.136 + lane)] as Point] : []),
        ...(outside
          ? sideLead(d, k, destination)
          : ([
              [d.accRear - 0.04, -0.152 + lane, k * (0.166 + lane)],
              [d.caseRear + 0.04, -0.154 + lane, k * (0.22 + lane)],
              [destination[0] - 0.032, -0.151 + lane, k * 0.253],
            ] as Point[])),
      ];
  return tube(
    [
      root,
      [root[0] - 0.017, root[1], root[2]],
      ...route,
      [
        destination[0] - 0.01,
        destination[1] + (upper ? 0.009 : -0.009),
        destination[2] + (outside ? 1 : -1) * k * 0.015,
      ],
      destination,
    ],
    0.0037,
    outside ? 110 : 64,
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
