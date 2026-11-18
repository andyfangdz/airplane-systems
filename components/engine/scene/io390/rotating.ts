import type { EngineSpec } from "@/engines/types";
import * as THREE from "three";
import { merge, zrod, type Dims } from "../kit";
import { bolt, hole, item, items, atStations, nut, plate, section, sleeve, stations, type XY } from "./shapes";

// IPC Fig. 10. The cap, bolt stacks and bearing shells follow the rod, while the pin and rings follow the piston.
export function rodAssembly(d: Dims) {
  const axial = (g: THREE.BufferGeometry) => g.rotateY(Math.PI / 2);
  const big = 0.029,
    width = 0.022,
    l = d.l;
  const eye = (r: number, outer: number, a: number, arc: number) =>
    axial(sleeve(r, outer, -width / 2, width / 2, a, arc, 28));
  const boltSites: XY[] = [
    [0, -0.027],
    [0, 0.027],
  ];
  const beam = merge([
    eye(0.0268, big + 0.006, Math.PI, Math.PI),
    eye(0.0123, 0.019, 0, Math.PI * 2).translate(0, 0, l),
    new THREE.BoxGeometry(0.007, 0.024, l - 0.035).translate(0, 0, l / 2),
    ...[-1, 1].map((k) => new THREE.BoxGeometry(0.018, 0.004, l - 0.041).translate(0, k * 0.012, l / 2)),
  ]);
  return [
    item(
      "Connecting rod",
      "77450-S",
      "10–1",
      "darkSteel",
      beam,
      "The forged rod joins the piston pin to the crankshaft.",
      [0, 0, 0.03],
    ),
    item(
      "Connecting rod cap",
      "77450-S",
      "10–1",
      "darkSteel",
      eye(0.0268, big + 0.006, 0, Math.PI),
      "The detachable big-end cap closes around the crankpin.",
      [0, 0, -0.06],
    ),
    ...([0, Math.PI] as const).map((angle) =>
      item(
        angle === 0 ? "Cap bearing shell" : "Rod bearing shell",
        "18M23887",
        "10–5",
        "bearing",
        axial(sleeve(0.026, 0.0268, -0.011, 0.011, angle + 0.008, Math.PI - 0.016)),
        "One of the two inserts that surround the crankpin.",
        [0, 0, angle === 0 ? -0.025 : 0.012],
      ),
    ),
    item(
      "Rod small-end bushing",
      "LW-13923",
      "10–2",
      "bearing",
      axial(sleeve(0.011, 0.0123, -0.011, 0.011)).translate(0, 0, l),
      "The piston pin runs in the upper bushing.",
      [0.055, 0, 0.03],
    ),
    ...items(
      "Rod cap bolt",
      "75060",
      "10–3",
      "steel",
      atStations(boltSites, () => bolt(0.0038, 0.04), 0.019),
      "Two bolts join the rod and cap.",
      [0, 0, 0.065],
    ),
    ...items(
      "Rod cap nut",
      "LW-12186",
      "10–4",
      "darkSteel",
      atStations(boltSites, () => nut(0.0038).rotateX(Math.PI), -0.018),
      "Each rod bolt carries a separate nut.",
      [0, 0, -0.1],
    ),
  ];
}

