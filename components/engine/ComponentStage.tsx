"use client";
/** Shared component viewport: responsive framing, labels, orbit controls and the hover tooltip. */
import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { fitComponentCamera, intersects, visibleStageLabels, type StageRect } from "@/lib/component-stage";
import { clamp, ease, type Vec3 } from "@/lib/math";
import { useSceneRendering } from "@/lib/useSceneRendering";
import { useStageReset } from "./chrome";
import { usePartInspectionStore } from "./PartInspector";
import { HoverTip, useHover } from "./scene/parts";

const clearHover = () => useHover.setState({ hover: null });
type Pose = { p: THREE.Vector3; t: THREE.Vector3 };

const obstaclesFor = (canvas: HTMLCanvasElement) => {
  const app = canvas.closest(".eng-app");
  if (!app) return [];
  // On phones the monitor scrolls behind the sticky stage; its DOM rectangle is not an overlay there.
  const selector =
    getComputedStyle(app).display === "grid" ? ".toolbar, .eng-foot, .inj-legend" : ".toolbar, .inj-legend";
  return [...app.querySelectorAll<HTMLElement>(selector)]
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width && r.height);
};

/** The toolbar and overlaid instruments leave one safe rectangle for the assembly. Phone instruments sit below it. */
function safeFrame(view: DOMRect, obstacles: StageRect[]): StageRect {
  const pad = view.width < 600 ? 20 : 28;
  let top = pad,
    bottom = view.height - pad;
  for (const r of obstacles) {
    if (!intersects(r, view)) continue;
    if ((r.top + r.bottom) / 2 < (view.top + view.bottom) / 2) top = Math.max(top, r.bottom - view.top + 18);
    else bottom = Math.min(bottom, r.top - view.top - 18);
  }
  // Keep a usable frame even in very short landscape windows.
  return { left: pad, right: view.width - pad, top, bottom: Math.max(top + 40, bottom) };
}

/**
 * Refit on mount, resize and explicit study changes. Live overlays keep Reset view up to date without taking the
 * camera away from someone who has started exploring. Before interaction, overlays can still settle the first view.
 */
function CameraRig({
  model,
  position,
  target,
  frameKey,
  maxDistance,
}: {
  model: RefObject<THREE.Group | null>;
  position: Vec3;
  target: Vec3;
  frameKey: string;
  maxDistance: number;
}) {
  const camera = useThree((s) => s.camera),
    gl = useThree((s) => s.gl);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const flight = useRef<{ from: Pose; to: Pose; t0: number } | null>(null);
  const previous = useRef({ request: "", overlays: "" });
  const exploring = useRef(false);
  const elapsed = useRef(1);
  const frames = useRef(0);
  useEffect(() => {
    if (!controls) return;
    const start = () => {
      exploring.current = true;
      flight.current = null;
    };
    const reset = () => {
      if (!model.current || !(camera instanceof THREE.PerspectiveCamera)) return;
      // Re-measure on click: a new alert may have arrived since the last throttled layout check.
      const view = gl.domElement.getBoundingClientRect();
      const safe = safeFrame(view, obstaclesFor(gl.domElement));
      const fit = fitComponentCamera(
        model.current,
        new THREE.Vector3(...position).sub(new THREE.Vector3(...target)),
        camera.fov,
        view.width,
        view.height,
        safe,
      );
      if (!fit) return;
      const pose = { p: fit.position, t: fit.target };
      previous.current = {
        request: [frameKey, ...position, ...target, view.width, view.height].join(","),
        overlays: [safe.top, safe.bottom].join(","),
      };
      exploring.current = false;
      controls.maxDistance = Math.max(maxDistance, pose.p.distanceTo(pose.t) * 1.5);
      const from = { p: camera.position.clone(), t: controls.target.clone() };
      controls.enableDamping = false;
      controls.update();
      controls.enableDamping = true;
      camera.position.copy(from.p);
      controls.target.copy(from.t);
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        flight.current = null;
        camera.position.copy(pose.p);
        controls.target.copy(pose.t);
        controls.update();
        return;
      }
      flight.current = { from, to: { p: pose.p.clone(), t: pose.t.clone() }, t0: performance.now() };
    };
    controls.addEventListener("start", start);
    useStageReset.setState({ reset });
    return () => {
      controls.removeEventListener("start", start);
      if (useStageReset.getState().reset === reset) useStageReset.setState({ reset: null });
    };
  }, [camera, controls, frameKey, gl, maxDistance, model, position, target]);
  useFrame((_, dt) => {
    if (!controls || !model.current || !(camera instanceof THREE.PerspectiveCamera)) return;
    // Animated assemblies get their initial pose before their bounds are measured.
    if (++frames.current < 3) return;
    elapsed.current += dt;
    if (elapsed.current >= 0.2) {
      elapsed.current = 0;
      const view = gl.domElement.getBoundingClientRect();
      const safe = safeFrame(view, obstaclesFor(gl.domElement));
      const request = [frameKey, ...position, ...target, view.width, view.height].join(",");
      const overlays = [safe.top, safe.bottom].join(",");
      const explicit = request !== previous.current.request;
      if (explicit || overlays !== previous.current.overlays) {
        const direction = new THREE.Vector3(...position).sub(new THREE.Vector3(...target));
        const fit = fitComponentCamera(model.current, direction, camera.fov, view.width, view.height, safe);
        if (fit) {
          previous.current = { request, overlays };
          if (explicit || !exploring.current) {
            exploring.current = false;
            flight.current = null;
            // Fitting a tall propeller on a phone may need more room than the authored desktop orbit limit.
            controls.maxDistance = Math.max(maxDistance, fit.position.distanceTo(fit.target) * 1.5);
            controls.enableDamping = false;
            controls.update();
            controls.enableDamping = true;
            camera.position.copy(fit.position);
            controls.target.copy(fit.target);
            controls.update();
          }
        }
      }
    }
    const f = flight.current;
    if (!f) return;
    const u = clamp((performance.now() - f.t0) / 1000, 0, 1),
      e = ease(u);
    camera.position.lerpVectors(f.from.p, f.to.p, e);
    controls.target.lerpVectors(f.from.t, f.to.t, e);
    if (u >= 1) flight.current = null;
  });
  return null;
}

