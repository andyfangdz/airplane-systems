/** Narrow study inspection overlays. 1968 OM scan35–36; original skin remains the ordinary-view geometry. */
import { sided } from "@/lib/geometry";
import { useView } from "@/lib/view";
import { FUSE, FW, loft, wingSec } from "../geometry";
import { part } from "./catalogue";
const only = (name: string, side: number) => (mesh: { visible: boolean }) => {
  const spot = useView.getState().spot;
  mesh.visible = !!spot?.names.includes(name) && (!spot.side || spot.side === side);
};
for (const side of [-1, 1]) {
  for (const [name, spans, start, end] of [
    ["Wing tip", [5.12, 5.18, 5.24, 5.3, 5.33], 0, 1],
    ["Wing leading edge", [0.62, 1, 1.6, 2.3, 3, 3.7, 4.4, 5.05], 0, 0.035],
  ] as const)
    part(
      () =>
        loft(
          sided(
            spans.map((z) => wingSec(side * z, start, end, 1.006)),
            side,
          ),
        ),
      ["airframe"],
      {
        name,
        ext: true,
        fairing: true,
        anim: only(name, side),
        note: "1968OM scan35–36 requires wing tip/navigation-light and leading-edge checks. This spotlight-only region follows the existing skin; its inspection boundary and small offset are display choices, not measured aircraft dimensions.",
      },
    );
  part(
    () =>
      loft(
        Array.from({ length: 25 }, (_, i) => {
          const x = FUSE.xNose - ((FUSE.xNose - FW) * i) / 24,
            a = side > 0 ? -Math.PI / 2 : Math.PI / 2;
          return FUSE.ring(x, 1.005, 24, a, a + Math.PI, false).reverse();
        }),
        { closed: false, caps: false },
      ),
    ["airframe", "engine"],
    {
      name: "Cowling inspection region",
      ext: true,
      fairing: true,
      anim: only("Cowling inspection region", side),
      note: "1968OM scan35–36: secure the inspected side's cowl fasteners. Narrow forward-of-firewall skin overlay; no complete fuselage highlight. Schematic cowling has no calibrated inlet cutouts. It does not depict individual fastener positions.",
    },
  );
}
