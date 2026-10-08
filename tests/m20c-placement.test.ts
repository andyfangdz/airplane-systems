/** M20C assembled placement and motion regressions.
 * OM pp. 6–9: gear retracts into wells outside the occupied cabin; push/pull controls,
 * one-piece elevator and pivoting tail. TCDS 2A3 supplies equipment arms; three-view
 * supplies track/wheelbase. Unspecified case/well envelopes remain schematic. */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { PartSpec } from "@/lib/catalogue";
import { D2R, V } from "@/lib/math";
import { FUSE, GROUND_Y, IN, PANEL_X, SSPAN, SY, TAIL_PIVOT, fuselageGeo, wingP } from "@/aircraft/m20c/geometry";
import { CAT, CYLS, TAIL_SHELLS } from "@/aircraft/m20c/parts";
import { live } from "@/aircraft/m20c/model";
import {
  CABIN,
  MAIN_LEG_WELL,
  MAIN_WELL,
  MG,
  NG,
  NOSE_WELL,
  fuelBayGeo,
  mainAngle,
  mainWellGeo,
  noseAngle,
  noseDoorAngle,
  noseDoorAxis,
  noseDoorHinge,
} from "@/aircraft/m20c/placement";
import { ELEV_HORN, JBAR, WHEEL, johnsonAngle, linkPoints, rigPose } from "@/aircraft/m20c/rig";
import { namedPart, partBounds, points, worldGeometry } from "./placement-helpers";

const vertices = new Map<PartSpec, THREE.Vector3[]>();
const triangles = new Map<PartSpec, number[]>();
function partPoints(part: PartSpec) {
  let value = vertices.get(part);
  if (!value) {
    const geo = worldGeometry(part);
    value = points(geo);
    triangles.set(part, geo.index ? Array.from(geo.index.array) : value.map((_, i) => i));
    geo.dispose();
    vertices.set(part, value);
  }
  return value;
}
const bounds = (part: PartSpec, matrix = new THREE.Matrix4()) =>
  new THREE.Box3().setFromPoints(partPoints(part).map((p) => p.clone().applyMatrix4(matrix)));
const penetrates = (a: THREE.Box3, b: THREE.Box3, margin = 0.00001) =>
  ["x", "y", "z"].every((axis) => {
    const k = axis as "x" | "y" | "z";
    return Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]) > margin;
  });
/** The footwell edge is tapered; its bounding box includes empty space beside the door.
 * Confirm broad-phase candidates against both closed meshes' edges and interiors. */
