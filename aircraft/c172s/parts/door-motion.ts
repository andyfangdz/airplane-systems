import { registerCabinTrim } from "@/lib/cabin-trim";
/** Cabin/baggage door mechanisms; outlines from this aircraft's airframe, illustrative travel. */
import { attachDoorParts, doorHardwareMotion, registerDoorPanels } from "@/lib/doors";
import { DOORS, DOOR_SKIN, FUSE, WIN, X, Y, doorPaint, paintSkin } from "../geometry";
import { useC172 } from "../store";
import { CAT } from "./catalogue";
export const DOOR_POSE: Record<string, number> = { L: 0, R: 0, bag: 0, windowL: 0, windowR: 0 };
export const doorTarget = (key: string) =>
  Number(
    useC172.getState().s.cabin[
      key === "L"
        ? "doorL"
        : key === "R"
          ? "doorR"
          : key === "windowL"
            ? "windowL"
            : key === "windowR"
              ? "windowR"
              : "bag"
    ],
  );
registerDoorPanels(CAT, DOORS, DOOR_SKIN, ["cabin"], doorPaint, paintSkin);
const handles = attachDoorParts(CAT, "Cabin door handle", ["R", "L"]);
doorHardwareMotion(handles, (i) => !!doorTarget(i ? "L" : "R"), "y", 0.65);
attachDoorParts(CAT, "Openable door window", ["windowR", "windowL"]);
attachDoorParts(CAT, "Baggage door", ["bag"]);
doorHardwareMotion(
  attachDoorParts(CAT, "Cabin door latch linkage", ["L", "R"]),
  (i) => !!doorTarget(i ? "R" : "L"),
  "y",
  0.5,
);
attachDoorParts(CAT, "Cabin door latch bolt", ["L", "R"]).forEach((part, i) => {
  part.anim = (mesh) => {
    mesh.position.x = part.pos![0] + 0.012 * doorTarget(i ? "R" : "L");
  };
  part.note += " Bolt retraction is illustrative, not a rigging dimension.";
});
attachDoorParts(CAT, "Baggage door latch", ["bag"]);

attachDoorParts(CAT, "Door-window lower latch", ["windowL", "windowR"]).forEach((part, i) => {
  part.anim = (mesh) => {
    mesh.position.y = part.pos![1] + 0.018 * doorTarget(i ? "windowR" : "windowL");
  };
  part.note +=
    " Release lifts the latch clear of the lower frame; 18 mm travel is illustrative, not a rigging dimension.";
});

registerCabinTrim(CAT, FUSE, DOOR_SKIN, {
  aft: X(115),
  front: X(25),
  floor: Y(29.5),
  doors: DOORS,
  windows: [-1, 1].map((side) => ({ side, outline: DOOR_SKIN.outline(WIN.rearSide.map(([fs, h]) => [X(fs), Y(h)])) })),
  note: "Cabin floor and fixed interior trim cover the underfloor and door-post systems (POH Fig 7-1, cabin description). Door and rear-window apertures remain clear; trim ghosts in X-ray.",
});
