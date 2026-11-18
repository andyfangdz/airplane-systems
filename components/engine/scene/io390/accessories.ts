import * as THREE from "three";
import { loft } from "@/lib/geometry";
import { rockerOutline } from "./cylinder";
import { servoPosition } from "./installation";
import { nozzleLinePoints } from "./lines";
import { bank, driveLayout, headPoints, magDrive, merge, rod, toWorld, tube, zrod, type Dims } from "../kit";
import type { EngineSpec } from "@/engines/types";
import {
  bolt,
  hole,
  item,
  items,
  atStations,
  nut,
  plate,
  section,
  sleeve,
  stations,
  type Detail,
  type Point,
  type XY,
} from "./shapes";

function pad(rx: number, ry: number, bore: number, depth: number) {
  const s = section([
    [-rx, -ry * 0.65],
    [-rx * 0.7, -ry],
    [rx * 0.7, -ry],
    [rx, -ry * 0.65],
    [rx, ry * 0.7],
    [rx * 0.7, ry],
    [-rx * 0.7, ry],
    [-rx, ry * 0.7],
  ]);
  if (bore) hole(s, 0, 0, bore);
  return plate(s, 0, depth);
}

function eyes(a: Point, b: Point, r: number) {
  return merge([
    tube([a, b], r * 0.62, 1, 4),
    ...([a, b] as Point[]).map((p) =>
      sleeve(r * 0.37, r, -0.003, 0.003)
        .rotateY(Math.PI / 2)
        .translate(...p),
    ),
  ]);
}

export function alternatorBell(length: number, rear: boolean) {
  // Front and aft end bells have open cooling windows; the stator stack is visible between them.
  const face = new THREE.Shape().absarc(0, 0, 0.057, 0, 2 * Math.PI, false);
  for (const [x, y] of stations(10, 0.042)) hole(face, x, y, 0.009);
  hole(face, 0, 0, 0.012);
  const axial = (g: THREE.BufferGeometry) => g.rotateY(Math.PI / 2);
  if (!rear) return axial(plate(face, -0.028, -0.019, 0.001));
  return merge([
    axial(plate(face, -length - 0.021, -length - 0.014, 0.001)),
    ...[-1, 1].map((k) => axial(pad(0.011, 0.016, 0.0045, 0.012)).translate(-length - 0.015, k * 0.057, 0)),
  ]);
}

export function fanPulley(d: Dims) {
  return merge([
    sleeve(0.006, d.altPulleyR, -0.006, 0.006).rotateY(Math.PI / 2),
    ...[-0.008, 0.008].map((x) => rod(d.altPulleyR + 0.003, 0.003, 36).translate(x, 0, 0)),
    rod(0.008, 0.032, 12).translate(-0.002, 0, 0),
  ]);
}
export function alternatorFan(): Detail[] {
  const blades = Array.from({ length: 12 }, (_, i) =>
    new THREE.BoxGeometry(0.009, 0.02, 0.003)
      .rotateX(0.32)
      .translate(-0.013, 0.04, 0)
      .rotateX((i * Math.PI) / 6),
  );
  const src = "Lycoming IPC Fig. 2 and Cirrus SR20 AMM 24-30. Fan and pulley dimensions are illustrative.";
  return [
    {
      name: "Alternator pulley nut",
      geometry: nut(0.006)
        .rotateY(Math.PI / 2)
        .translate(0.012, 0, 0),
      material: "darkSteel",
      note: "Self-locking pulley nut. Lycoming IPC Fig. 1B–20, STD-2221.",
      spread: [0.211, 0, 0],
    },
    {
      name: "Alternator pulley washer",
      geometry: sleeve(0.0065, 0.0127, 0.009, 0.012).rotateY(Math.PI / 2),
      material: "steel",
      note: "Washer under the pulley nut. Lycoming IPC Fig. 1B–19, STD-669.",
      spread: [0.181, 0, 0],
    },
    { name: "Alternator fan", material: "shroud", geometry: merge(blades), note: src, spread: [0.09, 0, 0] },
    {
      name: "Alternator fan spacer",
      material: "steel",
      geometry: sleeve(0.006, 0.01, -0.014, -0.009).rotateY(Math.PI / 2),
      note: src,
      spread: [0.112, 0, 0],
    },
    {
      name: "Alternator fan backplate",
      material: "darkSteel",
      geometry: sleeve(0.008, 0.046, -0.021, -0.02).rotateY(Math.PI / 2),
      note: src,
      spread: [0.055, 0, 0],
    },
  ];
}