export function pistonAssembly(d: Dims) {
  const r = d.bore / 2 - 0.0007,
    crown = d.crown;
  const grooves = [crown - 0.007, crown - 0.014, crown - 0.025];
  const profile: XY[] = [
    [r - 0.005, -0.034],
    [r - 0.001, -0.034],
    [r, -0.019],
  ];
  for (const z of [...grooves].reverse())
    profile.push([r, z - 0.0018], [r - 0.002, z - 0.0018], [r - 0.002, z + 0.0018], [r, z + 0.0018]);
  profile.push(
    [r, crown - 0.001],
    [r - 0.001, crown],
    [0, crown],
    [0, crown - 0.006],
    [r - 0.006, crown - 0.006],
    [r - 0.005, -0.034],
  );
  const ring = (z: number, angle: number) =>
    sleeve(r - 0.0019, r + 0.0004, z - 0.0014, z + 0.0014, angle, 2 * Math.PI - 0.035, 48);
  return [
    item(
      "Piston",
      "14E23911",
      "10–6",
      "piston",
      new THREE.LatheGeometry(
        profile.map(([a, b]) => new THREE.Vector2(a, b)),
        48,
      ).rotateX(Math.PI / 2),
      "The crown, ring lands and hollow skirt move together.",
      [0, 0, 0.12],
    ),
    item(
      "Top compression ring",
      "14G22050",
      "10–9",
      "ring",
      ring(grooves[0], 0.3),
      "The upper split ring seals combustion pressure at the crown.",
      [0, 0, 0.26],
    ),
    item(
      "Second compression ring",
      "14G22050",
      "10–9",
      "ring",
      ring(grooves[1], 2.1),
      "The second compression ring sits below the top land.",
      [0, 0, 0.23],
    ),
    item(
      "Oil control ring",
      "14H29865",
      "10–10",
      "darkSteel",
      merge([
        ring(grooves[2] - 0.001, 4),
        ring(grooves[2] + 0.001, 4),
        sleeve(r - 0.002, r - 0.0008, grooves[2] - 0.002, grooves[2] + 0.002),
      ]),
      "The expander-type oil regulating ring occupies the lowest groove.",
      [0, 0, 0.2],
    ),
    item(
      "Piston pin",
      "14J22048",
      "10–7",
      "steel",
      sleeve(0.007, 0.011, -r + 0.008, r - 0.008).rotateY(Math.PI / 2),
      "The hollow pin passes through the small end of the rod.",
      [0.12, 0, 0.12],
    ),
    ...([-1, 1] as const).map((k) =>
      item(
        "Piston pin plug " + (k < 0 ? "A" : "B"),
        "72198",
        "10–8",
        "piston",
        zrod(0.0108, r - 0.008, r - 0.001, 18, 0.01).rotateY((k * Math.PI) / 2),
        "One plug closes each end of the floating piston pin.",
        [k < 0 ? -0.12 : 0.18, 0, 0.12],
      ),
    ),
  ];
}

