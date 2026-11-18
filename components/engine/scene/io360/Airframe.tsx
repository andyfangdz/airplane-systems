import { useMemo } from "react";
import * as THREE from "three";
import type { EngineSpec } from "@/engines/types";
import { loft } from "@/lib/geometry";
import { driveLayout, merge, rod, tube, type Dims, type Mats } from "../kit";
import { layoutFor } from "../layout";
import { bankBaffles } from "../io390/accessories";
import { ignitionFeedthrough } from "../io390/lines";
import { parallelOutline } from "../io390/cylinder";
import { Details, useDetailDisposal } from "../io390/Details";
import { hole, plate, section, sleeve, type Detail, type Point } from "../io390/shapes";
import { installedBattery } from "./battery";
import { coolerPosition, detail, firewallX } from "./installation";

/** Folded Cessna ramps. The left ramp's heater takeoff is open through the sheet (172 Series MM 78-10-00). */
function cessnaRamp(d: Dims, side: number) {
  const rear = d.front - 0.018,
    front = d.flangeX - 0.031;
  const angle = Math.atan2(-0.042, front - rear),
    length = (front - rear) / Math.cos(angle);
  const center = side * 0.275,
    half = 0.036;
  const sheet = section([
    [0, -half],
    [length, -half],
    [length, half],
    [0, half],
  ]);
  if (side < 0) hole(sheet, length * 0.5, 0, 0.021);
  const pieces: THREE.BufferGeometry[] = [plate(sheet, -0.001, 0.001).rotateX(Math.PI / 2)];
  for (const edge of [-1, 1]) {
    const cheek = (x: number, width: number, height: number) => {
      const skin = Array.from({ length: 9 }, (_, i) => {
        const a = ((i / 8) * Math.PI) / 2;
        return new THREE.Vector3(x, height * (1 - Math.cos(a)), edge * (half + width * Math.sin(a)));
      });
      return [...skin, ...skin.toReversed().map((p) => p.clone().add(new THREE.Vector3(0, -0.002, 0)))];
    };
    pieces.push(loft([cheek(0, 0.068, 0.049), cheek(length, 0.052, 0.038)]));
  }
  if (side < 0)
    pieces.push(
      sleeve(0.02, 0.023, -0.014, 0)
        .rotateX(-Math.PI / 2)
        .translate(length * 0.5, 0, 0),
    );
  return {
    geometry: merge(pieces).rotateZ(angle).translate(rear, 0.101, center),
    takeoff: new THREE.Vector3(length * 0.5, -0.011, 0)
      .applyAxisAngle(new THREE.Vector3(0, 0, 1), angle)
      .add(new THREE.Vector3(rear, 0.101, center))
      .toArray() as Point,
  };
}

/** The Diamond left inlet has upper and lower intake baffles (AMM 75-00 Fig. 1). */
function diamondIntakeBaffle(d: Dims, side: number, upper: boolean) {
  const ring = (x: number, center: number, halfWidth: number, y: number, height: number) => {
    const points = Array.from({ length: 19 }, (_, i) => {
      const a = (Math.PI * i) / 18;
      return new THREE.Vector3(
        x,
        y + (upper ? 1 : -1) * height * Math.sin(a),
        side * (center + halfWidth * Math.cos(a)),
      );
    });
    return [
      ...points,
      ...points.toReversed().map((p) => p.clone().add(new THREE.Vector3(0, upper ? 0.002 : -0.002, 0))),
    ];
  };
  return loft([
    ring(d.flangeX - 0.031, 0.263, 0.071, 0.093, 0.043),
    ring(d.front + 0.014, 0.269, 0.092, 0.113, 0.044),
    ring(d.front - 0.018, 0.277, d.headOut - 0.294, 0.147, upper ? 0.043 : 0.049),
  ]);
}

