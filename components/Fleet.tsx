"use client";
import { useRouter } from "next/navigation";
import { useAircraft } from "@/lib/fleet";
import { ENGINES } from "@/engines";
import { COMPONENTS } from "@/engines/components";
import { FDR_REPLAYS } from "@/fdr";
import { FLEET_INDEX } from "@/lib/fleet-index";
import { Picker } from "./Picker";
import { componentEntries, engineEntries, replayEntries } from "./pickerEntries";

/**
 * The airplane pages' picker. Each airplane is its own route: picking one navigates to its overview (without this page's
 * query), which remounts the shell and the 3D scene with that airplane. (A link or reload of /<id> opens its last-viewed
 * system instead.) Engines, components and flight data replays open their own page.
 */
export function Fleet() {
  const current = useAircraft();
  const router = useRouter();
  return (
    <Picker
      current={current}
      kind="airplane"
      groups={[
        {
          label: "Airplanes",
          entries: FLEET_INDEX.map((a) => ({
            ...a,
            current: a.id === current.id,
            onPick: () => router.push(`/${a.id}/overview`),
          })),
        },
        { label: "Engines", entries: engineEntries(ENGINES) },
        { label: "Components", entries: componentEntries(COMPONENTS), compact: true },
        { label: "Flight data", entries: replayEntries(FDR_REPLAYS), compact: true },
      ]}
    />
  );
}
