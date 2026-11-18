import * as THREE from "three";
import { headPoints, merge, rod, VT, zrod, type Dims } from "../kit";
import { hole, item, items, atStations, nut, plate, section, sleeve, stations, type XY } from "./shapes";

// IPC Figs. 11–13. The cover has a wide lower skirt and a narrow crown over the rocker arms.
export const rockerOutline: XY[] = [
  [-0.068, -0.002],
  [-0.077, 0.016],
  [-0.075, 0.051],
  [-0.053, 0.126],
  [-0.04, 0.143],
  [0.04, 0.143],
  [0.053, 0.126],
  [0.075, 0.051],
  [0.077, 0.016],
  [0.068, -0.002],
  [0.048, -0.011],
  [-0.048, -0.011],
];
const screws: XY[] = [
  [-0.058, -0.006],
  [0, -0.008],
  [0.058, -0.006],
  [0.073, 0.048],
  [0.047, 0.132],
  [0, 0.14],
  [-0.047, 0.132],
  [-0.073, 0.048],
];

// Lycoming 61247, L2A Fig. 12 and M1A Fig. 13. One shaft, six screws and a pressed cover.
const parallelOutline: XY[] = [
  [-0.064, 0.018],
  [-0.03, -0.003],
  [0.03, -0.003],
  [0.064, 0.018],
  [0.064, 0.106],
  [0.045, 0.129],
  [0.029, 0.137],
  [-0.029, 0.137],
  [-0.045, 0.129],
  [-0.064, 0.106],
];
const parallelScrews: XY[] = [
  [0, 0],
  [0.057, 0.023],
  [0.054, 0.111],
  [0, 0.134],
  [-0.054, 0.111],
  [-0.057, 0.023],
];
function rockerRim(thickness: number, z: number, parallel = false) {
  const outline = parallel ? parallelOutline : rockerOutline;
  const s = section(outline);
  s.holes.push(new THREE.Path(outline.map(([x, y]) => new THREE.Vector2(x * 0.88, (y - 0.06) * 0.88 + 0.06))));
  for (const [x, y] of parallel ? parallelScrews : screws) hole(s, x, y, 0.0025);
  return plate(s, z, z + thickness);
}

function cover(d: Dims, parallel: boolean) {
  const outline = parallel ? parallelOutline : rockerOutline;
  const face = section(outline.map(([x, y]) => [x * 0.84, (y - 0.06) * 0.84 + 0.06]));
  if (parallel)
    return merge([
      rockerRim(0.003, d.headOut - 0.012, true),
      plate(face, d.headOut - 0.011, d.headOut - 0.005, 0.006),
      new THREE.BoxGeometry(0.08, 0.009, 0.003).translate(0, 0.063, d.headOut + 0.001),
    ]);
  // Raised numerals on the IO-390 cover.
  const three = new THREE.Shape()
    .moveTo(-9, 13)
    .quadraticCurveTo(0, 21, 8, 14)
    .quadraticCurveTo(14, 7, 6, 1)
    .quadraticCurveTo(15, -6, 8, -14)
    .quadraticCurveTo(0, -21, -10, -14)
    .lineTo(-7, -9)
    .quadraticCurveTo(3, -15, 4, -8)
    .quadraticCurveTo(5, -3, -3, -3)
    .lineTo(-3, 3)
    .quadraticCurveTo(5, 3, 4, 8)
    .quadraticCurveTo(3, 14, -7, 8)
    .closePath();
  const nine = new THREE.Shape()
    .moveTo(9, 10)
    .quadraticCurveTo(8, 20, -2, 18)
    .quadraticCurveTo(-13, 17, -11, 5)
    .quadraticCurveTo(-9, -4, 2, -2)
    .quadraticCurveTo(1, -13, -8, -13)
    .lineTo(-6, -18)
    .quadraticCurveTo(11, -15, 9, 10)
    .closePath();
  nine.holes.push(new THREE.Path().absellipse(-1, 8, 4.5, 5, 0, 2 * Math.PI, true, 0));
  const zero = new THREE.Shape().absellipse(0, 0, 11, 18, 0, 2 * Math.PI, false, 0);
  zero.holes.push(new THREE.Path().absellipse(0, 0, 4.5, 11, 0, 2 * Math.PI, true, 0));
  const digits = [three, nine, zero].map((shape, i) =>
    plate(shape, 0, 0.85, 0.42)
      .scale(0.001, 0.001, 0.001)
      .translate((i - 1) * 0.026, 0.063, d.headOut),
  );
  return merge([
    rockerRim(0.003, d.headOut - 0.012),
    plate(face, d.headOut - 0.011, d.headOut - 0.006, 0.006),
    ...digits,
  ]);
}

