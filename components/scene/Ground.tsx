"use client";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { airplaneBounds } from "@/lib/camera";
import { useBuild } from "@/lib/build";

/** Grid extent (m): 1 m cells with a major line every 5 m, faded out well before the edge. */
const SIZE = 40;
const FADE = 18;

const gridVertex = /* glsl */ `
varying vec2 vGround;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vGround = world.xz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

/** Anti-aliased lines from screen-space derivatives; minor lines drop out where they would be closer than ~4 px. */
const gridFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vGround;
float lines(vec2 p, float step, float width) {
  vec2 c = p / step;
  vec2 d = fwidth(c);
  vec2 g = abs(fract(c - 0.5) - 0.5) / d;
  return 1.0 - min(min(g.x, g.y) / width, 1.0);
}
void main() {
  vec2 px = fwidth(vGround);
  float minorFade = 1.0 - smoothstep(0.12, 0.3, max(px.x, px.y));
  float minor = lines(vGround, 1.0, 1.25) * minorFade;
  float major = lines(vGround, 5.0, 1.75);
  float fade = 1.0 - smoothstep(${(FADE * 0.3).toFixed(1)}, ${FADE.toFixed(1)}, length(vGround));
  float a = max(minor * 0.7, major) * fade * uOpacity;
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** A soft dark ellipse: the airplane's contact shadow, with no light or shadow map behind it. */
function shadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const g = canvas.getContext("2d")!;
  const gradient = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(0,0,0,1)");
  gradient.addColorStop(0.45, "rgba(0,0,0,0.6)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gradient;
  g.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * The ground under the airplane: a grid that fades with distance (major lines every 5 m) and a soft contact shadow sized
 * to the airplane once it has built. Its objects are marked `userData.ground`, as stage rather than model (the load test's
 * scene fingerprint leaves them out). `groundRef` is the whole ground, so a CAPS descent can hide it.
 */
export function Ground({
  groundRef,
  modelRef,
  y,
  color,
  dark,
}: {
  groundRef: RefObject<THREE.Group | null>;
  modelRef: RefObject<THREE.Group | null>;
  y: number;
  color: string;
  dark: boolean;
}) {
  const gridMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color() }, uOpacity: { value: 1 } },
        vertexShader: gridVertex,
        fragmentShader: gridFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );
  const shadowMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, color: "#000000" }),
    [],
  );
  useEffect(
    () => () => {
      gridMaterial.dispose();
      shadowMaterial.map?.dispose();
      shadowMaterial.dispose();
    },
    [gridMaterial, shadowMaterial],
  );
  useEffect(() => {
    gridMaterial.uniforms.uColor.value.set(color);
    gridMaterial.uniforms.uOpacity.value = dark ? 0.8 : 1;
    shadowMaterial.opacity = dark ? 0.55 : 0.3;
  }, [color, dark, gridMaterial, shadowMaterial]);

  // size the shadow to the built airplane's footprint
  const shadow = useRef<THREE.Mesh>(null);
  const ready = useBuild((b) => b.stage === "ready");
  useEffect(() => {
    const model = modelRef.current,
      mesh = shadow.current;
    if (!ready || !model || !mesh) return;
    const bounds = airplaneBounds(model);
    if (bounds.isEmpty()) return;
    const size = bounds.getSize(new THREE.Vector3()),
      centre = bounds.getCenter(new THREE.Vector3());
    mesh.position.set(centre.x, 0.002, centre.z);
    mesh.scale.set(size.x * 0.85, size.z * 0.6, 1);
    mesh.visible = true;
  }, [ready, modelRef]);

  return (
    <group ref={groundRef} position-y={y}>
      <mesh rotation-x={-Math.PI / 2} renderOrder={-2} material={gridMaterial} userData={{ ground: true }}>
        <planeGeometry args={[SIZE, SIZE]} />
      </mesh>
      <mesh
        ref={shadow}
        visible={false}
        rotation-x={-Math.PI / 2}
        renderOrder={-1}
        material={shadowMaterial}
        userData={{ ground: true }}
      >
        <planeGeometry args={[1, 1]} />
      </mesh>
    </group>
  );
}