function meshesIntersect(a: PartSpec, matrix: THREE.Matrix4, b: PartSpec, bMatrix = new THREE.Matrix4()) {
  if (!penetrates(bounds(a, matrix), bounds(b, bMatrix))) return false;
  const ap = partPoints(a).map((p) => p.clone().applyMatrix4(matrix));
  const bp = partPoints(b).map((p) => p.clone().applyMatrix4(bMatrix));
  const ai = triangles.get(a)!,
    bi = triangles.get(b)!;
  const ray = new THREE.Ray(),
    hit = V(0, 0, 0);
  const edgesCross = (ps: THREE.Vector3[], ix: number[], qs: THREE.Vector3[], qi: number[]) => {
    for (let i = 0; i < ix.length; i += 3)
      for (let edge = 0; edge < 3; edge++) {
        const start = ps[ix[i + edge]],
          end = ps[ix[i + ((edge + 1) % 3)]];
        const length = start.distanceTo(end);
        if (length < 1e-5) continue;
        ray.set(start, end.clone().sub(start).divideScalar(length));
        for (let j = 0; j < qi.length; j += 3)
          if (ray.intersectTriangle(qs[qi[j]], qs[qi[j + 1]], qs[qi[j + 2]], false, hit)) {
            const distance = hit.distanceTo(start);
            if (distance > 1e-5 && distance < length - 1e-5) return true;
          }
      }
    return false;
  };
  const inside = (p: THREE.Vector3, ps: THREE.Vector3[], ix: number[]) => {
    ray.set(p, V(1, 0.371, 0.129).normalize());
    const distances: number[] = [];
    for (let i = 0; i < ix.length; i += 3)
      if (ray.intersectTriangle(ps[ix[i]], ps[ix[i + 1]], ps[ix[i + 2]], false, hit)) {
        const distance = hit.distanceTo(p);
        if (distance < 1e-5) return false;
        if (!distances.some((d) => Math.abs(d - distance) < 1e-5)) distances.push(distance);
      }
    return distances.length % 2 === 1;
  };
  return edgesCross(ap, ai, bp, bi) || edgesCross(bp, bi, ap, ai) || inside(ap[0], bp, bi) || inside(bp[0], ap, ai);
}
function gearMatrix(parent: string, fraction: number, yaw = 0) {
  if (parent === "nose")
    return new THREE.Matrix4()
      .makeRotationZ(noseAngle(fraction))
      .multiply(new THREE.Matrix4().makeRotationY(-(1 - fraction) * yaw * 20 * D2R))
      .setPosition(...NG.top);
  if (parent === "jbar") return new THREE.Matrix4().makeRotationZ(johnsonAngle(fraction)).setPosition(...JBAR.pivot);
  const side = parent.endsWith("L") ? -1 : 1;
  if (parent.startsWith("noseDoor"))
    return new THREE.Matrix4()
      .makeRotationAxis(noseDoorAxis(), noseDoorAngle(fraction, side))
      .setPosition(...noseDoorHinge(side));
  return new THREE.Matrix4()
    .makeRotationX(mainAngle(fraction, side))
    .setPosition(MG.trunnion[0], MG.trunnion[1], side * MG.trunnion[2]);
}
function crosses(geometry: THREE.BufferGeometry, mesh: THREE.Mesh) {
  const ps = points(geometry),
    ix = geometry.index!.array,
    ray = new THREE.Raycaster();
  const seen = new Set<string>();
  const keys = ps.map((p) =>
    p
      .toArray()
      .map((v) => v.toFixed(6))
      .join(","),
  );
  for (let i = 0; i < ix.length; i += 3)
    for (let edge = 0; edge < 3; edge++) {
      const ai = ix[i + edge],
        bi = ix[i + ((edge + 1) % 3)];
      const key = [keys[ai], keys[bi]].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      const a = ps[ai],
        b = ps[bi],
        length = a.distanceTo(b);
      if (length < 1e-5) continue;
      ray.set(a, b.clone().sub(a).divideScalar(length));
      ray.near = 1e-5;
      ray.far = length - 1e-5;
      if (ray.intersectObject(mesh).length) return true;
    }
  return false;
}

