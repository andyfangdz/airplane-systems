import { registerCabinTrim } from "@/lib/cabin-trim";
/** Original 1968 OM p. 15; MAN205 Fig 15 (1968–1975 cabin) and Fig 16 (baggage). */
import { attachDoorParts, doorHardwareMotion, registerDoorPanels } from "@/lib/doors";
import { DOORS, DOOR_SKIN, FUSE, WIN, doorPaint, paintSkin, box, cyl, onSkin, tubeGeo } from "../geometry";
import { useM20C } from "../store";
import { CAT } from "./catalogue";
export const DOOR_POSE: Record<string, number> = { cabin: 0, baggage: 0 };
export const doorTarget = (key: string) => Number(!useM20C.getState().s.doors[key === "cabin" ? "cabin" : "baggage"]);
registerDoorPanels(CAT, DOORS, DOOR_SKIN, ["cabin"], doorPaint, paintSkin);
doorHardwareMotion(attachDoorParts(CAT, "Cabin door handle", ["cabin"]), () => !!doorTarget("cabin"), "z", 0.8);
doorHardwareMotion(attachDoorParts(CAT, "Baggage door", ["baggage"]), () => !!doorTarget("baggage"), "z", 0.8);
const seat = (x: number, y: number) => {
  const p = onSkin(x, y, 1, 1);
  p.z -= 0.022;
  return p.toArray() as [number, number, number];
};
CAT.part(() => tubeGeo([seat(1.1, -0.12), seat(0.98, -0.17), seat(0.88, -0.12)], 0.008, 0.3), ["cabin"], {
  name: "Cabin door pull strap",
  parent: "door:cabin",
  color: "#574A3D",
  pin: true,
  note: "Use the pull strap to close the door before rotating the handle forward; do not slam (1968 OM p. 15). Strap routing and size illustrative.",
});
for (const door of DOORS) {
  CAT.part(
    () =>
      tubeGeo(
        [
          door.pivot.toArray(),
          door.pivot
            .clone()
            .addScaledVector(door.axis, door.key === "cabin" ? 0.52 : 0.3)
            .toArray(),
        ] as [number, number, number][],
        0.006,
        0,
      ),
    ["cabin"],
    {
      name: `${door.name} hinge pin`,
      color: "#A8B0B6",
      ext: true,
      note: "Hinge halves and pin (MAN205 Figs 15–16); location and visible length illustrative.",
    },
  );
}
for (const sign of [-1, 1]) {
  const pos = seat(-0.06 + sign * 0.11, -0.11);
  CAT.part(() => cyl(0.006, 0.04, "x", 12), ["cabin"], {
    name: "Baggage door locking pin",
    parent: "door:baggage",
    pos,
    color: "#D0D7DC",
    pin: sign < 0,
    anim: (m) => {
      m.position.x = pos[0] - sign * 0.014 * doorTarget("baggage");
    },
    note: "Two lock pins, guides and handle-driven latch arms (MAN205 Fig 16 items 5, 10–17). Retraction illustrates operation; dimensions and travel schematic.",
  });
}
CAT.part(() => box(0.035, 0.03, 0.018), ["cabin"], {
  name: "Cabin door latch",
  parent: "door:cabin",
  pos: seat(0.76, -0.07),
  color: "#A8B0B6",
  pin: true,
  anim: (m) => {
    m.rotation.z = doorTarget("cabin") * 0.7;
  },
  note: "Handle-operated cabin latch (1968 OM p. 15; MAN205 Fig 15, 1968–1975 installation). Shape, placement and latch rotation illustrative.",
});

registerCabinTrim(CAT, FUSE, DOOR_SKIN, {
  aft: -0.5,
  front: 1.56,
  doors: DOORS,
  windows: [
    { side: -1, outline: DOOR_SKIN.outline(WIN.front) },
    ...[-1, 1].map((side) => ({ side, outline: DOOR_SKIN.outline(WIN.rear) })),
  ],
  note: "Fixed cabin lining surrounds the single cabin door and baggage opening (1968 OM p. 15; MAN205 Figs 15–16). The existing shaped floor retains the Johnson-bar recess.",
});
