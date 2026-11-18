import type { EngineSpec } from "@/engines/types";
import * as THREE from "three";
import { coolerCore } from "@/engines/io390/cooler";
import { bank, magnetoPose, headPoints, merge, slab, toWorld, tube, type Dims } from "../kit";
import { sleeve, type Detail, type Point } from "../io390/shapes";
import { servoInletOffset } from "../io390/installation";

/** Hardware supplied by the airframe. Coordinates and bends are illustrative, in engine metres. */
function detail(
  name: string,
  material: Detail["material"],
  geometry: THREE.BufferGeometry,
  spread: Point,
  note: string,
): Detail {
  return { name, material, geometry, spread, note, role: note };
}

export function installedCooler(d: Dims, cessna: boolean) {
  const x = d.caseRear - (cessna ? 0.025 : 0.11),
    y = cessna ? 0.065 : -0.015,
    z = 0.215;
  const src = cessna ? "C172S POH 7-35" : "DA40 AMM 79-00";
  return [
    detail("Oil cooler", "shroud", coolerCore().translate(x, y, z), [-0.18, 0.06, 0.42], src),
    ...[-1, 1].map((k) =>
      detail(
        k < 0 ? "Oil cooler feed hose" : "Oil cooler return hose",
        "fuelHose",
        tube(
          [
            [d.accRear - 0.019, 0.047, k * 0.051],
            [d.accRear - 0.095, 0.055, k * 0.08],
            [x - 0.115, y + 0.08, z + k * 0.052],
            [x - 0.025, y + 0.08, z + k * 0.052],
            [x, y + 0.045, z + k * 0.052],
          ],
          0.006,
        ),
        [-0.2, k * 0.04, 0.22],
        `The external hoses connect the cooler and accessory housing (${src}).`,
      ),
    ),
  ];
}

export function installedExhaust(d: Dims, cessna: boolean) {
  const y = cessna ? -0.319 : -0.295,
    x = cessna ? -0.06 : d.caseRear - 0.025;
  const ports = headPoints(d);
  const pipes = d.cylinders.map((c) => {
    const [px, py, pz] = toWorld(c, ports.exhaustPort),
      k = bank(c);
    const z = k * (c.n <= 2 ? 0.123 : 0.068);
    const route: Point[] = cessna
      ? [
          [px, -0.18, pz],
          [px, -0.26, k * 0.24],
          [x + (c.n <= 2 ? 0.045 : -0.045), y, z],
          [x, y, z],
        ]
      : [
          [px, -0.19, pz],
          [px - 0.03, -0.26, k * 0.25],
          [x + 0.12, y, k * 0.17],
          [x + 0.064, y, z * 0.63],
        ];
    return tube([[px, py - 0.006, pz], ...route], 0.017, 48, 16);
  });
  const muffler = cessna
    ? sleeve(0.048, 0.054, -0.174, 0.174).translate(x, y, 0)
    : slab(x - 0.066, x + 0.066, y - 0.034, y + 0.035, -0.109, 0.109, 0.021);
  const heatMuff = cessna
    ? sleeve(0.061, 0.064, -0.146, 0.146).translate(x, y, 0)
    : sleeve(0.046, 0.049, -0.095, 0.095)
        .rotateY(Math.PI / 2)
        .translate(x - 0.13, y, 0.05);
  const collectors = cessna
    ? []
    : [
        sleeve(0.035, 0.043, -0.09, 0.09)
          .rotateY(Math.PI / 2)
          .translate(x - 0.13, y, 0.05),
      ];
  const outlet: Point = cessna ? [x, y, 0.174] : [x - 0.22, y, 0.05];
  const tail = tube(
    [outlet, [outlet[0] - 0.022, y - 0.025, outlet[2] + 0.021], [outlet[0] - 0.056, y - 0.105, outlet[2] + 0.037]],
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
          [d.accRear - 0.09, 0.08, -0.13],
          magnetoPose(spec, d, "L").capEnd,
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
            [x - 0.018, y + 0.03, 0.036],
            [x - 0.05, y + 0.035, 0.075],
            [d.caseRear + 0.045, -0.19, 0.085],
            [d.accRear - 0.07, -0.16, 0.09],
          ],
          0.0035,
        ),
        [-0.18, -0.26, 0.18],
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
