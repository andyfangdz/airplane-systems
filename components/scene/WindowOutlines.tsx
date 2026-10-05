"use client";
import { useMemo } from "react";
import * as THREE from "three";
import { outlineMat } from "@/lib/materials";

/** Window / door outline loops drawn on the skin (`loops` builds them once). */
export function WindowOutlines({ loops }: { loops: () => THREE.Vector3[][] }) {
  const lines = useMemo(() => loops().map((pts) => {
    const l = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), outlineMat);
    l.raycast = () => {};
    return l;
  }), [loops]);
  return <>{lines.map((l, i) => <primitive key={i} object={l} />)}</>;
}
