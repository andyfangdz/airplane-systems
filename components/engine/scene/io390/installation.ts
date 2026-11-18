import {
  coolerBaffle,
  coolerBracket,
  coolerCore,
  coolerDiffuser,
  coolerDuctPath,
  coolerElbow,
  coolerMount,
} from "@/engines/io390/cooler";
import * as THREE from "three";
import { loft } from "@/lib/geometry";
import { bank, headPoints, merge, rod, toWorld, tube, zrod, type Dims } from "../kit";
import {
  bolt,
  item,
  items,
  nut,
  atStations,
  plate,
  section,
  sleeve,
  stations,
  type Detail,
  type Point,
} from "./shapes";

export function exhaustInstallation(d: Dims) {
  // SR20 AMM 78-00 / 78-10. Left headers cross beneath the sump; all four lead to a single right-hand muffler.
  const collectorY = -0.255,
    collectorZ = 0.27;
  const ports = [0.077, 0.017, -0.095, -0.155];
  const pipes = d.cylinders.map((c) => {
    const [x, y, z] = toWorld(c, headPoints(d).exhaustPort);
    const joint = ports[c.n - 1];
    const bend: Point[] =
      bank(c) > 0
        ? [
            [x, -0.155, z],
            [x, -0.205, z - 0.012],
            [joint, collectorY + 0.018, collectorZ + 0.028],
          ]
        : [
            [x, -0.175, z],
            [x, -0.255, z + 0.024],
            [x, -0.311, -0.18],
            [joint, -0.317, 0.08],
            [joint, -0.304, collectorZ - 0.034],
          ];
    return tube([[x, y - 0.006, z], ...bend, [joint, collectorY, collectorZ]], 0.017, 52, 16);
  });
  // The four branches enter separate stations on the longitudinal collector. The shroud
  // stops short of both ends of the muffler so the exhaust never crosses its outer jacket.
  const front = -0.209,
    rear = front - 0.135;
  const can = (inside: number, outside: number, a: number, b: number) =>
    sleeve(inside, outside, a, b)
      .rotateY(Math.PI / 2)
      .translate(0, collectorY, collectorZ);
  const muffler = can(0.036, 0.045, rear, front);
  const heatMuff = can(0.046, 0.053, rear + 0.007, front - 0.007);
  const collector = merge([
    tube(
      [
        [ports[0] + 0.017, collectorY, collectorZ],
        [front + 0.009, collectorY, collectorZ],
      ],
      0.024,
      12,
      20,
    ),
    can(0.0215, 0.037, front - 0.002, front + 0.01),
  ]);
  const tail = merge([
    can(0.022, 0.037, rear - 0.006, rear + 0.002),
    tube(
      [
        [rear, collectorY, collectorZ],
        [rear - 0.03, collectorY - 0.004, collectorZ + 0.005],
        [rear - 0.063, -0.293, collectorZ + 0.02],
        [rear - 0.069, -0.345, collectorZ + 0.025],
      ],
      0.023,
      28,
      20,
    ),
  ]);
  return { pipes, collectors: [collector], muffler, heatMuff, tail };
}

/** SR20 cooling air shroud and intake hardware, original shapes fitted to the existing scene stations. */
export function sumpCasting(d: Dims) {
  const y = d.sumpBottom,
    w = 0.123,
    x0 = d.caseRear + 0.005,
    x1 = d.front - 0.04;
  const s = section([
    [x0 + 0.015, -w],
    [x1 - 0.023, -w],
    [x1, -w + 0.027],
    [x1, w - 0.027],
    [x1 - 0.023, w],
    [x0 + 0.015, w],
    [x0, w - 0.03],
    [x0, -w + 0.03],
  ]);
  const top = plate(s, 0, 0.007)
    .rotateX(Math.PI / 2)
    .translate(0, d.caseBottom + 0.008, 0);
  const pan = section([
    [x0 + 0.012, y + 0.012],
    [x0 + 0.05, y - 0.002],
    [x0 + 0.11, y - 0.005],
    [x0 + 0.145, y + 0.018],
    [x1 - 0.035, y + 0.018],
    [x1 - 0.007, y + 0.04],
    [x1 - 0.007, d.caseBottom + 0.003],
    [x0 + 0.008, d.caseBottom + 0.003],
  ]);
  const ribs = Array.from({ length: 7 }, (_, i) =>
    new THREE.BoxGeometry(0.003, 0.042, 0.214).translate(x0 + 0.06 + i * 0.051, y + 0.044, 0),
  );
  return merge([top, plate(pan, -0.104, 0.104, 0.004), ...ribs]);
}

