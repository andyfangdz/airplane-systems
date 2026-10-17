"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { LoadFailed } from "@/components/LoadFailed";
import { FLEET_INDEX } from "@/lib/fleet-index";

/**
 * An airplane's page failed: most likely its code didn't download (switching to an airplane fetches its route's chunks,
 * and the 3D scene's arrive after the page). It says so and offers Retry, as the Loader does when the first page load's
 * code fails (components/LoadFailed.tsx).
 */
export default function AirplaneError({ error }: { error: Error & { digest?: string }; retry: () => void }) {
  const name = FLEET_INDEX.find((a) => a.id === usePathname().split("/")[1])?.name;
  useEffect(() => console.error(error), [error]);
  return (
    <div className="loader" role="alert" data-building="failed">
      <div className="loader-card">
        <LoadFailed name={name} shown />
      </div>
    </div>
  );
}
