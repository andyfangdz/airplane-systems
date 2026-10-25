"use client";
/**
 * Each component simulation's page, keyed by its id in `engines/components/index.ts` (the type makes every id have a
 * page and every page an id). Entries are `next/dynamic` imports, so a page loads only its own component.
 */
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { ComponentId } from "@/engines/components";

export const PAGES: Record<ComponentId, ComponentType> = {
  "piston-cylinder": dynamic(() => import("./piston-cylinder/PistonCylinderApp")),
  carburetor: dynamic(() => import("./carburetor/CarburetorApp")),
  "fuel-injector": dynamic(() => import("./fuel-injector/FuelInjectorApp")),
  surefly: dynamic(() => import("./surefly/App")),
  governor: dynamic(() => import("./governor/GovernorApp")),
  "pitot-static": dynamic(() => import("./pitot-static/PitotStaticApp")),
};

export default function ComponentPage({ id }: { id: ComponentId }) {
  const Page = PAGES[id];
  return <Page />;
}