export function driveHardware(spec: EngineSpec, d: Dims) {
  const drive = driveLayout(spec, d);
  const parts: Detail[] = [];
  for (const { at, def } of drive.alternators) {
    const [x, y, z] = at,
      k = Math.sign(z);
    const bracket: Point = [x - 0.085, -0.063, k * 0.106],
      pivot: Point = [x - 0.09, y + 0.043, z - k * 0.02],
      ear: Point = [x - 0.025, y - 0.035, z - k * 0.025];
    parts.push(
      item(
        def.name + " mounting brackets",
        "07A22097 / 07A19880 / 07A21908 / 07A21910",
        "1B",
        "acc",
        merge([
          eyes(bracket, pivot, 0.014),
          eyes([bracket[0] + 0.055, bracket[1], bracket[2]], [pivot[0] + 0.055, pivot[1], pivot[2]], 0.014),
        ]),
        "The rigid mounting ears carry the alternator beside the crankcase.",
        [0.09, -0.09, k * 0.19],
      ),
      item(
        def.name + " adjusting link",
        "07F21298",
        "1B–11",
        "steel",
        eyes([d.front - 0.01, d.caseBottom, k * 0.075], ear, 0.009),
        "The slotted link sets belt tension as the alternator pivots.",
        [0.1, -0.14, k * 0.19],
      ),
      ...items(
        def.name + " pivot bolt",
        k > 0 ? "AN6-15" : "AN6-21",
        "1B–13–16",
        "darkSteel",
        [
          bolt(0.0047, 0.078)
            .rotateY(-Math.PI / 2)
            .translate(...pivot),
        ],
        "The pivot bolt, slotted nut and cotter secure the bracket.",
        [0.17, -0.1, k * 0.19],
      ),
      ...items(
        def.name + " pivot nut",
        "STD-872",
        "1B–13–16",
        "darkSteel",
        [
          nut(0.0047)
            .rotateY(Math.PI / 2)
            .translate(pivot[0] + 0.073, pivot[1], pivot[2]),
        ],
        "The pivot bolt, slotted nut and cotter secure the bracket.",
        [0.2, -0.1, k * 0.19],
      ),
      ...items(
        def.name + " adjusting link bolt",
        "LW-31H2.13",
        "1B",
        "darkSteel",
        [
          bolt(0.004, 0.025)
            .rotateY(Math.PI / 2)
            .translate(...ear),
        ],
        "Secures the adjusting link at the alternator ear.",
        [0.17, -0.1, k * 0.19],
      ),
      ...items(
        def.name + " pivot cotter pin",
        "STD-713",
        "1B",
        "darkSteel",
        [
          tube(
            [
              [0, -0.006, 0],
              [0, 0.007, 0],
              [0.004, 0.01, 0],
              [0.005, 0.005, 0],
            ],
            0.0008,
            12,
            6,
          ).translate(pivot[0] + 0.078, pivot[1], pivot[2]),
        ],
        "The pivot bolt, slotted nut and cotter secure the bracket.",
        [0.23, -0.1, k * 0.19],
      ),
      ...items(
        def.name + " pivot spacer",
        "01L21916",
        "1B–9, 21",
        "steel",
        [
          sleeve(0.0048, 0.009, 0.006, 0.03)
            .rotateY(Math.PI / 2)
            .translate(...pivot),
        ],
        "Spacers locate the mounting ears along the pivot bolt.",
        [0.13, -0.1, k * 0.19],
      ),
      ...items(
        def.name + " pivot washer",
        "STD-690",
        "1B–9",
        "steel",
        [-0.002, 0.031].map((dx) =>
          sleeve(0.0048, 0.009, 0, 0.0014)
            .rotateY(Math.PI / 2)
            .translate(pivot[0] + dx, pivot[1], pivot[2]),
        ),
        "Spacers locate the mounting ears along the pivot bolt.",
        [0.15, -0.1, k * 0.19],
      ),
    );
  }
  if (drive.starter.kind === "front-ring") {
    const [x, y, z] = drive.starter.at;
    const at = (g: THREE.BufferGeometry) => g.rotateX(-Math.PI / 2).translate(x - 0.043, y + 0.033, z);
    const holes: XY[] = [
      [-0.018, -0.021],
      [0.018, -0.021],
      [-0.018, 0.021],
      [0.018, 0.021],
    ];
    parts.push(
      item(
        "Starter mounting pad",
        "31B22105",
        "28–1",
        "acc",
        at(pad(0.032, 0.029, 0, 0.009)),
        "The nose casting locates the starter pinion beside the ring gear.",
        [0.1, -0.1, -0.18],
      ),
      ...items(
        "Starter mounting washer",
        "STD-475",
        "28–2–4",
        "steel",
        atStations(holes, () => sleeve(0.004, 0.007, 0.009, 0.0105)).map(at),
        "Three nuts and one bolt retain the starter on its pad.",
        [0.12, -0.17, -0.18],
      ),
      ...items(
        "Starter mounting nut",
        "STD-1410",
        "28–2–4",
        "steel",
        atStations(holes.slice(0, 3), () => nut(0.004), 0.0105).map(at),
        "Three nuts and one bolt retain the starter on its pad.",
        [0.12, -0.2, -0.18],
      ),
      ...items(
        "Starter mounting bolt",
        "LW-31-0.94",
        "28–2–4",
        "steel",
        [at(bolt(0.004, 0.024).translate(...holes[3], 0.0105))],
        "Three nuts and one bolt retain the starter on its pad.",
        [0.12, -0.2, -0.18],
      ),
    );
  }
  if (!spec.accessories.governorRatio) return parts;
  const g = drive.governor.at;
  parts.push(
    item(
      "Governor pad gasket",
      "72053",
      "3–8",
      "black",
      pad(0.036, 0.039, 0.019, 0.002)
        .rotateY(Math.PI / 2)
        .translate(g[0] + 0.03, g[1], g[2]),
      "The front governor mounts over the driven shaft.",
      [0.16, 0.12, -0.07],
    ),
    item(
      "Governor idler shaft",
      "LW-14021",
      "3–2",
      "steel",
      rod(0.005, 0.045).translate(d.front - 0.03, d.camY - 0.055 * Math.SQRT1_2, -0.055 * Math.SQRT1_2),
      "The idler gear rotates on this shaft in the nose of the case.",
      [0.07, 0.08, -0.04],
    ),
    item(
      "Governor idler shaft gasket",
      "70455",
      "3–6",
      "bearing",
      sleeve(0.0099, 0.0143, 0, 0.0008)
        .rotateY(Math.PI / 2)
        .translate(d.front - 0.004, d.camY - 0.055 * Math.SQRT1_2, -0.055 * Math.SQRT1_2),
      "Seals the plug against the idler shaft bore.",
      [0.106, 0.08, -0.04],
    ),
    item(
      "Governor idler shaft plug",
      "LW-13896",
      "3–7",
      "darkSteel",
      rod(0.009, 0.012, 6).translate(d.front + 0.002, d.camY - 0.055 * Math.SQRT1_2, -0.055 * Math.SQRT1_2),
      "The plug closes the bore for the idler shaft.",
      [0.13, 0.08, -0.04],
    ),
  );
  return parts;
}

