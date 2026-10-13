/** Fixed forward-post enclosure: fuel/control runs are behind the cabin finish (POH Fig 7-1).
 * Shape and offsets fit the schematic installation, not a measured structural section. */
import * as THREE from "three";
import type { DoorSkin } from "@/lib/doors";
import type { Catalogue } from "@/lib/catalogue";
import type { fuselage } from "@/lib/geometry";

export function finishCessnaPosts(
  cat: Catalogue,
  fuse: ReturnType<typeof fuselage>,
  X: (fs: number) => number,
  Y: (h: number) => number,
) {
  const parts = cat.parts.filter((p) => p.name === "Forward door post");
  if (parts.length !== 2) throw new Error("Expected both Cessna forward door posts");
  // Keep the independent straight control cable between its existing pulleys.
  // The finish surrounds it; bending that cable to follow the skin would invent idlers.
  parts.forEach((part, i) => {
    const side = i === 0 ? 1 : -1;
    part.geo = () => {
      const positions: number[] = [];
      const aft = X(29.2),
        front = X(25.5);
      const ring = (y: number) => {
        const outer = (x: number) => Math.abs(fuse.onSkin(x, y, side, 1).z) - 0.003;
        const za = outer(aft),
          zf = outer(front);
        const inner = Math.min(0.39, za - 0.008, zf - 0.008);
        return [
          new THREE.Vector3(aft, y, side * inner),
          new THREE.Vector3(front, y, side * inner),
          new THREE.Vector3(front, y, side * zf),
          new THREE.Vector3(aft, y, side * za),
        ];
      };
      const triangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
        for (const v of side > 0 ? [a, c, b] : [a, b, c]) positions.push(v.x, v.y, v.z);
      };
      const low = Y(29.5),
        high = Math.min(Y(76), fuse.topY(aft) - 0.02, fuse.topY(front) - 0.02);
      const n = Math.ceil((high - low) / 0.015);
      let prev = ring(low);
      triangle(prev[0], prev[2], prev[1]);
      triangle(prev[0], prev[3], prev[2]);
      for (let j = 1; j <= n; j++) {
        const next = ring(low + ((high - low) * j) / n);
        for (let k = 0; k < 4; k++) {
          const l = (k + 1) % 4;
          triangle(prev[k], prev[l], next[l]);
          triangle(prev[k], next[l], next[k]);
        }
        prev = next;
      }
      triangle(prev[0], prev[1], prev[2]);
      triangle(prev[0], prev[2], prev[3]);
      const g = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      g.computeVertexNormals();
      return g;
    };
    part.color = "#8C8880";
    part.fairing = true;
    part.note +=
      " Fixed trim encloses the fuel/control runs and ghosts for X-ray. Section, thickness and offsets are illustrative.";
  });
}

/** End the headliner at the actual wraparound roof glazing, without overlapping CDT holes. */
export function cessnaLiningOutline(
  skin: DoorSkin,
  roof: number[][],
  X: (fs: number) => number,
  Y: (h: number) => number,
) {
  const aftFs = 120;
  const edge = roof.filter(([fs]) => fs < aftFs);
  const next = roof.find(([fs]) => fs >= aftFs)!;
  const last = edge.at(-1)!;
  edge.push([aftFs, last[1] + ((next[1] - last[1]) * (aftFs - last[0])) / (next[0] - last[0])]);
  return [
    new THREE.Vector2(X(aftFs), -1),
    new THREE.Vector2(X(25), -1),
    new THREE.Vector2(X(25), 1),
    new THREE.Vector2(X(edge[0][0]), 1),
    ...edge.map(([fs, h]) => skin.parameter(new THREE.Vector3(X(fs), Y(h), 0))),
  ];
}
