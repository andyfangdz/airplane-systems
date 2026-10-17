"use client";
import { useFrame } from "@react-three/fiber";
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, type ReactNode, type RefObject } from "react";
import type * as THREE from "three";
import type { PartSpec } from "@/lib/catalogue";
import { PartAnimations, type PartAppearance } from "@/lib/scene/part-animations";
import { registerPart } from "@/lib/registry";
import type { AircraftSessionOwner } from "@/lib/view";

const AnimationContext = createContext<{ animations: PartAnimations; owner: AircraftSessionOwner } | null>(null);

/** Own all catalogue animation work at the scene boundary, rather than registering one R3F callback per mesh. */
export function PartAnimationScope({ children, owner }: { children: ReactNode; owner: AircraftSessionOwner }) {
  const animations = useMemo(() => new PartAnimations(), []);
  const context = useMemo(() => ({ animations, owner }), [animations, owner]);
  useFrame(({ clock }) => animations.step(clock.elapsedTime));
  useEffect(() => () => animations.clear(), [animations]);
  return <AnimationContext.Provider value={context}>{children}</AnimationContext.Provider>;
}

export function usePartAnimation(
  ref: RefObject<THREE.Mesh>,
  spec: PartSpec,
  appearance: PartAppearance,
  color: string,
) {
  const context = useContext(AnimationContext);
  if (!context) throw new Error("Part requires a PartAnimationScope");
  const { animations, owner } = context;
  useLayoutEffect(
    () => animations.register(ref.current, spec, appearance, color),
    [animations, ref, spec, appearance, color],
  );
  useEffect(
    () => (spec.name ? registerPart(spec.name, ref.current, !!spec.pin, owner) : undefined),
    [ref, spec.name, spec.pin, owner],
  );
}