function coolingPanels(d: Dims, cessna: boolean, leftRamp: ReturnType<typeof cessnaRamp> | null) {
  const ref = cessna ? "C172S POH 7-37" : "DA40 AMM 75-00, Fig. 1";
  const note = `The baffles seal against the upper cowling and direct inlet air down through the cylinder fins (${ref}).`;
  const rear = d.caseRear + 0.005;
  const parts = bankBaffles(d, parallelOutline, note, [rear, d.front - 0.006]);
  const [, coolerY, coolerZ] = coolerPosition(d, cessna);
  for (const side of [-1, 1]) {
    const name = side > 0 ? "Right" : "Left";
    const rim = d.headOut - 0.014;
    // The panel is drawn in transverse station/height coordinates. The cooler looks through the Cessna right panel.
    const sheet = section([
      [0.084, 0.157],
      [0.148, 0.005],
      [rim, 0.005],
      [rim, 0.145],
      [rim - 0.024, 0.174],
      [0.127, 0.196],
      [0.084, 0.18],
    ]);
    for (const c of d.cylinders.filter((c) => c.side === (side < 0 ? "L" : "R"))) {
      const [, y, z] = ignitionFeedthrough(d, c);
      hole(sheet, Math.abs(z), y, 0.0065);
    }
    if (cessna && side > 0)
      sheet.holes.push(
        section([
          [coolerZ - 0.052, coolerY - 0.047],
          [coolerZ + 0.052, coolerY - 0.047],
          [coolerZ + 0.052, coolerY + 0.047],
          [coolerZ - 0.052, coolerY + 0.047],
        ]),
      );
    parts.push(
      detail(
        name + " rear cooling baffle",
        "baffleSheet",
        plate(sheet, -0.001, 0.001)
          .rotateY((-side * Math.PI) / 2)
          .translate(rear, 0, 0),
        [-0.31, 0.17, side * 0.37],
        note,
      ),
    );
    const seal = section([
      [0.084, 0.173],
      [0.127, 0.19],
      [rim - 0.024, 0.168],
      [rim, 0.14],
      [rim, 0.165],
      [rim - 0.024, 0.196],
      [0.127, 0.217],
      [0.084, 0.199],
    ]);
    parts.push(
      detail(
        name + " rear baffle seal",
        "baffleSeal",
        plate(seal, -0.002, 0.002)
          .rotateY((-side * Math.PI) / 2)
          .translate(rear, 0, 0),
        [-0.36, 0.26, side * 0.4],
        note,
      ),
    );
    if (!cessna)
      parts.push(
        detail(
          name + " baffle tie bar",
          "steel",
          tube(
            [
              [rear, 0.009, side * (rim - 0.018)],
              [rear + 0.009, -0.11, side * (rim + 0.036)],
              [rear + 0.057, -0.145, side * (rim + 0.023)],
              [d.front - 0.066, -0.145, side * (rim + 0.023)],
              [d.front - 0.02, -0.11, side * (rim + 0.036)],
              [d.front - 0.018, 0.127, side * (rim - 0.006)],
            ],
            0.0025,
            24,
          ),
          [0, -0.24, side * 0.32],
          "A tie bar secures the cylinder baffles along the underside of each bank (DA40 AMM 75-00 Fig. 1).",
        ),
      );
    if (cessna || side < 0)
      parts.push(
        detail(
          name + " cooling inlet ramp",
          "baffleSheet",
          cessna ? (side < 0 ? leftRamp! : cessnaRamp(d, side)).geometry : diamondIntakeBaffle(d, side, false),
          [0.32, 0.12, side * 0.25],
          note,
        ),
      );
  }
  if (!cessna)
    parts.push(
      detail(
        "Upper intake baffle",
        "baffleSheet",
        diamondIntakeBaffle(d, -1, true),
        [0.34, 0.29, -0.3],
        "The upper and lower intake baffles form the front duct from the left cowling inlet to the space above the cylinders (DA40 AMM 71-10 and 75-00 Fig. 1).",
      ),
    );
  return parts;
}

