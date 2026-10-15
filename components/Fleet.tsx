"use client";
import { FLEET, selectAircraft, useAircraft } from "@/aircraft";
import { ENGINES } from "@/engines";
import { Picker } from "./Picker";
import { engineEntries } from "./pickerEntries";

/** The airplane pages' picker: airplanes switch in place, engines open their own page. */
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
        { label: "Engines", entries: engineEntries(ENGINES) },
      ]}
    />
  );
}
