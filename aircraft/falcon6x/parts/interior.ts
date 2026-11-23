import type { Catalogue } from "@/lib/catalogue";
import { box, cyl, loft, mergeGeos } from "@/lib/geometry";
import { V, type Vec3 } from "@/lib/math";
import { FUSE } from "../geometry";
import {
  aftCloseout,
  carpetUV,
  woolCarpet,
  bulkhead,
  chairCushions,
  chairShell,
  chairTrim,
  coveMaterial,
  floorY,
  headlinerMaterial,
  oakVeneer,
  roofBand,
  softBox,
  windowWall,
} from "./cabin-interior";

// Dassault Falcon 6X Overview (June 2026), p. 12, 14-passenger plan. Furniture finish,
// seat shells, paired conference chairs and divan cushions follow the Global Jet
// LX-TIN cabin photographs (July 2025). Furniture dimensions are photographic estimates.
const leather = "#CDBFA9",
  upholstery = "#B7A791",
  oak = "#A97749",
  liner = "#DFD9CE";
const locations = [
  { id: "forward", x: 5.07 },
  { id: "rear", x: 3.32 },
] as const;

export function addInterior(cat: Catalogue) {
  const deckBounds = [-3.8, 8.5] as const;
  cat.part(
    () =>
      carpetUV(
        loft(
          Array.from({ length: 42 }, (_, i) => {
            const x = deckBounds[0] + ((deckBounds[1] - deckBounds[0]) * i) / 41;
            const h = Math.min(1.08, FUSE.onSkin(x, floorY - 0.05, 1, 0.95).z);
            return [V(x, floorY - 0.05, -h), V(x, floorY - 0.05, h), V(x, floorY, h), V(x, floorY, -h)];
          }),
        ),
      ),
    ["cabin"],
    {
      id: "cabin.deck",
      color: "#978C79",
      solidMaterial: woolCarpet,
      name: "Cabin floor",
      note: "The published cabin length is 12.30 m. The forward club leads to a four-place dining group and the aft divans.",
      pin: true,
    },
  );

  function installSeat(
    id: string,
    instance: string[],
    position: Vec3,
    yaw: number,
    width: number,
    pin: boolean,
    isClub: boolean,
  ) {
    const placement = { pos: position, rot: [0, yaw, 0] as Vec3, scale: [1, 1, width] as Vec3 };
    const name = isClub ? "Passenger seating" : "Conference seating";
    cat.part(chairCushions, ["cabin"], {
      ...placement,
      id,
      instance,
      color: leather,
      name,
      pin,
      note: isClub
        ? "Four individual club chairs form facing pairs on opposite sides of the forward aisle."
        : "Two pairs of narrower seats face each other across the dining table on the port side.",
    });
    cat.part(chairShell, ["cabin"], {
      ...placement,
      id: "cabin.seat-shell",
      instance: [id, ...instance],
      color: upholstery,
      name,
    });
    cat.part(chairTrim, ["cabin"], {
      ...placement,
      id: "cabin.seat-trim",
      instance: [id, ...instance],
      color: "#514741",
      name,
    });
  }

  for (const [side, z] of [
    ["left", -0.71],
    ["right", 0.71],
  ] as const) {
    for (const [i, row] of locations.entries()) {
      installSeat(
        "cabin.club-seat",
        ["forward", row.id, side],
        [row.x, floorY, z],
        i === 0 ? Math.PI : 0,
        1,
        true,
        true,
      );
    }
    cat.part(() => softBox(0.57, 0.046, 0.55, 0.045), ["cabin"], {
      id: "cabin.club-table",
      instance: side,
      pos: [4.19, floorY + 0.68, Math.sign(z) * 0.88],
      color: oak,
      solidMaterial: oakVeneer,
      name: "Club tables",
      note: "Each forward facing pair shares a table at the window-side ledge.",
      pin: true,
    });
  }

  for (const [row, x, yaw] of [
    ["forward", 2.27, Math.PI],
    ["rear", 0.4, 0],
  ] as const) {
    for (const [column, z] of [
      ["window", -0.89],
      ["aisle", -0.31],
    ] as const) {
      installSeat("cabin.conference-seat", [row, column], [x, floorY, z], yaw, 0.77, column === "aisle", false);
    }
  }
  cat.part(() => softBox(1.04, 0.052, 1.16, 0.07), ["cabin"], {
    id: "cabin.conference-table",
    pos: [1.34, floorY + 0.7, -0.61],
    color: oak,
    solidMaterial: oakVeneer,
    name: "Conference table",
    note: "The four-place table is offset to port. The aisle continues between the dining group and the starboard credenza.",
    pin: true,
  });
  cat.part(() => mergeGeos([-0.28, 0.51].map((z) => cyl(0.038, 0.655).translate(0, 0.327, z))), ["cabin"], {
    id: "cabin.conference-pedestals",
    pos: [1.34, floorY, -0.72],
    color: "#ACA8A0",
    name: "Conference table",
  });
  cat.part(() => softBox(2.48, 0.68, 0.43, 0.055), ["cabin"], {
    id: "cabin.credenza",
    pos: [1.36, floorY + 0.37, 0.942],
    color: oak,
    solidMaterial: oakVeneer,
    name: "Cabin credenza",
    note: "The starboard storage cabinet faces the conference group and leaves the aisle open.",
    pin: true,
  });
  cat.part(() => softBox(2.54, 0.045, 0.475, 0.025), ["cabin"], {
    id: "cabin.credenza-top",
    pos: [1.36, floorY + 0.718, 0.95],
    color: "#B39472",
    name: "Cabin credenza",
  });
  cat.part(
    () => mergeGeos([-0.8, 0, 0.8].map((x) => softBox(0.15, 0.016, 0.014, 0.005).translate(x, 0.53, -0.22))),
    ["cabin"],
    {
      id: "cabin.credenza-pulls",
      pos: [1.36, floorY, 0.942],
      color: "#49443A",
      name: "Cabin credenza",
    },
  );

  for (const [side, sign] of [
    ["port", -1],
    ["starboard", 1],
  ] as const) {
    const position: Vec3 = [-1.37, floorY, 0.79 * sign];
    const name = "Aft divans";
    cat.part(
      () =>
        mergeGeos([
          softBox(2.23, 0.31, 0.61, 0.08).translate(0, 0.19, 0),
          ...[-0.72, 0, 0.72].flatMap((x) => [
            softBox(0.708, 0.16, 0.64, 0.067).translate(x, 0.4, 0),
            softBox(0.709, 0.52, 0.16, 0.064)
              .rotateX(-sign * 0.15)
              .translate(x, 0.68, sign * 0.257),
          ]),
          ...[-1, 1].map((direction) =>
            softBox(0.1, 0.31, 0.58, 0.048).translate(direction * 1.107, 0.49, -sign * 0.012),
          ),
        ]),
      ["cabin"],
      {
        id: "cabin.aft-divan",
        instance: side,
        pos: position,
        color: leather,
        name,
        pin: true,
        note: "Two facing three-place divans provide the six aft lounge seats in this 14-passenger layout.",
      },
    );
    for (const [end, x, tone] of [
      ["fore", 0.85, "#B86437"],
      ["aft", -0.75, "#BC904E"],
    ] as const) {
      cat.part(
        () =>
          softBox(0.32, 0.31, 0.11, 0.055)
            .rotateZ(end === "fore" ? 0.12 : -0.1)
            .rotateX(-sign * 0.23),
        ["cabin"],
        {
          id: "cabin.divan-pillow",
          instance: [side, end],
          pos: [position[0] + x, floorY + 0.66, sign * 0.867],
          color: tone,
          name,
        },
      );
    }
  }

  for (const [side, sign] of [
    ["port", -1],
    ["starboard", 1],
  ] as const) {
    // These liners have inward-facing surfaces. They remain open to the outside observer in X-ray.
    cat.part(() => windowWall(sign), ["cabin"], {
      id: "cabin.window-liner",
      instance: side,
      color: liner,
      name: "Recessed window surrounds",
      note: "Each oval window sits inside a sculpted reveal above the continuous side ledge.",
      pin: true,
    });
    cat.part(
      () =>
        mergeGeos([
          roofBand(sign > 0 ? -0.67 : Math.PI + 0.155, sign > 0 ? -0.155 : Math.PI + 0.67, 0.933),
          roofBand(sign > 0 ? -0.155 : Math.PI - 0.665, sign > 0 ? 0.665 : Math.PI + 0.155, 0.933, -1.716, -2.65),
        ]),
      ["cabin"],
      { id: "cabin.lower-wall", instance: side, color: "#C4B9A7" },
    );

    cat.part(() => softBox(8.37, 0.055, 0.17, 0.025), ["cabin"], {
      id: "cabin.window-ledge",
      instance: side,
      pos: [2.48, -0.045, sign * 1.18],
      color: oak,
      solidMaterial: oakVeneer,
      name: "Window ledges",
    });
  }
  cat.part(() => roofBand(0.665, Math.PI - 0.665, 0.933), ["cabin"], {
    id: "cabin.headliner",
    color: liner,
    name: "Cabin headliner",
    note: "The arched headliner follows the roof above the three passenger zones.",
  });
  cat.part(
    () =>
      mergeGeos(
        Array.from({ length: 7 }, (_, i) => {
          const aft = -2.641 + 1.306 * i;
          return roofBand(1.047, Math.PI - 1.047, 0.915, aft + 1.295, aft);
        }),
      ),
    ["cabin"],
    {
      id: "cabin.center-ceiling-panels",
      color: liner,
      solidMaterial: headlinerMaterial,
      name: "Cabin headliner",
    },
  );
  for (const [side, sign] of [
    ["port", -1],
    ["starboard", 1],
  ] as const) {
    const angle = sign > 0 ? 0.91 : Math.PI - 0.91;
    cat.part(() => roofBand(angle - 0.023, angle + 0.023, 0.925), ["cabin"], {
      id: "cabin.ceiling-light-strip",
      instance: side,
      color: "#FFECCD",
      solidMaterial: coveMaterial,
      name: "Indirect cabin lighting",
    });
    cat.part(
      () =>
        mergeGeos(
          Array.from({ length: 10 }, (_, i) => {
            const x = -2.22 + i * 0.865;
            const lamp = FUSE.ring(x, 0.916, 1, angle, angle, false)[0];
            return cyl(0.027, 0.008, "y", 16)
              .rotateX(sign * 0.62)
              .translate(lamp.x, lamp.y, lamp.z);
          }),
        ),
      ["cabin"],
      { id: "cabin.reading-lights", instance: side, color: "#A3937B", name: "Cabin lighting" },
    );
    for (const [zone, x, height] of [
      ["forward", 5.69, 0.99],
      ["lounge", -0.125, 0.41],
      ["aft", -2.63, 1.055],
    ] as const) {
      cat.part(() => bulkhead(x, sign, height), ["cabin"], {
        id: "cabin.partition",
        instance: [zone, side],
        color: oak,
        solidMaterial: oakVeneer,
        name: "Cabin partitions",
      });
    }
  }

  // At the aft lavatory, the landing ends at a closed door and a continuous arched bulkhead.
  cat.part(aftCloseout, ["cabin"], {
    id: "cabin.aft-closeout",
    color: oak,
    solidMaterial: oakVeneer,
    name: "Aft lavatory bulkhead",
    note: "The rear lounge ends at the enclosed aft lavatory shown in the operator’s floor plan.",
  });
  cat.part(() => softBox(0.041, 1.79, 0.655, 0.018), ["cabin"], {
    id: "cabin.lavatory-door",
    pos: [-2.614, floorY + 0.915, 0],
    color: "#998875",
    name: "Aft lavatory door",
  });
  cat.part(() => softBox(0.025, 0.09, 0.025, 0.008), ["cabin"], {
    id: "cabin.lavatory-latch",
    pos: [-2.58, floorY + 0.99, -0.263],
    color: "#66625B",
    name: "Aft lavatory door",
  });
  for (const [side, sign] of [
    ["port", -1],
    ["starboard", 1],
  ] as const) {
    cat.part(() => softBox(0.14, 0.049, 0.54, 0.019), ["cabin"], {
      id: "cabin.folded-throw",
      instance: side,
      pos: [3.5, floorY + 0.466, sign * 0.71],
      color: "#B57248",
      name: "Passenger seating",
    });
    cat.part(() => softBox(0.13, 0.115, 0.057, 0.016), ["cabin"], {
      id: "cabin.throw-edge",
      instance: side,
      pos: [3.5, floorY + 0.41, sign * 0.966],
      color: "#A96644",
      name: "Passenger seating",
    });
  }

  // Cabinetry stays on the starboard side of the vestibule; the port door opens into a clear landing.
  cat.part(() => softBox(1.77, 0.83, 0.52, 0.04), ["cabin"], {
    id: "cabin.galley-base",
    pos: [6.73, floorY + 0.43, 0.83],
    color: oak,
    solidMaterial: oakVeneer,
    name: "Forward galley",
    pin: true,
    note: "The galley opens onto the entry vestibule beneath the skylight.",
  });
  cat.part(() => softBox(1.81, 0.044, 0.59, 0.017), ["cabin"], {
    id: "cabin.galley-counter",
    pos: [6.73, floorY + 0.868, 0.84],
    color: "#D3CABE",
    name: "Forward galley",
  });
  cat.part(() => mergeGeos([-0.46, 0, 0.46].map((x) => box(0.39, 0.19, 0.012).translate(x, 0.51, 0))), ["cabin"], {
    id: "cabin.galley-drawers",
    pos: [6.73, floorY, 0.565],
    color: "#AC8059",
    name: "Forward galley",
  });
  cat.part(() => softBox(0.49, 0.28, 0.5, 0.025), ["cabin"], {
    id: "cabin.galley-oven",
    pos: [6.08, floorY + 1.02, 0.84],
    color: "#47443F",
    name: "Galley appliance bay",
  });
}