describe("M20C gear wells and occupied cabin (OM pp. 6–7)", () => {
  it("keeps the unchanged bungee package inside the belly and below the floor throughout its actual animation", () => {
    const part = namedPart(CAT, "Gear bungee springs");
    const material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(part.geo(), material);
    mesh.position.set(...part.pos!);
    mesh.geometry.computeBoundingBox();
    expect(mesh.geometry.boundingBox!.getSize(V(0, 0, 0)).toArray()).toEqual([
      expect.closeTo(0.03, 6),
      expect.closeTo(0.1, 6),
      expect.closeTo(0.03, 6),
    ]);
    const occupied = CAT.parts.filter(
      (p) => /seat|Cabin floor|floor recess/.test(p.name ?? "") || (p !== part && !p.parent && p.sys.includes("gear")),
    );
    const moving = CAT.parts.filter((p) => /^(main[LR]|nose|noseDoor[LR]|jbar)$/.test(p.parent ?? ""));
    const fraction = live.gearFrac;
    try {
      for (let step = 0; step <= 40; step++) {
        const f = step / 40;
        live.gearFrac = f;
        part.anim!(mesh, 0);
        mesh.updateMatrix();
        const matrix = mesh.matrix
          .clone()
          .multiply(new THREE.Matrix4().makeTranslation(...(part.pos!.map((v) => -v) as [number, number, number])));
        for (const p of partPoints(part).map((p) => p.clone().applyMatrix4(matrix)))
          expect(FUSE.inside(p, 0.002), `bungee vs belly at ${f}: ${p.toArray()}`).toBe(true);
        expect(bounds(part, matrix).max.y).toBeLessThan(CABIN.floor - 0.016);
        for (const other of occupied)
          expect(meshesIntersect(part, matrix, other), `bungee vs ${other.name} at ${f}`).toBe(false);
        for (const other of moving)
          for (const yaw of other.parent === "nose" ? [-1, 0, 1] : [0])
            expect(
              meshesIntersect(part, matrix, other, gearMatrix(other.parent!, f, yaw)),
              `bungee vs ${other.name} at ${f}, yaw=${yaw}`,
            ).toBe(false);
      }
    } finally {
      live.gearFrac = fraction;
      mesh.geometry.dispose();
      material.dispose();
    }
  }, 30_000);

  it("preserves the cited ground track, wheelbase and full-size tire envelopes", () => {
    const left = bounds(namedPart(CAT, "Left main wheel"), gearMatrix("mainL", 0));
    const right = bounds(namedPart(CAT, "Right main wheel"), gearMatrix("mainR", 0));
    const nose = bounds(namedPart(CAT, "Nose wheel"), gearMatrix("nose", 0));
    const lc = left.getCenter(V(0, 0, 0)),
      rc = right.getCenter(V(0, 0, 0)),
      nc = nose.getCenter(V(0, 0, 0));
    expect(rc.z - lc.z).toBeCloseTo((9 * 12 + 0.75) * IN, 5);
    expect(nc.x - rc.x).toBeCloseTo((5 * 12 + 6 + 9 / 16) * IN, 5);
    for (const b of [left, right, nose]) expect(b.min.y).toBeCloseTo(GROUND_Y, 5);
    expect(right.max.x - right.min.x).toBeCloseTo(0.44, 5);
    expect(nose.max.x - nose.min.x).toBeCloseTo(0.36, 5);
  });

  it("keeps tires, struts, doors and the Johnson bar clear of every seat and floor through the full sweep", () => {
    const occupied = CAT.parts.filter((p) => /seat|Cabin floor|floor recess/.test(p.name ?? ""));
    const moving = CAT.parts.filter((p) => /^(main[LR]|nose|noseDoor[LR]|jbar)$/.test(p.parent ?? ""));
    for (let step = 0; step <= 40; step++) {
      const f = step / 40;
      for (const part of moving)
        for (const yaw of part.parent === "nose" ? [-1, 0, 1] : [0]) {
          const matrix = gearMatrix(part.parent!, f, yaw);
          for (const seat of occupied)
            expect(meshesIntersect(part, matrix, seat), `${part.name} vs ${seat.name}; gear=${f}, yaw=${yaw}`).toBe(
              false,
            );
        }
    }
  }, 30_000);

  it("stows each main tire outside the fuselage, behind the fuel bay, within its well", () => {
    for (const side of [-1, 1]) {
      const tire = namedPart(CAT, side > 0 ? "Right main wheel" : "Left main wheel");
      const matrix = gearMatrix(side > 0 ? "mainR" : "mainL", 1);
      for (const p of partPoints(tire).map((v) => v.clone().applyMatrix4(matrix))) {
        expect(FUSE.inside(p)).toBe(false);
        const radial =
          ((p.x - MAIN_WELL.x) / (MAIN_WELL.length / 2)) ** 4 +
          ((p.z - side * MAIN_WELL.z) / (MAIN_WELL.width / 2)) ** 4;
        expect(radial).toBeLessThan(1);
        const le = wingP(p.z, 0, 0).x,
          te = wingP(p.z, 1, 0).x;
        expect(p.y).toBeLessThan(wingP(p.z, (le - p.x) / (le - te), 1).y);
      }
    }
  });

  it("keeps the retracted nose tire below its raised housing and ahead of the panel", () => {
    const b = bounds(namedPart(CAT, "Nose wheel"), gearMatrix("nose", 1));
    expect(b.max.y).toBeLessThan(NOSE_WELL.roof - 0.007);
    expect(b.min.x).toBeGreaterThan(PANEL_X + 0.02);
    expect(Math.max(Math.abs(b.min.z), Math.abs(b.max.z))).toBeLessThan(NOSE_WELL.halfWidth - 0.006);
    for (const f of [...Array.from({ length: 21 }, (_, i) => i / 20), 0.94, 0.96, 0.97, 0.98, 0.99])
      for (const yaw of [-1, 0, 1])
        for (const part of CAT.parts.filter((p) => p.parent === "nose"))
          for (const door of CAT.parts.filter((p) => p.parent?.startsWith("noseDoor")))
            expect(
              meshesIntersect(part, gearMatrix("nose", f, yaw), door, gearMatrix(door.parent!, f)),
              `${part.name} vs nose door at ${f}, yaw=${yaw}`,
            ).toBe(false);
  }, 30_000);

  it("closes the nose aperture with the same curved skin that was removed", () => {
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const original = new THREE.Mesh(fuselageGeo(), material);
    const cut = new THREE.Mesh(CAT.shells.find((s) => s.name === "Fuselage")!.geo(), material);
    const doors = CAT.parts
      .filter((p) => p.parent?.startsWith("noseDoor"))
      .map((p) => new THREE.Mesh(worldGeometry(p, gearMatrix(p.parent!, 1)), material));
    [original, cut, ...doors].forEach((mesh) => mesh.updateMatrixWorld(true));
    const firstY = (meshes: THREE.Mesh[], x: number, z: number) => {
      const hits = new THREE.Raycaster(V(x, -2, z), V(0, 1, 0)).intersectObjects(meshes);
      expect(hits.length).toBeGreaterThan(0);
      return hits[0].point.y;
    };
    try {
      for (let i = 1; i < 24; i++)
        for (const z of [-0.12, -0.08, -0.03, 0.03, 0.08, 0.12]) {
          const x = NOSE_WELL.x0 + ((NOSE_WELL.x1 - NOSE_WELL.x0) * i) / 24;
          const y = firstY([original], x, z),
            open = firstY([cut], x, z);
          if (open > NOSE_WELL.roof) expect(firstY(doors, x, z), `${x}, ${z}`).toBeCloseTo(y, 5);
          expect(firstY([cut, ...doors], x, z)).toBeCloseTo(y, 5);
        }
    } finally {
      [original, cut, ...doors].forEach((mesh) => mesh.geometry.dispose());
      material.dispose();
    }
  }, 30_000);

  it("opens and closes the curved nose doors without crossing the fixed cowl skin", () => {
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const shell = new THREE.Mesh(CAT.shells.find((s) => s.name === "Fuselage")!.geo(), material);
    shell.updateMatrixWorld(true);
    const templates = CAT.parts
      .filter((p) => p.parent?.startsWith("noseDoor"))
      .map((part) => ({ part, geo: worldGeometry(part) }));
    try {
      for (const f of [0, 0.95, 0.97, 0.99, 0.999])
        for (const { part, geo: template } of templates) {
          const geo = template.clone().applyMatrix4(gearMatrix(part.parent!, f));
          try {
            expect(crosses(geo, shell), `${part.parent} at ${f}`).toBe(false);
          } finally {
            geo.dispose();
          }
        }
    } finally {
      templates.forEach(({ geo }) => geo.dispose());
      shell.geometry.dispose();
      material.dispose();
    }
  }, 30_000);

  it("stows the complete main assembly through a continuous leg-and-wheel opening clear of skin, walls and fuel", () => {
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    try {
      for (const side of [-1, 1]) {
        const parent = side > 0 ? "mainR" : "mainL";
        const shell = CAT.shells.find((s) => s.name === (side > 0 ? "Right wing" : "Left wing"))!.geo();
        const walls = mainWellGeo(side),
          fuel = fuelBayGeo(side);
        const meshes = [shell, walls, fuel].map((geometry) => {
          const mesh = new THREE.Mesh(geometry, material);
          mesh.updateMatrixWorld(true);
          return mesh;
        });
        try {
          for (const part of CAT.parts.filter((p) => p.parent === parent)) {
            const geo = worldGeometry(part, gearMatrix(parent, 1));
            try {
              for (const [i, mesh] of meshes.entries())
                expect(crosses(geo, mesh), `${part.name} vs ${["wing skin", "well walls", "fuel bay"][i]}`).toBe(false);
            } finally {
              geo.dispose();
            }
          }
          expect(crosses(walls, meshes[2]), "well walls vs fuel bay").toBe(false);
        } finally {
          [shell, walls, fuel].forEach((geometry) => geometry.dispose());
        }
      }
    } finally {
      material.dispose();
    }
  }, 30_000);

  it("cuts lower-skin well apertures while retaining the upper wing", () => {
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    try {
      for (const side of [-1, 1]) {
        const geo = CAT.shells.find((s) => s.name === (side > 0 ? "Right wing" : "Left wing"))!.geo();
        const mesh = new THREE.Mesh(geo, material);
        mesh.updateMatrixWorld(true);
        for (const [x, z] of [
          [MAIN_WELL.x, MAIN_WELL.z],
          [MAIN_LEG_WELL.x, MAIN_LEG_WELL.z],
          [MG.trunnion[0], MG.trunnion[2]],
        ]) {
          const hits = new THREE.Raycaster(V(x, -2, side * z), V(0, 1, 0)).intersectObject(mesh);
          expect(hits.length).toBeGreaterThan(0);
          expect(hits[0].point.y).toBeGreaterThan(-0.4);
        }
        geo.dispose();
      }
      const geo = CAT.shells.find((s) => s.name === "Fuselage")!.geo();
      const mesh = new THREE.Mesh(geo, material);
      mesh.updateMatrixWorld(true);
      const hits = new THREE.Raycaster(V(1.8, -2, 0), V(0, 1, 0)).intersectObject(mesh);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].point.y).toBeGreaterThan(NOSE_WELL.roof);
      geo.dispose();
    } finally {
      material.dispose();
    }
  });

  it("puts the Johnson-bar handle in the matching lock socket at both ends", () => {
    const handle = namedPart(CAT, "Gear handle safety latch (thumb button)");
    for (const [f, name] of [
      [0, "Down-lock socket"],
      [1, "Up-lock socket"],
    ] as const) {
      const p = bounds(handle, gearMatrix("jbar", f)).getCenter(V(0, 0, 0));
      const socket = bounds(namedPart(CAT, name)).getCenter(V(0, 0, 0));
      expect(p.distanceTo(socket)).toBeLessThan(0.021);
      expect(f === 0 ? p.x > JBAR.pivot[0] : p.x < JBAR.pivot[0]).toBe(true);
    }
  });
});

