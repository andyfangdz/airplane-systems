"use client";
/**
 * The 3D view of an engine or component page: the canvas, its lights, orbit controls and the hover tooltip. Pages give
 * the camera, what it orbits and how close it may come; the scene goes in as children.
 */
import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, type ReactNode } from "react";
import type { Vec3 } from "@/lib/math";
import { HoverTip, useHover } from "./scene/parts";

const clearHover = () => useHover.setState({ hover: null });

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
      </Canvas>
      <HoverTip />
    </>
  );
}
