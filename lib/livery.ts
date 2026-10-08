/** Side-projected paint atlas: independent, readable port and starboard markings. */
import * as THREE from "three";

export interface PaintBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
export type PaintPoint = (p: number[]) => number[];
export interface PaintText {
  text: string;
  /** Opposite corners of the lettering's bounding rectangle, in painter coordinates. */
  a: number[];
  b: number[];
  color: string;
  italic?: boolean;
}

/** Assign UVs before moving geometry into a hinge's local coordinates. Each triangle
 * belongs to one atlas half, including triangles on the centreline: no seam interpolation.
 * Normals are retained so splitting the UV seam doesn't facet the skin. */
export function sidePaintUV(source: THREE.BufferGeometry, box: PaintBox) {
  const g = source.index ? source.toNonIndexed() : source.clone();
  const p = g.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i += 3) {
    const right = p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2) >= 0;
    for (let j = i; j < i + 3; j++) {
      const u = (p.getX(j) - box.x0) / (box.x1 - box.x0);
      uv[j * 2] = right ? u / 2 : 1 - u / 2;
      uv[j * 2 + 1] = (p.getY(j) - box.y0) / (box.y1 - box.y0);
    }
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  // Keep the indexed contract used by the DA40's fixed/moving skin assembly.
  g.setIndex(Array.from({ length: p.count }, (_, i) => i));
  source.dispose();
  return g;
}

/** Mirror the paint, then draw text separately on each side so neither registration reverses. */
export function paintAtlas(base: HTMLCanvasElement, P: PaintPoint, labels: PaintText[] = []) {
  const c = document.createElement("canvas");
  const W = base.width,
    H = base.height;
  c.width = W * 2;
  c.height = H;
  const g = c.getContext("2d")!;
  g.drawImage(base, 0, 0);
  g.save();
  g.translate(2 * W, 0);
  g.scale(-1, 1);
  g.drawImage(base, 0, 0);
  g.restore();
  for (const label of labels) {
    const a = P(label.a),
      b = P(label.b);
    const x = Math.min(a[0], b[0]),
      y = Math.min(a[1], b[1]);
    const w = Math.abs(a[0] - b[0]),
      h = Math.abs(a[1] - b[1]);
    for (const left of [false, true]) {
      g.save();
      g.font = `${label.italic === false ? "" : "italic "}600 100px Arial, sans-serif`;
      const m = g.measureText(label.text);
      g.translate(left ? 2 * W - x - w : x, y);
      g.scale(w / m.width, h / (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent));
      g.fillStyle = label.color;
      g.fillText(label.text, 0, m.actualBoundingBoxAscent);
      g.restore();
    }
  }
  const texture = new THREE.CanvasTexture(c);
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