describe("M20C assembled controls (OM pp. 8–9)", () => {
  it("pulls the wheel aft for nose up, and pushes it forward for nose down", () => {
    for (const pitch of [-1, 1]) {
      const pose = rigPose({ pitch, roll: 0, yaw: 0 }, 0);
      expect(Math.sign(pose.a)).toBe(-pitch);
      expect(Math.abs(pose.a)).toBeCloseTo(WHEEL.pitchTravel);
      expect(Math.sign(pose.elev)).toBe(pitch);
    }
  });

  it("has one straight elevator hinge and keeps its visible horn attached to its rod through pitch/trim travel", () => {
    const spec = CAT.surfaces.find((s) => s.key === "elev")!;
    const geo = spec.geo();
    try {
      for (const z of [-1.2, -0.6, 0, 0.6, 1.2]) {
        const row = points(geo).filter((p) => Math.abs(p.z + spec.pivot[2] - z) < 1e-5);
        expect(row.length).toBeGreaterThan(0);
        expect(Math.max(...row.map((p) => p.x))).toBeCloseTo(0, 5);
      }
    } finally {
      geo.dispose();
    }
    const horn = namedPart(CAT, "Elevator horn");
    for (const pitch of [-1, 0, 1])
      for (const trim of [-1, 0, 1]) {
        const pose = rigPose({ pitch, roll: 0, yaw: 0 }, trim);
        const matrix = new THREE.Matrix4()
          .makeRotationZ(pose.tail)
          .setPosition(...TAIL_PIVOT)
          .multiply(new THREE.Matrix4().makeTranslation(...spec.pivot))
          .multiply(new THREE.Matrix4().makeRotationAxis(V(...spec.axis), -pose.elev));
        const visibleTip = V(...horn.pos!)
          .add(V(0, -ELEV_HORN.len / 2, 0))
          .applyMatrix4(matrix);
        expect(visibleTip.distanceTo(linkPoints(pose).elev3[1])).toBeLessThan(0.00001);
      }
  });

  it("joins the fixed wing to each neutral aileron without a missing chord strip", () => {
    for (const side of [-1, 1]) {
      const wing = CAT.shells.find((s) => s.name === (side > 0 ? "Right wing" : "Left wing"))!.geo();
      const surface = CAT.surfaces.find((s) => s.key === (side > 0 ? "ailR" : "ailL"))!;
      const aileron = surface.geo().translate(...surface.pivot);
      try {
        for (const z of [3.6, 4.2, 4.8]) {
          const xs = (g: THREE.BufferGeometry) =>
            points(g)
              .filter((p) => Math.abs(p.z - side * z) < 1e-5)
              .map((p) => p.x);
          expect(Math.min(...xs(wing))).toBeCloseTo(Math.max(...xs(aileron)), 5);
        }
      } finally {
        wing.dispose();
        aileron.dispose();
      }
    }
  });

  it("winds both stabilizer upper skins outward across the continuous loft", () => {
    const geo = TAIL_SHELLS.find((s) => s.name === "Horizontal stabilizer")!
      .geo()
      .translate(...TAIL_PIVOT);
    const p = geo.attributes.position,
      n = geo.attributes.normal;
    try {
      for (const side of [-1, 1]) {
        let count = 0;
        for (let i = 0; i < p.count; i++)
          if (p.getY(i) > SY + 0.008 && Math.sign(p.getZ(i)) === side && Math.abs(p.getZ(i)) < SSPAN - 0.01) {
            count++;
            expect(n.getY(i)).toBeGreaterThan(0);
          }
        expect(count).toBeGreaterThan(10);
      }
    } finally {
      geo.dispose();
    }
  });
});

