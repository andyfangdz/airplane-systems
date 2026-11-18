import type { EngineSpec } from "@/engines/types";
import * as THREE from "three";
import { bearingStations } from "./rotating";
import { VT, coil, merge, oilFiller, type oilPump, tube, zrod, type Dims } from "../kit";
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
  type XY,
} from "./shapes";

// C3B6, IPC Fig. 5B. Bored bosses follow the pushrod axes through the sloping deck.
function tappetDeck(d: Dims, cylinderXs: number[]) {
  const edgeY = 0.096,
    ridge = 0.044;
  const slope = (d.caseHalf - ridge) / (d.caseTop - edgeY);
  const deck = section([
    [d.caseRear, edgeY],
    [d.front, edgeY],
    [d.front, d.caseTop],
    [d.caseRear, d.caseTop],
  ]);
  const guides = cylinderXs.flatMap((x) => [x - VT.xOff, x + VT.xOff]);
  for (const x of guides) hole(deck, x, VT.pushY, 0.014);
  const skin = plate(deck, -0.01, 0)
    .applyMatrix4(new THREE.Matrix4().makeShear(0, 0, 0, -slope, 0, 0))
    .translate(0, 0, ridge + slope * d.caseTop);
  const boss = [
    [0.014, ridge],
    [0.021, ridge],
    [0.021, d.caseHalf - 0.023],
    [0.019, d.caseHalf - 0.008],
    [0.018, d.caseHalf + 0.002],
    [0.014, d.caseHalf + 0.002],
    [0.014, ridge],
  ].map(([r, z]) => new THREE.Vector2(r, z));
  const crest = section([
    [0.002, d.caseTop],
    [ridge, d.caseTop],
    [ridge, d.caseTop - 0.009],
    [0.002, d.caseTop - 0.009],
  ]);
  return merge([
    skin,
    plate(crest, -d.front, -d.caseRear).rotateY(-Math.PI / 2),
    ...guides.map((x) => new THREE.LatheGeometry(boss, 28).rotateX(Math.PI / 2).translate(x, VT.pushY, 0)),
  ]);
}

function bearingSaddle(x: number, length: number, width: number, footX: number) {
  // In the joint plane the insert sits in a half-round seat. The web fans out to the cheek.
  const web = new THREE.Shape()
    .moveTo(0, -0.052)
    .quadraticCurveTo(0.042, -0.052, width, -0.071)
    .lineTo(width, 0.069)
    .quadraticCurveTo(0.046, 0.047, 0, 0.053)
    .lineTo(0, 0.031)
    .absarc(0, 0, 0.031, Math.PI / 2, -Math.PI / 2, true)
    .closePath();
  const casting = plate(web, -x - length / 2, -x + length / 2).rotateY(-Math.PI / 2);
  // Keep the seat coaxial. Beyond the insert the casting narrows into the gap between
  // the staggered barrel spigots on this bank.
  const vertices = casting.getAttribute("position");
  for (let i = 0; i < vertices.count; i++) {
    const t = THREE.MathUtils.smoothstep(vertices.getZ(i), 0.032, width);
    const dx = vertices.getX(i) - x;
    vertices.setX(i, THREE.MathUtils.lerp(x + dx, footX + (dx * 0.016) / length, t));
  }
  casting.computeVertexNormals();
  return casting;
}

export function noseCasting(d: Dims) {
  // Annular seal recess at the open end of the tapered nose (IPC Figs. 5B, 6).
  const profile = [
    [0.036, -0.006],
    [0.07, -0.006],
    [0.07, -0.001],
    [0.066, 0.003],
    [0.055, 0.012],
    [0.051, 0.018],
    [0.051, 0.033],
    [0.049, 0.036],
    [0.046, 0.036],
    [0.046, 0.028],
    [0.036, 0.028],
    [0.036, -0.006],
  ];
  return new THREE.LatheGeometry(
    profile.map(([r, x]) => new THREE.Vector2(r, x)),
    48,
  )
    .rotateZ(-Math.PI / 2)
    .translate(d.front, 0, 0);
}

