/** Schematic harness lanes: below the cabin floor, along the sidewall, and above the occupants.
 * Aircraft documents establish connections; these bends are drawing coordinates, not installation dimensions. */
import type { Vec3 } from "./math";

interface Envelope {
  fus(x: number): { cy: number; hh: number; hw: number };
  botY(x: number): number;
  topY(x: number): number;
  onSkin(x: number, y: number, side: number, factor?: number): { z: number };
}

export function cabinFloorLane(shape: Envelope, x: number, side: number): Vec3 {
  const section = shape.fus(x);
  return [x, shape.botY(x) + Math.max(0.045, section.hh * 0.12), side * Math.min(0.2, section.hw * 0.3)];
}

/** Preserve the actual terminals while keeping long runs out of the seat and instrument volumes. */
export function cabinHarness(
  shape: Envelope,
  a: Vec3,
  b: Vec3,
  panelBack: number,
  side = a[2] + b[2] < 0 ? -1 : 1,
  wallInset = 0.02,
  sidewallPost?: { x: number; from: number; to: number },
): Vec3[] {
  const end = (p: Vec3): Vec3[] => {
    // Behind-panel connectors descend on the forward side of the instrument faces.
    if (p[0] >= panelBack - 0.22) {
      const x = Math.max(panelBack, p[0]);
      return [p, [x, p[1], p[2]], [x, shape.fus(x).cy, p[2]], cabinFloorLane(shape, x, side)];
    }
    let x = p[0];
    let floor = cabinFloorLane(shape, x, side);
    if (p[1] <= floor[1] + 0.08) return [p, floor];
    const section = shape.fus(p[0]);
    const roof = p[1] > section.cy + section.hh * 0.45;
    let y = roof ? Math.min(p[1], shape.topY(p[0]) - 0.055) : p[1];
    const pts: Vec3[] = [p];
    if (roof) pts.push([p[0], y, p[2]]);
    const wall = (at: number, h: number) => side * Math.max(0, Math.abs(shape.onSkin(at, h, side, 1).z) - wallInset);
    // Roof equipment first reaches a headliner rail; wall fittings stay outboard before descending.
    pts.push([x, y, wall(x, y)]);
    // A narrow cabin may have no clearance between the cushion edge and the lower sidewall.
    // Reach a clear forward post before descending, keeping the lateral run behind the trim.
    if (sidewallPost && x >= sidewallPost.from && x <= sidewallPost.to) {
      const count = Math.max(1, Math.ceil(Math.abs(sidewallPost.x - x) / 0.15));
      const start = x;
      for (let i = 1; i <= count; i++) {
        x = start + ((sidewallPost.x - start) * i) / count;
        const h = Math.min(y, shape.topY(x) - 0.055);
        pts.push([x, h, wall(x, h)]);
      }
      y = Math.min(y, shape.topY(x) - 0.055);
      floor = cabinFloorLane(shape, x, side);
    }
    const sill = floor[1];
    const steps = Math.max(1, Math.ceil((y - sill) / 0.08));
    for (let i = 1; i <= steps; i++) {
      const h = y + ((sill - y) * i) / steps;
      pts.push([x, h, wall(x, h)]);
    }
    pts.push(floor);
    return pts;
  };
  const from = end(a),
    to = end(b);
  const start = from.at(-1)![0],
    finish = to.at(-1)![0];
  const points = [...from];
  // Follow the changing belly section instead of spanning the cabin with a single diagonal.
  const steps = Math.max(1, Math.ceil(Math.abs(finish - start) / 0.15));
  for (let i = 1; i < steps; i++) points.push(cabinFloorLane(shape, start + ((finish - start) * i) / steps, side));
  points.push(...to.reverse());
  return points.filter((p, i) => i === 0 || p.some((v, j) => Math.abs(v - points[i - 1][j]) > 1e-8));
}
