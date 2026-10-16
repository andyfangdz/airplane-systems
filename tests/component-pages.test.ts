/**
 * The component simulations' registry (engines/components) and their pages (components/engine/ComponentPage.tsx)
 * name the same components: each listed component has a page, and each page is listed (the picker, static params and
 * metadata come from the list).
 */
import { expect, test } from "vitest";
import { COMPONENT_IDS } from "@/engines/components";
import { PAGES } from "@/components/engine/ComponentPage";

test("every listed component has a page, and every page is listed", () => {
  expect(Object.keys(PAGES).sort()).toEqual([...COMPONENT_IDS].sort());
});

test("component ids are unique", () => {
  expect(new Set(COMPONENT_IDS).size).toBe(COMPONENT_IDS.length);
});
