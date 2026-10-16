/** Local presentation filters: never alter engine/system operation. */
import type { FlowSpec, PartSpec } from "@/lib/catalogue";
import type { EngineGroup, ShownGroups } from "@/lib/engine-groups";
export { ENGINE_GROUPS, allGroups, type EngineGroup, type ShownGroups } from "@/lib/engine-groups";
export function engineGroupsOf(s: PartSpec | FlowSpec): readonly EngineGroup[] {
  if (s.groups) return s.groups as readonly EngineGroup[];
  const n = ((s.name ?? "") + " " + ("key" in s ? s.key : "")).toLowerCase();
  if (/sensor|transducer|probe|signal|gea|tach|temperature/.test(n)) return ["sensors"];
  if (/oil|breather|gallery|pushrod|rocker|valve spring/.test(n)) return ["oil"];
  if (/magneto|spark|ignition|p-lead|plead|starter|ring gear/.test(n)) return ["ignition"];
  if (/induction|intake|alternate.air|throttle butterfly|man[1-4]/.test(n)) return ["induction"];
  if (/muffler|exhaust|tailpipe|heater shroud|exh[1-4]/.test(n)) return ["exhaust"];
  if (s.sys.includes("fuel") || /mixture/.test(n)) return ["fuel"];
  return [];
}
export function engineHidden(s: PartSpec | FlowSpec, sys: string, shown: ShownGroups) {
  if (sys !== "engine" || !s.sys.includes("engine")) return false;
  const g = engineGroupsOf(s);
  return g.length > 0 && !g.some((k) => shown[k]);
}