// The side baffles and flexible edge seals follow each installation’s rocker outline and staggered cylinders.
export function bankBaffles(d: Dims, coverOutline: XY[], note: string, ends?: [number, number]): Detail[] {
  const parts: Detail[] = [];
  const add = (name: string, material: Detail["material"], geometry: THREE.BufferGeometry, spread: Point) =>
    parts.push({ name, material, geometry, spread, note, role: note });
  for (const k of [-1, 1]) {
    const label = k > 0 ? "Right" : "Left",
      cylinders = d.cylinders.filter((c) => bank(c) === k);
    const x0 = ends?.[0] ?? Math.min(...cylinders.map((c) => c.x)) - 0.098,
      x1 = ends?.[1] ?? Math.max(...cylinders.map((c) => c.x)) + 0.099;
    const z = d.headOut - 0.014;
    const outline = section([
      [x0, -0.024],
      [x1 - 0.015, -0.024],
      [x1, 0.015],
      [x1, 0.144],
      [x1 - 0.033, 0.171],
      [x0 + 0.034, 0.171],
      [x0, 0.143],
    ]);
    for (const c of cylinders)
      outline.holes.push(section(coverOutline.map(([x, y]) => [c.x + x * 1.043, (y - 0.064) * 1.045 + 0.064])));
    const wall = plate(outline, k * z - 0.0009, k * z + 0.0009);
    add(label + " cylinder bank baffle", "baffleSheet", wall, [0, 0.038, k * 0.63]);
    const stations: XY[] = [
      [x0, 0.141],
      [x0 + 0.034, 0.169],
      [x1 - 0.033, 0.169],
      [x1, 0.142],
    ];
    const lip = loft(
      stations.map(([x, y]) => [
        new THREE.Vector3(x, y - 0.011, k * (z + 0.001)),
        new THREE.Vector3(x, y + 0.009, k * (z + 0.002)),
        new THREE.Vector3(x, y + 0.026, k * (z - 0.006)),
        new THREE.Vector3(x, y + 0.026, k * (z - 0.008)),
        new THREE.Vector3(x, y + 0.008, k * z),
        new THREE.Vector3(x, y - 0.011, k * (z - 0.001)),
      ]),
    );
    add(label + " cylinder baffle seal", "baffleSeal", lip, [0, 0.12, k * 0.7]);
    for (let i = 0; i < 6; i++) {
      const x = x0 + 0.037 + (i * (x1 - x0 - 0.074)) / 5;
      add(
        label + " baffle seal rivet (" + (i + 1) + ")",
        "steel",
        zrod(0.003, -0.0015, 0.0015, 12).translate(x, 0.163, k * (z + 0.0024)),
        [0, 0.17, k * 0.75],
      );
    }
  }
  return parts;
}