export function cylinderCastings(d: Dims, parallel = false) {
  const r = d.bore / 2,
    end = d.headIn;
  // Turn the barrel as one continuous profile: the bore stays clear through every fin.
  const profile: XY[] = [
    [r, d.caseHalf - 0.013],
    [r + 0.004, d.caseHalf - 0.013],
    [r + 0.004, d.caseHalf + 0.012],
  ];
  const start = d.caseHalf + 0.012,
    pitch = (end - start) / 24;
  for (let i = 0; i < 24; i++) {
    const z = start + i * pitch;
    profile.push([r + 0.006, z], [r + 0.016, z + 0.0005], [r + 0.016, z + 0.0016], [r + 0.006, z + 0.0021]);
  }
  profile.push([r + 0.006, end], [r, end], [r, d.caseHalf - 0.013]);
  const barrel = new THREE.LatheGeometry(
    profile.map(([a, b]) => new THREE.Vector2(a, b)),
    48,
  ).rotateX(Math.PI / 2);
  const base = section([
    [-0.08, -0.045],
    [-0.049, -0.08],
    [0.047, -0.08],
    [0.08, -0.047],
    [0.08, 0.047],
    [0.047, 0.08],
    [-0.047, 0.08],
    [-0.08, 0.045],
  ]);
  hole(base, 0, 0, r + 0.001);
  for (const [x, y] of baseStuds) hole(base, x, y, 0.0058);

  // Squared-off banks of fins are interrupted over the upper plug boss (Fig. 11).
  const fins: THREE.BufferGeometry[] = [];
  const depth = d.headOut - 0.03 - end;
  for (let i = 0; i < 26; i++) {
    const z = end + (depth * i) / 26;
    const f = i / 25;
    const w = 0.075 + 0.005 * Math.sin(Math.PI * f);
    const s = section([
      [-w, -0.068],
      [-w + 0.012, -0.089],
      [w - 0.012, -0.089],
      [w, -0.068],
      [w, 0.065],
      [w - 0.009, 0.084],
      [0.032, 0.084],
      [0.019, 0.055],
      [-0.019, 0.055],
      [-0.032, 0.084],
      [-w + 0.009, 0.084],
      [-w, 0.065],
    ]);
    hole(s, 0, 0, 0.05);
    fins.push(plate(s, z, z + 0.0017));
  }
  const head = merge([sleeve(r, r + 0.009, end - 0.005, d.deck), zrod(r, end + 0.012, d.deck + 0.026, 32), ...fins]);
  return {
    barrel,
    flange: plate(base, d.caseHalf, d.caseHalf + 0.009),
    head,
    rockerBox: rockerRim(d.headOut - 0.013 - (d.zPivot - 0.045), d.zPivot - 0.045, parallel),
    cover: cover(d, parallel),
  };
}

const baseStuds = stations(8, 0.079, 0.079, Math.PI / 8);

