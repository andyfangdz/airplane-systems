"use client";
/**
 * The 3D view of an engine or component page: the canvas, its lights, orbit controls, Reset view and the hover tooltip.
 * Pages give the camera, what it orbits and how close it may come; the scene goes in as children.
 */
import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { clamp, ease, type Vec3 } from "@/lib/math";
import { useStageReset } from "./chrome";
import { HoverTip, useHover } from "./scene/parts";

const clearHover = () => useHover.setState({ hover: null });

type Pose = { p: THREE.Vector3; t: THREE.Vector3 };

/**
 * Reset view: flies back to the view as it was before the user first moved it (after any fit the page made on its
 * first frame), as the airplane pages' Reset view does. A drag stops the flight; reduced motion jumps.
 */
function ResetRig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const flight = useRef<{ from: Pose; to: Pose; t0: number } | null>(null);
  useEffect(() => {
    if (!controls) return;
    let home: Pose | null = null;
    const start = () => {
      flight.current = null;
      home ??= { p: camera.position.clone(), t: controls.target.clone() };
    };
    const reset = () => {
      if (!home) return;
      // drop a drag's momentum: an update with damping off spends it, then the camera goes back where it was
      const from = { p: camera.position.clone(), t: controls.target.clone() };
      controls.enableDamping = false;
      controls.update();
      controls.enableDamping = true;
      camera.position.copy(from.p);
      controls.target.copy(from.t);
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        flight.current = null;
        camera.position.copy(home.p);
        controls.target.copy(home.t);
        controls.update();
        return;
      }
      flight.current = { from, to: { p: home.p.clone(), t: home.t.clone() }, t0: performance.now() };
    };
    controls.addEventListener("start", start);
    useStageReset.setState({ reset });
    return () => {
      controls.removeEventListener("start", start);
      if (useStageReset.getState().reset === reset) useStageReset.setState({ reset: null });
    };
  }, [camera, controls]);
  useFrame(() => {
    const f = flight.current;
    if (!f || !controls) return;
    const u = clamp((performance.now() - f.t0) / 1000, 0, 1),
      e = ease(u);
    camera.position.lerpVectors(f.from.p, f.to.p, e);
    controls.target.lerpVectors(f.from.t, f.to.t, e);
    if (u >= 1) flight.current = null;
  });
  return null;
}

/** Labels never sit under the toolbar: a few times a second, any `.eng-label` that overlaps it is hidden. */
function LabelClear({ every = 0.2, pad = 4 }: { every?: number; pad?: number }) {
  const gl = useThree((s) => s.gl);
  const acc = useRef(every);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < every) return;
    acc.current = 0;
    const view = gl.domElement.closest(".eng-view"),
      bar = view?.querySelector(".toolbar")?.getBoundingClientRect();
    if (!view || !bar?.width) return;
    for (const el of view.querySelectorAll<HTMLElement>(".eng-label")) {
      const r = el.getBoundingClientRect();
      const v =
        r.width &&
        r.left < bar.right + pad &&
        r.right > bar.left - pad &&
        r.top < bar.bottom + pad &&
        r.bottom > bar.top - pad
          ? "hidden"
          : "";
      if (el.style.visibility !== v) el.style.visibility = v;
    }
  });
  return null;
}

export function ComponentStage({
  camera,
  target,
  minDistance,
  maxDistance,
  ambient = 0.55,
  keyLight = { position: [3, 4, 2], intensity: 1.6 },
  children,
}: {
  camera: { position: Vec3; fov: number; near: number; far: number };
  /** The point the view orbits. */
  target: Vec3;
  minDistance: number;
  maxDistance: number;
  ambient?: number;
  /** The main light, above and to the front right. */
  keyLight?: { position: Vec3; intensity: number };
  children: ReactNode;
}) {
  useEffect(() => clearHover, []);
  return (
    <>
      <Canvas camera={camera} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} onPointerMissed={clearHover}>
        <ambientLight intensity={ambient} />
        <directionalLight position={keyLight.position} intensity={keyLight.intensity} />
        <directionalLight position={[-3, 1.5, -2]} intensity={0.5} />
        <hemisphereLight args={["#ffffff", "#445566", 0.4]} />
        {children}
        <OrbitControls makeDefault target={target} enableDamping minDistance={minDistance} maxDistance={maxDistance} />
        <ResetRig />
        <LabelClear />
      </Canvas>
      <HoverTip />
    </>
  );
}
