import * as THREE from "three";
import type { Catalogue } from "@/lib/catalogue";
import { loft, mergeGeos } from "@/lib/geometry";
import { lerp, V, type Vec3 } from "@/lib/math";

// EASA IM.E.096, issue 07, p. 7. The published dimension applies to the bare fan
// case, not the cowling around the installed powerplant. Local +X points upstream.
export const FAN_CASE_RADIUS = 1.109 / 2;
export const SPINNER_FACE = 1.86;
const tailconeTip = SPINNER_FACE - 2.874;
type Profile = [number, number][];

export function turned(profile: Profile, start = 0, angle = 2 * Math.PI) {
  return new THREE.LatheGeometry(
    profile.map(([station, radius]) => new THREE.Vector2(radius, station)),
    64,
    start,
    angle,
  ).rotateZ(-Math.PI / 2);
}

// Leave the inboard side of the liner in place. The opening on the outboard
// side exposes the cavity when the study viewer ghosts the surrounding nacelle.
function sectionWall(outside: Profile, thickness: number, sign: number) {
  const inside = outside.map(([x, r]): [number, number] => [x, r - thickness]).reverse();
  return turned([...outside, ...inside, outside[0]], (sign > 0 ? 0.38 : -0.28) * Math.PI, 0.9 * Math.PI);
}

// A section of cambered foil is lofted and twisted radially. Stage counts follow
// the type data sheet. Blade quantities, stagger, spacing and contours are illustrative.
function bladedRow(x: number, hub: number, tip: number, chord: number, count: number, reverse = false) {
  const outline = [
    [0, 0],
    [0.23, 0.14],
    [0.56, 0.12],
    [1, 0],
    [0.55, 0.035],
    [0.18, 0.025],
  ];
  const blade = loft(
    [0, 0.5, 1].map((t) => {
      const r = lerp(hub, tip, t);
      return outline.map(([u, v]) => {
        const theta = (reverse ? -1 : 1) * (u * (0.85 - t * 0.33) + t * t * 0.19) * ((2 * Math.PI) / count);
        return V(x - u * chord + v * chord - t * chord * 0.12, r * Math.cos(theta), r * Math.sin(theta));
      });
    }),
  );
  const blades = Array.from({ length: count }, (_, i) => blade.clone().rotateX((2 * Math.PI * i) / count));
  return mergeGeos(blades);
}

interface StageGroup {
  id: string;
  name: string;
  note: string;
  count: number;
  // Fore and aft rotor stations, hub radii and blade-tip radii.
  stations: [number, number];
  hub: [number, number];
  tip: [number, number];
  chord: number;
  blades: number;
  color: string;
  hot?: boolean;
}

const stages: StageGroup[] = [
  {
    id: "booster",
    name: "Booster",
    count: 2,
    stations: [1.28, 1.11],
    hub: [0.14, 0.155],
    tip: [0.323, 0.312],
    chord: 0.078,
    blades: 21,
    color: "#437b91",
    note: "Two booster stages on the low-pressure spool feed the high-pressure compressor.",
  },
  {
    id: "hp-compressor",
    name: "High-pressure compressor",
    count: 8,
    stations: [0.92, 0.402],
    hub: [0.165, 0.205],
    tip: [0.305, 0.262],
    chord: 0.038,
    blades: 26,
    color: "#497f83",
    note: "Eight axial stages compress core air. The two-stage high-pressure turbine drives this rotor through its own shaft.",
  },
  {
    id: "hp-turbine",
    name: "High-pressure turbine",
    count: 2,
    stations: [-0.113, -0.243],
    hub: [0.205, 0.203],
    tip: [0.3, 0.321],
    chord: 0.066,
    blades: 23,
    color: "#a87352",
    hot: true,
    note: "Two turbine stages downstream of the annular combustor extract power for the high-pressure compressor.",
  },
  {
    id: "lp-turbine",
    name: "Low-pressure turbine",
    count: 4,
    stations: [-0.395, -0.783],
    hub: [0.204, 0.174],
    tip: [0.33, 0.389],
    chord: 0.064,
    blades: 25,
    color: "#9a8064",
    hot: true,
    note: "Four turbine stages drive the fan and both booster stages through the low-pressure shaft.",
  },
];

