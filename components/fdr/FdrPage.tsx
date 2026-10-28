"use client";
/**
 * Each flight data replay's page, keyed by its id in `fdr/index.ts` (the type makes every id have a page and every page
 * an id). Entries are `next/dynamic` imports, so a page loads only its own replay.
 */
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { FdrId } from "@/fdr";

export const PAGES: Record<FdrId, ComponentType> = {
  "c5-diego-garcia": dynamic(() => import("./c5-diego-garcia/C5App")),
};

export default function FdrPage({ id }: { id: FdrId }) {
  const Page = PAGES[id];
  return <Page />;
}