export function suctionScreen(d: Dims) {
  const at: Point = [d.caseRear + 0.007, d.sumpBottom + 0.024, 0.064];
  const mesh: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 18; i++) mesh.push(sleeve(0.0122, 0.013, i * 0.0035, i * 0.0035 + 0.00065, 0, Math.PI * 2, 20));
  for (const [x, y] of stations(20, 0.0126)) mesh.push(zrod(0.0006, 0, 0.062, 5).translate(x, y, 0));
  return merge(mesh)
    .rotateY(Math.PI / 2)
    .translate(...at);
}

/** Forward face of the throttle inlet relative to the servo's centre, in model metres. */
export const servoInletOffset = 0.071;

export function servoPosition(d: Dims): Point {
  return [d.front - 0.053, d.sumpBottom - 0.035, 0];
}

export function injectionServo(d: Dims, [ix, iy]: Point = servoPosition(d), updraft = false) {
  const flange = section([
    [-0.05, -0.034],
    [-0.036, -0.048],
    [0.043, -0.048],
    [0.051, -0.033],
    [0.049, 0.037],
    [0.034, 0.048],
    [-0.04, 0.048],
    [-0.05, 0.03],
  ]);
  const bore = new THREE.Path().absarc(0, 0, 0.032, 0, 2 * Math.PI, true);
  flange.holes.push(bore);
  const through = sleeve(0.032, 0.039, -0.045, 0.045).rotateY(Math.PI / 2);
  const side = merge([zrod(0.031, 0.028, 0.054, 24), zrod(0.033, 0.052, 0.056, 24), zrod(0.021, 0.056, 0.065, 16)]);
  return merge([
    through,
    plate(flange, -0.046, -0.04).rotateY(Math.PI / 2),
    plate(flange, 0.039, 0.046).rotateY(Math.PI / 2),
    side,
  ])
    .rotateZ(updraft ? -Math.PI / 2 : 0)
    .translate(ix, iy, 0);
}

export function diaphragmPump(d: Dims) {
  const px = d.accRear - 0.03,
    y = -0.06,
    z = -0.09;
  return merge([
    rod(0.028, 0.057, 24),
    rod(0.038, 0.008, 32).translate(-0.013, 0, 0),
    new THREE.SphereGeometry(0.031, 24, 12).scale(0.72, 1, 1).translate(-0.023, 0, 0),
    zrod(0.009, -0.028, -0.015, 6).translate(0, -0.017, 0),
  ]).translate(px, y, z);
}

export function accessoryPads(d: Dims): Detail[] {
  const rear = (g: THREE.BufferGeometry, y: number, z: number) => g.rotateY(-Math.PI / 2).translate(d.accRear, y, z);
  const s = section([
    [-0.034, -0.029],
    [0.028, -0.029],
    [0.035, -0.016],
    [0.028, 0.031],
    [-0.025, 0.031],
    [-0.034, 0.018],
  ]);

  const parts: Detail[] = [];
  for (const [name, y, z, pn, fig] of [
    ["Accessory drive", 0.126, -0.016, "8313 / 60430", "22"],
    ["Rear governor pad", -0.069, 0.069, "69551 / 69106", "23"],
  ] as const) {
    const governor = fig === "23";
    const fasteners = governor ? [[0, 0] as [number, number]] : stations(4, 0.035, 0.031, Math.PI / 4);
    parts.push(
      item(
        name + " gasket",
        pn,
        fig,
        "black",
        rear(plate(s, 0, 0.0015), y, z),
        "The unused accessory mounting pad is closed at the rear housing.",
        [-0.3, 0, 0],
      ),
      item(
        name + " cover",
        pn,
        fig,
        "acc",
        rear(plate(s, 0.0015, 0.005), y, z),
        "The cover closes the accessory pad.",
        [-0.35, 0, 0],
      ),
      ...items(
        name + " cover stud",
        governor ? "accessory housing stud" : "adapter assembly 61098",
        fig,
        "steel",
        atStations(fasteners, () => zrod(0.003, -0.018, 0.014, 10)).map((g) => rear(g, y, z)),
        "The cover fasteners pass through its mounting flange.",
        [-0.28, 0, 0],
      ),
      ...items(
        name + " cover washer",
        governor ? "STD-35" : "STD-8",
        fig,
        "steel",
        atStations(fasteners, () => sleeve(0.0032, 0.006, 0.005, 0.006)).map((g) => rear(g, y, z)),
        "The cover fasteners pass through its mounting flange.",
        [-0.375, 0, 0],
      ),
      ...items(
        name + " cover lock washer",
        governor ? "STD-475" : "STD-160",
        fig,
        "steel",
        atStations(fasteners, () => sleeve(0.0032, 0.006, 0.006, 0.007, 0.05, 6.12)).map((g) => rear(g, y, z)),
        "The cover fasteners pass through its mounting flange.",
        [-0.39, 0, 0],
      ),
      ...items(
        name + " cover nut",
        governor ? "STD-1410" : "STD-1411",
        fig,
        "steel",
        atStations(fasteners, () => nut(0.0032), 0.007).map((g) => rear(g, y, z)),
        "The cover fasteners pass through its mounting flange.",
        [-0.41, 0, 0],
      ),
    );
  }
  return parts;
}