function stageModule(group: StageGroup) {
  const rotors: THREE.BufferGeometry[] = [];
  const profile: Profile = [];
  for (let i = 0; i < group.count; i++) {
    const t = i / (group.count - 1);
    const x = lerp(...group.stations, t),
      hub = lerp(...group.hub, t),
      tip = lerp(...group.tip, t);
    rotors.push(bladedRow(x, hub, tip, group.chord, group.blades, group.hot));
    profile.push([x, hub], [x - group.chord, hub]);
  }
  profile.reverse();
  rotors.push(turned([[profile[0][0], 0.072], ...profile, [profile.at(-1)![0], 0.072]]));
  return mergeGeos(rotors);
}

// Perforated outer flame tube. Each curved panel has a real opening with a
// return lip, so the liner reads correctly looking into the section from either side.
function combustor(sign: number) {
  const rings = 3,
    panels = 14,
    angle = Math.PI * 1.4;
  const start = (sign > 0 ? 0.26 : -0.66) * Math.PI;
  const positions: number[] = [],
    indices: number[] = [];
  const frame = [
    [0, 0],
    [0.5, 0],
    [1, 0],
    [1, 0.5],
    [1, 1],
    [0.5, 1],
    [0, 1],
    [0, 0.5],
  ];
  const point = (row: number, col: number, u: number, v: number, inset = 0) => {
    const t = (row + u) / rings,
      x = lerp(0.322, -0.048, t),
      a = start + (angle * (col + v)) / panels;
    const r = 0.292 + 0.042 * Math.sin(t * Math.PI) - inset;
    positions.push(x, -r * Math.sin(a), r * Math.cos(a));
  };
  for (let row = 0; row < rings; row++)
    for (let col = 0; col < panels; col++) {
      const base = positions.length / 3;
      for (const [u, v] of frame) point(row, col, u, v);
      for (const inset of [0, 0.009])
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4 - (3 * Math.PI) / 4;
          point(row, col, 0.5 + 0.25 * Math.cos(a), 0.5 + 0.22 * Math.sin(a), inset);
        }
      for (let i = 0; i < 8; i++) {
        const j = (i + 1) % 8;
        const a = base + i,
          b = base + j;
        indices.push(a, b, a + 8, b, b + 8, a + 8, a + 8, b + 8, a + 16, b + 8, b + 16, a + 16);
      }
    }
  const liner = new THREE.BufferGeometry();
  liner.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  liner.setIndex(indices);
  liner.computeVertexNormals();
  const inner = sectionWall(
    [
      [-0.048, 0.217],
      [0.12, 0.16],
      [0.322, 0.205],
    ],
    0.012,
    sign,
  );
  return mergeGeos([liner, inner]);
}

// This illustrative lobed rim shows where core and bypass streams meet. Pratt
// & Whitney identifies a mixer on the PW800 family; exact PW812D lobe geometry is unpublished here.
function mixer() {
  const rings = [
    [-0.87, 0.391, 0],
    [-0.96, 0.404, 0.012],
    [-1.07, 0.402, 0.041],
    [-1.16, 0.392, 0.07],
  ];
  const shell = (thickness: number) =>
    rings.map(([x, radius, amplitude]) =>
      Array.from({ length: 96 }, (_, i) => {
        const a = (2 * Math.PI * i) / 96,
          r = radius + amplitude * Math.cos(12 * a) - thickness;
        return V(x, r * Math.cos(a), r * Math.sin(a));
      }),
    );
  const outside = shell(0);
  return loft([...outside, ...shell(0.009).reverse(), outside[0]], { caps: false });
}

