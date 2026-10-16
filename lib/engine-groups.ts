/**
 * Engine-view study groups shared by the airplanes that split their engine into toggleable groups (SR20, SR22T, C172S,
 * C182T). Presentation only: a group hides parts and flows in the Engine view, never changes system operation. Each
 * airplane's `engine-groups.ts` decides which group an untagged item falls into, and its `engine-group-store.ts` makes its
 * own toggles with `createEngineGroupStore` (`lib/engine-group-store.ts`), so they survive switching airplanes.
 */

export const ENGINE_GROUPS = ["ignition", "induction", "exhaust", "fuel", "oil", "sensors"] as const;
export type EngineGroup = (typeof ENGINE_GROUPS)[number];
export type ShownGroups = Record<EngineGroup, boolean>;
declare module "@/lib/catalogue" {
  // Each engine group id is a valid `groups` tag on part() / flow(); nothing else type-checks.
  interface StudyGroups extends Record<EngineGroup, true> {}
}

/** Every group shown (or, with `on` false, hidden). */
export const allGroups = (on = true): ShownGroups =>
  Object.fromEntries(ENGINE_GROUPS.map((group) => [group, on])) as ShownGroups;