function cowlBaffles(d: Dims) {
  const note =
    "Cooling baffles guide inlet air through the cylinder fins (SR20 POH 7-40). Panel outlines and seal attachment positions are illustrative.";
  const parts = bankBaffles(d, rockerOutline, note);
  const add = (name: string, material: Detail["material"], geometry: THREE.BufferGeometry, spread: Point) =>
    parts.push({ name, material, geometry, spread, note });
  const arch = (inner: number, outer: number, back: number, front: number) => {
    const s = new THREE.Shape().absarc(0, 0, outer, 0.06, Math.PI - 0.06, false);
    s.absarc(0, 0, inner, Math.PI - 0.06, 0.06, true);
    s.closePath();
    return plate(s, back, front).rotateY(Math.PI / 2);
  };
  add(
    "Forward cooling baffle arch",
    "baffleSheet",
    arch(0.146, 0.187, d.front + 0.007, d.front + 0.009),
    [0.4, 0.19, 0],
  );
  add(
    "Forward cooling baffle seal",
    "baffleSeal",
    arch(0.175, 0.211, d.front + 0.01, d.front + 0.012),
    [0.46, 0.24, 0],
  );
  return parts;
}

export function coolingBaffles(d: Dims, cirrusBaffles = true) {
  const parts = cirrusBaffles ? cowlBaffles(d) : [];
  for (const side of ["L", "R"] as const) {
    const k = side === "L" ? -1 : 1;
    const pair = d.cylinders.filter((c) => c.side === side);
    const x = (pair[0].x + pair[1].x) / 2;
    const at = (g: THREE.BufferGeometry) => g.translate(x, 0, k * (d.caseHalf + 0.061));
    const s = section([
      [-0.067, -0.063],
      [-0.033, -0.077],
      [0, -0.081],
      [0.033, -0.077],
      [0.067, -0.063],
      [0.065, -0.059],
      [0.03, -0.072],
      [0, -0.075],
      [-0.03, -0.072],
      [-0.065, -0.059],
    ]);
    let panel: THREE.BufferGeometry = plate(s, -0.052, 0.052);
    if (!cirrusBaffles && side === "R") {
      // The IO-360 right baffle has a grommet in its inboard flange (L2A Fig. 12, M1A Fig. 13).
      const flange = section([
        [-0.016, -0.051],
        [0.016, -0.051],
        [0.016, -0.075],
        [-0.016, -0.075],
      ]);
      hole(flange, 0, -0.064, 0.0075);
      const place = (g: THREE.BufferGeometry) => g.rotateX(Math.PI / 2).translate(0, -0.078, 0);
      panel = merge([panel, place(plate(flange, -0.001, 0.001))]);
      const note = "The rubber grommet lines the opening in the right intercylinder baffle.";
      parts.push({
        name: "Right intercylinder baffle grommet",
        role: note,
        note,
        material: "black",
        geometry: at(place(sleeve(0.0055, 0.0095, -0.002, 0.002).translate(0, -0.064, 0))),
        spread: [0, -0.22, k * 0.34],
      });
    }
    parts.push(
      item(
        side + " intercylinder cooling baffle",
        k === 1 ? "75337" : "75338",
        "14–8",
        "shroud",
        at(panel),
        "Formed sheet metal between the barrels directs cooling air through the fins.",
        [0, -0.14, k * 0.3],
      ),
      item(
        side + " baffle hook",
        "17M23284",
        "14–10",
        "steel",
        at(
          tube(
            [
              [0, -0.077, 0],
              [0, 0.078, 0],
              [0, 0.083, 0.01],
              [0, 0.078, 0.014],
            ],
            0.0016,
            18,
            6,
          ),
        ),
        "Hooks the retainer to the intercylinder baffle.",
        [0, -0.21, k * 0.3],
      ),
      item(
        side + " baffle retainer",
        "71611",
        "14–9",
        "steel",
        at(new THREE.BoxGeometry(0.09, 0.002, 0.012).translate(0, 0.077, 0)),
        "The hook bears against the retainer.",
        [0, -0.14, k * 0.3],
      ),
    );
    if (cirrusBaffles)
      parts.push(
        item(
          side + " ignition cable hole cover",
          "72834",
          "14–11",
          "darkSteel",
          at(new THREE.BoxGeometry(0.026, 0.002, 0.025).translate(0.025, -0.074, 0.022)),
          "The small cover closes the ignition-lead opening.",
          [0, -0.25, k * 0.3],
        ),
      );
  }
  return parts;
}

