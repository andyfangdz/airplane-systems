"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import type { SysId } from "@/lib/systems";
import { useView } from "@/lib/view";

/**
 * Keeps dense label views readable: a few times a second, hides any label pin that overlaps a higher-priority one
 * (lower `rank`, then catalogue order), the toolbar or the annunciation window, or that would spill past the edge of
 * the 3D view. `hide` drops labels outright (e.g. parts hidden behind the solid skin). Hidden parts keep their hover
 * notes and stay in the panel's "tap to locate" list.
 */
export function PinDeclutter({ every = 0.2, pad = 2, rank, hide }: {
  every?: number; pad?: number; rank?: (label: string, sys: SysId) => number; hide?: (label: string, camera: THREE.Camera) => boolean;
}) {
  const gl = useThree((s) => s.gl), camera = useThree((s) => s.camera);
  const acc = useRef(every);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < every) return;
    acc.current = 0;
    const root = gl.domElement.parentElement;
    if (!root) return;
    const view = gl.domElement.getBoundingClientRect();
    const stage = root.closest(".stage") ?? root;
    const kept: DOMRect[] = [...stage.querySelectorAll<HTMLElement>(".toolbar, .cas")].map((e) => e.getBoundingClientRect());
    const sys = useView.getState().sys;
    const pins = [...root.querySelectorAll<HTMLElement>(".pin")].map((el, i) => ({ el, k: (rank?.(el.textContent ?? "", sys) ?? 0) * 1e4 + i }));
    pins.sort((a, b) => a.k - b.k).forEach(({ el }) => {
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      const off = r.left < view.left || r.right > view.right || r.top < view.top || r.bottom > view.bottom || !!hide?.(el.textContent ?? "", camera);
      const hit = off || kept.some((k) => r.left < k.right + pad && r.right > k.left - pad && r.top < k.bottom + pad && r.bottom > k.top - pad);
      const v = hit ? "hidden" : "";
      if (el.style.visibility !== v) el.style.visibility = v;
      if (!hit) kept.push(r);
    });
  });
  return null;
}