export function flangeAssembly(d: Dims, installation?: EngineSpec["illustratedInstallation"]) {
  const s = new THREE.Shape().absarc(0, 0, 0.086, 0, Math.PI * 2, false);
  const sites = stations(6, 0.068, 0.068, Math.PI / 2);
  hole(s, 0, 0, 0.022);
  sites.forEach(([x, y]) => hole(s, x, y, 0.008));
  const orient = (g: THREE.BufferGeometry) => g.rotateY(Math.PI / 2).translate(d.flangeX, 0, 0);
  return [
    ...(installation === "c172s"
      ? [
          item(
            "Propeller spacer",
            "C5464",
            "POH 6-23",
            "propFlange",
            orient(sleeve(0.02, 0.072, 0.007, 0.007 + 3.5 * 0.0254)),
            "The 3.5-inch McCauley spacer C5464 fits between the crankshaft and the fixed-pitch propeller (C172S POH 6-23).",
            [0.43, 0, 0],
          ),
        ]
      : []),
    item(
      "Propeller flange",
      "13C47318",
      "7–1",
      "propFlange",
      orient(plate(s, -0.007, 0.007, 0.001)),
      "Six bushings locate the propeller on the C3B6 crankshaft.",
      [0, 0, 0],
    ),
    item(
      "Starter ring gear support",
      "31M19861 / 74977",
      "7–19",
      "ringSupport",
      ringSupport(d),
      "The dished support fits over the propeller flange and carries the toothed steel ring. The catalog lists alternate supports for this engine.",
      [0.22, 0, 0],
    ),
    item(
      "Crankshaft gear lockplate",
      "LW-18639",
      "7–17",
      "steel",
      orient(
        plate(
          section([
            [-0.008, -0.006],
            [0.009, -0.006],
            [0.012, 0.009],
            [-0.008, 0.007],
          ]),
          0,
          0.0015,
        ),
      ).translate(d.caseRear - d.flangeX - 0.026, 0, 0),
      "The tab locks the gear retaining bolt.",
      [-0.145, 0, 0],
    ),
    item(
      "Crankshaft gear retaining bolt",
      "STD-2246",
      "7–18",
      "darkSteel",
      bolt(0.004, 0.0254)
        .rotateY(-Math.PI / 2)
        .translate(d.caseRear - 0.028, 0, 0),
      "The bolt retains the crankshaft gear.",
      [-0.18, 0, 0],
    ),
    item(
      "Crankshaft gear locating dowel",
      "STD-1065",
      "7–2",
      "steel",
      zrod(0.004, -0.008, 0.008, 12, 0.0032)
        .rotateY(Math.PI / 2)
        .translate(d.caseRear - 0.008, 0.012, 0),
      "The stepped dowel indexes the gear to the shaft.",
      [-0.055, 0, 0],
    ),
    item(
      "Crankshaft expansion plug",
      "LW-14529",
      "7–9",
      "darkSteel",
      zrod(0.026, -0.002, 0.002, 32)
        .rotateY(Math.PI / 2)
        .translate(d.flangeX - 0.011, 0, 0),
      "The expansion plug closes the front bore in the crankshaft.",
      [0.1, 0, 0],
    ),
    ...(installation === "c172s"
      ? [
          item(
            "Crankshaft oil tube",
            "68484",
            "5–3",
            "steel",
            sleeve(0.008, 0.01, -0.055, 0.055)
              .rotateY(Math.PI / 2)
              .translate(d.front, 0, 0),
            "Tube 68484 fits inside the L2A crankshaft (IPC Fig. 5).",
            [0.045, 0, 0],
          ),
        ]
      : [
          item(
            "Crankshaft bore plug",
            "74711",
            "7–3",
            "steel",
            zrod(0.0158, -0.004, 0.004, 24)
              .rotateY(Math.PI / 2)
              .translate(d.front + 0.008, 0, 0),
            "A second plug occupies the drilled nose of the shaft.",
            [0.045, 0, 0],
          ),
        ]),
    ...(installation === "c172s" || installation === "da40"
      ? []
      : [
          item(
            "Crankshaft pipe plug",
            "1102",
            "7–8",
            "steel",
            zrod(0.005, -0.005, 0.002, 6).translate(d.front + 0.014, 0, 0.029),
            "The plug closes the cross drilling in the shaft.",
            [0, 0, 0.05],
          ),
        ]),
    ...(
      [
        ["Long flange bushing", "75656-S", "7–4", [0, 1, 2, 4], 0.022],
        ["Short flange bushing", "72155-S", "7–5", [3], 0.01],
        ["Indexing flange bushing", "75657-S", "7–6", [5], 0.022],
      ] as const
    ).flatMap(([name, pn, ref, indices, len]) =>
      items(
        name,
        pn,
        ref,
        "darkSteel",
        atStations(
          indices.map((i) => sites[i]),
          () => sleeve(0.005, 0.008, -0.011, len, 0, Math.PI * 2, 20),
        ).map(orient),
        "The C3B6 flange uses four long bushings, one short bushing and one indexing bushing.",
        [0.07, 0, 0],
      ),
    ),
  ];
}

