"use client";
import { ControlSurfaces } from "@/components/scene/ControlSurface";
import { Parts, Shells } from "@/components/scene/Part";
import { surfaceAngle } from "./flaperons";
import { CAT } from "./parts";

export function Model() {
  return (
    <>
      <Shells cat={CAT} />
      <ControlSurfaces cat={CAT} angle={surfaceAngle} />
      <Parts cat={CAT} />
    </>
  );
}
