/** Cabin/baggage door mechanisms; outlines from this aircraft's airframe, illustrative travel. */
import { attachDoorParts, doorHardwareMotion, registerDoorPanels } from "@/lib/doors";
import { DOORS, DOOR_SKIN, doorPaint, paintSkin } from "../geometry";
import { useC182 } from "../store";
import { CAT } from "./catalogue";
export const DOOR_POSE: Record<string, number> = { L: 0, R: 0, bag: 0, windowL: 0, windowR: 0 };
export const doorTarget = (key: string) =>
  Number(
    useC182.getState().s.cabin[
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
