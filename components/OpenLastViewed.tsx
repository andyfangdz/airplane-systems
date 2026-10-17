"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoadFailed } from "./LoadFailed";
import { DEFAULT_AIRCRAFT, isAircraftId } from "@/lib/systems";

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

/** Root opens the last-viewed aircraft; that route owns its saved system selection. Deep links use explicit paths. */
function target(): string {
  const saved = read("fleetAc");
  return `/${isAircraftId(saved) ? saved : DEFAULT_AIRCRAFT}`;
}

/** The root page: opens the airplane route (keeping the query, e.g. ?cam=top), with the loader up meanwhile. */
export function OpenLastViewed() {
  const router = useRouter();
  useEffect(() => {
    router.replace(target() + location.search);
  }, [router]);
  return (
    <div className="loader" role="status" aria-live="polite" data-building="code">
      <div className="loader-card">
        <span className="spinner" aria-hidden="true" />
        <span className="loader-text">Loading…</span>
        <LoadFailed />
      </div>
    </div>
  );
}