export function rockerDrains(d: Dims, parallel = false) {
  const tubes = ["72702", "72703", "74808", "73027"];
  return d.cylinders.flatMap((c) => {
    const k = bank(c),
      out = d.headOut - 0.023;
    const place = (g: THREE.BufferGeometry) => g.rotateY(k === 1 ? 0 : Math.PI).translate(c.x, 0, 0);
    const points: Point[] = [
      [0.032, parallel ? 0.0005 : -0.006, out],
      [0.044, -0.054, out + 0.004],
      [0.073, -0.112, out + 0.003],
      [0.075, -0.121, out - 0.063],
      [0.015, -0.109, d.caseHalf + 0.095],
      [0, -0.1, d.caseHalf + 0.065],
      [0, -0.1, d.caseHalf + 0.036],
    ];
    const suffix = ", cylinder " + c.n;
    return [
      item(
        "Rocker box oil drain" + suffix,
        tubes[c.n - 1],
        "14–" + (3 + c.n),
        "steel",
        place(tube(points, 0.0048, 28, 10)),
        "Oil leaving the rocker box returns to the crankcase through this formed tube.",
        [c.n <= 2 ? 0.14 : -0.14, -0.12, k * 0.29],
      ),
      item(
        "Drain hose" + suffix,
        "STD-2180",
        "14–2",
        "black",
        place(sleeve(0.0048, 0.0072, d.caseHalf + 0.009, d.caseHalf + 0.05).translate(0, -0.1, 0)),
        "A short hose joins the drain tube to its crankcase nipple.",
        [c.n <= 2 ? 0.14 : -0.14, -0.12, k * 0.18],
      ),
      ...items(
        "Drain hose clamp" + suffix,
        "LW-15592-5-04",
        "14–3",
        "steel",
        [0.015, 0.041].map((a) =>
          place(sleeve(0.0072, 0.008, d.caseHalf + a, d.caseHalf + a + 0.005).translate(0, -0.1, 0)),
        ),
        "Two clamps secure the hose ends.",
        [c.n <= 2 ? 0.14 : -0.14, -0.17, k * 0.18],
      ),
      item(
        "Drain nipple" + suffix,
        "STD-684",
        "14–1",
        "bearing",
        place(zrod(0.0055, d.caseHalf - 0.01, d.caseHalf + 0.026).translate(0, -0.1, 0)),
        "The nipple opens into the crankcase.",
        [c.n <= 2 ? 0.14 : -0.14, -0.12, k * 0.12],
      ),
    ];
  });
}

