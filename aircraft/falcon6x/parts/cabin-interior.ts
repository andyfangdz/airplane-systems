import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { loft, mergeGeos } from "@/lib/geometry";
import { V } from "@/lib/math";
import { CABIN_FLOOR_Y as floorY, FUSE } from "../geometry";

export { floorY };

export const softBox = (x: number, y: number, z: number, r = 0.035) =>
  new RoundedBoxGeometry(x, y, z, 2, Math.min(r, Math.min(x, y, z) / 2));

/** Upholstery rolls over at the edges and narrows at the shoulders. The slight dish along
 * the center of the back and pad keeps the seat silhouette distinct from its rigid shell. */
function upholstery(stations: number[][], dish = 0) {
  return loft(
    stations.map(([y, x, depth, width]) =>
      Array.from({ length: 32 }, (_, i) => {
        const angle = (i * Math.PI) / 16;
        const c = Math.cos(angle),
          s = Math.sin(angle);
        const u = Math.sign(c) * Math.abs(c) ** 0.55,
          v = Math.sign(s) * Math.abs(s) ** 0.55;
        return V(x + depth * u - dish * Math.max(0, u) * (1 - v * v), y, width * v);
      }),
    ),
  );
}

export function chairCushions() {
  return mergeGeos([
    upholstery(
      [
        [0.31, 0, 0.26, 0.25],
        [0.36, 0.012, 0.32, 0.3],
        [0.425, 0.028, 0.328, 0.304],
        [0.46, 0.04, 0.294, 0.281],
      ],
      0.018,
    ),
    upholstery(
      [
        [0.399, -0.208, 0.09, 0.25],
        [0.52, -0.229, 0.112, 0.286],
        [0.67, -0.247, 0.103, 0.294],
        [0.88, -0.287, 0.095, 0.307],
        [0.94, -0.296, 0.079, 0.267],
      ],
      0.038,
    ),
    upholstery(
      [
        [0.933, -0.302, 0.075, 0.262],
        [0.96, -0.313, 0.1, 0.283],
        [1.065, -0.319, 0.095, 0.274],
        [1.105, -0.325, 0.072, 0.22],
      ],
      0.012,
    ),
  ]);
}
export function chairShell() {
  const outer = new THREE.Shape();
  outer.moveTo(-0.27, 0.34);
  outer.quadraticCurveTo(-0.325, 0.43, -0.291, 0.649);
  outer.quadraticCurveTo(-0.278, 0.689, -0.22, 0.684);
  outer.lineTo(0.205, 0.649);
  outer.quadraticCurveTo(0.293, 0.638, 0.274, 0.535);
  outer.lineTo(0.233, 0.374);
  outer.quadraticCurveTo(0.216, 0.326, 0.145, 0.325);
  outer.closePath();
  const inner = new THREE.Path();
  inner.moveTo(-0.213, 0.446);
  inner.lineTo(0.139, 0.422);
  inner.quadraticCurveTo(0.17, 0.418, 0.184, 0.473);
  inner.lineTo(0.21, 0.544);
  inner.quadraticCurveTo(0.225, 0.572, 0.181, 0.578);
  inner.lineTo(-0.199, 0.615);
  inner.quadraticCurveTo(-0.243, 0.621, -0.239, 0.577);
  inner.lineTo(-0.24, 0.49);
  inner.quadraticCurveTo(-0.24, 0.454, -0.213, 0.446);
  outer.holes.push(inner);
  return mergeGeos([
    upholstery(
      [
        [0.065, -0.02, 0.228, 0.22],
        [0.17, -0.01, 0.274, 0.232],
        [0.326, 0.012, 0.298, 0.264],
      ],
      0,
    ),
    ...[-1, 1].map((s) =>
      new THREE.ExtrudeGeometry(outer, {
        depth: 0.065,
        bevelEnabled: true,
        bevelSize: 0.009,
        bevelThickness: 0.009,
        bevelSegments: 2,
        curveSegments: 6,
      }).translate(0, 0, s * 0.319 - 0.0325),
    ),
  ]);
}
export function chairTrim() {
  const insert = new THREE.Shape();
  insert.moveTo(-0.222, 0.577);
  insert.quadraticCurveTo(-0.232, 0.611, -0.201, 0.609);
  insert.lineTo(0.18, 0.572);
  insert.quadraticCurveTo(0.204, 0.57, 0.192, 0.536);
  insert.lineTo(0.167, 0.462);
  insert.quadraticCurveTo(0.159, 0.433, 0.137, 0.435);
  insert.lineTo(-0.195, 0.462);
  insert.quadraticCurveTo(-0.223, 0.467, -0.222, 0.51);
  insert.closePath();
  return mergeGeos([
    softBox(0.43, 0.065, 0.32, 0.025).translate(0, 0.04, 0),
    ...[-1, 1].map((s) =>
      new THREE.ExtrudeGeometry(insert, { depth: 0.01, bevelEnabled: false, curveSegments: 6 }).translate(
        0,
        0,
        s * 0.31 - 0.005,
      ),
    ),
  ]);
}

/** An inward-facing liner lets the X-ray observer look across the cabin from either side.
 * Map each recessed reveal back onto the corresponding shell aperture. */
function innerPoint(x: number, angle: number, side: number, scale: number) {
  const p = FUSE.ring(x, scale, 1, angle, angle, false)[0];
  p.z *= side;
  return p;
}

