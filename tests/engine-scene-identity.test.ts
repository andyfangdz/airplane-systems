/**
 * Identical-scene guard for the engine page's 3D model (components/engine/scene/): every mesh the IO-390 and O-360
 * scenes mount, stopped and at takeoff power at two crank angles, against a baseline recorded on main's scene code
 * before the per-engine scene layouts. Each mesh is summarised, in mount order, by its hover name and note, a
 * fingerprint of its whole geometry, its world matrix and its material's colour, opacity and glow.
 *
 * The geometry fingerprint covers every vertex, normal and index in order: the attribute layout, the index buffer and
 * the groups are hashed exactly (they are integers), and each float attribute is summed plain and with two sets of
 * fixed per-item weights, so moving, swapping or reordering any vertex changes it. As in scene-snapshot.test.ts, the
 * last bit of Math.sin/cos differs between runtimes, so the float sums are compared within TOL rather than hashed;
 * text, counts and hashes must match exactly.
 *
 * Update only for an intended change to these engines' drawing:
 * UPDATE_ENGINE_SCENE_BASELINE=1 npx vitest run tests/engine-scene-identity.test.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createElement as h } from "react";
import * as THREE from "three";
import { afterAll, describe, expect, test } from "vitest";
import { IO390 } from "@/engines/io390/spec";
import { noFailures } from "@/engines/model/engine";
import { SCENARIOS } from "@/engines/model/scenarios";
import { O360 } from "@/engines/o360/spec";
import type { EngineSpec } from "@/engines/types";
import { replaceState, simFor, type EngineSim } from "@/components/engine/store";
import { Crankcase, Lubrication } from "@/components/engine/scene/Case";
import { Cylinders } from "@/components/engine/scene/Cylinders";
import { dims, makeMats } from "@/components/engine/scene/kit";
import { PartNotesProvider, useHover } from "@/components/engine/scene/parts";
import { Crankshaft, RodsAndPistons } from "@/components/engine/scene/Rotating";
import { Drives, FuelSystem, Ignition, Induction, Propeller } from "@/components/engine/scene/Systems";
import { Camshaft, ValveTrain } from "@/components/engine/scene/Valvetrain";
import { mountScene } from "./engine-mount";

// Read through fs below. Listing it to Vite (never loading it) makes it a dependency, so `vitest --changed` reruns this
// file when it changes.
import.meta.glob("./engine-scene-identity.baseline.json");
const BASELINE = new URL("./engine-scene-identity.baseline.json", import.meta.url);
const UPDATE = !!process.env.UPDATE_ENGINE_SCENE_BASELINE;

/** Absolute tolerance on every stored number, and the step it is stored to. */
const TOL = 2e-6;
const STEP = 1e-7;
const to = (x: number) => +(Math.round(x / STEP) * STEP).toFixed(7);

/** One mesh: [hash of its hover name and note, counts and geometry hash, numbers]. */
type Row = [string, string, number[]];

/** FNV-1a over the text's UTF-16 code units. */
function hash(s: string) {
  let x = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619) >>> 0;
  return x.toString(36);
}

/** FNV-1a over 32-bit integers. */
function hashInts(a: ArrayLike<number>, x = 0x811c9dc5) {
  for (let i = 0; i < a.length; i++) x = Math.imul(x ^ a[i], 16777619) >>> 0;
  return x;
}

/** A fixed weight in [0.5, 1.5) for item `i`: integer arithmetic only, so every runtime gets the same weights. */
const weight = (i: number, seed: number) => (Math.imul(i + 1, seed) >>> 0) / 2 ** 32 + 0.5;
const SEEDS = [0x9e3779b1, 0x85ebca6b];

/**
 * An order-sensitive fingerprint of a geometry's whole content: the exact text and integers (attribute layout, index
 * buffer, groups) as a hash, and per float attribute (position, normal, uv) the plain sum and the two weighted sums of
 * each component over its items.
 */
function geometryPrint(g: THREE.BufferGeometry): { text: string; nums: number[] } {
  const names = Object.keys(g.attributes).sort();
  const layout = names.map((n) => `${n}:${g.attributes[n].itemSize}:${g.attributes[n].count}`).join(" ");
  let x = hashInts(Array.from(`${layout}|${JSON.stringify(g.groups)}`, (c) => c.charCodeAt(0)));
  if (g.index) x = hashInts(g.index.array, hashInts([g.index.count], x));
  const nums: number[] = [];
  for (const n of names) {
    const a = g.attributes[n].array,
      k = g.attributes[n].itemSize;
    const plain = new Array(k).fill(0),
      weighted = SEEDS.map(() => new Array(k).fill(0));
    for (let i = 0; i < a.length; i++) {
      const item = Math.floor(i / k);
      plain[i % k] += a[i];
      SEEDS.forEach((seed, j) => (weighted[j][i % k] += weight(item, seed) * a[i]));
    }
    nums.push(...plain, ...weighted.flat());
  }
  return { text: `${layout}/${g.index?.count ?? -1}/${x.toString(36)}`, nums };
}

/** What differs between two rows, or null when they match. */
function mismatch([text, counts, nums]: Row, [wtext, wcounts, wnums]: Row): string | null {
  if (text !== wtext) return "hover name or note";
  if (counts !== wcounts) return `counts or geometry hash: ${counts} vs ${wcounts}`;
  if (nums.length !== wnums.length) return "number of values";
  const j = nums.findIndex((v, k) => !(Math.abs(v - wnums[k]) <= TOL));
  return j < 0 ? null : `value ${j}: ${nums[j]} vs ${wnums[j]}`;
}

