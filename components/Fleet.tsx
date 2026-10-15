"use client";
import { FLEET, selectAircraft, useAircraft } from "@/aircraft";
import { ENGINES } from "@/engines";
import { COMPONENTS } from "@/engines/components";
import { Picker } from "./Picker";
import { componentEntries, engineEntries } from "./pickerEntries";

/** The airplane pages' picker: airplanes switch in place, engines and components open their own page. */
export function Fleet() {
  const current = useAircraft();
  return (
    <Picker
      current={current}
      kind="airplane"
      groups={[
        {
          label: "Airplanes",
          entries: FLEET.map((a) => ({
            id: a.id,
            name: a.name,
            sub: a.sub,
            walk: !!a.walk,
            current: a.id === current.id,
            onPick: () => selectAircraft(a.id),
          })),
        },
        { label: "Engines", entries: engineEntries(ENGINES), compact: true },
        { label: "Components", entries: componentEntries(COMPONENTS), compact: true },
      ]}
    />
  );
}