// Cirrus AMM 79-20 Fig. 79-20-1. Both the rear baffle aperture and the duct refer to the same mount.
function installedCoolerMount(d: Dims) {
  const foot: Point = [d.caseRear + 0.012, -0.075, -(d.caseHalf - 0.025)];
  const wall: Point = [d.accRear - 0.21, 0.12, -0.28];
  return { foot, wall, mount: coolerMount(wall, foot) };
}

export function coolerBafflePort(d: Dims): Point {
  return [d.caseRear, 0.08, installedCoolerMount(d).mount.center[2]];
}

export function remoteCooler(d: Dims): Detail[] {
  const { foot, wall, mount: m } = installedCoolerMount(d);
  const note =
    "Cirrus SR20 AMM 79-20 Fig. 79-20-1, standard installation. The bracket bolts to the engine mount weldment. Side, clocking, dimensions and hose paths are illustrative.";
  const local = (g: THREE.BufferGeometry) => g.translate(...m.center);
  const part = (name: string, material: Detail["material"], geometry: THREE.BufferGeometry, spread: Point): Detail => ({
    name,
    material,
    geometry,
    spread,
    note,
  });
  const weldment: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    for (const level of [-1, 1]) {
      const firewall: Point = [wall[0], level > 0 ? wall[1] : -0.16, side * Math.abs(wall[2])];
      for (const target of [-1, 1]) {
        const boss: Point = [foot[0], target * Math.abs(foot[1]), side * Math.abs(foot[2])];
        weldment.push(tube([firewall, boss], 0.009, 1));
      }
      weldment.push(
        sleeve(0.006, 0.015, -0.011, 0.011)
          .rotateY(Math.PI / 2)
          .translate(...firewall),
      );
    }
  }
  const parts = [
    part("Engine mount weldment", "darkSteel", merge(weldment), [0, 0, 0]),
    part("Oil cooler mounting bracket", "steel", local(coolerBracket(m)), [-0.07, -0.04, -0.2]),
    { ...part("Oil cooler", "shroud", local(coolerCore()), [-0.07, -0.04, -0.34]), cameraSubject: true },
    part("Oil cooler diffuser", "acc", local(coolerDiffuser()), [-0.16, -0.04, -0.34]),
  ];
  const bafflePort = coolerBafflePort(d);
  const duct: Point[] = coolerDuctPath(m, [bafflePort[0] - 0.012, bafflePort[1], bafflePort[2]]);
  parts.push(
    part(
      "Oil cooler baffle outlet",
      "shroud",
      merge([
        coolerBaffle(0.099, 0.091, 0, 0).translate(0.0025, 0, 0),
        sleeve(0.028, 0.031, -0.023, 0.002).rotateY(Math.PI / 2),
      ]).translate(...bafflePort),
      [0.14, 0.11, -0.35],
    ),
    part("Oil cooler air duct", "duct", tube(duct, 0.029, 30, 24), [-0.25, 0.025, -0.34]),
    part(
      "Oil cooler duct clamp",
      "steel",
      sleeve(0.0285, 0.0305, -0.004, 0.004)
        .rotateY(Math.PI / 2)
        .translate(...m.inlet),
      [-0.21, -0.04, -0.34],
    ),
  );
  for (const [i, pad] of m.pads.entries()) {
    const site = (g: THREE.BufferGeometry) => g.rotateY(Math.PI).translate(...pad);
    parts.push(
      part(
        `Oil cooler bracket bolt (${i + 1})`,
        "darkSteel",
        site(bolt(0.003, 0.026).translate(0, 0, 0.017)),
        [-0.07, -0.04, -0.12],
      ),
      part(
        `Oil cooler bracket washer (${i + 1})`,
        "steel",
        site(sleeve(0.0031, 0.006, 0.014, 0.017)),
        [-0.07, -0.04, -0.095],
      ),
    );
  }
  for (const [i, [y, z]] of [
    [-0.046, -0.058],
    [-0.046, 0.058],
    [0.046, -0.058],
    [0.046, 0.058],
  ].entries()) {
    const site = (g: THREE.BufferGeometry) => g.rotateY(-Math.PI / 2).translate(...m.at(-0.03, y, z));
    parts.push(
      part(
        `Oil cooler retaining bolt (${i + 1})`,
        "darkSteel",
        site(bolt(0.0028, 0.025).translate(0, 0, 0.008)),
        [-0.314, -0.04, -0.34],
      ),
      part(
        `Oil cooler retaining washer (${i + 1})`,
        "steel",
        site(sleeve(0.0029, 0.0058, 0.006, 0.008)),
        [-0.284, -0.04, -0.34],
      ),
      part(
        `Oil cooler retaining spacer (${i + 1})`,
        "steel",
        site(sleeve(0.003, 0.0054, -0.006, 0.006)),
        [-0.257, -0.04, -0.34],
      ),
    );
  }
  for (const side of [-1, 1]) {
    const port = side < 0 ? m.feed : m.outlet;
    const label = side < 0 ? "feed" : "return";
    // Stay between the filter and magnetos until clear of the aft caps, then cross
    // the mount on separate levels. Both hoses meet their elbow along its -X tail.
    const approach: Point[] =
      side < 0
        ? [
            [-0.429, -0.009, -0.069],
            [-0.456, -0.023, -0.154],
            [-0.459, -0.027, -0.278],
            [-0.448, -0.008, -0.383],
            [-0.444, 0.057, -0.383],
            [port[0] - 0.014, port[1], port[2]],
          ]
        : [
            [-0.455, 0.043, 0.016],
            [-0.458, 0.039, -0.102],
            [-0.49, 0.094, -0.179],
            [-0.47, 0.093, -0.2],
            [-0.456, 0.088, -0.212],
            [-0.443, port[1], port[2]],
          ];
    const path: Point[] = [
      [d.accRear - 0.019, 0.047, side * 0.051],
      [d.accRear - 0.038, 0.047, side * 0.049],
      [side < 0 ? -0.429 : -0.45, side < 0 ? 0.042 : 0.053, side < 0 ? -0.046 : 0.042],
      ...approach,
      port,
    ];
    parts.push(
      part(`Oil cooler ${label} elbow`, "bearing", local(coolerElbow(side)), [-0.13, 0.055, -0.34]),
      part(`Oil cooler ${label} hose`, "oilHose", tube(path, 0.0075, 36, 12), [
        -0.3,
        0.32 + side * 0.045,
        -0.47 + side * 0.06,
      ]),
      part(
        `Oil cooler ${label} hose coupling`,
        "steel",
        merge([sleeve(0.0058, 0.0095, -0.011, 0, 0, Math.PI * 2, 6), sleeve(0.0073, 0.0088, -0.021, -0.01)])
          .rotateY(Math.PI / 2)
          .translate(...port),
        [-0.28, 0.2 + side * 0.025, -0.42 + side * 0.035],
      ),
      part(
        `Oil cooler cushion strip (${side < 0 ? 1 : 2})`,
        "black",
        local(new THREE.BoxGeometry(0.052, 0.002, 0.12).translate(0, side * 0.052, 0)),
        [-0.07, side * 0.055, -0.275],
      ),
    );
  }
  return parts;
}

