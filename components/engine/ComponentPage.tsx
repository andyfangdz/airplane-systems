"use client";
/**
 * Each component simulation's page, keyed by its id in `engines/components/index.ts`. Entries are `next/dynamic`
 * imports, so a page loads only its own component.
 */
import dynamic from "next/dynamic";
import type { ComponentType } from "react";

const PAGES: Record<string, ComponentType> = {
  carburetor: dynamic(() => import("./carburetor/CarburetorApp")),
  "fuel-injector": dynamic(() => import("./fuel-injector/FuelInjectorApp")),
};

export default function ComponentPage({ id }: { id: string }) {
  const Page = PAGES[id];
  return Page ? <Page /> : null;
}
