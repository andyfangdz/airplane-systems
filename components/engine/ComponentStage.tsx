"use client";
/** Shared component viewport: responsive framing, labels, orbit controls and the hover tooltip. */
import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { fitComponentCamera, intersects, visibleStageLabels, type StageRect } from "@/lib/component-stage";
import { clamp, ease, toV, toVec3, type Vec3 } from "@/lib/math";
import { prefersReducedMotion } from "@/lib/useReducedMotion";
import { useSceneRendering } from "@/lib/useSceneRendering";
import { placeTipAtPoint, projectToStage } from "@/lib/view";
import { useStageReset } from "./chrome";
import { usePartInspectionStore } from "./PartInspector";
import { HoverTip, useHover } from "./scene/parts";

const clearHover = () => useHover.setState({ hover: null });
type StageFit = NonNullable<ReturnType<typeof fitComponentCamera>>;

function setStageOffset(camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement, x: number, y: number) {
  if (!x && !y) {
    if (camera.view?.enabled) camera.clearViewOffset();
  } else {
    const { clientWidth: width, clientHeight: height } = canvas;
    if (width && height) camera.setViewOffset(width, height, x, y, width, height);
  }
}

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
  direction,
  frameKey,
  motionKey,
  focused,
  maxDistance,
}: {
  model: RefObject<THREE.Group | null>;
  direction: Vec3;
  frameKey: string;
  motionKey: string;
  focused: boolean;
  maxDistance: number;
}) {
  const camera = useThree((s) => s.camera),
    gl = useThree((s) => s.gl);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const flight = useRef<{ from: StageFit; to: StageFit; t0: number } | null>(null);
  const previous = useRef({ request: "", layout: "", motionKey });
  const exploring = useRef(false);
  const elapsed = useRef(1);
  const frames = useRef(0);
  const applyFit = useCallback(
    (fit: StageFit, animate: boolean) => {
      if (!controls || !(camera instanceof THREE.PerspectiveCamera)) return;
      // A tall propeller on a phone can need more room than the authored desktop orbit limit.
      controls.maxDistance = Math.max(maxDistance, fit.position.distanceTo(fit.target) * 1.5);
      const view = camera.view;
      const from = {
        position: camera.position.clone(),
        target: controls.target.clone(),
        viewOffset: view?.enabled ? new THREE.Vector2(view.offsetX, view.offsetY) : new THREE.Vector2(),
      };
      controls.enableDamping = false;
      controls.update();
      controls.enableDamping = true;
      if (animate && !prefersReducedMotion()) {
        camera.position.copy(from.position);
        controls.target.copy(from.target);
        flight.current = { from, to: fit, t0: performance.now() };
      } else {
        flight.current = null;
        camera.position.copy(fit.position);
        controls.target.copy(fit.target);
        setStageOffset(camera, gl.domElement, fit.viewOffset.x, fit.viewOffset.y);
        controls.update();
      }
    },
    [camera, controls, gl, maxDistance],
  );
  useEffect(() => {
    if (!controls) return;
    const start = () => {
      exploring.current = true;
    };
    const reset = () => {
      if (!model.current || !(camera instanceof THREE.PerspectiveCamera)) return;
      // Re-measure on click: a new alert may have arrived since the last throttled layout check.
      const view = gl.domElement.getBoundingClientRect();
      const safe = safeFrame(view, obstaclesFor(gl.domElement));
      const fit = fitComponentCamera(
        model.current,
        new THREE.Vector3(...direction),
        camera.fov,
        view.width,
        view.height,
        safe,
        focused,
      );
      if (!fit) return;
      previous.current = {
        motionKey,
        request: [frameKey, focused, ...direction, window.innerWidth, window.innerHeight].join(","),
        layout: [view.width, view.height, safe.top, safe.bottom].join(","),
      };
      exploring.current = false;
      applyFit(fit, true);
    };
    controls.addEventListener("start", start);
    useStageReset.setState({ reset });
    return () => {
      controls.removeEventListener("start", start);
      if (useStageReset.getState().reset === reset) useStageReset.setState({ reset: null });
    };
  }, [applyFit, camera, controls, frameKey, motionKey, focused, gl, model, direction]);
  useFrame((_, dt) => {
    if (!controls || !model.current || !(camera instanceof THREE.PerspectiveCamera)) return;
    // Animated assemblies get their initial pose before their bounds are measured.
    if (++frames.current < 3) return;
    elapsed.current += dt;
    const studyChanged = motionKey !== previous.current.motionKey;
    if (studyChanged || elapsed.current >= 0.2) {
      elapsed.current = 0;
      const view = gl.domElement.getBoundingClientRect();
      const safe = safeFrame(view, obstaclesFor(gl.domElement));
      const request = [frameKey, focused, ...direction, window.innerWidth, window.innerHeight].join(",");
      const layout = [view.width, view.height, safe.top, safe.bottom].join(",");
      const explicit = request !== previous.current.request;
      if (studyChanged || explicit || layout !== previous.current.layout) {
        const fit = fitComponentCamera(
          model.current,
          new THREE.Vector3(...direction),
          camera.fov,
          view.width,
          view.height,
          safe,
          focused,
        );
        previous.current = { request, layout, motionKey };
        if (fit && (studyChanged || explicit || !exploring.current)) {
          exploring.current = false;
          applyFit(fit, studyChanged || !!flight.current);
        } else if (
          fit &&
          camera.view?.enabled &&
          (camera.view.fullWidth !== gl.domElement.clientWidth || camera.view.fullHeight !== gl.domElement.clientHeight)
        ) {
          // Folding a panel resizes the lens while keeping the user's orbit, pan and zoom.
          setStageOffset(camera, gl.domElement, fit.viewOffset.x, fit.viewOffset.y);
        }
      }
    }
    const f = flight.current;
    if (!f) return;
    const u = clamp((performance.now() - f.t0) / 1000, 0, 1),
      e = ease(u);
    // Dragging takes over the orbit. Let the lens finish shifting into the current study layout.
    if (!exploring.current) {
      camera.position.lerpVectors(f.from.position, f.to.position, e);
      controls.target.lerpVectors(f.from.target, f.to.target, e);
    }
    setStageOffset(
      camera,
      gl.domElement,
      THREE.MathUtils.lerp(f.from.viewOffset.x, f.to.viewOffset.x, e),
      THREE.MathUtils.lerp(f.from.viewOffset.y, f.to.viewOffset.y, e),
    );
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
        // A corner control or selected part card blocks labels, but does not need a full-width band reserved by the camera fit.
        ...[...view.querySelectorAll<HTMLElement>(".model-size-toggle, .eng-panel-toggle, .eng-tip-selected")].map(
          (element) => element.getBoundingClientRect(),
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

function isAttachedVisible(object: THREE.Object3D, scene: THREE.Scene) {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (!current.visible) return false;
    if (current === scene) return true;
    current = current.parent;
  }
  return false;
}

/** Keeps the selected engine/component tooltip positioned beside its 3D part as the camera or assembly moves. */
function SelectedEngineTipSync() {
  const inspection = usePartInspectionStore();
  const world = useRef(new THREE.Vector3());
  const last = useRef<{ el: HTMLElement | null; name: string; x: number; y: number }>({
    el: null,
    name: "",
    x: NaN,
    y: NaN,
  });
  useFrame(({ camera, gl, scene, size }) => {
    const { selected, anchor, objectFor } = inspection.getState();
    const hover = useHover.getState().hover;
    if (!selected || (hover && hover.name !== selected)) {
      last.current.el = null;
      return;
    }
    const stage = gl.domElement.closest<HTMLElement>(".eng-view") ?? gl.domElement.parentElement;
    const el = stage?.querySelector<HTMLElement>(".eng-tip.eng-tip-selected") ?? null;
    if (!stage || !el) {
      last.current.el = null;
      return;
    }
    const tmp = world.current;
    let hasPoint = false;
    if (anchor?.object && anchor.local && isAttachedVisible(anchor.object, scene)) {
      anchor.object.updateWorldMatrix(true, false);
      tmp.copy(anchor.local).applyMatrix4(anchor.object.matrixWorld);
      hasPoint = true;
    } else {
      const obj = objectFor(selected);
      if (obj instanceof THREE.Mesh && isAttachedVisible(obj, scene)) {
        if (!obj.geometry.boundingSphere) obj.geometry.computeBoundingSphere();
        obj.updateWorldMatrix(true, false);
        tmp.copy(obj.geometry.boundingSphere!.center).applyMatrix4(obj.matrixWorld);
        hasPoint = true;
      }
    }
    if (!hasPoint) return;
    const pt = projectToStage(tmp, camera, size.width, size.height);
    if (!pt) return;
    const prev = last.current;
    if (prev.el === el && prev.name === selected && Math.abs(prev.x - pt.x) < 0.5 && Math.abs(prev.y - pt.y) < 0.5)
      return;
    prev.el = el;
    prev.name = selected;
    prev.x = pt.x;
    prev.y = pt.y;
    placeTipAtPoint(el, pt.x, pt.y, stage.clientWidth, stage.clientHeight);
  });
  return null;
}

export function ComponentStage({
  camera,
  target,
  minDistance,
  maxDistance,
  frameKey = "",
  motionKey = "",
  focused = false,
  fitDirection,
  shadowExtent,
  ambient = 0.55,
  keyLight = { position: [3, 4, 2], intensity: 1.6 },
  logarithmicDepth = false,
  children,
}: {
  camera: { position: Vec3; fov: number; near: number; far: number };
  /** Authored direction and orbit target; responsive fitting finds the visible assembly's centre. */
  target: Vec3;
  minDistance: number;
  maxDistance: number;
  /** Change only for an explicit study/preset change, not for live simulation values. */
  frameKey?: string;
  /** Animate the camera between explicit assembly study levels. */
  motionKey?: string;
  /** Orbit a focused assembly’s working parts in the unobstructed portion of the canvas. */
  focused?: boolean;
  /** Optional view from a particular side of a focused assembly, in model axes. */
  fitDirection?: Vec3;
  /** Half-width of the directional shadow camera in model metres, for the solid engine finish. */
  shadowExtent?: number;
  ambient?: number;
  keyLight?: { position: Vec3; intensity: number };
  /** For a scene deeper than the depth buffer resolves (metres to tens of kilometres): surfaces a metre apart far
   * away otherwise flicker through each other. */
  logarithmicDepth?: boolean;
  children: ReactNode;
}) {
  const model = useRef<THREE.Group>(null);
  const pointerDown = useRef<{ x: number; y: number } | null>(null);
  const inspection = usePartInspectionStore();
  const rendering = useSceneRendering();
  useEffect(() => clearHover, []);
  return (
    <>
      <Canvas
        camera={camera}
        {...rendering}
        shadows={shadowExtent ? "percentage" : false}
        gl={{ antialias: true, alpha: true, logarithmicDepthBuffer: logarithmicDepth }}
        onPointerDown={(e) => {
          pointerDown.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMissed={(e) => {
          const down = pointerDown.current;
          pointerDown.current = null;
          clearHover();
          if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) <= 4) {
            inspection.getState().select(null);
          }
        }}
      >
        <ambientLight intensity={ambient} />
        <directionalLight
          position={keyLight.position}
          intensity={keyLight.intensity}
          castShadow={!!shadowExtent}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-normalBias={0.0007}
          shadow-bias={-0.00012}
        >
          {shadowExtent && (
            <orthographicCamera
              attach="shadow-camera"
              args={[-shadowExtent, shadowExtent, shadowExtent, -shadowExtent, 2, 8]}
            />
          )}
        </directionalLight>
        <directionalLight position={[-3, 1.5, -2]} intensity={0.5} />
        <hemisphereLight args={["#ffffff", "#445566", 0.4]} />
        <group ref={model}>{children}</group>
        <OrbitControls makeDefault target={target} enableDamping minDistance={minDistance} maxDistance={maxDistance} />
        <CameraRig
          model={model}
          direction={fitDirection ?? toVec3(toV(camera.position).sub(toV(target)))}
          frameKey={frameKey}
          motionKey={motionKey}
          focused={focused}
          maxDistance={maxDistance}
        />
        <LabelClear />
        <SelectedEngineTipSync />
      </Canvas>
      <HoverTip />
    </>
  );
}
