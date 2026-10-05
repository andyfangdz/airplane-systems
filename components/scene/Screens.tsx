"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Vec3 } from "@/lib/math";
import { V } from "@/lib/math";
import { sysColor, type SysId } from "@/lib/systems";
import { useView } from "@/lib/view";
import { Pin } from "./Part";

export interface ScreenSpec {
  key: string;
  /** Canvas resolution in pixels. */
  px: [number, number];
  /** Physical size in metres (width, height). */
  size: [number, number];
  pos: Vec3;
  /** Euler rotation; default faces aft (toward the pilot). */
  rot?: Vec3;
  sys: SysId[];
  name: string;
  note: string;
  /** Redraws the whole canvas (called a few times a second). */
  draw: (ctx: CanvasRenderingContext2D, W: number, H: number) => void;
}

/** Live cockpit displays drawn into canvas textures. */
export function Screens({ screens, every = 0.2 }: { screens: ScreenSpec[]; every?: number }) {
  const sys = useView((x) => x.sys);
  const labels = useView((x) => x.labels);
  const theme = useView((x) => x.theme);
  const items = useMemo(() => screens.map((d) => {
    const c = document.createElement("canvas");
    c.width = d.px[0]; c.height = d.px[1];
    const tx = new THREE.CanvasTexture(c);
    tx.anisotropy = 4; tx.colorSpace = THREE.SRGBColorSpace;
    return { d, ctx: c.getContext("2d")!, tx };
  }), [screens]);
  const acc = useRef(1);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < every) return;
    acc.current = 0;
    for (const it of items) { it.d.draw(it.ctx, it.d.px[0], it.d.px[1]); it.tx.needsUpdate = true; }
  });
  return <>{items.map(({ d, tx }) => (
    <mesh key={d.key} position={d.pos} rotation={d.rot ?? [0, -Math.PI / 2, 0]}
      userData={{ pick: { name: d.name, note: d.note, color: sysColor("avionics", theme), sys: d.sys } }}>
      <planeGeometry args={d.size} />
      <meshBasicMaterial map={tx} toneMapped={false} />
      {labels && d.sys.includes(sys) && <Pin at={V(0, 0, 0)} label={d.name} color={sysColor(sys, theme)} />}
    </mesh>
  ))}</>;
}
