"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Catalogue } from "@/lib/catalogue";
import type { SysId } from "@/lib/systems";
import { useView } from "@/lib/view";

/**
 * Default label policy for an airplane: a part's own (first) system wins overlaps, and with X-ray off and the camera
 * outside the fuselage only parts outside the skin keep their labels.
 */
export function pinPolicy(cat: Catalogue, inside?: (p: THREE.Vector3) => boolean) {
  const home = new Map(cat.parts.filter((p) => p.name).map((p) => [p.name!, p.sys[0]]));
  const ext = new Set(cat.parts.filter((p) => p.ext && p.name).map((p) => p.name!));
  const order = new Map<string, number>();
  cat.parts.forEach((p, i) => {
    if (p.name && !order.has(p.name)) order.set(p.name, i);
  });
  return {
    // own system first, then catalogue order (labels that are not parts, e.g. tanks and screens, after the parts)
    rank: (label: string, sys: SysId) => {
      const priority = cat.labels.priority?.[sys]?.indexOf(label) ?? -1;
      return priority >= 0 ? priority - 1e5 : (home.get(label) === sys ? 0 : 1) * 1e5 + (order.get(label) ?? 1e5 - 1);
    },
    hide: (label: string, camera: THREE.Camera) =>
      !!inside && !useView.getState().xray && !ext.has(label) && !inside(camera.position),
  };
}

/**
 * Keeps dense label views readable: a few times a second, hides any label pin that overlaps a higher-priority one
 * (lower `rank`, then label text; never DOM order, which depends on the views visited before), the toolbar, the
 * hint or the annunciation window, or that would spill past the edge of the 3D view. `hide` drops labels outright
 * (e.g. parts hidden behind the solid skin). Hidden parts keep their hover notes and stay in the panel's "tap to
 * locate" list.
 */
export function PinDeclutter({
  every = 0.2,
  pad = 2,
  rank,
  hide,
}: {
  every?: number;
  pad?: number;
  rank?: (label: string, sys: SysId) => number;
  hide?: (label: string, camera: THREE.Camera) => boolean;
}) {
  const gl = useThree((s) => s.gl),
    camera = useThree((s) => s.camera);
  const acc = useRef(every);
  const layout = useRef({
    dirty: true,
    camera: new THREE.Matrix4(),
    projection: new THREE.Matrix4(),
    state: useView.getState(),
  });
  useEffect(() => {
    const root = gl.domElement.parentElement;
    if (!root) return;
    const stage = root.closest(".stage") ?? root;
    const dirty = () => {
      layout.current.dirty = true;
    };
    const observer = new MutationObserver((records) => {
      // Html's projected transforms and new/changed labels invalidate layout. Ignore our own pin visibility writes.
      if (
        records.some(
          (record) =>
            record.type !== "attributes" ||
            !(record.target instanceof Element) ||
            !record.target.classList.contains("pin"),
        )
      )
        dirty();
    });
    observer.observe(stage, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });
    const resize = new ResizeObserver(dirty);
    resize.observe(stage);
    document.fonts?.addEventListener("loadingdone", dirty);
    dirty();
    return () => {
      observer.disconnect();
      resize.disconnect();
      document.fonts?.removeEventListener("loadingdone", dirty);
    };
  }, [gl]);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < every) return;
    acc.current = 0;
    const last = layout.current,
      state = useView.getState();
    if (
      !last.dirty &&
      last.state === state &&
      last.camera.equals(camera.matrixWorld) &&
      last.projection.equals(camera.projectionMatrix)
    )
      return;
    last.dirty = false;
    last.state = state;
    last.camera.copy(camera.matrixWorld);
    last.projection.copy(camera.projectionMatrix);
    const root = gl.domElement.parentElement;
    if (!root) return;
    const view = gl.domElement.getBoundingClientRect();
    const stage = root.closest(".stage") ?? root;
    const kept: DOMRect[] = [...stage.querySelectorAll<HTMLElement>(".toolbar, .cas, .hint")]
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.width);
    const sys = useView.getState().sys;
    const pins = [...root.querySelectorAll<HTMLElement>(".pin")].map((el) => ({
      el,
      t: el.textContent ?? "",
      k: rank?.(el.textContent ?? "", sys) ?? 0,
    }));
    pins
      .sort((a, b) => a.k - b.k || (a.t < b.t ? -1 : a.t > b.t ? 1 : 0))
      .forEach(({ el }) => {
        const r = el.getBoundingClientRect();
        if (!r.width) return;
        const off =
          r.left < view.left ||
          r.right > view.right ||
          r.top < view.top ||
          r.bottom > view.bottom ||
          !!hide?.(el.textContent ?? "", camera);
        const hit =
          off ||
          kept.some(
            (k) => r.left < k.right + pad && r.right > k.left - pad && r.top < k.bottom + pad && r.bottom > k.top - pad,
          );
        const v = hit ? "hidden" : "";
        if (el.style.visibility !== v) el.style.visibility = v;
        if (!hit) kept.push(r);
      });
  });
  return null;
}
