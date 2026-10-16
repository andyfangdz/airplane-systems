/** The `flow(...)` helper the SR22T flow sections share: each section collects its own list, in registration order. */
import type { FlowSpec } from "@/lib/catalogue";
import type { Vec3 } from "@/lib/math";
import type { SysId } from "@/lib/systems";
import { checkEngineGroups } from "./engine-groups";

/** A section's flow list and the `flow` call that checks its Engine-view groups and appends to it. */
export function flowList() {
  const F: FlowSpec[] = [];
  const flow = (key: string, pts: FlowSpec["pts"], sys: SysId[], o: Partial<FlowSpec> = {}) => {
    checkEngineGroups("flow " + key, o.groups);
    return F.push({ key, pts, sys, ...o });
  };
  return { F, flow };
}

/** `p` moved by `d`. */
export const off = (p: Vec3, d: Vec3): Vec3 => [p[0] + d[0], p[1] + d[1], p[2] + d[2]];
