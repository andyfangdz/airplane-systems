/**
 * The flight data replays' registry (fdr/index.ts) and their pages (components/fdr/FdrPage.tsx) name the same replays:
 * each listed replay has a page, and each page is listed (the picker, static params and metadata come from the list).
 * A replay's id is its own: /fdr/<id> never names an airplane, an engine or a component.
 */
import { expect, test } from "vitest";
import { FDR_IDS, FDR_REPLAYS, fdrById } from "@/fdr";
import { PAGES } from "@/components/fdr/FdrPage";
import { COMPONENT_IDS } from "@/engines/components";
import { ENGINE_IDS } from "@/engines";
import { AIRCRAFT_IDS } from "@/lib/systems";
import { C5_DIEGO_GARCIA } from "@/fdr/c5-diego-garcia/spec";

test("every listed replay has a page, and every page is listed", () => {
  expect(Object.keys(PAGES).sort()).toEqual([...FDR_IDS].sort());
});

test("replay ids are unique and name nothing else", () => {
  expect(new Set(FDR_IDS).size).toBe(FDR_IDS.length);
  const others = new Set<string>([...COMPONENT_IDS, ...ENGINE_IDS, ...AIRCRAFT_IDS]);
  for (const id of FDR_IDS) expect(others.has(id), id).toBe(false);
});

test("the picker's entry is the replay's own name and summary", () => {
  expect(fdrById(C5_DIEGO_GARCIA.id)).toEqual({
    id: C5_DIEGO_GARCIA.id,
    name: C5_DIEGO_GARCIA.name,
    sub: C5_DIEGO_GARCIA.sub,
    lead: C5_DIEGO_GARCIA.lead,
  });
  expect(fdrById("nope")).toBeUndefined();
  expect(FDR_REPLAYS).toHaveLength(FDR_IDS.length);
});