/** Crankcase cheeks with real cylinder openings, sloping crown, and bored front/rear bearing webs (IPC Fig. 5B). */
export function caseHalf(d: Dims, side: 1 | -1, angleValve: boolean) {
  const { caseRear: x0, front: x1, caseHalf: w, caseTop: h, caseBottom: b } = d;
  const cylinders = d.cylinders.filter((c) => c.side === (side === 1 ? "R" : "L"));
  const face = section([
    [x0 + 0.012, b],
    [x1 - 0.042, b],
    [x1, -0.058],
    [x1, 0.078],
    [x1 - 0.045, 0.105],
    [x0 + 0.034, 0.105],
    [x0, 0.074],
    [x0, -0.074],
  ]);
  cylinders.forEach((c) => hole(face, c.x, 0, d.bore / 2 + 0.004));
  const crown = section([
    [0.002, h],
    [0.044, h],
    [w, 0.096],
    [w, 0.085],
    [0.041, h - 0.009],
    [0.002, h - 0.009],
  ]);
  const floor = section([
    [0.002, b],
    [w - 0.014, b],
    [w, -0.084],
    [w, -0.073],
    [w - 0.02, b + 0.009],
    [0.002, b + 0.009],
  ]);
  const longitudinal = (s: THREE.Shape) => plate(s, -x1, -x0).rotateY(-Math.PI / 2);
  const web = (x: number) => {
    const s = new THREE.Shape(
      [
        [0, b + 0.008],
        [w - 0.014, b + 0.008],
        [w - 0.003, -0.074],
        [w - 0.003, 0.093],
        [0.042, h - 0.009],
        [0, h - 0.009],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
    );
    // The shared split bore opens to the mating face.
    s.lineTo(0, 0.037);
    s.absarc(0, 0, 0.037, Math.PI / 2, -Math.PI / 2, true);
    s.lineTo(0, b + 0.008);
    return plate(s, -x - 0.004, -x + 0.004).rotateY(-Math.PI / 2);
  };
  const ribs = cylinders.flatMap((c) =>
    [-1, 1].map((k) =>
      tube(
        [
          [c.x + k * 0.06, 0.062, w - 0.002],
          [c.x + k * 0.066, 0.098, w - 0.006],
          [c.x + k * 0.047, 0.145, 0.064],
        ],
        0.0045,
        10,
        6,
      ),
    ),
  );
  const cylinderXs = cylinders.map((c) => c.x);
  const fore = Math.max(...cylinderXs),
    aft = Math.min(...cylinderXs);
  const saddleFoot = {
    front: Math.min(x1 - 0.01, fore + 0.098),
    center: (fore + aft) / 2,
    rear: Math.max(x0 + 0.01, aft - 0.098),
  };
  const half = merge([
    plate(face, w - 0.008, w),
    angleValve ? tappetDeck(d, cylinderXs) : longitudinal(crown),
    longitudinal(floor),
    web(x0 + 0.004),
    web(x1 - 0.004),
    ...ribs,
    ...(angleValve
      ? bearingStations(d).map(([station, x, len]) => bearingSaddle(x, len, w - 0.003, saddleFoot[station]))
      : []),
  ]);
  if (side === -1) {
    // Reflect the side plate in the joint plane and reverse triangle winding to match its reflected normals.
    half.scale(1, 1, -1);
    const count = half.attributes.position.count;
    half.setIndex(Array.from({ length: count }, (_, i) => (i % 3 === 0 ? i : i % 3 === 1 ? i + 1 : i - 1)));
  }
  return half;
}

export function accessoryCasting(d: Dims) {
  // Paired magneto pads flank the centre of the arched rear face. The lower half tapers to the fuel pump/filter pads.
  const profile: XY[] = [
    [-0.144, 0.048],
    [-0.143, 0.096],
    [-0.108, 0.14],
    [-0.056, 0.172],
    [0, 0.18],
    [0.056, 0.172],
    [0.108, 0.14],
    [0.143, 0.096],
    [0.144, 0.048],
    [0.106, 0.008],
    [0.095, -0.095],
    [0.068, -0.124],
    [-0.07, -0.124],
    [-0.102, -0.096],
    [-0.109, 0.008],
  ];
  const face = section(profile);
  const rim = section(profile);
  rim.holes.push(new THREE.Path(profile.map(([x, y]) => new THREE.Vector2(x * 0.93, y * 0.93))));
  return merge([plate(face, 0, 0.008, 0.002), plate(rim, 0.008, d.caseRear - d.accRear)])
    .rotateY(Math.PI / 2)
    .translate(d.accRear, 0, 0);
}

function flangeSites(d: Dims, sideHoles: number) {
  const front = d.front - 0.045,
    rear = d.caseRear + 0.012;
  const xs = Array.from({ length: sideHoles }, (_, i) => rear + (i * (front - rear)) / (sideHoles - 1));
  return [
    ...xs.flatMap((x): XY[] => [
      [x, -0.114],
      [x, 0.114],
    ]),
    ...[-0.077, -0.039, 0, 0.039, 0.077].flatMap((z): XY[] => [
      [rear, z],
      [front, z],
    ]),
  ];
}

export function caseHardware(d: Dims, installation?: EngineSpec["illustratedInstallation"]): Detail[] {
  const flat = (g: THREE.BufferGeometry, y: number) => g.rotateX(Math.PI / 2).translate(0, y, 0);
  // Both IO-360 catalogs, Fig. 15. The IO-390 uses its own Fig. 17 pattern.
  const bolts = installation === "c172s" ? 16 : installation === "da40" ? 8 : 20;
  const sites = flangeSites(d, (bolts + 2) / 2);
  const washers = installation === "da40" ? [...sites, ...sites.slice(0, 6)] : sites;
  const sump = section([
    [d.caseRear + 0.004, -0.122],
    [d.front - 0.038, -0.122],
    [d.front - 0.038, 0.122],
    [d.caseRear + 0.004, 0.122],
  ]);
  sump.holes.push(
    section([
      [d.caseRear + 0.02, -0.104],
      [d.caseRear + 0.02, 0.104],
      [d.front - 0.056, 0.104],
      [d.front - 0.056, -0.104],
    ]),
  );
  const lugs = [d.caseRear + 0.09, d.front - 0.08].map((x) => {
    const s = section([
      [-0.023, 0],
      [0.022, 0],
      [0.018, 0.023],
      [0.008, 0.047],
      [-0.006, 0.047],
      [-0.02, 0.022],
    ]);
    hole(s, 0, 0.033, 0.009);
    return plate(s, -0.002, 0.002).translate(x, d.caseTop + 0.009, 0);
  });
  const through = d.cylinders.flatMap((c) =>
    (c.n < 3 ? [-1, 1] : [1]).map((k) =>
      zrod(0.0055, -d.caseHalf - 0.017, d.caseHalf + 0.017, 12).translate(c.x + k * 0.032, k * 0.073, 0),
    ),
  );
  const plugs = [
    [d.front - 0.035, 0.077],
    [d.caseRear + 0.028, 0.067],
    [d.caseRear + 0.025, -0.064],
  ] as XY[];
  return [
    ...caseJoint(d),
    item(
      "Crankcase lifting straps",
      "60803",
      "9B–4",
      "steel",
      merge(lugs),
      "The two lifting eyes attach at the upper crankcase joint.",
      [0, 0.44, 0],
    ),
    ...items(
      "Crankcase through-stud",
      "01A22453 / 01A23544",
      "9B–19, 5B–2",
      "steel",
      through,
      "The long studs span the case and carry cylinder hold-down loads.",
      [0, 0.19, 0],
    ),
    ...items(
      "Crankcase gallery plug",
      "1102 / STD-1339",
      "5B–17, 18",
      "darkSteel",
      [-1, 1].flatMap((k) => atStations(plugs, () => zrod(0.0055, -0.006, 0.001, 6), k * d.caseHalf)),
      "Threaded plugs close drilled oil passages.",
      [0, 0.29, 0.18],
    ),
    ...items(
      "Crankcase locating dowel",
      "STD-557 / STD-514",
      "5B–10, 11",
      "steel",
      [-0.064, 0.067].flatMap((y) =>
        [d.front - 0.035, d.caseRear + 0.03].map((x) => sleeve(0.003, 0.006, -0.009, 0.009).translate(x, y, 0)),
      ),
      "Dowels align the crankcase halves at the joint.",
      [0, 0.24, -0.04],
    ),
    item(
      "Front crankshaft oil seal",
      "LW-15628",
      "6–7",
      "black",
      sleeve(0.033, 0.046, -0.005, 0.005)
        .rotateY(Math.PI / 2)
        .translate(d.front + 0.033, 0, 0),
      "The seal fits around the shaft where it leaves the nose of the case.",
      [0.11, 0, 0],
    ),
    item(
      "Oil sump gasket",
      "LW-13353",
      "17–1",
      "black",
      flat(plate(sump, 0, 0.002), d.caseBottom + 0.008),
      "The gasket follows the sump-to-case mating flange.",
      [0, -0.11, 0],
    ),
    ...items(
      "Sump attaching bolt",
      "LW-25-0.94 / LW-25-1.13",
      "17–7, 8",
      "steel",
      atStations(sites.slice(0, bolts), () => bolt(0.0032, 0.024)).map((piece) => flat(piece, d.caseBottom + 0.005)),
      "The bolted flange joins the sump casting and crankcase.",
      [0, -0.43, 0],
    ),
    ...items(
      "Sump flange nut",
      "STD-1411",
      "17–9",
      "darkSteel",
      atStations(sites.slice(bolts), () => nut(0.0032)).map((piece) => flat(piece, d.caseBottom + 0.005)),
      "Twelve nuts share the sump mounting flange with the bolts.",
      [0, -0.43, 0],
    ),
    ...items(
      "Sump flange plain washer",
      "STD-8",
      "17–5",
      "steel",
      atStations(washers, () => sleeve(0.0033, 0.0067, -0.001, 0)).map((piece, i) =>
        flat(piece, d.caseBottom + (i >= sites.length ? 0.0065 : 0.005)),
      ),
      "The fasteners bear on plain washers along the flange.",
      [0, -0.34, 0],
    ),
    ...items(
      "Sump flange lock washer",
      "STD-160",
      "17–6",
      "darkSteel",
      atStations(sites.slice(0, 20), () => sleeve(0.0033, 0.006, -0.001, 0)).map((piece) =>
        flat(piece, d.caseBottom + 0.004),
      ),
      "Lock washers sit below the sump fasteners.",
      [0, -0.38, 0],
    ),
    item(
      "Accessory housing gasket",
      "73818",
      "18–1",
      "black",
      sleeve(0.09, 0.095, -0.001, 0.001)
        .scale(1, 1.26, 1)
        .rotateY(Math.PI / 2)
        .translate(d.caseRear, 0.026, 0),
      "The gasket seals the housing against the rear of the crankcase.",
      [-0.14, 0, 0],
    ),
    ...items(
      "Accessory housing bolt",
      "LW-25-0.94 / LW-25-1.13 / LW-25-1.44",
      "19–10–12",
      "steel",
      atStations(stations(12, 0.106, 0.122), () => bolt(0.0032, 0.024)).map((piece) =>
        piece.rotateY(-Math.PI / 2).translate(d.accRear, 0.026, 0),
      ),
      "Twelve fasteners retain the rear housing.",
      [-0.37, 0, 0],
    ),
  ];
}

export function oilHardware(d: Dims, pump: ReturnType<typeof oilPump>) {
  const pumpFace = (g: THREE.BufferGeometry) =>
    g.rotateY(-Math.PI / 2).translate(d.caseRear + pump.x1 - pump.body[0], pump.y, pump.gearR);
  const screenFace = (g: THREE.BufferGeometry) =>
    g.rotateY(-Math.PI / 2).translate(d.caseRear + 0.005, d.sumpBottom + 0.024, 0.064);

  const relief = (g: THREE.BufferGeometry) => g.translate(d.caseRear + 0.03, 0.042, d.caseHalf);
  const filler = oilFiller(d);
  const filter = (g: THREE.BufferGeometry) => g.rotateY(-Math.PI / 2).translate(d.accRear, 0.015, 0);
  const thermostat = (g: THREE.BufferGeometry) => g.rotateX(Math.PI).translate(d.accRear - 0.02, -0.027, 0);
  return [
    item(
      "Oil pressure relief ball",
      "1028-B",
      "6–1",
      "steel",
      relief(new THREE.SphereGeometry(0.00873, 16, 12).translate(0, 0, -0.02)),
      "The relief spring holds the ball against its seat.",
      [0, 0.26, 0.19],
    ),
    item(
      "Oil pressure relief spring",
      "relief spring, select fit",
      "6–2",
      "spring",
      relief(coil(0.008, 0.0013, -0.012, 0.017, 7)),
      "The spring loads the pressure relief ball.",
      [0, 0.26, 0.23],
    ),
    item(
      "Pressure relief valve housing",
      "77808",
      "6–4",
      "acc",
      relief(merge([sleeve(0.009, 0.012, -0.024, 0.018), zrod(0.014, 0.018, 0.026, 6), zrod(0.004, 0.026, 0.033, 12)])),
      "The crankcase houses the adjustable spring-and-ball relief valve.",
      [0, 0.26, 0.3],
    ),
    item(
      "Pressure relief valve gasket",
      "06E19769-1.25",
      "6–3",
      "bearing",
      relief(sleeve(0.011, 0.017, 0, 0.0016)),
      "An annular gasket seals the relief assembly.",
      [0, 0.26, 0.26],
    ),
    item(
      "Oil filter base",
      "77852",
      "24–2",
      "acc",
      filter(
        merge([
          sleeve(0.017, 0.042, -0.005, 0.01),
          new THREE.BoxGeometry(0.035, 0.04, 0.019).translate(0, -0.024, 0.005),
        ]),
      ),
      "The base supports the spin-on filter and the temperature-control valve.",
      [-0.32, -0.04, 0],
    ),
    item(
      "Oil filter base gasket",
      "06B23862",
      "24–1",
      "black",
      filter(sleeve(0.022, 0.041, -0.006, -0.004)),
      "Seals the filter base to its mounting face.",
      [-0.28, -0.04, 0],
    ),
    item(
      "Oil cooler temperature control valve",
      "53E22144",
      "24–9",
      "bearing",
      thermostat(
        merge([zrod(0.007, -0.021, 0.016, 12), zrod(0.014, 0.015, 0.024, 6), coil(0.009, 0.0011, -0.016, 0.012, 5)]),
      ),
      "The thermostatic element controls oil routing through the cooler.",
      [-0.38, -0.11, 0],
    ),
    item(
      "Oil cooler bypass plug",
      "62417",
      "24–12",
      "steel",
      filter(zrod(0.009, 0.013, 0.019, 6).translate(0.026, 0.015, 0)),
      "Closes the cooler bypass port.",
      [-0.42, -0.14, 0],
    ),
    item(
      "Oil cooler bypass plug gasket",
      "06E19769-0.63",
      "24–11",
      "bearing",
      filter(sleeve(0.006, 0.01, 0.011, 0.013).translate(0.026, 0.015, 0)),
      "Seals the bypass plug.",
      [-0.388, -0.14, 0],
    ),
    ...[-1, 1].map((k) =>
      item(
        "Accessory housing cooler " + (k < 0 ? "feed" : "return") + " fitting",
        "MS20823-8",
        "24–13",
        "bearing",
        filter(
          tube(
            [
              [k * 0.027, 0.014, 0.006],
              [k * 0.036, 0.025, 0.013],
              [k * 0.051, 0.032, 0.019],
            ],
            0.006,
            10,
            8,
          ),
        ),
        "Connects the remote cooler hose at the accessory housing.",
        [-0.35, 0.04, k * 0.09],
      ),
    ),
    item(
      "Crankcase breather fitting",
      "71140",
      "24–14",
      "steel",
      tube(
        [
          [d.accRear, 0.125, 0],
          [d.accRear - 0.025, 0.133, 0],
          [d.accRear - 0.031, 0.15, 0],
        ],
        0.009,
        12,
        12,
      ),
      "The breather provides a vent from the crankcase.",
      [-0.31, 0.13, 0],
    ),
    item(
      "Oil level gage blade",
      "56C23681",
      "16B–4",
      "steel",
      tube(filler.tube, 0.0019, 24, 5),
      "The dipstick extends from the filler cap into the sump.",
      [0, 0.55, 0.16],
    ),
    item(
      "Oil gage tube gasket and cap seal",
      "72059 / 74068",
      "16B–2, 3",
      "black",
      merge([
        sleeve(0.008, 0.011, 0, 0.002)
          .rotateX(-Math.PI / 2)
          .translate(...filler.cap),
        sleeve(0.008, 0.011, -0.001, 0.001).translate(...filler.tube[0]),
      ]),
      "Seals at the tube and cap keep oil in the filler assembly.",
      [0, 0.43, 0.16],
    ),
    item(
      "Oil screen plug gasket",
      "06E19769-1.25",
      "17–16",
      "bearing",
      screenFace(sleeve(0.013, 0.018, 0, 0.0015)),
      "The annular gasket seals the rear access plug for the suction screen.",
      [-0.19, -0.26, 0],
    ),
    ...items(
      "Oil pump retaining washer",
      "STD-35",
      "19–6",
      "steel",
      atStations(stations(3, 0.027), () => sleeve(0.004, 0.008, 0, 0.0012)).map((piece) => pumpFace(piece)),
      "Plain washers fit beneath the three retaining nuts.",
      [-0.35, -0.06, 0],
    ),
    item(
      "Filter base mounting stud",
      "25C-10",
      "24–10",
      "steel",
      filter(zrod(0.0032, -0.017, 0.015, 10).translate(0.028, 0.024, 0)),
      "The stud and three bolts locate the filter base.",
      [-0.29, -0.04, 0],
    ),
    ...items(
      "Filter base washer",
      "STD-8",
      "24–4",
      "steel",
      atStations(stations(4, 0.035, 0.032, Math.PI / 4), () => sleeve(0.0032, 0.0065, 0.008, 0.0095)).map((piece) =>
        filter(piece),
      ),
      "Four plain washers seat against the base.",
      [-0.36, -0.04, 0],
    ),
    ...items(
      "Filter base lock washer",
      "STD-160",
      "24–5, 8",
      "darkSteel",
      atStations(stations(4, 0.035, 0.032, Math.PI / 4), () => sleeve(0.0032, 0.006, 0.0095, 0.011, 0.05, 6.15)).map(
        (piece) => filter(piece),
      ),
      "Lock washers sit beneath the mounting fasteners.",
      [-0.385, -0.04, 0],
    ),
    ...items(
      "Filter base bolt",
      "LW-25-1.00",
      "24–7",
      "steel",
      atStations(stations(4, 0.035, 0.032, Math.PI / 4).slice(1), () => bolt(0.0032, 0.0254), 0.011).map((piece) =>
        filter(piece),
      ),
      "Three bolts pass through the base into the housing.",
      [-0.41, -0.04, 0],
    ),
    item(
      "Filter base nut",
      "STD-1411",
      "24–6",
      "darkSteel",
      filter(nut(0.0032).translate(0.025, 0.023, 0.011)),
      "The fourth corner is retained by a nut on the mounting stud.",
      [-0.41, -0.04, 0],
    ),
    ...items(
      "Oil pump retaining nut",
      "STD-1420",
      "19–7",
      "steel",
      atStations(stations(3, 0.027), () => nut(0.004), 0.0012).map((piece) => pumpFace(piece)),
      "Three slotted nuts retain the pump body.",
      [-0.39, -0.06, 0],
    ),
  ];
}

/** Joining hardware for the standard C3B6 case (11U28752-1S). Positions around the parting flange are illustrative. */
function caseJoint(d: Dims): Detail[] {
  const rear = d.caseRear + 0.025,
    span = d.front - d.caseRear - 0.055;
  const top = Array.from({ length: 9 }, (_, i): XY => [rear + (i * span) / 8, d.caseTop + 0.003]);
  const bottom = Array.from({ length: 4 }, (_, i): XY => [rear + (i * span) / 3, d.caseBottom + 0.015]);
  const sites = [...top, ...bottom];
  const grip = 0.012,
    radius = 0.0032;
  const sizes = [
    ["Short crankcase bolt", "LW-25-1.50", "9B–1", 0, 5, 0.0381],
    ["Long crankcase bolt", "LW-25-2.13", "9B–2", 5, 7, 0.0541],
    ["Lifting strap bolt", "LW-25-1.75", "9B–5", 7, 9, 0.0445],
    ["Lower crankcase bolt", "LW-25-1.13", "9B–6", 9, 10, 0.0286],
    ["Drilled crankcase bolt", "LW-25S1.50", "9B–9", 10, 13, 0.0381],
  ] as const;
  const parts: Detail[] = sizes.flatMap(([name, pn, ref, start, end, len]) =>
    items(
      name,
      pn,
      ref,
      "steel",
      atStations(sites.slice(start, end), () => bolt(radius, len), grip),
      "This fastener passes across the crankcase joint.",
      [0, 0.26, 0.27],
    ),
  );
  const onLeft = (sites: XY[], g: () => THREE.BufferGeometry, z: number) =>
    atStations(sites, () => g().rotateX(Math.PI), z);
  const washers = () => sleeve(radius, radius * 2, -0.001, 0);
  parts.push(
    ...items(
      "Crankcase flange washer, right",
      "STD-8",
      "9B–3, 10",
      "steel",
      atStations(sites, washers, grip),
      "Plain washers seat the fasteners against the flange. Select-fit washers are shown schematically.",
      [0, 0.26, 0.215],
    ),
    ...items(
      "Crankcase flange washer, left",
      "STD-8",
      "9B–3, 10",
      "steel",
      onLeft(sites.slice(0, 10), washers, -grip),
      "Plain washers seat the fasteners against the flange. Select-fit washers are shown schematically.",
      [0, 0.26, -0.18],
    ),
    ...items(
      "Crankcase locking washer",
      "STD-160",
      "9B–7",
      "darkSteel",
      onLeft(sites.slice(0, 10), () => sleeve(radius, radius * 1.85, 0, 0.001, 0.05, 6.1), -grip - 0.001),
      "The lock washers fit on the nut side of the joint.",
      [0, 0.26, -0.21],
    ),
    ...items(
      "Crankcase flange nut",
      "STD-1411",
      "9B–8",
      "darkSteel",
      onLeft(sites.slice(0, 9), () => nut(radius), -grip - 0.002),
      "The plain nuts secure the flange bolts.",
      [0, 0.26, -0.25],
    ),
    ...items(
      "Crankcase slotted nut",
      "STD-2249",
      "9B–11",
      "darkSteel",
      onLeft(sites.slice(10), () => nut(radius), -grip - 0.002),
      "Three slotted nuts are used with the drilled bolts.",
      [0, 0.26, -0.25],
    ),
    ...items(
      "Main bearing locating dowel",
      "69796",
      "5B–14",
      "steel",
      atStations(
        [
          [rear + 0.018, 0],
          [rear + span * 0.43, 0],
        ],
        () => zrod(0.003, -0.008, 0.008, 12),
        -0.029,
      ),
      "The case dowels locate bearing inserts at the main journals.",
      [0, -0.09, -0.15],
    ),
    ...items(
      "Crankcase oil transfer seals",
      "72075 / 72091",
      "6–8, 9",
      "black",
      atStations(
        [
          [rear + 0.02, 0.051],
          [rear + 0.032, 0.05],
          [rear + 0.021, -0.047],
          [rear + 0.041, -0.052],
        ],
        () => sleeve(0.0046, 0.0069, -0.001, 0.001),
      ),
      "The oil seals surround passage openings at the case joint.",
      [0, 0.26, -0.09],
    ),
    item(
      "Breather oil shield",
      "76119",
      "18B–7",
      "shroud",
      plate(
        section([
          [-0.023, -0.009],
          [0.023, -0.009],
          [0.018, 0.02],
          [-0.018, 0.02],
        ]),
        0,
        0.0015,
      )
        .rotateY(-Math.PI / 2)
        .translate(d.accRear + 0.009, 0.075, 0.018),
      "The shield fits inside the accessory housing at its breather.",
      [-0.19, 0.1, 0],
    ),
  );
  return parts;
}