/** Selection wins collisions. Small stages show a few principal assemblies; every part remains in the inspector. */
function LabelClear({ every = 0.2 }: { every?: number }) {
  const gl = useThree((s) => s.gl);
  const inspection = usePartInspectionStore();
  const acc = useRef(every);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < every) return;
    acc.current = 0;
    inspection.getState().refresh();
    const view = gl.domElement.closest(".eng-view");
    if (!view) return;
    const viewport = gl.domElement.getBoundingClientRect();
    const selected = inspection.getState().selected;
    const labels = [...view.querySelectorAll<HTMLElement>(".eng-label")].map((el, index) => {
      const name = el.textContent?.trim() ?? "";
      return {
        el,
        id: `${name}:${index}`,
        rect: el.getBoundingClientRect(),
        selected: selected === name,
        priority: Number(el.dataset.labelPriority ?? (/^Cyl\s*\d/i.test(name) ? 10 : 0)),
      };
    });
    const shown = visibleStageLabels(
      labels.filter(({ rect }) => rect.width && rect.height),
      viewport,
      [
        ...obstaclesFor(gl.domElement),
        // A corner control blocks labels, but does not need a full-width band reserved by the camera fit.
        ...[...view.querySelectorAll<HTMLElement>(".model-size-toggle")].map((button) =>
          button.getBoundingClientRect(),
        ),
      ],
      viewport.width < 600 ? 6 : Infinity,
    );
    for (const { el, id } of labels) {
      const visibility = shown.has(id) ? "" : "hidden";
      if (el.style.visibility !== visibility) el.style.visibility = visibility;
    }
  });
  return null;
}

export function ComponentStage({
  camera,
  target,
  minDistance,
  maxDistance,
  frameKey = "",
  ambient = 0.55,
  keyLight = { position: [3, 4, 2], intensity: 1.6 },
  children,
}: {
  camera: { position: Vec3; fov: number; near: number; far: number };
  /** Authored direction and orbit target; responsive fitting finds the visible assembly's centre. */
  target: Vec3;
  minDistance: number;
  maxDistance: number;
  /** Change only for an explicit study/preset change, not for live simulation values. */
  frameKey?: string;
  ambient?: number;
  keyLight?: { position: Vec3; intensity: number };
  children: ReactNode;
}) {
  const model = useRef<THREE.Group>(null);
  const rendering = useSceneRendering();
  useEffect(() => clearHover, []);
  return (
    <>
      <Canvas camera={camera} {...rendering} gl={{ antialias: true, alpha: true }} onPointerMissed={clearHover}>
        <ambientLight intensity={ambient} />
        <directionalLight position={keyLight.position} intensity={keyLight.intensity} />
        <directionalLight position={[-3, 1.5, -2]} intensity={0.5} />
        <hemisphereLight args={["#ffffff", "#445566", 0.4]} />
        <group ref={model}>{children}</group>
        <OrbitControls makeDefault target={target} enableDamping minDistance={minDistance} maxDistance={maxDistance} />
        <CameraRig
          model={model}
          position={camera.position}
          target={target}
          frameKey={frameKey}
          maxDistance={maxDistance}
        />
        <LabelClear />
      </Canvas>
      <HoverTip />
    </>
  );
}
