"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { dotTex } from "@/lib/materials";
import { V, type Vec3 } from "@/lib/math";

/** Additive glow sprite at a light; `on(t)` is evaluated every frame (t = clock seconds, for strobes/beacons). */
export interface GlowSpec {
  key: string;
  pos: Vec3;
  color: string;
  size: number;
  on: (t: number) => boolean;
}
/** Faint additive cone from `from` (narrow) to `to` (wide), for landing/taxi/ice-light beams. */
export interface BeamSpec {
  key: string;
  from: Vec3;
  to: Vec3;
  r: number;
  opacity: number;
  on: (t: number) => boolean;
  color?: string;
}

function beamProps(from: Vec3, to: Vec3, r: number) {
  const a = V(...from),
    b = V(...to),
    d = b.clone().sub(a),
    len = d.length();
  const geo = new THREE.CylinderGeometry(r, 0.015, len, 24, 1, true);
  const quat = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize());
  return { geo, pos: a.clone().add(b).multiplyScalar(0.5), quat };
}

export function LightFX({ glows, beams = [] }: { glows: GlowSpec[]; beams?: BeamSpec[] }) {
  const refs = useRef<Record<string, THREE.Object3D | null>>({});
  const set = (key: string) => (o: THREE.Object3D | null) => {
    refs.current[key] = o;
  };
  const geos = useMemo(() => beams.map((b) => ({ b, ...beamProps(b.from, b.to, b.r) })), [beams]);
  useEffect(() => () => geos.forEach((g) => g.geo.dispose()), [geos]);
  useFrame(({ clock }) => {
    const R = refs.current,
      t = clock.elapsedTime;
    for (const g of glows) {
      const o = R["g:" + g.key];
      if (o) o.visible = g.on(t);
    }
    for (const b of beams) {
      const o = R["b:" + b.key];
      if (o) o.visible = b.on(t);
    }
  });
  return (
    <>
      {glows.map((g) => (
        <sprite
          key={g.key}
          ref={set("g:" + g.key)}
          position={g.pos}
          scale={[g.size, g.size, g.size]}
          raycast={() => null}
          visible={false}
        >
          <spriteMaterial
            map={dotTex()}
            color={g.color}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      ))}
      {geos.map(({ b, geo, pos, quat }) => (
        <mesh
          key={b.key}
          ref={set("b:" + b.key)}
          geometry={geo}
          position={pos}
          quaternion={quat}
          raycast={() => null}
          visible={false}
        >
          <meshBasicMaterial
            color={b.color ?? "#FFF6DD"}
            transparent
            opacity={b.opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </>
  );
}