export function cylinderHardware(d: Dims, parallel = false) {
  const hp = headPoints(d);
  const small = baseStuds.filter((_, i) => i % 4 === 1 || i % 4 === 2),
    big = baseStuds.filter((p) => !small.includes(p));
  const studFamily = (points: XY[], r: number) => atStations(points, () => zrod(r, -0.012, 0.019, 12), d.caseHalf);
  const plugs = [
    { at: hp.topPlug, rot: hp.tilt },
    { at: hp.botPlug, rot: Math.PI - hp.tilt },
  ];
  const shafts = [-1, 1].map((k) => k * (VT.xOff + 0.008));
  const details = [
    item(
      "Cylinder base packing",
      "71481",
      "13–9",
      "black",
      sleeve(d.bore / 2 + 0.004, d.bore / 2 + 0.007, d.caseHalf - 0.003, d.caseHalf),
      "The packing seals the barrel spigot to its crankcase opening.",
      [0, 0, -0.08],
    ),
    ...items(
      "Cylinder hold-down stud",
      "50-15 / 38-13",
      "5B",
      "steel",
      [...studFamily(small, 0.0047), ...studFamily(big, 0.0063)],
      "The cylinder flange fits over the crankcase studs and through-studs.",
      [0, 0, -0.16],
    ),
    ...items(
      "Cylinder base nut, ⅜ inch",
      "71134",
      "13–11",
      "darkSteel",
      atStations(small, () => nut(0.0047), d.caseHalf + 0.009),
      "Four nuts secure the smaller studs at each cylinder base.",
      [0, 0, 0.045],
    ),
    ...items(
      "Cylinder base nut, ½ inch",
      "71133",
      "13–12",
      "darkSteel",
      atStations(big, () => nut(0.0063), d.caseHalf + 0.009),
      "Four nuts retain the flange at the larger studs.",
      [0, 0, 0.045],
    ),
    item(
      "Rocker cover gasket",
      "06B26811",
      "13–5",
      "black",
      rockerRim(0.002, d.headOut - 0.014, parallel),
      "The silicone gasket follows the rocker-box rim.",
      [0, 0, 0.23],
    ),
    ...items(
      "Rocker cover screw",
      "STD-1925",
      "13–7",
      "steel",
      atStations(
        parallel ? parallelScrews : screws,
        () => merge([zrod(0.003, -0.013, 0, 10), zrod(0.005, 0, 0.003, 14, 0.004)]),
        d.headOut - 0.008,
      ),
      "Eight pan-head screws retain this cover.",
      [0, 0, 0.39],
    ),
    ...(!parallel
      ? [
          item(
            "Spark plug reach plate",
            "74494",
            "13–8",
            "coverMark",
            new THREE.BoxGeometry(0.078, 0.015, 0.0003).translate(0, 0.026, d.headOut + 0.00019),
            "The rocker cover carries the plug-reach caution plate.",
            [0, 0, 0.34],
          ),
        ]
      : []),
    ...items(
      "Spark plug insert",
      "69260",
      "11–6",
      "bearing",
      plugs.map((p) =>
        sleeve(0.0074, 0.009, -0.013, 0.001)
          .rotateX(-Math.PI / 2)
          .rotateZ(p.rot)
          .translate(...p.at),
      ),
      "Threaded inserts receive the upper and lower spark plugs.",
      [0, 0.045, 0.15],
    ),
    ...items(
      "Rocker shaft bushing",
      "66670",
      "11–10",
      "bearing",
      shafts.flatMap((x) =>
        [-0.009, 0.009].map((off) =>
          sleeve(0.0056, 0.008, -0.003, 0.003)
            .rotateY(Math.PI / 2)
            .translate(x + off, VT.pivotY, d.zPivot),
        ),
      ),
      "Two bushings in the head support each rocker shaft.",
      [-0.055, 0.035, 0.15],
    ),
    ...(!parallel
      ? [
          item(
            "Cylinder fin stabilizers",
            "72343 / 72344",
            "11–11, 12",
            "darkSteel",
            merge(
              [-1, 1].map((k) =>
                new THREE.BoxGeometry(0.003, 0.005, 0.074).translate(k * 0.078, 0.051, d.deck + 0.047),
              ),
            ),
            "The intake and exhaust fin banks carry separate stabilizers.",
            [0, -0.055, 0.15],
          ),
        ]
      : []),
  ];
  if (parallel)
    return [
      ...details,
      ...[-1, 1].map((side, i) =>
        item(
          "Rocker shaft thrust button (" + (i + 1) + ")",
          "LW-12892",
          "72-30",
          "black",
          zrod(0.006, 0, 0.004, 20)
            .rotateY((side * Math.PI) / 2)
            .translate(side * (VT.xOff + 0.015), VT.pivotY, d.zPivot),
          "An LW-12892 thrust button at each end locates the common rocker shaft between the rocker box walls.",
          [side * 0.13, 0.03, 0.2],
        ),
      ),
    ];
  // Each rocker shaft exits through its own oval cover on the side wall.
  for (const k of [-1, 1]) {
    const which = k > 0 ? "Intake" : "Exhaust";
    const face = section([
      [-0.018, -0.009],
      [-0.012, -0.013],
      [0.014, -0.011],
      [0.019, 0.004],
      [0.01, 0.012],
      [-0.013, 0.012],
    ]);
    const pts: XY[] = [
      [-0.012, -0.004],
      [0.012, 0.004],
    ];
    const at = (g: THREE.BufferGeometry) => g.rotateY((k * Math.PI) / 2).translate(k * 0.062, VT.pivotY, d.zPivot);
    details.push(
      item(
        which + " rocker shaft cover",
        "17H28668",
        "13–2",
        "cover",
        at(plate(face, 0, 0.003)),
        "This cover closes the end of the rocker shaft bore.",
        [k * 0.085, 0, 0.15],
      ),
      item(
        which + " rocker shaft cover gasket",
        "66732",
        "13–1",
        "black",
        at(plate(face, -0.0015, 0)),
        "The gasket seals the cover to the cylinder head.",
        [k * 0.05, 0, 0.15],
      ),
      ...items(
        which + " rocker shaft cover stud",
        "25C-8",
        "11–8",
        "steel",
        atStations(pts, () => zrod(0.003, -0.016, 0.011, 10)).map((piece) => at(piece)),
        "Two studs pass through the shaft cover.",
        [k * 0.025, 0, 0.15],
      ),
      ...items(
        which + " rocker shaft cover lock washer",
        "STD-160",
        "13–3",
        "darkSteel",
        atStations(pts, () => sleeve(0.003, 0.0058, 0.003, 0.0044)).map((piece) => at(piece)),
        "Lock washers sit beneath the shaft-cover nuts.",
        [k * 0.11, 0, 0.15],
      ),
      ...items(
        which + " rocker shaft cover nut",
        "STD-1411",
        "13–4",
        "steel",
        atStations(pts, () => nut(0.003), 0.0044).map((piece) => at(piece)),
        "Two nuts retain this shaft cover.",
        [k * 0.14, 0, 0.15],
      ),
    );
  }
  return details;
}

