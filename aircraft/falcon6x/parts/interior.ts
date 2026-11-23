import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { box, loft, mergeGeos } from "@/lib/geometry";
import { V } from "@/lib/math";
import { FUSE } from "../geometry";
import type { Catalogue } from "@/lib/catalogue";

export function addInterior(cat: Catalogue) {
  // Dassault lists the cabin at 12.30 × 2.58 × 1.98 m. Its furnishings vary by completion.
  // All furniture coordinates and the twelve-seat club arrangement are illustrative.
  const floorY = -0.74;
  const floorCenter = 1.05;
  cat.part(
    () =>
      loft(
        Array.from({ length: 42 }, (_, i) => {
          const x = -6.15 + 0.3 * i;
          // Keep the edge inside the upswept rear shell at the underside of the floor.
          const halfWidth = Math.min(1.04, FUSE.onSkin(x + floorCenter, floorY - 0.05, 1, 0.975).z);
          return [V(x, -0.025, -halfWidth), V(x, -0.025, halfWidth), V(x, 0.025, halfWidth), V(x, 0.025, -halfWidth)];
        }),
      ),
    ["cabin"],
    {
      id: "cabin.deck",
      pos: [floorCenter, floorY - 0.025, 0],
      color: "#8B7B69",
      name: "Cabin floor",
      note: "Dassault publishes a 12.30 m cabin length and 1.98 m of headroom. The aisle runs through the center of this example interior.",
      pin: true,
    },
  );

  function seat() {
    return mergeGeos([
      new RoundedBoxGeometry(0.44, 0.34, 0.39, 1, 0.05).translate(0, 0.17, 0),
      new RoundedBoxGeometry(0.64, 0.15, 0.58, 1, 0.07).translate(0, 0.4, 0),
      new RoundedBoxGeometry(0.16, 0.67, 0.57, 1, 0.07).rotateZ(0.13).translate(-0.27, 0.74, 0),
      new RoundedBoxGeometry(0.14, 0.19, 0.36, 1, 0.06).translate(-0.32, 1.11, 0),
      ...[-1, 1].map((side) => new RoundedBoxGeometry(0.48, 0.12, 0.09, 1, 0.04).translate(0, 0.58, 0.32 * side)),
    ]);
  }

  for (const [zone, center] of [
    ["forward", 4.1],
    ["middle", 1.0],
    ["aft", -2.1],
  ] as const) {
    for (const [row, dx, yaw] of [
      ["fore", 0.95, Math.PI],
      ["aft", -0.95, 0],
    ] as const) {
      for (const [side, z] of [
        ["left", -0.74],
        ["right", 0.74],
      ] as const) {
        cat.part(seat, ["cabin"], {
          id: "cabin.club-seat",
          instance: [zone, row, side],
          pos: [center + dx, floorY, z],
          rot: [0, yaw, 0],
          color: "#C4AD8F",
          name: "Passenger seating",
          note: "The Falcon 6X can accommodate up to 16 passengers. This example places facing pairs of club seats along a central aisle.",
          pin: true,
        });
      }
    }
  }

  for (const [pilot, z] of [
    ["left", -0.53],
    ["right", 0.53],
  ] as const) {
    cat.part(seat, ["avionics"], {
      id: "flight-deck.crew-seat",
      instance: pilot,
      pos: [7.87, floorY, z],
      scale: [0.83, 0.92, 0.87],
      color: "#807970",
      name: "Pilot seat",
      note: "Each pilot faces an outboard primary display and can see the two shared displays in the center.",
    });
  }

  cat.part(() => box(0.21, 0.64, 1.73), ["avionics"], {
    id: "flight-deck.instrument-panel",
    pos: [8.99, 0.04, 0],
    color: "#384048",
    name: "EASy IV instrument panel",
    note: "The EASy IV flight deck uses Honeywell Primus Epic avionics. Four displays are arranged in a T with the shared displays stacked in the center.",
    pin: true,
  });

  cat.part(() => box(1.05, 0.47, 0.37), ["avionics"], {
    id: "flight-deck.pedestal",
    pos: [8.36, floorY + 0.235, 0],
    name: "Center pedestal",
    color: "#484B4D",
  });

  // A stroke is a polyline on a display face in meters (horizontal, vertical).
  // Merge each graphic into one mesh so it remains visible with the system study materials.
  type Stroke = [number, number][];
  function linework(paths: Stroke[], width: number) {
    return mergeGeos(
      paths.flatMap((path) =>
        path.slice(1).map(([u, v], i) => {
          const [lastU, lastV] = path[i];
          const du = u - lastU,
            dv = v - lastV;
          return box(0.001, width, Math.hypot(du, dv) + width * 0.4)
            .rotateX(-Math.atan2(dv, du))
            .translate(0, (v + lastV) / 2, (u + lastU) / 2);
        }),
      ),
    );
  }

  function attitudeLines(): Stroke[] {
    const paths: Stroke[] = [
      [
        [-0.11, 0],
        [0.11, 0],
      ],
      [
        [-0.052, 0.004],
        [-0.027, 0.004],
        [-0.018, -0.008],
        [0, 0.004],
        [0.018, -0.008],
        [0.027, 0.004],
        [0.052, 0.004],
      ],
      [
        [-0.007, 0.095],
        [0, 0.104],
        [0.007, 0.095],
        [-0.007, 0.095],
      ],
    ];
    for (const sign of [-1, 1]) {
      for (let row = 1; row <= 3; row++) {
        const span = row % 2 === 0 ? 0.035 : 0.018;
        paths.push([
          [-span, sign * row * 0.021],
          [span, sign * row * 0.021],
        ]);
      }
      // Scale rails and unnumbered graduations flank the attitude reference.
      paths.push([
        [sign * 0.124, -0.096],
        [sign * 0.124, 0.096],
      ]);
      for (let tick = -4; tick <= 4; tick++) {
        const end = tick % 2 === 0 ? 0.148 : 0.138;
        paths.push([
          [sign * 0.124, tick * 0.021],
          [sign * end, tick * 0.021],
        ]);
      }
    }
    return paths;
  }

  const mapContours: Stroke[] = [
    [
      [-0.163, 0.045],
      [-0.131, 0.048],
      [-0.105, 0.035],
      [-0.083, 0.049],
      [-0.071, 0.082],
      [-0.042, 0.11],
    ],
    [
      [-0.16, -0.032],
      [-0.124, -0.019],
      [-0.098, -0.035],
      [-0.076, -0.022],
      [-0.054, 0.01],
      [-0.022, 0.019],
      [0.009, 0.052],
      [0.038, 0.054],
      [0.064, 0.099],
    ],
    [
      [0.023, -0.112],
      [0.034, -0.079],
      [0.075, -0.062],
      [0.092, -0.024],
      [0.134, -0.011],
      [0.162, 0.015],
    ],
    [
      [0.079, -0.112],
      [0.093, -0.09],
      [0.135, -0.072],
      [0.163, -0.028],
    ],
  ];

  const route: Stroke = [
    [-0.121, -0.092],
    [-0.071, -0.033],
    [0.039, 0.018],
    [0.116, 0.093],
  ];
  const routeGraphic: Stroke[] = [
    route,
    ...route.map(([u, v]): Stroke => [
      [u, v + 0.008],
      [u + 0.008, v],
      [u, v - 0.008],
      [u - 0.008, v],
      [u, v + 0.008],
    ]),
  ];

  function systemDiagram(): Stroke[] {
    const paths: Stroke[] = [];
    for (const side of [-1, 1]) {
      // Two branches joined to a shared bus, a generic systems-page illustration.
      for (const [u, v, w, h] of [
        [0.103, 0.081, 0.036, 0.019],
        [0.103, -0.073, 0.032, 0.016],
        [0.035, -0.073, 0.024, 0.016],
      ]) {
        paths.push([
          [side * (u - w), v - h],
          [side * (u + w), v - h],
          [side * (u + w), v + h],
          [side * (u - w), v + h],
          [side * (u - w), v - h],
        ]);
      }
      paths.push([
        [side * 0.103, 0.062],
        [side * 0.103, -0.057],
      ]);
      paths.push([
        [side * 0.103, 0.007],
        [side * 0.035, 0.007],
        [side * 0.035, -0.057],
      ]);
    }
    paths.push([
      [-0.103, 0.035],
      [0.103, 0.035],
    ]);
    return paths;
  }

  // Dassault, EASy Flight Deck: a primary display at each pilot station and two central
  // multifunction displays, one above the other. Display faces are simplified study markers.
  for (const [unit, y, z, primary] of [
    ["left", 0.18, -0.46, true],
    ["upper-center", 0.18, 0, false],
    ["right", 0.18, 0.46, true],
    ["lower-center", -0.12, 0, false],
  ] as const) {
    cat.part(() => box(0.034, 0.274, 0.368), ["avionics"], {
      id: "flight-deck.display-bezel",
      instance: unit,
      pos: [8.87, y, z],
      color: "#202B33",
    });
    cat.part(() => box(0.008, 0.246, 0.34), ["avionics"], {
      id: "flight-deck.display",
      instance: unit,
      pos: [8.85, y, z],
      color: primary ? "#5885A9" : "#45675F",
      name: primary ? "Primary display unit" : "Multifunction display unit",
      note: primary
        ? "Each pilot has a primary display directly ahead for flight information."
        : "The two central multifunction displays give both pilots a shared view of navigation, flight management and aircraft systems.",
      pin: true,
    });
    if (primary) {
      cat.part(() => box(0.004, 0.12, 0.338), ["avionics"], {
        id: "flight-deck.attitude-ground",
        instance: unit,
        pos: [8.844, y - 0.061, z],
        color: "#886C51",
        name: "Primary display unit",
        note: "The colored horizon marks the primary flight display in this schematic.",
      });
      cat.part(() => linework(attitudeLines(), 0.0028), ["avionics"], {
        id: "flight-deck.attitude-reference",
        instance: unit,
        pos: [8.84, y, z],
        color: "#F2F7F8",
      });
    } else if (unit === "upper-center") {
      cat.part(() => linework(mapContours, 0.0022), ["avionics"], {
        id: "flight-deck.map-contours",
        pos: [8.843, y, z],
        color: "#85A6AA",
      });
      cat.part(() => linework(routeGraphic, 0.0036), ["avionics"], {
        id: "flight-deck.map-route",
        pos: [8.84, y, z],
        color: "#FFA8F0",
      });
    } else {
      cat.part(() => linework(systemDiagram(), 0.0031), ["avionics"], {
        id: "flight-deck.systems-diagram",
        pos: [8.84, y, z],
        color: "#A5E6CA",
      });
    }
  }

  // The Overview (June 2026), p. 57, illustrates FalconEye, dual-HUD capability and smart sidesticks.
  // A single pilot-side combiner represents FalconEye in this example installation.
  cat.part(() => new RoundedBoxGeometry(0.012, 0.22, 0.27, 2, 0.005).rotateZ(0.16), ["avionics"], {
    id: "flight-deck.hud",
    pos: [8.88, 0.54, -0.46],
    name: "FalconEye head-up display",
    note: "FalconEye combines synthetic and enhanced vision in a head-up display. Dassault also describes dual-HUD capability.",
    plate: true,
    pin: true,
  });

  for (const [pilot, z] of [
    ["left", -0.91],
    ["right", 0.91],
  ] as const) {
    cat.part(
      () =>
        mergeGeos([
          new RoundedBoxGeometry(0.26, 0.12, 0.14, 1, 0.045),
          new RoundedBoxGeometry(0.073, 0.19, 0.071, 1, 0.035).rotateZ(0.22).translate(0.018, 0.13, 0),
        ]),
      ["avionics"],
      {
        id: "flight-deck.sidestick",
        instance: pilot,
        pos: [8.12, -0.19, z],
        color: "#384048",
        name: "Smart sidestick",
        note: "The pilot commands the digital flight control system through a sidestick.",
      },
    );
  }
}
