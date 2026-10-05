"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Catalogue, SurfaceSpec } from "@/lib/catalogue";
import { mats, shellMat, solidMat } from "@/lib/materials";
import { V } from "@/lib/math";
import { sysColor } from "@/lib/systems";
import { useView } from "@/lib/view";
import { Parts, specGeo, type PickInfo } from "./Part";

/** A control surface rotating about its hinge line; `angle` gives its deflection (radians) every frame. */
export function ControlSurface({ spec, cat, angle }: { spec: SurfaceSpec; cat: Catalogue; angle: (key: string) => number }) {
  const geo = specGeo(spec);
  const ref = useRef<THREE.Group>(null!);
  const axis = useMemo(() => V(...spec.axis), [spec]);
  const sys = useView((x) => x.sys);
  const xray = useView((x) => x.xray);
  const theme = useView((x) => x.theme);
  const cf = useView((x) => x.ctrlFocus);
  const chanDim = sys === "controls" && cf !== "all" && !spec.chan?.includes(cf);
  const active = sys !== "overview" && spec.sys.includes(sys) && !chanDim;
  const color = sysColor(spec.sys[0], theme);
  useFrame(() => { ref.current.quaternion.setFromAxisAngle(axis, angle(spec.key)); });
  const pick: PickInfo = { name: spec.name, note: spec.note, color, sys: spec.sys };
  return (
    <group ref={ref} position={spec.pivot}>
      <mesh geometry={geo} material={active ? mats(color).hi : xray ? shellMat : solidMat} renderOrder={xray && !active ? 2 : 0} userData={{ pick }} />
      <Parts cat={cat} parent={"surf:" + spec.key} />
    </group>
  );
}

export const ControlSurfaces = ({ cat, angle }: { cat: Catalogue; angle: (key: string) => number }) =>
  <>{cat.surfaces.map((s) => <ControlSurface key={s.key} spec={s} cat={cat} angle={angle} />)}</>;
