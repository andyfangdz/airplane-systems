import type { EngineSpec } from "@/engines/types";
import * as THREE from "three";
import { coolerCore } from "@/engines/io390/cooler";
import { bank, magnetoPose, headPoints, merge, slab, toWorld, tube, type Dims } from "../kit";
import { hole, plate, section, sleeve, type Detail, type Point } from "../io390/shapes";
import { servoInletOffset } from "../io390/installation";

/** Hardware supplied by the airframe. Coordinates and bends are illustrative, in engine metres. */
export function detail(
  name: string,
  material: Detail["material"],
  geometry: THREE.BufferGeometry,
  spread: Point,
  note: string,
): Detail {
  return { name, material, geometry, spread, note, role: note };
}

export const firewallX = (d: Dims, cessna: boolean) => d.accRear - (cessna ? 0.19 : 0.23);

export function coolerPosition(d: Dims, cessna: boolean): Point {
  return [d.caseRear - (cessna ? 0.025 : 0.11), cessna ? 0.065 : -0.015, cessna ? 0.215 : 0.321];
}

export function installedCooler(d: Dims, cessna: boolean) {
  const [x, y, z] = coolerPosition(d, cessna);
  const src = cessna ? "C172S POH 7-35" : "DA40 AMM 79-00";
  return [
    {
      ...detail("Oil cooler", "shroud", coolerCore().translate(x, y, z), [-0.18, 0.06, 0.42], src),
      cameraSubject: true,
    },
    ...[-1, 1].map((k) =>
      detail(
        k < 0 ? "Oil cooler feed hose" : "Oil cooler return hose",
        "fuelHose",
        tube(
          [
            [d.accRear - 0.019, 0.047, k * 0.051],
            [d.accRear - 0.031, 0.081, k * 0.048],
            [d.accRear - (k < 0 ? 0.027 : 0.064), k < 0 ? 0.191 : 0.149, k * 0.05],
            [d.accRear - 0.044, k < 0 ? 0.244 : 0.168, k * 0.083],
            [x - 0.025, k < 0 ? 0.25 : 0.157, z + k * 0.055],
            [x + (k < 0 ? -0.025 : 0.014), y + 0.087, z + k * 0.055],
            [x + (k < 0 ? -0.025 : 0.014), y + 0.047, z + k * 0.055],
          ],
          0.006,
        ),
        [-0.24 + k * 0.13, k * 0.1, 0.5 + k * 0.19],
        `The external hoses connect the cooler and accessory housing (${src}).`,
      ),
    ),
  ];
}

/** The split heater jacket has a flat takeoff face and a collar opening into the space around the muffler. */
function cessnaHeatShroud(x: number, y: number) {
  const half = 0.134,
    angle = 0.58,
    radius = 0.064;
  const width = radius * Math.sin(angle),
    face = radius * Math.cos(angle);
  const flange = section([
    [-half, -width],
    [half, -width],
    [half, width],
    [-half, width],
  ]);
  hole(flange, -0.104, 0, 0.02);
  return merge([
    sleeve(0.061, radius, -half, half, Math.PI / 2 + angle, 2 * (Math.PI - angle), 48),
    plate(flange, -0.0015, 0.0015)
      .rotateY(-Math.PI / 2)
      .translate(face, 0, 0),
    sleeve(0.019, 0.023, 0, 0.015)
      .rotateY(Math.PI / 2)
      .translate(face, 0, -0.104),
  ]).translate(x, y, 0);
}

