/** Thin physical inspection patches preserve precise walk-around highlights. */
import { useView } from "@/lib/view";
import { sided } from "@/lib/geometry";
import { type Vec3 } from "@/lib/math";
import { FW, WJ, AIL, box, cyl, fRing, fs, loft, onSkin, wingSec } from "../geometry";
import { part } from "./catalogue";
const only =
  (name: string, side = 0) =>
  (m: { visible: boolean }) => {
    const spot = useView.getState().spot;
    m.visible = !!spot?.names.includes(name) && (!side || !spot.side || spot.side === side);
  };
for (const side of [-1, 1])
  part(
    () =>
      loft(
        sided(
          [WJ, 1.6, 2.6, 3.4, 4.4, AIL.z1].map((z) => wingSec(side * z, 0, 0.085, 0.997)),
          side,
        ),
      ),
    ["airframe"],
    {
      id: "parts.walk-inspection.wing-leading-edge.001",
      instance: [side],
      name: "Wing leading edge",
      ext: true,
      fairing: true,
      anim: only("Wing leading edge", side),
      pos: [0, 0, 0],
      note: "Narrow leading-edge inspection region for cleanliness and damage, separate from the whole-wing surface check (AFM 4A-7/4A-8).",
    },
  );
part(() => loft([FW, FW + 0.12, fs(0.9), fs(0.6), fs(0.46)].map((x) => fRing(x))), ["airframe", "engine"], {
  id: "parts.walk-inspection.cowling-inspection-region.002",
  name: "Cowling inspection region",
  ext: true,
  anim: only("Cowling inspection region"),
  note: "Cowling inspection surface, separate from the fuselage/cabin skin (AFM 4A-9/4A-10).",
  fairing: true,
});
// Dipstick location is schematic inside the upper engine cowl; the AFM/AMM establishes the filler and access door.
const filler: Vec3 = [fs(1.17), 0.1, -0.16];
part(() => cyl(0.015, 0.14), ["engine"], {
  id: "parts.walk-inspection.oil-dipstick-filler.003",
  name: "Oil dipstick / filler",
  pos: filler,
  note: "Oil filler neck and dipstick through the cowling access door: check 4–8 qt, IFR minimum 6 qt (AFM 2-5,4A-9; Lycoming IPC 72-50 pp 32–33). Neck station schematic.",
  pin: true,
});
part(() => box(0.055, 0.008, 0.065), ["engine", "airframe"], {
  id: "parts.walk-inspection.oil-access-door.004",
  name: "Oil-access door",
  pos: (() => {
    const v = onSkin(fs(1.17), 0.2, -1, 1.002);
    return [v.x, v.y, v.z] as Vec3;
  })(),
  ext: true,
  note: "Upper cowling access to oil filler/dipstick; check closed after oil inspection (AFM 4A-9). Position and outline schematic.",
});
