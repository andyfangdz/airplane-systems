import { expect, it } from "vitest";
import { CAT, MOUNT_ATTACH, MOUNT_FEET, MOUNT_RUNS, NOSE_GEAR } from "@/aircraft/sr22t/parts";
import { ACCESSORY_FACE_X, CRANK_Y, IN } from "@/aircraft/sr22t/engine-datum";
import type { Vec3 } from "@/lib/math";

// Continental M-18 (21 Sep 2017) installation drawing 657645: the six engine mount fittings, as inches forward of the
// accessory mounting face, out from and below the crankshaft centreline. MOUNT_FEET runs left aft, left rear hole,
// left front hole, then the same on the right (negative z is the left side).
//  - forward legs: Fig 5-33 (p. 5-53) left, 16.30 + 3.97 and 3.28 in behind it; Fig 5-35 (p. 5-55) right, 16.22 + 3.97
//    and 3.28 in behind it; 7.62 in out and 8.21 in below, Fig 5-34 view D-D (p. 5-54). Dimensioned.
//  - aft mounts: 7.31 in out and 8.13 in below, Fig 5-33 rear view. The station is the 3.97 in line of Figs 5-33 and
//    5-35, scaled off the side views: approximate, ± 0.5 in.
const DIMENSIONED_IN = 0.01;
const AFT_STATION_IN = 0.5;
const feet: { key: string; station: number; out: number; below: number; side: -1 | 1; tolerance: number }[] = [
  { key: "left-aft", station: 3.97, out: 7.31, below: 8.13, side: -1, tolerance: AFT_STATION_IN },
  { key: "left-rear-hole", station: 16.99, out: 7.62, below: 8.21, side: -1, tolerance: DIMENSIONED_IN },
  { key: "left-front-hole", station: 20.27, out: 7.62, below: 8.21, side: -1, tolerance: DIMENSIONED_IN },
  { key: "right-aft", station: 3.97, out: 7.31, below: 8.13, side: 1, tolerance: AFT_STATION_IN },
  { key: "right-rear-hole", station: 16.91, out: 7.62, below: 8.21, side: 1, tolerance: DIMENSIONED_IN },
  { key: "right-front-hole", station: 20.19, out: 7.62, below: 8.21, side: 1, tolerance: DIMENSIONED_IN },
];

it("the six engine mount feet sit at the M-18 mount stations (Figs 5-33 to 5-35, pp. 5-53 to 5-55)", () => {
  expect(MOUNT_FEET).toHaveLength(feet.length);
  for (const [i, foot] of feet.entries()) {
    const [x, y, z] = MOUNT_FEET[i];
    expect(Math.abs((x - ACCESSORY_FACE_X) / IN - foot.station), `${foot.key} station`).toBeLessThanOrEqual(
      foot.tolerance,
    );
    expect(Math.abs((CRANK_Y - y) / IN - foot.below), `${foot.key} below the crankshaft`).toBeLessThanOrEqual(
      DIMENSIONED_IN,
    );
    expect(Math.abs(z / IN - foot.side * foot.out), `${foot.key} out from the crankshaft`).toBeLessThanOrEqual(
      DIMENSIONED_IN,
    );
  }
  // Each foot carries its isolator (POH 7-31; AMM 71-20 PDF 2522).
  const isolators = CAT.parts.filter((p) => p.name === "Engine mount isolator");
  expect(isolators).toHaveLength(MOUNT_FEET.length);
  for (const foot of MOUNT_FEET) expect(isolators.some((p) => p.pos!.every((v, k) => v === foot[k]))).toBe(true);
});

// precheck: passes-on-base deliberate regression guard: the frame is connected before and after the feet move
it("the mount frame stays one connected structure from the firewall fittings to the feet and the nose strut (AMM Fig 71-20-1 PDF 2527)", () => {
  // Members join where two runs share a node; the nodes are exact repeats of one coordinate triple.
  const key = (p: Vec3) => p.join(",");
  const nodes = new Map<string, Vec3>();
  const links = new Map<string, Set<string>>();
  for (const run of MOUNT_RUNS)
    for (const [i, p] of run.entries()) {
      nodes.set(key(p), p);
      if (!links.has(key(p))) links.set(key(p), new Set());
      if (i > 0) {
        links.get(key(p))!.add(key(run[i - 1]));
        links.get(key(run[i - 1]))!.add(key(p));
      }
    }
  const reached = new Set<string>([key(MOUNT_ATTACH[0])]);
  const queue = [key(MOUNT_ATTACH[0])];
  for (let next = queue.pop(); next !== undefined; next = queue.pop())
    for (const n of links.get(next) ?? [])
      if (!reached.has(n)) {
        reached.add(n);
        queue.push(n);
      }
  expect(reached.size, "every frame node is reachable from the first firewall fitting").toBe(nodes.size);
  for (const anchor of [...MOUNT_ATTACH, ...MOUNT_FEET, NOSE_GEAR]) expect(reached.has(key(anchor))).toBe(true);
});
