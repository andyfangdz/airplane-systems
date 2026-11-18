import type { EngineSpec } from "@/engines/types";
import type { Vec3 } from "@/lib/math";
import type { EngineView } from "./store";

// Overview offsets are display spacing in model axes. Each cylinder occupies one station
// across its three separately drawn systems (castings, reciprocating parts and valve train).
const stations = {
  case: { name: "Crankcase and sump", by: [0, 0, 0] },
  shafts: { name: "Crankshaft and camshaft", by: [0.95, 0, 0.1] },
  ignition: { name: "Ignition", by: [-1.18, 0.47, 0.38] },
  fuel: { name: "Fuel injection", by: [-0.78, -0.72, 0.55] },
  induction: { name: "Induction and exhaust", by: [0.1, -0.92, 0] },
  oil: { name: "Lubrication", by: [0.85, -0.85, -0.65] },
  drives: { name: "Accessory drives", by: [0.68, 0.75, -0.45] },
  installation: { name: "Cooling and installation", by: [-0.65, 0.98, -0.1] },
  propeller: { name: "Propeller", by: [1.65, 0.1, -0.85] },
} satisfies Record<string, { name: string; by: Vec3 }>;

export type AssemblyId = keyof typeof stations | `cylinder-${number}`;
export interface AssemblyStation {
  id: AssemblyId;
  name: string;
  by: Vec3;
  // A cylinder and the shafts each cross multiple visibility switches in the study panel.
  groups: readonly string[];
}

export function assemblyStations(spec: EngineSpec): AssemblyStation[] {
  const cylinders = spec.geometry.cylinders.map(({ n, side }): AssemblyStation => ({
    id: `cylinder-${n}`,
    name: `Cylinder ${n} assembly`,
    by: [n <= 2 ? 0.49 : -0.49, n <= 2 ? 0.06 : 0.19, side === "R" ? 0.95 : -0.85],
    groups: ["cylinders", "rotating", "valvetrain"],
  }));
  return [
    ...cylinders,
    ...(Object.keys(stations) as (keyof typeof stations)[]).map((id) => ({
      id,
      ...stations[id],
      groups:
        id === "shafts"
          ? ["rotating", "valvetrain"]
          : id === "installation"
            ? ["cylinders", ...(spec.illustratedInstallation === "sr20" ? [] : ["installation"])]
            : [id],
    })),
  ];
}

export function assemblyAvailable(station: AssemblyStation, view: Pick<EngineView, "prop" | "hidden">) {
  return station.id === "propeller" ? view.prop : station.groups.some((group) => !view.hidden.includes(group));
}