export function addEngineCore(cat: Catalogue, side: "left" | "right", pos: Vec3) {
  const sign = side === "right" ? 1 : -1;
  const location = { instance: side, pos };
  const labeled = { ...location, pin: side === "right" };

  cat.part(
    () =>
      sectionWall(
        [
          [1.04, 0.49],
          [1.3, FAN_CASE_RADIUS],
          [1.7, FAN_CASE_RADIUS],
        ],
        0.015,
        sign,
      ),
    ["engine"],
    {
      ...location,
      id: "engine.fan-case",
      name: "Fan case",
      solidColor: "#647179",
      color: "#758c97",
      note: "EASA lists a nominal PW812D fan-case diameter of 1.109 m. The casing is shown in section in X-ray.",
    },
  );
  cat.part(() => bladedRow(1.44, 0.304, 0.529, 0.086, 18, true), ["engine"], {
    ...location,
    id: "engine.fan-stators",
    name: "Fan outlet guide vanes",
    solidColor: "#767e80",
    color: "#758e97",
    note: "The guide vanes illustrate the stationary row downstream of the fan.",
  });
  cat.part(
    () =>
      mergeGeos([
        sectionWall(
          [
            [-0.96, 0.499],
            [-0.62, 0.51],
            [0.53, 0.526],
            [1.13, 0.532],
          ],
          0.014,
          sign,
        ),
        sectionWall(
          [
            [-0.85, 0.394],
            [-0.36, 0.36],
            [0.21, 0.352],
            [0.91, 0.344],
            [1.31, 0.325],
          ],
          0.012,
          sign,
        ),
      ]),
    ["engine"],
    {
      ...labeled,
      id: "engine.bypass-duct",
      name: "Bypass duct",
      color: "#839ea6",
      solidColor: "#636f74",
      note: "Fan air outside the core passes around the compressors, combustor and turbines. The open side reveals the annular passage.",
    },
  );

  for (const group of stages) {
    cat.part(() => stageModule(group), ["engine"], {
      ...labeled,
      id: `engine.${group.id}`,
      name: group.name,
      color: group.color,
      note: group.note,
    });
  }
  cat.part(() => combustor(sign), ["engine"], {
    ...labeled,
    id: "engine.combustor",
    name: "Annular combustor",
    color: "#bc8450",
    note: "Core air flows through the annular TALON X combustor and into the high-pressure turbine. The sectioned liner and openings are illustrative.",
  });
  cat.part(
    () =>
      turned([
        [-0.88, 0.03],
        [-0.83, 0.049],
        [-0.69, 0.049],
        [1.51, 0.049],
        [1.55, 0.135],
      ]),
    ["engine"],
    {
      ...location,
      id: "engine.lp-shaft",
      name: "Low-pressure shaft",
      color: "#4d8196",
      note: "The inner one-piece shaft connects the four-stage low-pressure turbine to the fan and booster.",
    },
  );
  cat.part(
    () =>
      sectionWall(
        [
          [-0.33, 0.184],
          [-0.24, 0.1],
          [-0.16, 0.072],
          [0.36, 0.072],
          [0.43, 0.095],
          [0.45, 0.2],
        ],
        0.013,
        sign,
      ),
    ["engine"],
    {
      ...location,
      id: "engine.hp-shaft",
      name: "High-pressure shaft",
      color: "#53898a",
      note: "The high-pressure shaft surrounds the low-pressure shaft. Each rotor can turn at its own speed.",
    },
  );
  cat.part(mixer, ["engine"], {
    ...location,
    id: "engine.exhaust-mixer",
    name: "Exhaust mixer",
    color: "#8c7970",
    solidColor: "#665f5d",
    note: "Core exhaust and bypass air meet downstream of the turbines. The lobes illustrate the mixer on the PW800 family.",
  });
  cat.part(
    () =>
      turned([
        [tailconeTip, 0.001],
        [-0.98, 0.043],
        [-0.92, 0.12],
        [-0.86, 0.172],
        [-0.82, 0.172],
      ]),
    ["engine"],
    {
      ...location,
      id: "engine.core",
      name: "Exhaust centerbody",
      color: "#766b64",
      solidColor: "#44474a",
      note: "The engine tailcone sits inside the aft flow passage, ahead of the nacelle exhaust exit.",
    },
  );
}