function engineMount(spec: EngineSpec, d: Dims, cessna: boolean) {
  const ref = cessna ? "Cessna 172 Series MM ch. 71" : "DA40 AMM 71-20 Fig. 1";
  const wallX = firewallX(d, cessna);
  const frame: THREE.BufferGeometry[] = [];
  const parts: Detail[] = [];
  const bosses = layoutFor(spec).mounts(d).bosses;
  for (const [x, y, z] of bosses) {
    const side = Math.sign(z),
      level = Math.sign(y);
    const foot: Point = [x - 0.048, y, z];
    const pad: Point = [wallX, level > 0 ? 0.19 : -0.17, side * 0.255];
    const otherPad: Point = [wallX, level > 0 ? -0.17 : 0.19, pad[2]];
    frame.push(
      rod(0.022, 0.011).translate(...pad),
      rod(0.026, 0.009).translate(...foot),
      tube([pad, foot], 0.009, 1),
      tube([otherPad, foot], 0.008, 1),
    );
    if (!cessna && level < 0) frame.push(tube([foot, [wallX, -0.22, 0]], 0.009, 1));
    parts.push(
      detail(
        (side > 0 ? "Right " : "Left ") + (level > 0 ? "upper" : "lower") + " engine shock mount",
        "black",
        sleeve(0.007, 0.025, -0.012, 0.012)
          .rotateY(Math.PI / 2)
          .translate(x - 0.032, y, z),
        [-0.24, level * 0.15, side * 0.17],
        `Rubber cushions isolate the crankcase attachment from the steel mount (${ref}).`,
      ),
    );
  }
  if (!cessna) frame.push(rod(0.023, 0.012).translate(wallX, -0.22, 0));
  parts.push(
    detail(
      "Engine mount weldment",
      "darkSteel",
      merge(frame),
      [-0.53, -0.03, 0],
      `The welded tubular frame carries engine loads to the firewall (${ref}).`,
    ),
  );
  if (!cessna) {
    const [x, y, z] = coolerPosition(d, false);
    // Link both cooler flanges to the right-hand upper/lower frame tubes at the cooler station.
    const rightFoot = bosses.find((p) => p[1] > 0 && p[2] > 0)!;
    const t = (x - wallX) / (rightFoot[0] - 0.048 - wallX);
    const bracket = [-1, 1].map((level) =>
      tube(
        [
          [x, y + level * 0.05, z + 0.057],
          [x, y + level * 0.05, z + 0.07],
          [
            x,
            THREE.MathUtils.lerp(level > 0 ? 0.19 : -0.17, level * rightFoot[1], t),
            THREE.MathUtils.lerp(0.255, rightFoot[2], t),
          ],
        ],
        0.005,
        8,
      ),
    );
    parts.push(
      detail(
        "Oil cooler mounting brackets",
        "steel",
        merge(bracket),
        [-0.37, 0.01, 0.31],
        "Brackets support the oil cooler on the engine mounting frame (DA40 AMM 71-20 Fig. 1 and 79-00).",
      ),
    );
  }
  return parts;
}

