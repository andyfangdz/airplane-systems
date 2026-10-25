"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { FlowSpec } from "@/lib/catalogue";
import { dimSolidMat, dotTex, mats } from "@/lib/materials";
import { createFlowParticleBatches, FlowResources, type FlowResource } from "@/lib/scene/flow-resources";
import { createFlowDirection, updateFlowDirection, type FlowDirection } from "@/lib/scene/flow-directions";
import { studyMaterial } from "@/lib/scene/study-materials";
import { sysColor } from "@/lib/systems";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { useView } from "@/lib/view";
import type { PickInfo } from "./Part";

const chanDim = (f: FlowSpec, sysNow: string, focus: string) =>
  sysNow === "controls" && focus !== "all" && !f.chan?.includes(focus as never);

/** Advance particles imperatively; only view-dependent mesh props participate in React rendering. */
export function advanceFlows(
  items: FlowResource[],
  dt: number,
  rates: () => Record<string, number>,
  color: ((key: string, out: THREE.Color) => boolean) | undefined,
  tmp: THREE.Vector3,
  liveColor: THREE.Color,
  directions: FlowDirection[],
  reducedMotion: boolean,
) {
  const v = useView.getState();
  const R = rates();
  for (const [index, it] of items.entries()) {
    const rate = R[it.f.key] ?? 0;
    const vis =
      rate !== 0 && !v.spot && (v.sys === "overview" || it.f.sys.includes(v.sys)) && !chanDim(it.f, v.sys, v.ctrlFocus);
    it.pts.visible = vis && !reducedMotion;
    if (!vis) {
      if (directions[index]) directions[index].mesh.visible = false;
      continue;
    }
    const mat = it.pts.material as THREE.PointsMaterial;
    if (color?.(it.f.key, liveColor)) mat.color.copy(liveColor);
    else mat.color.set(it.f.pcolor ?? it.f.color ?? sysColor(it.f.sys[0], v.theme));
    if (directions[index]) updateFlowDirection(directions[index], rate, vis && reducedMotion, mat.color);
    if (reducedMotion) continue;
    it.t += (dt * 0.9 * rate) / Math.max(it.len, 0.5);
    const a = it.pts.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < it.n; i++) {
      let u = (it.off[i] + it.t) % 1;
      if (u < 0) u += 1;
      it.curve.getPointAt(u, tmp);
      a.setXYZ(i, tmp.x, tmp.y, tmp.z);
    }
    a.needsUpdate = true;
  }
}
/**
 * All pipes/wires/ducts/cables of one airplane; one frame loop moves every particle.
 * `rates()` gives a speed multiplier per flow key (0 = stopped, negative = reversed);
 * `color(key, out)` may set a live particle colour and return true (e.g. cabin air following the temperature knob).
 */
export function Flows({
  flows,
  rates,
  color,
}: {
  flows: FlowSpec[];
  rates: () => Record<string, number>;
  color?: (key: string, out: THREE.Color) => boolean;
}) {
  const sys = useView((x) => x.sys);
  const xray = useView((x) => x.xray);
  const theme = useView((x) => x.theme);
  const cf = useView((x) => x.ctrlFocus);
  const spot = useView((x) => !!x.spot);
  const reducedMotion = useReducedMotion();

  const resources = useMemo(() => new FlowResources(dotTex()), []);
  const items = useMemo(() => resources.select(flows), [resources, flows]);
  const batches = useMemo(() => createFlowParticleBatches(items, dotTex()), [items]);
  const directions = useMemo(() => (reducedMotion ? items.map(createFlowDirection) : []), [items, reducedMotion]);
  // Filtering retains each flow's geometry and phase; the mounted aircraft releases all resources together.
  useEffect(() => () => resources.dispose(), [resources]);
  useEffect(() => () => batches.forEach((batch) => batch.dispose()), [batches]);
  useEffect(
    () => () =>
      directions.forEach(({ mesh }) => {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }),
    [directions],
  );

  const tmp = useRef(new THREE.Vector3());
  const live = useRef(new THREE.Color());
  useFrame(({ camera }, dt) => {
    advanceFlows(items, dt, rates, color, tmp.current, live.current, directions, reducedMotion);
    for (const batch of batches) batch.sync(camera);
  });

  return (
    <>
      {items.map((it) => {
        const c = it.f.color ?? sysColor(it.f.sys[0], theme);
        // a walk-around spot dims every flow, with everything else it doesn't name
        const act = !spot && (sys === "overview" || it.f.sys.includes(sys)) && !chanDim(it.f, sys, cf);
        const pick: PickInfo | undefined = it.f.name
          ? { name: it.f.name, note: it.f.note ?? "", color: c, sys: it.f.sys }
          : undefined;
        return (
          <group key={it.f.key}>
            {it.tube && (
              <mesh
                geometry={it.tube}
                material={
                  !xray && spot
                    ? dimSolidMat(mats(c).on)
                    : act && xray && sys !== "overview"
                      ? studyMaterial(c, theme)
                      : act || !xray
                        ? mats(c).on
                        : mats(c).dim
                }
                userData={{ pick }}
              />
            )}
          </group>
        );
      })}
      {batches.map((batch, i) => (
        <primitive key={i} object={batch.points} />
      ))}
      {directions.map(({ mesh }, i) => (
        <primitive key={items[i].f.key} object={mesh} />
      ))}
    </>
  );
}