function wallBay(center: number, side: number) {
  const rings = [0, 1, 2, 3].map((level) =>
    Array.from({ length: 32 }, (_, i) => {
      const a = (i * Math.PI) / 16,
        c = Math.cos(a),
        s = Math.sin(a);
      const cx = Math.sign(c) * Math.abs(c) ** 0.79,
        sy = Math.sign(s) * Math.abs(s) ** 0.79;
      if (level === 3) {
        const edge = Math.max(Math.abs(c), Math.abs(s));
        return innerPoint(center + (0.274 * c) / edge, 0.205 + ((s > 0 ? 0.46 : 0.36) * s) / edge, side, 0.933);
      }
      return innerPoint(
        center + [0.161, 0.18, 0.197][level] * cx,
        0.205 + [0.161, 0.187, 0.209][level] * sy,
        side,
        [0.986, 0.948, 0.932][level],
      );
    }),
  );
  return cabinSurface(rings, true, -side);
}

function cabinSurface(rows: THREE.Vector3[][], closed: boolean, winding: number) {
  const index: number[] = [];
  const cols = rows[0].length;
  for (let i = 0; i < rows.length - 1; i++) {
    for (let j = 0; j < (closed ? cols : cols - 1); j++) {
      const k = (j + 1) % cols,
        a = i * cols + j,
        b = i * cols + k,
        c = a + cols,
        d = b + cols;
      if (winding > 0) index.push(a, c, d, a, d, b);
      else index.push(a, d, c, a, b, d);
    }
  }
  const g = new THREE.BufferGeometry().setFromPoints(rows.flat());
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}
export function windowWall(side: number) {
  return mergeGeos(Array.from({ length: 15 }, (_, i) => wallBay(6.23 - i * 0.548, side)));
}

export function roofBand(a0: number, a1: number, scale: number, fore = 6.504, aft = -2.65) {
  const rows = Array.from({ length: 26 }, (_, i) => {
    const x = aft + (i * (fore - aft)) / 25;
    return FUSE.ring(x, scale, 14, a0, a1, false);
  });
  return cabinSurface(rows, false, -1);
}

const headlinerFinish = new THREE.MeshStandardMaterial({
  color: "#E9E1D2",
  emissive: "#888173",
  roughness: 0.91,
});
const lightDiffuser = new THREE.MeshStandardMaterial({
  color: "#FFF3D8",
  emissive: "#FFE6B8",
  roughness: 0.77,
});
export const headlinerMaterial = () => headlinerFinish;
export const coveMaterial = () => lightDiffuser;

export function bulkhead(x: number, side: number, height: number) {
  const shape = new THREE.Shape();
  const limit = (y: number) => Math.abs(FUSE.onSkin(x, y, 1, 0.95).z);
  shape.moveTo(0.34, floorY);
  shape.lineTo(limit(floorY), floorY);
  for (let i = 1; i <= 24; i++) {
    const y = floorY + ((height - floorY) * i) / 24;
    shape.lineTo(limit(y), y);
  }
  shape.lineTo(0.37, height);
  shape.quadraticCurveTo(0.31, height - 0.03, 0.31, height - 0.13);
  shape.lineTo(0.34, floorY);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.042,
    bevelEnabled: true,
    bevelSize: 0.008,
    bevelThickness: 0.008,
    bevelSegments: 2,
  });
  g.rotateY(((side * Math.PI) / 2) * -1);
  return g.translate(x + side * 0.021, 0, 0);
}

let woodMaterial: THREE.MeshStandardMaterial | undefined;
export function oakVeneer() {
  if (woodMaterial) return woodMaterial;
  const width = 256,
    height = 128,
    data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const warp = 1.55 * Math.sin((x * 2 * Math.PI) / width) + 0.45 * Math.sin((x * 4 * Math.PI) / width);
      const grain = 0.6 * Math.cos(((y + warp) * Math.PI) / 2) + 0.4 * Math.cos(((y + 2 * warp) * Math.PI) / 8);
      const band = 5 * Math.sin(((y + warp) * Math.PI) / 16) + 3 * Math.sin(((y + warp) * Math.PI) / 32);
      const delta = band + grain * 5,
        k = (y * width + x) * 4;
      data[k] = 164 + delta;
      data[k + 1] = 113 + delta;
      data[k + 2] = 72 + delta;
      data[k + 3] = 255;
    }
  const texture = new THREE.DataTexture(data, width, height);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  woodMaterial = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.43,
    metalness: 0.01,
    emissive: "#302115",
  });
  return woodMaterial;
}

export function aftCloseout() {
  const x = -2.7;
  const shape = new THREE.Shape();
  FUSE.ring(x, 0.933, 52, -0.66, Math.PI + 0.66, false).forEach((p, i) => {
    if (i === 0) shape.moveTo(p.z, p.y);
    else shape.lineTo(p.z, p.y);
  });
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false })
    .rotateY(-Math.PI / 2)
    .translate(x, 0, 0);
}

let carpet: THREE.MeshStandardMaterial | undefined;
export function woolCarpet() {
  if (carpet) return carpet;
  const size = 128,
    data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const hatch = (x + Math.floor(y / 8) * 2) % 8;
      const value = (hatch === 0 ? 6 : 0) + (y % 4 === 0 ? -4 : 0) + 3 * Math.sin(y * 0.53 + x * 1.92);
      const i = 4 * (y * size + x);
      data.set([145 + value, 135 + value, 118 + value, 255], i);
    }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return (carpet = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.97 }));
}
export function carpetUV(geo: THREE.BufferGeometry) {
  const p = geo.getAttribute("position"),
    uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[2 * i] = p.getX(i) * 1.7;
    uv[2 * i + 1] = p.getZ(i) * 1.7;
  }
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return geo;
}