export function valveHardware(d: Dims, intake: boolean) {
  const figure = "12";
  const seat = d.zPivot - 0.008 - 0.05;
  const fixed = [
    item(
      "Valve seat insert",
      intake ? "72212" : "16T19468",
      intake ? "11–2" : "11–3",
      "darkSteel",
      sleeve(0.016, 0.021, d.deck - 0.002, d.deck + 0.003),
      "The valve face meets this insert when the valve closes.",
      [0, 0, -0.07],
    ),
    item(
      "Valve guide",
      intake ? "LW-11956" : "LW-11958",
      intake ? "11–4" : "11–5",
      "bearing",
      sleeve(0.0036, 0.0065, d.deck + 0.012, seat + 0.005),
      "The guide locates the sliding valve stem in the head.",
      [0, 0, -0.025],
    ),
    item(
      "Lower valve spring seat",
      intake ? "LW-13321" : "LW-13322",
      figure + (intake ? "–5" : "–6"),
      "darkSteel",
      sleeve(0.005, 0.014, seat - 0.002, seat),
      "The inner and outer springs bear on the lower seat in the head.",
      [0, 0, 0.018],
    ),
  ];
  const moving = [
    ...items(
      "Valve keeper half",
      intake ? "60009" : "17C21191",
      figure + (intake ? "–9" : "–10"),
      "steel",
      [0, Math.PI].map((a) => sleeve(0.0034, 0.005, d.zPivot - 0.012, d.zPivot - 0.006, a + 0.04, Math.PI - 0.08, 12)),
      "Two tapered keys lock the upper spring seat to the stem.",
      [0, 0, 0.18],
    ),
  ];
  if (!intake)
    moving.push(
      item(
        "Exhaust valve stem cap",
        "17C19386",
        "12–11",
        "darkSteel",
        zrod(0.005, d.zPivot - 0.002, d.zPivot + 0.002, 12),
        "The exhaust rocker bears on this cap at the stem tip.",
        [0, 0, 0.2],
      ),
    );
  return { fixed, moving };
}

export function tappetParts() {
  return [
    item(
      "Tappet roller",
      "LRT23381",
      "6–10",
      "steel",
      rod(0.006, 0.011, 18).translate(0, 0, 0.006),
      "The roller contacts the cam lobe.",
      [0.04, 0, -0.07],
    ),
    item(
      "Hydraulic tappet plunger",
      "15B26066",
      "12–12",
      "steel",
      zrod(0.006, 0.014, VT.tappetLen - 0.004, 16),
      "The plunger fits inside the hydraulic roller tappet body.",
      [0, 0, -0.025],
    ),
    item(
      "Pushrod socket",
      "15B21319",
      "12–13",
      "bearing",
      sleeve(0.004, 0.007, VT.tappetLen - 0.005, VT.tappetLen),
      "The socket seats the inboard end of the pushrod.",
      [0, 0, 0.005],
    ),
  ];
}

export function shroudParts(d: Dims) {
  const z = d.caseHalf;
  return [
    ...items(
      "Shroud tube retaining spring",
      "15H21201",
      "12–15",
      "darkSteel",
      [0, 0.003].map((k) => sleeve(0.011, 0.0145, z + 0.008 + k, z + 0.009 + k, 0.1, 6.0)),
      "A pair of retaining springs locates each pushrod shroud.",
      [0, -0.085, 0.025],
    ),
    item(
      "Shroud tube washer",
      "01L23459",
      "12–16",
      "steel",
      sleeve(0.011, 0.015, z + 0.006, z + 0.0075),
      "The washer supports the shroud springs.",
      [0, -0.085, 0],
    ),
    item(
      "Shroud tube sleeve",
      "61503",
      "12–17",
      "steel",
      sleeve(0.011, 0.0135, d.zPivot - 0.081, d.zPivot - 0.074),
      "The sleeve supports the head end of the shroud.",
      [0, -0.085, 0.07],
    ),
  ];
}