export function counterweightHardware() {
  const pairs: XY[] = [
    [-0.028, -0.038],
    [0.028, -0.038],
  ];
  // Draw the stack along x, through both faces of each weight. The holes sit on the hanging side (negative z).
  const pinParts = (build: () => THREE.BufferGeometry[]) =>
    pairs.flatMap(([y, z]) => build().map((g) => g.rotateY(Math.PI / 2).translate(0, y, z)));
  return [
    ...items(
      "Counterweight roller",
      "14W21696 / 72797",
      "7–12, 13",
      "steel",
      pinParts(() => [zrod(0.0055, -0.013, 0.013, 14)]),
      "Two rollers suspend each counterweight from the crankshaft.",
      [0.07, 0, -0.075],
    ),
    ...items(
      "Crankshaft counterweight bushing",
      "73810",
      "7–7",
      "bearing",
      pinParts(() => [sleeve(0.006, 0.008, -0.006, 0.006)]),
      "These bushings line the holes in the shaft lugs.",
      [0, 0, -0.025],
    ),
    ...items(
      "Dynamic counterweight bushing",
      "71903-A",
      "7–11",
      "bearing",
      pinParts(() => [-0.011, 0.011].map((x) => sleeve(0.006, 0.009, x - 0.003, x + 0.003))),
      "Four bushings fit the two sides of each weight.",
      [0.035, 0, -0.075],
    ),
    ...items(
      "Counterweight washer",
      "71907",
      "7–15",
      "darkSteel",
      pinParts(() => [-0.015, 0.015].map((x) => sleeve(0.003, 0.01, x - 0.001, x + 0.001))),
      "Washers retain the ends of the rollers.",
      [0.1, 0, -0.075],
    ),
    ...items(
      "Counterweight retaining ring",
      "LW-14820",
      "7–14",
      "steel",
      pinParts(() => [-0.017, 0.017].map((x) => sleeve(0.008, 0.0105, x - 0.0007, x + 0.0007, 0.1, Math.PI * 2 - 0.2))),
      "Split rings hold the washers in their grooves.",
      [0.13, 0, -0.075],
    ),
  ];
}

/** Fig. 7. The support has a perforated hub, dished web, rim and belt grooves. Its outer ring is a separate part. */
function ringSupport(d: Dims) {
  const r = d.ringR;
  const hub = new THREE.Shape().absarc(0, 0, 0.09, 0, 2 * Math.PI, false);
  hole(hub, 0, 0, 0.034);
  for (const [x, y] of stations(6, 0.068, 0.068, Math.PI / 2)) hole(hub, x, y, 0.008);
  const profile: XY[] = [
    [0.089, 0.009],
    [0.105, 0.004],
    [r - 0.017, -0.025],
    [r - 0.006, -0.024],
    [r - 0.006, -0.035],
    [r - 0.018, -0.036],
    [0.104, -0.003],
    [0.089, 0.003],
    [0.089, 0.009],
  ];
  const web = new THREE.LatheGeometry(
    profile.map(([r, z]) => new THREE.Vector2(r, z)),
    72,
  ).rotateX(Math.PI / 2);
  return merge([plate(hub, 0.003, 0.009), web])
    .rotateY(Math.PI / 2)
    .translate(d.flangeX, 0, 0);
}

/** Each bored shell stays aligned with the crank journal when the crank turns. */
export function mainBearingShells(d: Dims) {
  const front = (d.front + Math.max(...d.cylinders.map((c) => c.x)) + 0.032) / 2;
  return (
    [
      ["front", front, 0.05],
      ["center", (d.cylinders[1].x + d.cylinders[2].x) / 2, 0.028],
      ["rear", (d.caseRear + d.cylinders[3].x - 0.032) / 2, 0.028],
    ] as const
  ).flatMap(([station, x, len]) =>
    ([-1, 1] as const).map((side) =>
      item(
        (side === 1 ? "Right" : "Left") + " " + station + " main bearing shell",
        station === "front" ? "18B23885" : "18E23886",
        station === "front" ? "6–6" : "6–5",
        "bearing",
        sleeve(0.028, 0.031, -len / 2, len / 2, side === 1 ? Math.PI : 0, Math.PI, 36)
          .rotateY(Math.PI / 2)
          .translate(x, 0, 0),
        "A split bearing insert supports the main journal in this crankcase half.",
        [0, -0.09, side * 0.095],
      ),
    ),
  );
}

export function crankCheek(d: Dims, thickness: number) {
  const s = new THREE.Shape();
  s.moveTo(-0.023, -0.035);
  s.quadraticCurveTo(-0.044, -0.017, -0.04, 0.009);
  s.lineTo(-0.032, d.r + 0.008);
  s.quadraticCurveTo(0, d.r + 0.049, 0.032, d.r + 0.008);
  s.lineTo(0.04, 0.009);
  s.quadraticCurveTo(0.043, -0.04, -0.023, -0.035);
  return plate(s, -thickness / 2, thickness / 2, 0.0015)
    .rotateY(Math.PI / 2)
    .rotateX(Math.PI / 2);
}