export function installedExhaust(d: Dims, cessna: boolean) {
  const y = cessna ? -0.343 : -0.295,
    x = cessna ? -0.138 : d.caseRear - 0.025;
  const ports = headPoints(d);
  const pipes = d.cylinders.map((c) => {
    const [px, py, pz] = toWorld(c, ports.exhaustPort),
      k = bank(c),
      front = c.n <= 2;
    const station = x + (front ? 0.024 : -0.024);
    const route: Point[] = cessna
      ? [
          [px, -0.18, pz],
          [px, -0.246, k * (front ? 0.31 : 0.257)],
          [station + (front ? 0.041 : -0.025), y + 0.013, k * (front ? 0.267 : 0.226)],
          [station, y, k * 0.206],
          [station, y, k * 0.172],
        ]
      : [
          [px, -0.19, pz],
          [px - 0.03, front ? -0.283 : -0.218, k * (front ? 0.306 : 0.242)],
          [x + 0.13, y + (front ? -0.023 : 0.016), k * (front ? 0.145 : 0.091)],
          [x + 0.064, y, k * (front ? 0.086 : 0.038)],
        ];
    return tube([[px, py - 0.006, pz], ...route], 0.017, 48, 16);
  });
  // Two risers enter each end plate, clear of the cylindrical heater shroud (Cessna MM 78-10-00 Fig. 201).
  const end = new THREE.Shape().absarc(0, 0, 0.054, 0, 2 * Math.PI, false);
  for (const dx of [-0.024, 0.024]) hole(end, dx, 0, 0.0166);
  const muffler = cessna
    ? merge([sleeve(0.048, 0.054, -0.174, 0.174), plate(end, -0.174, -0.171), plate(end, 0.171, 0.174)]).translate(
        x,
        y,
        0,
      )
    : slab(x - 0.066, x + 0.066, y - 0.034, y + 0.035, -0.109, 0.109, 0.021);
  const heatMuff = cessna
    ? cessnaHeatShroud(x, y)
    : sleeve(0.046, 0.049, -0.053, 0.076)
        .rotateY(Math.PI / 2)
        .translate(x - 0.13, y, 0.05);
  const collectors = cessna
    ? []
    : [
        sleeve(0.035, 0.043, -0.09, 0.09)
          .rotateY(Math.PI / 2)
          .translate(x - 0.13, y, 0.05),
      ];
  const outlet: Point = cessna ? [x, y - 0.05, 0.169] : [x - 0.22, y, 0.05];
  const tail = tube(
    [
      outlet,
      [outlet[0] - (cessna ? 0.022 : 0.005), outlet[1] - 0.025, outlet[2] + 0.021],
      [outlet[0] - (cessna ? 0.056 : 0.006), outlet[1] - 0.105, outlet[2] + 0.037],
    ],
    0.027,
    24,
    20,
  );
  return { pipes, collectors, muffler, heatMuff, tail };
}

export function io360Inlet(servo: Point, cessna: boolean) {
  const [ix, iy] = servo;
  const x = cessna ? ix : ix + servoInletOffset + 0.049;
  const y = cessna ? iy - servoInletOffset - 0.034 : iy;
  const z = 0;
  const mount: Point = [x, y, z];
  const box = (a: number, b: number, c: number) => new THREE.BoxGeometry(a, b, c);
  const src = cessna ? "C172S POH 7-36" : "DA40 AMM 71-60";
  // The Cessna filter covers the front of the air box. The DA40's six ports turn into registry.
  const ring = (open: number, len: number) => sleeve(open, open + 0.003, -len / 2, len / 2).rotateY(Math.PI / 2);
  const cage = (r: number) =>
    merge([
      ...[-0.022, 0.022].map((dx) => ring(r, 0.006).translate(dx, 0, 0)),
      ...Array.from({ length: 6 }, (_, i) =>
        sleeve(r, r + 0.002, -0.021, 0.021, (i * Math.PI) / 3, Math.PI / 6, 12).rotateY(Math.PI / 2),
      ),
    ]);
  const parts = [
    detail(
      "Induction air box",
      "acc",
      cessna ? slab(x - 0.068, x + 0.055, y - 0.035, y + 0.035, -0.065, 0.065, 0.009) : cage(0.042).translate(...mount),
      [0.24, -0.52, 0],
      `Filtered induction air passes from the air box to the fuel servo (${src}).`,
    ),
    detail(
      "Induction air filter",
      "filter",
      merge(Array.from({ length: 23 }, (_, i) => box(0.014, 0.063, 0.004).translate(x + 0.061, y, (i - 11) * 0.005))),
      [0.39, -0.53, 0],
      `A pleated filter removes debris from inlet air (${src}).`,
    ),
  ];
  const pivot: Point = cessna ? [x - 0.053, y + 0.033, 0.066] : mount;
  const door = cessna ? box(0.089, 0.058, 0.003).translate(0.044, -0.029, 0) : cage(0.046);
  return { parts, door, pivot };
}