const inletAngle = 0.82;
const inletZ = 0.31;
const inletY = 0.088;

// Both inlet floors meet the side sheets and the arched partition around the ring
// gear. Only the right floor is pierced for the induction filter (SR20 POH 7-35).
export function inletRamp(d: Dims, right: boolean) {
  const rim = d.headOut - 0.014;
  const innerEdge = [-0.061, -0.03, 0, 0.04, 0.09].map((v) => {
    const y = inletY + v * Math.cos(inletAngle);
    return [inletZ - Math.sqrt(0.18 ** 2 - y ** 2), v] as [number, number];
  });
  const sheet = section([[inletZ - rim, -0.061], ...innerEdge, [inletZ - rim, 0.09]]);
  if (right)
    sheet.holes.push(
      section([
        [-0.052, -0.048],
        [-0.052, 0.048],
        [0.052, 0.048],
        [0.052, -0.048],
      ]),
    );
  const floor = plate(sheet, right ? 0.003 : -0.005, right ? 0.005 : -0.003)
    .rotateY(right ? Math.PI / 2 : -Math.PI / 2)
    .rotateZ(inletAngle)
    .translate(d.front + 0.055, inletY, right ? inletZ : -inletZ);
  // The return tucks down to the front cylinder. Its depth follows the bank stagger.
  const side = right ? 1 : -1;
  const cylinderX = Math.max(...d.cylinders.filter((c) => bank(c) === side).map((c) => c.x));
  const foldX = d.front + 0.055 - 0.09 * Math.sin(inletAngle) + 0.004 * Math.cos(inletAngle);
  const foldY = inletY + 0.09 * Math.cos(inletAngle) + 0.004 * Math.sin(inletAngle);
  const inner = inletZ - innerEdge.at(-1)![0];
  const skirt = loft(
    [
      [inner, d.front + 0.006, 0.133],
      [d.caseHalf + 0.009, d.front - 0.013, 0.096],
      [d.headIn - 0.02, cylinderX + 0.081, 0.037],
      [d.headIn + 0.031, cylinderX + 0.086, 0.045],
      [rim, cylinderX + 0.083, 0.037],
    ].map(([span, rear, y]) => {
      const mid = THREE.MathUtils.lerp(foldX, rear, 0.4);
      const z = side * span;
      return [
        [foldX, foldY],
        [mid, foldY - 0.014],
        [rear, y],
        [rear + 0.0015, y],
        [mid + 0.001, foldY - 0.0155],
        [foldX, foldY - 0.0015],
      ].map(([x, h]) => new THREE.Vector3(x, h, z));
    }),
  );
  return merge([floor, skirt]);
}