function accessoryAir(spec: EngineSpec, d: Dims, heaterTakeoff: Point | undefined): Detail[] {
  if (heaterTakeoff) {
    const x = d.accRear,
      y = 0.139;
    return [
      ...installedBattery(d, true),
      detail(
        "Engine-driven vacuum pump",
        "acc",
        merge([
          rod(0.033, 0.081).translate(x - 0.045, y, 0),
          rod(0.041, 0.009).translate(x - 0.004, y, 0),
          sleeve(0.005, 0.009, 0, 0.025)
            .rotateY(Math.PI / 2)
            .translate(x - 0.104, y + 0.015, 0),
        ]),
        [-0.41, 0.32, 0],
        "The accessory drive turns the vacuum pump for the standby attitude indicator (C172S NAV III POH 7-65, equipment list 37-01-R).",
      ),
      detail(
        "Cabin heat inlet hose",
        "duct",
        tube(
          [
            heaterTakeoff,
            [d.front + 0.018, 0.032, -0.269],
            [d.front + 0.018, -0.148, -0.293],
            [d.front - 0.01, -0.298, -0.289],
            [0.11, -0.355, -0.197],
            [0.005, -0.359, -0.104],
            [-0.076, -0.343, -0.104],
          ],
          0.023,
          36,
          20,
        ),
        [0.2, -0.5, -0.57],
        "Outside air enters the heater shroud around the muffler and picks up exhaust heat for the cabin (C172S POH 7-37, Fig. 7-8).",
      ),
    ];
  }
  const ref = "DA40 AMM 71-10, 75-00 and 79-00";
  const inlet: Point = [d.flangeX - 0.018, 0.064, 0.264];
  const bend: Point = [d.front + 0.059, 0.051, 0.3];
  const junction: Point = [d.front + 0.031, 0.038, 0.329];
  const [x, y, z] = coolerPosition(d, false);
  // Sections of the moulded lower cowling passage. Its rectangular aft seal meets the cooler face.
  const ring = ([cx, cy, cz]: Point, h: number, w: number, rectangular = false) =>
    Array.from({ length: 32 }, (_, i) => {
      const a = (i * Math.PI) / 16,
        dy = Math.cos(a),
        dz = Math.sin(a);
      const scale = rectangular ? 1 / Math.max(Math.abs(dy), Math.abs(dz)) : 1;
      return new THREE.Vector3(cx, cy + h * dy * scale, cz + w * dz * scale);
    });
  const throat = ring(junction, 0.038, 0.044);
  const outlet = ring([x + 0.033, y, z], 0.052, 0.063, true);
  const [, ay, az] = driveLayout(spec, d).alternators[0].at;
  return [
    ...installedBattery(d, false, [bend[0] + 0.012, 0.001, 0.28]),
    detail(
      "Supplemental engine cooling outlet",
      "acc",
      loft(
        [
          ring([bend[0], bend[1] + 0.032, bend[2]], 0.016, 0.019),
          ring([junction[0], 0.085, 0.274], 0.017, 0.02),
          ring([junction[0] - 0.038, 0.11, 0.236], 0.019, 0.025),
        ],
        { caps: false },
      ),
      [0.24, 0.22, 0.32],
      "A small outlet in the right intake admits additional cooling air to the engine (DA40 AMM 71-00).",
    ),
    detail(
      "Right accessory air inlet",
      "acc",
      loft([ring(inlet, 0.043, 0.051), ring(bend, 0.041, 0.047), throat], { caps: false }),
      [0.4, 0.13, 0.37],
      `The right cowling inlet supplies cooling and heater air (${ref}).`,
    ),
    detail(
      "Oil cooler air duct",
      "acc",
      loft(
        [
          throat,
          ring([d.front + 0.009, -0.074, d.headOut + 0.106], 0.031, 0.05),
          ring([d.caseRear + 0.045, -0.103, d.headOut + 0.102], 0.032, 0.052),
          ring([d.caseRear - 0.032, -0.089, 0.433], 0.036, 0.054),
          ring([x + 0.059, y - 0.015, z + 0.032], 0.048, 0.059, true),
          outlet,
        ],
        { caps: false },
      ),
      [-0.12, -0.13, 0.52],
      `The lower cowling forms a passage from the right inlet to the oil cooler on the mounting frame (${ref}).`,
    ),
    detail(
      "Oil cooler duct seal",
      "baffleSeal",
      loft([outlet, ring([x + 0.0285, y, z], 0.052, 0.063, true)], { caps: false }),
      [-0.14, -0.06, 0.47],
      "The flexible seal meets the oil cooler when the lower cowling is installed (DA40 AMM 71-10 and 79-00).",
    ),
    detail(
      "Accessory air Y connector",
      "shroud",
      merge([
        tube(
          [
            [bend[0], 0.014, 0.3],
            [bend[0] + 0.012, 0.001, 0.28],
          ],
          0.009,
          1,
        ),
        tube([bend, [bend[0], 0.014, 0.3], [bend[0] - 0.012, -0.004, 0.283]], 0.015, 12),
        tube(
          [
            [bend[0], 0.014, 0.3],
            [bend[0], -0.011, 0.325],
          ],
          0.019,
          8,
        ),
      ]),
      [0.3, -0.06, 0.42],
      "The lower-cowl Y connector feeds the alternator and the exhaust heat exchanger (DA40 AMM 71-10).",
    ),
    detail(
      "Alternator cooling hose",
      "duct",
      tube(
        [
          [bend[0] - 0.012, -0.004, 0.283],
          [d.front + 0.007, -0.071, 0.294],
          [0.215, -0.206, az + 0.1],
          [0.181, ay - 0.106, az + 0.038],
          [0.172, ay - 0.1, az],
          [0.172, ay - 0.057, az],
        ],
        0.014,
        22,
      ),
      [0.18, -0.21, 0.4],
      "The smaller air branch carries ram air to the alternator (DA40 AMM 71-10).",
    ),
    detail(
      "Cabin heat inlet hose",
      "duct",
      tube(
        [
          [bend[0], -0.011, 0.325],
          [d.front + 0.035, -0.134, 0.356],
          [d.front - 0.015, -0.29, 0.352],
          [0.065, -0.367, 0.278],
          [d.caseRear - 0.052, -0.367, 0.162],
          [d.caseRear - 0.155, -0.295, 0.142],
          [d.caseRear - 0.155, -0.296, 0.099],
        ],
        0.019,
        36,
        20,
      ),
      [-0.18, -0.63, 0.55],
      "The heater air branch feeds the shroud around the Power Flow exhaust collector (DA40 AMM 71-10 and PFS-15250-00).",
    ),
  ];
}

export function IO360Airframe({ spec, d, mats }: { spec: EngineSpec; d: Dims; mats: Mats }) {
  const parts = useMemo(() => {
    const cessna = spec.illustratedInstallation === "c172s";
    const leftRamp = cessna ? cessnaRamp(d, -1) : null;
    return [
      ...coolingPanels(d, cessna, leftRamp),
      ...engineMount(spec, d, cessna),
      ...accessoryAir(spec, d, leftRamp?.takeoff),
    ];
  }, [d, spec]);
  useDetailDisposal(parts);
  return <Details parts={parts} mats={mats} />;
}
