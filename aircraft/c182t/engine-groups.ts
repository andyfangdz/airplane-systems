/** Presentation-only subsystem filters for the naturally aspirated IO540. */
import type { FlowSpec, PartSpec } from "@/lib/catalogue";
import type { EngineGroup, ShownGroups } from "@/lib/engine-groups";
export { ENGINE_GROUPS, allGroups, type EngineGroup, type ShownGroups } from "@/lib/engine-groups";
export function engineGroupsOf(p: PartSpec | FlowSpec): readonly EngineGroup[] {
  if (p.groups) return p.groups as readonly EngineGroup[];
  if (p.sys.includes("fuel")) return ["fuel"];
  if (p.sys.includes("avionics")) return ["sensors"];
  if (p.sys.includes("environment")) return ["exhaust"];
  const n = p.name ?? "";
  if (/magneto|spark plug|ignition/i.test(n)) return ["ignition"];
  if (/oil |oil-|lubrication/i.test(n)) return ["oil"];
  if (/induction|intake|alternate air/i.test(n)) return ["induction"];
  if (/exhaust|muffler|tailpipe/i.test(n)) return ["exhaust"];
  if (/sensor|transducer|temperature|tach/i.test(n)) return ["sensors"];
  return [];
}
export const engineHidden = (p: PartSpec | FlowSpec, sys: string, shown: ShownGroups) =>
  sys === "engine" &&
  p.sys.includes("engine") &&
  engineGroupsOf(p).length > 0 &&
  !engineGroupsOf(p).some((g) => shown[g]);