export function portHardware(d: Dims) {
  const hp = headPoints(d);
  return d.cylinders.flatMap((c) => {
    const suffix = ", cylinder " + c.n;
    const at = (p: Point, g: THREE.BufferGeometry) => g.rotateX(Math.PI / 2).translate(...toWorld(c, p));
    const sites: XY[] = [
      [-0.027, 0],
      [0.027, 0],
    ];
    const intake = (g: THREE.BufferGeometry) => at(hp.intakePort, g);
    const exhaust = (g: THREE.BufferGeometry) => at(hp.exhaustPort, g);
    return [
      item(
        "Intake flange gasket" + suffix,
        "71973",
        "15–6",
        "black",
        intake(pad(0.034, 0.025, 0.018, 0.002)),
        "The two-bolt gasket seals the intake pipe at the head.",
        [c.n <= 2 ? 0.14 : -0.14, -0.12, bank(c) * 0.44],
      ),
      ...items(
        "Intake flange bolt" + suffix,
        "LW-25-1.25",
        "15–7–9",
        "steel",
        atStations(sites, () => bolt(0.0032, 0.03), 0.008).map(intake),
        "Two bolts retain each intake flange.",
        [c.n <= 2 ? 0.14 : -0.14, -0.2, bank(c) * 0.44],
      ),
      ...items(
        "Intake flange plain washer" + suffix,
        "STD-8",
        "15–7–9",
        "steel",
        atStations(sites, () => sleeve(0.0032, 0.007, -0.003, -0.0015), 0.008).map(intake),
        "Two bolts retain each intake flange.",
        [c.n <= 2 ? 0.14 : -0.14, -0.15, bank(c) * 0.44],
      ),
      ...items(
        "Intake flange lock washer" + suffix,
        "STD-160",
        "15–7–9",
        "steel",
        atStations(sites, () => sleeve(0.0032, 0.0065, -0.0015, 0, 0.05, 6.12), 0.008).map(intake),
        "Two bolts retain each intake flange.",
        [c.n <= 2 ? 0.14 : -0.14, -0.175, bank(c) * 0.44],
      ),
      item(
        "Intake pipe seal" + suffix,
        "72711",
        "15–1",
        "black",
        sleeve(0.016, 0.02, -0.004, 0.004).translate(
          toWorld(c, hp.intakePort)[0],
          d.sumpBottom - 0.031,
          bank(c) * 0.079,
        ),
        "The runner enters the induction housing through a seal.",
        [c.n <= 2 ? 0.14 : -0.14, -0.27, bank(c) * 0.15],
      ),
      item(
        "Exhaust flange gasket" + suffix,
        "77611",
        "11–17",
        "bearing",
        exhaust(pad(0.034, 0.025, 0.018, 0.002)),
        "The exhaust gasket fits between the head and the riser flange.",
        [c.n <= 2 ? 0.14 : -0.14, -0.13, bank(c) * 0.44],
      ),
      ...items(
        "Exhaust flange stud" + suffix,
        "31C-13",
        "11–7",
        "steel",
        atStations(sites, () => zrod(0.004, -0.018, 0.019, 10)).map((piece) => exhaust(piece)),
        "A pair of studs projects below the exhaust port.",
        [c.n <= 2 ? 0.14 : -0.14, -0.08, bank(c) * 0.44],
      ),
      ...items(
        "Exhaust flange nut" + suffix,
        "STD-1410",
        "11–14–16",
        "darkSteel",
        atStations(sites, () => nut(0.004).translate(0, 0, 0.003), 0.008).map(exhaust),
        "The nuts clamp the exhaust flange to the head.",
        [c.n <= 2 ? 0.14 : -0.14, -0.23, bank(c) * 0.44],
      ),
      ...items(
        "Exhaust flange plain washer" + suffix,
        "STD-35",
        "11–14–16",
        "darkSteel",
        atStations(sites, () => sleeve(0.004, 0.007, 0, 0.0015), 0.008).map(exhaust),
        "The nuts clamp the exhaust flange to the head.",
        [c.n <= 2 ? 0.14 : -0.14, -0.17, bank(c) * 0.44],
      ),
      ...items(
        "Exhaust flange lock washer" + suffix,
        "STD-475",
        "11–14–16",
        "darkSteel",
        atStations(sites, () => sleeve(0.004, 0.007, 0.0015, 0.003, 0.05, 6.12), 0.008).map(exhaust),
        "The nuts clamp the exhaust flange to the head.",
        [c.n <= 2 ? 0.14 : -0.14, -0.2, bank(c) * 0.44],
      ),
    ];
  });
}