describe("M20C equipment envelopes and station anchors", () => {
  it("keeps full-size engine cases, battery, radio housing and seats inside the skin", () => {
    const selected =
      /Lycoming|Cylinder|Starter$|Carburetor|Oil|Exhaust manifold|Heat muff$|Battery|Radios|boost pump|seat|Cabin floor|floor recess|magneto|Alternator/;
    const parts = CAT.parts.filter((p) => selected.test(p.name ?? "") && (!p.parent || p.parent.startsWith("cyl:")));
    for (const part of parts) {
      const c = CYLS.find((c) => part.parent === "cyl:" + c.n);
      const matrix = c ? new THREE.Matrix4().makeTranslation(c.x, -0.05, c.s * 0.18) : undefined;
      const geo = worldGeometry(part, matrix);
      try {
        for (const p of points(geo)) expect(FUSE.inside(p), `${part.name}: ${p.toArray()}`).toBe(true);
      } finally {
        geo.dispose();
      }
    }
  });

  it("uses the documented battery, boost-pump and seat arms, and keeps radio cases behind the panel", () => {
    const station = (name: string) => (2.3 - namedPart(CAT, name).pos![0]) / IN;
    expect(station("Battery — 12 V, 35 Ah")).toBeCloseTo(2.5);
    expect(station("Electric boost pump")).toBeCloseTo(19);
    expect(station("Pilot seat")).toBeGreaterThanOrEqual(36.5);
    expect(station("Pilot seat")).toBeLessThanOrEqual(44);
    expect(station("Rear seat (L)")).toBeCloseTo(70);
    expect(partBounds(namedPart(CAT, "Radios (centre stack)")).min.x).toBeGreaterThanOrEqual(PANEL_X - 1e-5);
    expect(partBounds(namedPart(CAT, "Electric boost pump")).max.y).toBeLessThan(CABIN.floor - 0.015 + 1e-5);
    for (const [a, b] of [
      ["Starter", "Oil sump (wet sump)"],
      ["Carburetor (Marvel-Schebler MA-4-5)", "Carburetor air box & filter"],
      ["Carburetor (Marvel-Schebler MA-4-5)", "Oil sump (wet sump)"],
      ["Carburetor (Marvel-Schebler MA-4-5)", "Exhaust manifold & muffler"],
      ["Carburetor (Marvel-Schebler MA-4-5)", "Heat muff"],
      ["Carburetor air box & filter", "Heat muff"],
    ])
      expect(penetrates(bounds(namedPart(CAT, a)), bounds(namedPart(CAT, b))), `${a} vs ${b}`).toBe(false);
  });

  it("represents 26 US gal of usable fluid in each wing without intruding into the gear well", () => {
    for (const side of [-1, 1]) {
      const geo = fuelBayGeo(side),
        p = geo.attributes.position,
        ix = geo.index!;
      let volume = 0;
      try {
        for (let i = 0; i < ix.count; i += 3) {
          const a = new THREE.Vector3().fromBufferAttribute(p, ix.getX(i));
          const b = new THREE.Vector3().fromBufferAttribute(p, ix.getX(i + 1));
          const c = new THREE.Vector3().fromBufferAttribute(p, ix.getX(i + 2));
          volume += a.dot(b.cross(c)) / 6;
        }
        expect(Math.abs(volume) / 0.003785411784).toBeCloseTo(26, 1);
        const well = new THREE.Box3(
          V(MAIN_WELL.x - MAIN_WELL.length / 2, -0.8, side * MAIN_WELL.z - MAIN_WELL.width / 2),
          V(MAIN_WELL.x + MAIN_WELL.length / 2, 0, side * MAIN_WELL.z + MAIN_WELL.width / 2),
        );
        const ps = points(geo);
        for (let i = 0; i < ix.count; i += 3)
          expect(
            well.intersectsTriangle(new THREE.Triangle(ps[ix.getX(i)], ps[ix.getX(i + 1)], ps[ix.getX(i + 2)])),
          ).toBe(false);
      } finally {
        geo.dispose();
      }
    }
  });
});
