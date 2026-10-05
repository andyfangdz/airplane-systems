"use client";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Catalogue, PartSpec, ShellSpec } from "@/lib/catalogue";
import { mats, plateMat, shellMat, skinMat, solidMat } from "@/lib/materials";
import { partObjects } from "@/lib/registry";
import { palette, sysColor, type SysId } from "@/lib/systems";
import { useView } from "@/lib/view";

/** What the hover tooltip needs to know about a mesh. */
export interface PickInfo { name: string; note: string; color: string; sys: SysId[]; shell?: boolean }

/** Geometry is built once per spec and kept, so switching airplanes back and forth is cheap. */
const geoCache = new WeakMap<object, THREE.BufferGeometry>();
export function specGeo(spec: { geo: () => THREE.BufferGeometry }) {
  let g = geoCache.get(spec);
  if (!g) { g = spec.geo(); geoCache.set(spec, g); }
  return g;
}

export function Pin({ at, label, color }: { at: THREE.Vector3; label: string; color: string }) {
  // A fixed portal target: drei re-runs its mount effect (re-creating its React root on the same element) when its
  // default target changes after the first render, and the old root's deferred unmount then empties the label.
  const gl = useThree((s) => s.gl);
  const portal = useMemo(() => ({ current: gl.domElement.parentNode as HTMLElement }), [gl]);
  return (
    <Html position={at} portal={portal} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      <div className="pin" style={{ "--c": color } as React.CSSProperties}>{label}</div>
    </Html>
  );
}

const centerOf = (g: THREE.BufferGeometry) => { if (!g.boundingSphere) g.computeBoundingSphere(); return g.boundingSphere!.center.clone(); };

export function Part({ spec, cat }: { spec: PartSpec; cat: Catalogue }) {
  const geo = specGeo(spec);
  const ref = useRef<THREE.Mesh>(null!);
  const sys = useView((x) => x.sys);
  const xray = useView((x) => x.xray);
  const focus = useView((x) => x.focus);
  const labels = useView((x) => x.labels);
  const theme = useView((x) => x.theme);
  const cf = useView((x) => x.ctrlFocus);

  const color = spec.color ?? sysColor(spec.sys[0], theme);
  const all = sys === "overview";
  // Flight-controls channel focus: parts outside the chosen channel fade out
  const chanDim = sys === "controls" && cf !== "all" && !spec.chan?.includes(cf);
  const act = (all || spec.sys.includes(sys)) && !chanDim;
  const material = spec.plate ? (act ? plateMat.on : plateMat.dim)
    : focus && focus === spec.name ? mats(color).hi
    : act || !xray ? mats(color).on : mats(color).dim;
  const pick: PickInfo | undefined = spec.name ? { name: spec.name, note: spec.note ?? "", color, sys: spec.sys } : undefined;
  const showPin = labels && !all && !chanDim && cat.isPinned(spec, sys);

  useEffect(() => {
    const name = spec.name, m = ref.current;
    if (!name || partObjects.has(name)) return;
    partObjects.set(name, m);
    return () => { if (partObjects.get(name) === m) partObjects.delete(name); };
  }, [spec.name]);

  useFrame(({ clock }) => { if (spec.anim) spec.anim(ref.current, clock.elapsedTime); });

  return (
    <mesh ref={ref} geometry={geo} material={material} position={spec.pos} rotation={spec.rot} scale={spec.scale} userData={{ pick }}>
      {showPin && spec.name && <Pin at={centerOf(geo)} label={spec.name} color={sysColor(sys, theme)} />}
    </mesh>
  );
}

/** All parts riding on one moving group (or the fixed airframe when parent is omitted). */
export const Parts = ({ cat, parent }: { cat: Catalogue; parent?: string }) => <>{cat.partsFor(parent).map((p) => <Part key={p.id} spec={p} cat={cat} />)}</>;

/** Airframe skin: x-ray ghost, painted skin or plain white. */
export function Shell({ spec }: { spec: ShellSpec }) {
  const geo = specGeo(spec);
  const xray = useView((x) => x.xray);
  const theme = useView((x) => x.theme);
  const material = xray ? shellMat : spec.skin ? skinMat(spec.skin) : solidMat;
  const pick: PickInfo | undefined = spec.name ? { name: spec.name, note: spec.note, color: palette(theme).frame, sys: ["airframe"], shell: true } : undefined;
  return <mesh geometry={geo} material={material} renderOrder={xray ? 2 : 0} userData={{ pick }} />;
}

export const Shells = ({ cat }: { cat: Catalogue }) => <>{cat.shells.map((s) => <Shell key={s.id} spec={s} />)}</>;