/** SR20 normal-air filter on the forward right baffle and manually selected alternate-air inlet. */
export function inductionInlet(d: Dims) {
  const x = d.front + 0.055,
    y = inletY,
    z = inletZ;
  const src = "Cirrus SR20 POH 7-35, 7-39 and AMM 71-60 p. 1. Positions and duct contours are approximate.";
  // The paper filter faces the incoming air on the sloping right-hand inlet ramp.
  const angle = inletAngle;
  const local = (dx: number, dy: number, dz: number): Point => [
    x + dx * Math.cos(angle) - dy * Math.sin(angle),
    y + dx * Math.sin(angle) + dy * Math.cos(angle),
    z + dz,
  ];
  const at = (g: THREE.BufferGeometry) => g.rotateZ(angle).translate(x, y, z);
  const folds = Array.from({ length: 22 }, (_, i) =>
    new THREE.BoxGeometry(0.015, 0.091, 0.003)
      .rotateY(i % 2 === 0 ? 0.32 : -0.32)
      .translate(0.026, 0, (i - 10.5) * 0.0044),
  );
  const rim = merge(
    [-1, 1].flatMap((k) => [
      new THREE.BoxGeometry(0.034, 0.005, 0.107).translate(0.022, k * 0.047, 0),
      new THREE.BoxGeometry(0.034, 0.098, 0.005).translate(0.022, 0, k * 0.051),
    ]),
  );
  const end = servoPosition(d)[0] + servoInletOffset;
  // The wire retainer and dark inlet ramp are visible in the overhead G6 photograph.
  // Local x is the filter normal, local z is across the filter.
  const guard: THREE.BufferGeometry[] = [];
  for (let i = -9; i <= 9; i++) {
    guard.push(new THREE.BoxGeometry(0.0012, 0.091, 0.001).translate(0.0345, 0, i * 0.0051));
  }
  for (let i = -6; i <= 6; i++) {
    guard.push(new THREE.BoxGeometry(0.0012, 0.001, 0.1).translate(0.035, i * 0.007, 0));
  }
  const normal: Point[] = [
    local(-0.06, 0, 0),
    local(-0.083, 0, 0),
    [x - 0.032, -0.023, z + 0.025],
    [x - 0.018, -0.137, z + 0.03],
    [x - 0.009, -0.229, z - 0.001],
    [x + 0.006, -0.26, 0.213],
    [end + 0.052, -0.244, 0.083],
    [end + 0.05, d.sumpBottom - 0.035, 0.036],
    [end + 0.043, d.sumpBottom - 0.035, 0.011],
    [end + 0.02, d.sumpBottom - 0.035, 0],
    [end + 0.009, d.sumpBottom - 0.035, 0],
    [end, d.sumpBottom - 0.035, 0],
  ];
  const alternate: Point[] = [
    local(-0.0215, 0, -0.051),
    local(-0.0215, 0, -0.077),
    [x - 0.004, 0.033, z - 0.084],
    [x - 0.006, 0.003, z - 0.083],
  ];
  const back = section([
    [-0.05, -0.047],
    [0.05, -0.047],
    [0.05, 0.047],
    [-0.05, 0.047],
  ]);
  back.holes.push(new THREE.Path().absarc(0, 0, 0.029, 0, 2 * Math.PI, true));
  const alternateWall = section([
    [-0.052, -0.047],
    [0.005, -0.047],
    [0.005, 0.047],
    [-0.052, 0.047],
  ]);
  alternateWall.holes.push(new THREE.Path().absarc(-0.0215, 0, 0.02, 0, 2 * Math.PI, true));
  const parts: Detail[] = [
    {
      name: "Induction filter retaining screen",
      material: "steel",
      geometry: at(merge(guard)),
      note: src,
      spread: [0.34, 0.04, 0.31],
    },
    {
      name: "Right inlet baffle ramp",
      material: "inletSheet",
      geometry: inletRamp(d, true),
      note: src,
      spread: [0.2, 0.17, 0.43],
    },
    {
      name: "Induction air filter",
      material: "paper",
      note: "The paper element feeds the normal induction inlet. " + src,
      geometry: at(merge(folds)),
      spread: [0.28, 0.03, 0.3],
    },
    { name: "Induction filter frame", material: "acc", note: src, geometry: at(rim), spread: [0.22, 0.03, 0.3] },
    {
      name: "Induction air box",
      material: "intake",
      note: src,
      geometry: at(
        merge([
          new THREE.BoxGeometry(0.057, 0.094, 0.003).translate(-0.0235, 0, 0.05),
          plate(alternateWall, -0.052, -0.049),
          plate(back, -0.052, -0.049).rotateY(Math.PI / 2),
          sleeve(0.029, 0.031, -0.074, -0.049).rotateY(Math.PI / 2),
          sleeve(0.019, 0.021, -0.065, -0.051).translate(-0.0215, 0, 0),
          ...[-1, 1].map((k) => new THREE.BoxGeometry(0.057, 0.003, 0.1).translate(-0.0235, k * 0.047, 0)),
        ]),
      ),
      spread: [0.14, 0.03, 0.3],
    },
    {
      name: "Induction inlet duct",
      material: "duct",
      note: "The duct connects the air box to the servo throttle body. " + src,
      geometry: tube(normal, 0.031, 32, 18),
      spread: [0.18, -0.14, 0.24],
    },
    {
      name: "Alternate air duct",
      material: "duct",
      note: "This duct admits air from the warm side of the baffling. " + src,
      geometry: tube(alternate, 0.021, 24, 16),
      spread: [0.07, 0.09, 0.23],
    },
  ];
  const cuff = (name: string, geometry: THREE.BufferGeometry, spread: Point) =>
    parts.push({
      name,
      geometry,
      spread,
      material: "steel",
      note: "Formed hose connection on the induction air duct. Shape and dimensions are approximate.",
    });
  cuff(
    "Induction filter outlet clamp",
    at(sleeve(0.0309, 0.0325, -0.07, -0.063).rotateY(Math.PI / 2)),
    [0.15, -0.05, 0.24],
  );
  cuff(
    "Throttle inlet hose coupling",
    sleeve(0.0295, 0.038, -0.001, 0.019)
      .rotateY(Math.PI / 2)
      .translate(end, d.sumpBottom - 0.035, 0),
    [0.25, -0.26, 0.1],
  );
  cuff(
    "Throttle inlet duct clamp",
    sleeve(0.0378, 0.0395, 0.006, 0.013)
      .rotateY(Math.PI / 2)
      .translate(end, d.sumpBottom - 0.035, 0),
    [0.29, -0.26, 0.1],
  );
  const door = new THREE.BoxGeometry(0.045, 0.073, 0.002).translate(-0.0225, 0, 0);
  return { parts, door, hinge: local(0.004, 0, -0.049), angle };
}