export function ignitionHardware(spec: EngineSpec, d: Dims) {
  return (["L", "R"] as const).flatMap((side) => {
    const m = magDrive(spec, d, undefined, side);
    const z = (side === "L" ? -1 : 1) * m.z;
    const at = (g: THREE.BufferGeometry) => g.rotateY(-Math.PI / 2).translate(d.accRear, m.y, z);
    return [
      item(
        side + " magneto gasket",
        "LW-12681",
        "27–3",
        "black",
        at(sleeve(0.031, 0.049, -0.0015, 0.001)),
        "The gasket seals the magneto mounting pad.",
        [-0.34, 0.1, 0],
      ),
      ...items(
        side + " magneto clamp",
        "66M21195",
        "27–8",
        "steel",
        atStations(
          [
            [-0.045, 0],
            [0.045, 0],
          ],
          () => pad(0.01, 0.007, 0.0039, 0.007),
        ).map((piece) => at(piece)),
        "Two toe clamps secure the flange while allowing timing adjustment.",
        [-0.46, 0.1, 0],
      ),
      ...items(
        side + " magneto clamp nut",
        "STD-1410",
        "27–9, 10",
        "darkSteel",
        atStations(
          [
            [-0.045, 0],
            [0.045, 0],
          ],
          () => nut(0.004),
          0.009,
        ).map(at),
        "Each magneto clamp is secured with a lock washer and nut.",
        [-0.51, 0.1, 0],
      ),
      ...items(
        side + " magneto clamp washer",
        "STD-475",
        "27–9, 10",
        "darkSteel",
        atStations(
          [
            [-0.045, 0],
            [0.045, 0],
          ],
          () => sleeve(0.004, 0.007, 0.007, 0.009),
        ).map(at),
        "Each magneto clamp is secured with a lock washer and nut.",
        [-0.485, 0.1, 0],
      ),
      item(
        side + " idler gear shaft",
        "LW-13796",
        "8–6",
        "steel",
        rod(0.009, 0.034).translate(d.caseRear - 0.009, m.idler!.y, m.idler!.z),
        "A fixed shaft supports the idler.",
        [-0.09, 0.09, 0],
      ),
    ];
  });
}