function hoverOf(o: THREE.Object3D): string {
  const over = (o as { __r3f?: { handlers: Record<string, (e: unknown) => void> } }).__r3f?.handlers.onPointerOver;
  if (!over) return "";
  useHover.setState({ hover: null });
  over({ object: o, stopPropagation() {}, nativeEvent: { clientX: 0, clientY: 0 } });
  const hv = useHover.getState().hover;
  useHover.setState({ hover: null });
  return hv ? hash(`${hv.name}\n${hv.note}`) : "(clear)";
}

function rowsOf(scene: THREE.Object3D): Row[] {
  const rows: Row[] = [];
  scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const m = o.material as THREE.MeshStandardMaterial;
    const print = geometryPrint(o.geometry as THREE.BufferGeometry);
    rows.push([
      hoverOf(o),
      `${print.text}/${o.visible ? 1 : 0}/${m.type}`,
      [
        ...print.nums,
        ...o.matrixWorld.elements,
        m.color.r,
        m.color.g,
        m.color.b,
        m.opacity,
        m.emissiveIntensity ?? 0,
      ].map(to),
    ]);
  });
  return rows;
}

/** The engine's parts as EngineScene mounts them (labels and the shake on the mounts left out). */
const model = (sim: EngineSim) => {
  const p = { sim, d: dims(sim.spec), mats: makeMats() };
  return h(
    PartNotesProvider,
    { value: sim.spec.parts },
    h(Crankshaft, p),
    h(RodsAndPistons, p),
    h(Camshaft, p),
    h(ValveTrain, p),
    h(Cylinders, p),
    h(Crankcase, p),
    h(Lubrication, p),
    h(Ignition, p),
    h(FuelSystem, p),
    h(Induction, p),
    h(Drives, p),
    h(Propeller, p),
  );
};

/** Stopped and cold, then the takeoff scenario at two drawn crank angles. */
async function snapshot(spec: EngineSpec): Promise<Record<string, Row[]>> {
  const sim = simFor(spec, `identity-${spec.id}`);
  const out: Record<string, Row[]> = {};
  const { scene, frame, unmount } = await mountScene(model(sim));
  const shoot = (state: string, cranks: number[]) => {
    for (const crank of cranks) {
      sim.anim.crank = crank;
      frame();
      out[`${state}@${crank}`] = rowsOf(scene);
    }
  };
  shoot("cold", [0]);
  const x = SCENARIOS.find((sc) => sc.id === "takeoff")!.run(spec, noFailures(spec));
  replaceState(sim, x.s);
  sim.useUi.setState({ controls: x.c, env: x.env });
  shoot("takeoff", [137, 500]);
  await unmount();
  return out;
}

const ENGINES: [string, EngineSpec][] = [
  ["IO-390", IO390],
  ["O-360", O360],
];
const taken: Record<string, Record<string, Row[]>> = {};
const baseline: Record<string, Record<string, Row[]>> = UPDATE ? {} : JSON.parse(readFileSync(BASELINE, "utf8"));

afterAll(() => {
  // one mesh per line, so a change shows as the lines of the meshes it moved
  if (UPDATE)
    writeFileSync(
      BASELINE,
      JSON.stringify(taken)
        .replace(/\]\],\[/g, "]],\n[")
        .replace(/\],"/g, '],\n"') + "\n",
    );
});

describe.each(ENGINES)("the %s scene", (name, spec) => {
  test("draws every part exactly as before the per-engine layouts", async () => {
    const now = await snapshot(spec);
    taken[name] = now;
    if (UPDATE) return;
    const was = baseline[name];
    expect(Object.keys(now)).toEqual(Object.keys(was));
    for (const k of Object.keys(was)) {
      expect(now[k].length, `${k}: mesh count`).toBe(was[k].length);
      now[k].forEach((row, i) => expect(mismatch(row, was[k][i]), `${k} mesh ${i}`).toBeNull());
    }
  });
});

describe("the identity fingerprint", () => {
  /** A 4 × 4 grid of vertices, two triangles per cell, with normals and uvs. */
  const grid = () => new THREE.PlaneGeometry(0.2, 0.2, 3, 3);
  const row = (g: THREE.BufferGeometry) => rowsOf(new THREE.Mesh(g, new THREE.MeshStandardMaterial()))[0];

  test("an unchanged geometry matches itself", () => {
    expect(mismatch(row(grid()), row(grid()))).toBeNull();
  });

  test("moving two interior vertices by equal and opposite amounts fails, though every plain sum is unchanged", () => {
    const was = grid(),
      now = grid();
    const p = now.attributes.position;
    // vertices 5 and 10 are inside the grid: neither the first nor the last
    p.setY(5, p.getY(5) + 1e-4);
    p.setY(10, p.getY(10) - 1e-4);
    const sums = (g: THREE.BufferGeometry) =>
      [0, 1, 2].map((c) => {
        const a = g.attributes.position.array;
        let t = 0;
        for (let i = c; i < a.length; i += 3) t += a[i];
        return t;
      });
    sums(now).forEach((v, i) => expect(v).toBeCloseTo(sums(was)[i], 9));
    expect(mismatch(row(now), row(was))).toMatch(/^value/);
  });

  test("a changed normal fails", () => {
    const was = grid(),
      now = grid();
    now.attributes.normal.setX(6, 0.01);
    expect(mismatch(row(now), row(was))).toMatch(/^value/);
  });

  test("a changed triangle (two indices swapped) fails", () => {
    const was = grid(),
      now = grid();
    const ix = now.index!;
    const a = ix.getX(3);
    ix.setX(3, ix.getX(4));
    ix.setX(4, a);
    expect(mismatch(row(now), row(was))).toMatch(/^counts or geometry hash/);
  });
});
