"use client";
import { selectAircraft, useAircraft } from "@/aircraft/lazy";
import { ENGINES } from "@/engines";
import { COMPONENTS } from "@/engines/components";
import { FLEET_INDEX } from "@/lib/fleet-index";
import { Picker } from "./Picker";
import { componentEntries, engineEntries } from "./pickerEntries";

/** The airplane pages' picker: airplanes switch in place (loading their code if they haven't yet), engines and components open their own page. */
export function Fleet() {
  const current = useAircraft();
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
            onPick: () => selectAircraft(a.id),
          })),
        },
        { label: "Engines", entries: engineEntries(ENGINES) },
        { label: "Components", entries: componentEntries(COMPONENTS), compact: true },
      ]}
    />
  );
}