export function fuelHardware(d: Dims, [ix, iy]: Point = servoPosition(d), updraft = false, parallel = false) {
  const mx = (Math.min(...d.cylinders.map((c) => c.x)) + Math.max(...d.cylinders.map((c) => c.x))) / 2,
    my = d.caseTop + 0.035;

  const parts: Detail[] = [
    ...[-1, 1].map((side): Detail => ({
      name: side < 0 ? "Servo inlet hose fitting" : "Servo metered outlet fitting",
      material: "steel",
      geometry: merge([zrod(0.0075, 0, 0.016, 6), sleeve(0.0048, 0.0065, 0.014, 0.023)])
        .rotateY(side < 0 ? Math.PI : 0)
        .translate(ix, iy, side * (side < 0 ? 0.031 : 0.056)),
      spread: [0.16, -0.36, side * 0.09],
      note: "Hose connection on the modeled fuel servo. Fitting contours are approximate (IPC Fig. 25A).",
    })),
    item(
      "Fuel manifold support brackets",
      "07A23031 / 07A23032",
      "25A–16, 17",
      "steel",
      merge(
        [-1, 1].map((k) =>
          tube(
            [
              [mx + k * 0.025, d.caseTop + 0.006, 0],
              [mx + k * 0.024, my - 0.012, 0],
              [mx + k * 0.014, my - 0.012, 0],
            ],
            0.005,
            6,
            4,
          ),
        ),
      ),
      "Two brackets support the flow divider above the case joint.",
      [0, 0.44, 0],
    ),
    ...items(
      "Flow-divider mounting screw",
      "73966 / STD-82 / STD-251",
      "25A–15, 20, 21",
      "darkSteel",
      [-1, 1].flatMap((k) =>
        [-1, 1].map((j) =>
          bolt(0.0025, 0.013)
            .rotateX(Math.PI / 2)
            .translate(mx + k * 0.016, my - 0.013, j * 0.01),
        ),
      ),
      "Screws and lock washers attach the divider to the brackets.",
      [0, 0.58, 0],
    ),
    ...items(
      "Flow-divider mounting washer",
      "STD-251",
      "25A–15, 20, 21",
      "darkSteel",
      [-1, 1].flatMap((k) =>
        [-1, 1].map((j) =>
          sleeve(0.0025, 0.005, 0, 0.001)
            .rotateX(Math.PI / 2)
            .translate(mx + k * 0.016, my - 0.012, j * 0.01),
        ),
      ),
      "Screws and lock washers attach the divider to the brackets.",
      [0, 0.55, 0],
    ),
    item(
      "Injector air inlet gaskets",
      "73032 / 06B28651",
      "25A–1, 3",
      "black",
      merge(
        [-0.044, 0.044].map((x) =>
          updraft
            ? pad(0.049, 0.041, 0.032, 0.0018)
                .rotateY(Math.PI / 2)
                .rotateZ(-Math.PI / 2)
                .translate(ix, iy - x, 0)
            : pad(0.049, 0.041, 0.032, 0.0018)
                .rotateY(Math.PI / 2)
                .translate(ix + x, iy, 0),
        ),
      ),
      "Gaskets seal the servo's induction flanges.",
      parallel ? [0.22, -0.56, -0.2] : [0.13, -0.37, 0],
    ),
    ...items(
      "Fuel injector mounting nut",
      "STD-1410",
      "25A–6",
      "steel",
      atStations(stations(4, 0.047, 0.047, Math.PI / 4), () => nut(0.004)).map((piece) =>
        updraft
          ? piece
              .rotateY(Math.PI / 2)
              .rotateZ(-Math.PI / 2)
              .translate(ix, iy - 0.049, 0)
          : piece.rotateY(Math.PI / 2).translate(ix + 0.049, iy, 0),
      ),
      "Four nuts clamp the servo to its flange.",
      [0.24, -0.37, 0],
    ),
    item(
      "Fuel pump mounting gasket",
      "60096",
      "20–1",
      "black",
      pad(0.041, 0.029, 0.012, 0.0018)
        .rotateY(Math.PI / 2)
        .translate(d.accRear, -0.06, -0.09),
      "The diaphragm pump mounts on the accessory housing.",
      [-0.33, -0.14, 0],
    ),
    ...items(
      "Fuel pump mounting screw",
      "STD-1882 / STD-33",
      "20–3, 4",
      "steel",
      atStations(
        [
          [-0.032, 0],
          [0.032, 0],
        ],
        () => bolt(0.0047, 0.032),
      ).map((piece) => piece.rotateY(-Math.PI / 2).translate(d.accRear - 0.01, -0.06, -0.09)),
      "Two socket-head screws retain the fuel pump.",
      [-0.52, -0.14, 0],
    ),
  ];
  for (const c of d.cylinders) {
    const k = bank(c);
    const curve = new THREE.CatmullRomCurve3(nozzleLinePoints(c, d, [mx, my, 0]).map((p) => new THREE.Vector3(...p)));
    // Rotate the whole cushioned loop and its lug into the section normal to the fuel line.
    // The screw passes through the offset lug, clear of the fuel tube.
    const clamps = [0.42, 0.76].map((t) =>
      new THREE.Matrix4().compose(
        curve.getPoint(t),
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), curve.getTangent(t)),
        new THREE.Vector3(1, 1, 1),
      ),
    );
    parts.push(
      ...items(
        "Nozzle line clamp, cylinder " + c.n,
        "LW-16266-10-75 / LW-16266-10-13",
        "26B–3, 4",
        "steel",
        clamps.map((m) =>
          merge([
            sleeve(0.00325, 0.005, -0.003, 0.003),
            new THREE.BoxGeometry(0.006, 0.002, 0.006).translate(0.007, 0, 0),
          ]).applyMatrix4(m),
        ),
        "Two pairs of cushioned clamps support this cylinder’s injector line.",
        [c.n <= 2 ? 0.14 : -0.14, 0.39, k * 0.12],
      ),
      ...items(
        "Nozzle line clamp screw, cylinder " + c.n,
        "STD-860",
        "26B–5, 6",
        "darkSteel",
        clamps.map((m) =>
          bolt(0.0024, 0.014)
            .rotateX(Math.PI / 2)
            .translate(0.008, -0.002, 0)
            .applyMatrix4(m),
        ),
        "Screws and locknuts join the injector line clamps.",
        [c.n <= 2 ? 0.14 : -0.14, 0.43, k * 0.12],
      ),
      ...items(
        "Nozzle line clamp locknut, cylinder " + c.n,
        "STD-670",
        "26B–5, 6",
        "darkSteel",
        clamps.map((m) =>
          nut(0.0024)
            .rotateX(Math.PI / 2)
            .translate(0.008, 0.006, 0)
            .applyMatrix4(m),
        ),
        "Screws and locknuts join the injector line clamps.",
        [c.n <= 2 ? 0.14 : -0.14, 0.46, k * 0.12],
      ),
      item(
        "Flow-divider outlet, cylinder " + c.n,
        "STD-148",
        "25A–11",
        "bearing",
        zrod(0.0055, 0, 0.014, 6)
          .rotateX(k > 0 ? 0 : Math.PI)
          .translate(mx + (c.n < 3 ? 0.01 : -0.01), my + 0.006, k * 0.015),
        "One union per cylinder connects the flow divider to its nozzle line.",
        [0, 0.51, k * 0.05],
      ),
    );
  }
  return parts;
}