export function installedIgnition(spec: EngineSpec, d: Dims): Detail[] {
  if (spec.illustratedInstallation === "c172s")
    return (["L", "R"] as const).map((side) => {
      const [x, y, z] = magnetoPose(spec, d, side).driveEnd;
      return detail(
        (side === "L" ? "Left" : "Right") + " impulse coupling",
        "steel",
        merge([sleeve(0.012, 0.029, -0.008, 0.008), sleeve(0.02, 0.024, 0.008, 0.012, 0, Math.PI * 1.5)])
          .rotateY(Math.PI / 2)
          .translate(x - 0.012, y, z),
        [-0.25, 0.1, side === "L" ? -0.1 : 0.1],
        "At cranking speed the spring winds up and releases the magneto rotor for a retarded starting spark (L2A IPC Fig. 24).",
      );
    });
  const x = d.accRear - 0.145;
  return [
    detail(
      "SlickSTART ignition booster",
      "black",
      slab(x - 0.018, x + 0.018, 0.092, 0.15, -0.24, -0.154, 0.006),
      [-0.41, 0.21, -0.15],
      "The starting circuit powers SlickSTART during cranking to boost spark energy. The running magnetos supply their own ignition energy (DA40 AFM 7-43, AMM 74-00).",
    ),
    detail(
      "SlickSTART lead",
      "lead",
      tube(
        [
          [x, 0.098, -0.17],
          [x + 0.015, 0.088, -0.155],
          [d.accRear - 0.128, 0.085, -0.15],
          [d.accRear - 0.137, 0.096, -0.145],
          [magnetoPose(spec, d, "L").capEnd[0] - 0.019, 0.097, -0.128],
        ],
        0.0026,
      ),
      [-0.36, 0.15, -0.13],
      "The starting aid connects to the left retard-breaker magneto (DA40 AMM 74-00).",
    ),
  ];
}

export function installedMetering(d: Dims, servo: Point, cessna: boolean): Detail[] {
  const [x, y] = servo;
  if (cessna)
    return [
      detail(
        "Fuel-flow transducer",
        "fuelBody",
        slab(d.caseRear + 0.088, d.caseRear + 0.13, 0.185, 0.214, 0.127, 0.165, 0.005),
        [-0.16, 0.2, 0.23],
        "The turbine transducer measures metered fuel on top of the engine, between the servo and the flow divider (C172S POH 7-40).",
      ),
      detail(
        "Fuel return line",
        "fuelHose",
        tube(
          [
            [x - 0.024, y + 0.007, 0.043],
            [x - 0.051, y - 0.003, 0.083],
            [d.caseRear + 0.045, -0.251, 0.099],
            [d.caseRear - 0.027, -0.245, 0.092],
            [d.accRear - 0.07, -0.16, 0.09],
          ],
          0.0035,
        ),
        [-0.32, -0.31, 0.19],
        "A restricted passage returns fuel and vapor from the servo toward the reservoir (C172S POH 7-39, 7-44).",
      ),
    ];
  return [
    detail(
      "Fuel-flow transducer",
      "fuelBody",
      slab(d.caseRear + 0.025, d.caseRear + 0.078, -0.199, -0.158, -0.158, -0.128, 0.005),
      [-0.2, -0.23, -0.18],
      "The DA40 measures fuel flow between the engine-driven pump and the injection servo (DA40 AFM 7-34).",
    ),
  ];
}
