/**
 * Identical-scene guard for the engine page's 3D model (components/engine/scene/): every mesh the IO-390 and O-360
 * scenes mount, stopped and at takeoff power at two crank angles, against a baseline taken from main 50d1aa3b before
 * the per-engine scene layouts. Each mesh is summarised by its hover name and note (hashed), its geometry (vertex and
 * index counts, position sums, first and last vertex), its world matrix and its material's colour, opacity and glow, in
 * mount order.
 *
 * As in scene-snapshot.test.ts, the last bit of Math.sin/cos differs between runtimes, so numbers are compared within
 * TOL; text and counts must match exactly.
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

/** One mesh: [hash of its hover name and note, counts, numbers]. */
type Row = [string, string, number[]];

/** FNV-1a over the text's UTF-16 code units. */
function hash(s: string) {
  let x = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619) >>> 0;
  return x.toString(36);
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
    const g = o.geometry as THREE.BufferGeometry,
      pos = g.attributes.position.array,
      m = o.material as THREE.MeshStandardMaterial;
    const sum = [0, 0, 0];
    for (let i = 0; i < pos.length; i++) sum[i % 3] += pos[i];
    const counts = `${pos.length / 3}/${g.index?.count ?? -1}/${o.visible ? 1 : 0}/${m.type}`;
    rows.push([
      hoverOf(o),
      counts,
      [
        ...sum,
        ...Array.from(pos.slice(0, 3)),
        ...Array.from(pos.slice(-3)),
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
  if (UPDATE) writeFileSync(BASELINE, JSON.stringify(taken, null, 0).replace(/\],"/g, '],\n"') + "\n");
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
      now[k].forEach(([text, counts, nums], i) => {
        const [wtext, wcounts, wnums] = was[k][i];
        const at = `${k} mesh ${i}`;
        expect([text, counts], at).toEqual([wtext, wcounts]);
        expect(nums.length, at).toBe(wnums.length);
        const off = nums.map((v, j) => Math.abs(v - wnums[j]));
        expect(Math.max(0, ...off), `${at}: largest numeric difference`).toBeLessThanOrEqual(TOL);
      });
    }
  });
});
