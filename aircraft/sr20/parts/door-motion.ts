/** POH 11934-005 7-26/7-33; AMM 12137-002 52-10/52-30. Illustrative attachment geometry. */
import { Vector3 } from "three";
import { attachDoorParts, doorHardwareMotion, doorPoint, registerDoorPanels } from "@/lib/doors";
import { sidePaintUV } from "@/lib/livery";
import { telescopingStrut } from "@/lib/strut";
import { DOORS, DOOR_SKIN, SK, paintSkin } from "../geometry";
import { useSR20 } from "../store";
import { CAT } from "./catalogue";
import { doorHardwarePoint } from "./doors";

export const DOOR_POSE: Record<string, number> = { L: 0, R: 0, bag: 0 };
export const doorTarget = (key: string) =>
  Number(useSR20.getState().s.lights[key === "L" ? "door" : key === "R" ? "doorR" : "bag"]);
registerDoorPanels(
  CAT,
  DOORS.map((door) => ({ ...door, edgeSeal: door.key === "bag" })),
  DOOR_SKIN,
  ["doors", "cabin"],
  (g) => sidePaintUV(g, SK).setIndex(null),
  paintSkin,
);
for (const name of [
  "Cabin door perimeter seal",
  "Cabin door armrest",
  "Interior cabin door handle",
  "Exterior cabin door handle",
  "Cabin door key lock",
  "Upper aft door latch",
  "Lower aft door latch",
  "Cabin door latch pull cable",
  "Cabin door lower latch linkage",
])
  attachDoorParts(CAT, name, ["L", "R"]);
for (const name of ["Baggage door", "Baggage door key lock"]) attachDoorParts(CAT, name, ["bag"]);
for (const name of [
  "Interior cabin door handle",
  "Exterior cabin door handle",
  "Upper aft door latch",
  "Lower aft door latch",
])
  doorHardwareMotion(
    CAT.parts.filter((p) => p.name === name),
    (i) => !!doorTarget(i ? "R" : "L"),
    "z",
    0.8,
  );
export const DOOR_STRUTS = [-1, 1].map((side, index) => {
  const door = DOORS[index],
    fixed = new Vector3(...doorHardwarePoint(1.85, 0.05, side, 0.12));
  const moving = new Vector3(...doorHardwarePoint(1.48, -0.03, side, 0.045));
  return telescopingStrut(CAT, {
    name: "Cabin door gas strut",
    note: "Gas-charged strut between the fixed forward bracket and moving door (POH 7-33; AMM 52-10 Fig 52-10-1). Barrel, rod, ball joints and travel are illustrative; attachment points remain connected throughout opening.",
    sys: ["doors", "cabin"],
    fraction: () => DOOR_POSE[door.key],
    ends: (fraction) => ({ fixed: fixed.clone(), moving: doorPoint(door, moving, fraction) }),
    replace: CAT.parts.filter((p) => p.name === "Cabin door gas strut")[index],
  });
});
