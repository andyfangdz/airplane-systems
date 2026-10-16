"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FLEET_META } from "@/aircraft/metas";
import { DEFAULT_AIRCRAFT, isAircraftId, type AircraftId } from "@/lib/systems";

/** Before the fleet, links named the SR20's views by a bare system (#electrical). */
const FIRST_AIRCRAFT: AircraftId = "sr20";

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

/**
 * The airplane route the root opens: a view named by the hash of a link made before views had paths (#c172s/electrical,
 * #c172s, or #electrical for the SR20), else the last-viewed airplane, else the default one. An airplane alone opens at
 * its last-viewed system (its route picks it).
 */
function target(hash: string): string {
  try {
    hash = decodeURIComponent(hash);
  } catch {} // malformed escape (e.g. a truncated link): use the raw text
  const [a, b] = hash.replace(/^#+\/*/, "").split("/");
  const named = (id: AircraftId, sys?: string) =>
    FLEET_META.find((m) => m.id === id)?.systems.some((s) => s.id === sys) ? `/${id}/${sys}` : undefined;
  if (isAircraftId(a)) return named(a, b) ?? `/${a}`;
  const first = named(FIRST_AIRCRAFT, a);
  if (first) return first;
  const saved = read("fleetAc");
  return `/${isAircraftId(saved) ? saved : DEFAULT_AIRCRAFT}`;
}

/** The root page: opens the airplane route (keeping the query, e.g. ?cam=top), with the loader up meanwhile. */
export function OpenLastViewed() {
  const router = useRouter();
  useEffect(() => {
    router.replace(target(location.hash) + location.search);
  }, [router]);
  return (
    <div className="loader" role="status" aria-live="polite" data-building="code">
      <div className="loader-card">
        <span className="spinner" aria-hidden="true" />
        <span className="loader-text">Loading…</span>
      </div>
    </div>
  );
}
