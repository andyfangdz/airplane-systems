"use client";
import { SR22T } from "@/aircraft/sr22t";

// Evaluated as soon as the route's code arrives in the browser, before the page hydrates (and on a switch to the SR22T,
// before its page renders): the fuselage skin's worker build starts at once. The shell calls `prepare` again when it
// boots, which joins the same build.
if (typeof window !== "undefined") SR22T.prepare?.();

/** Rendered by the SR22T's page, so this module ships with it. */
export function Prepare() {
  return null;
}
