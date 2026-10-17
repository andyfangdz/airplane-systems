/** Narrow preflight surfaces, shown only while their inspected region is selected. */
import { useView } from "@/lib/view";
import { cutCowlInlets } from "@/lib/cowl";
import { COWL_INLETS } from "../../cowl-inlets";
import { FUSE, X, Z, loft, sided, wingSec } from "../geometry";
import { part } from "./catalogue";
const only = (name: string, side: number) => (mesh: { visible: boolean }) => {
  const spot = useView.getState().spot;
  mesh.visible = !!spot?.names.includes(name) && (!spot.side || spot.side === side);
};
for (const side of [-1, 1]) {
  part(
    () =>
      loft(
        sided(
          [208, 210, 212, 213].map((bl) => wingSec(side * Z(bl), 0, 1, 1.005)),
          side,
        ),
      ),
    ["airframe"],
    {
      id: "parts.walk-inspection.wing-tip.001",
      instance: [side],
      name: "Wing tip",
      ext: true,
      fairing: true,
      anim: only("Wing tip", side),
      note: "Inspect wingtip condition and tip position/strobe lights (POH 182TPHAUS-04 Rev 4 Section 4). Narrow overlay follows existing tip skin; boundaries and 0.5% offset are display choices.",
    },
  );
  part(
    () =>
      loft(
        sided(
          [24, 45, 75, 100, 125, 160, 190, 208].map((bl) => wingSec(side * Z(bl), 0, 0.035, 1.005)),
          side,
        ),
      ),
    ["airframe"],
    {
      id: "parts.walk-inspection.wing-leading-edge.002",
      instance: [side],
      name: "Wing leading edge",
      ext: true,
      fairing: true,
      anim: only("Wing leading edge", side),
      note: "Preflight wing/leading-edge condition (POH Section 4). This narrow 3.5%-chord overlay avoids selecting the entire wing; it does not imply undocumented stall strips.",
    },
  );
  part(
    () => {
      const arc = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      const patch = loft(
        Array.from({ length: 25 }, (_, i) =>
          FUSE.ring(FUSE.xNose - ((FUSE.xNose - X(0)) * i) / 24, 1.006, 24, arc, arc + Math.PI, false).reverse(),
        ),
        { closed: false, caps: false },
      );
      return cutCowlInlets(patch, COWL_INLETS.c182t);
    },
    ["airframe"],
    {
      id: "parts.walk-inspection.cowling-inspection-region.003",
      instance: [side],
      name: "Cowling inspection region",
      ext: true,
      fairing: true,
      anim: only("Cowling inspection region", side),
      note: "Cowl attachment security/condition on nose preflight (POH Section 4; MM 71-10-00). Sided overlay includes only cowling ahead of firewall and preserves inlet apertures; 0.6% offset is a display choice.",
    },
  );
}
