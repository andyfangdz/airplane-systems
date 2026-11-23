import type { ScreenSpec } from "@/components/scene/Screens";
import { panelRotation, UNITS } from "./flightdeck-layout";

// Original schematic display artwork. The paired PDUs mirror the outboard flight presentation
// and inboard engine strip visible on the Falcon 6X at EBACE 2022; the two MDUs are configurable.
// Values and graphics form a single illustrative snapshot, independent of flight state.
type Context = CanvasRenderingContext2D;
type Point = [number, number];
const white = "#e7edf0",
  green = "#5fe29d",
  cyan = "#70d1ef",
  magenta = "#ee72cf",
  edge = "#697981";
function rect(c: Context, x: number, y: number, w: number, h: number, color: string) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}
function ink(
  c: Context,
  x: number,
  y: number,
  caption: string,
  size: number,
  color = white,
  align: CanvasTextAlign = "left",
) {
  c.font = `600 ${size}px monospace`;
  c.textAlign = align;
  c.textBaseline = "middle";
  c.fillStyle = color;
  c.fillText(caption, x, y);
}
function path(c: Context, points: Point[], colour: string, width = 2, closed = false) {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  if (closed) {
    c.closePath();
    c.fillStyle = colour;
    c.fill();
  } else {
    c.strokeStyle = colour;
    c.lineWidth = width;
    c.stroke();
  }
}
function circle(c: Context, x: number, y: number, r: number, colour: string, width = 2) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.strokeStyle = colour;
  c.lineWidth = width;
  c.stroke();
}
function strip(c: Context, title: string, secondary: string) {
  rect(c, 0, 0, 640, 29, "#15272c");
  ink(c, 11, 14, title, 14, cyan);
  ink(c, 628, 14, secondary, 13, green, "right");
  rect(c, 0, 29, 640, 1, edge);
}
function tape(c: Context, x: number, rows: string[], center: string) {
  rect(c, x, 102, 52, 132, "#24323c");
  rows.forEach((v, i) => {
    ink(c, x + 25, 116 + i * 24, v, 13, white, "center");
    rect(c, x + 45, 117 + i * 24, 7, 1, white);
  });
  rect(c, x - 2, 151, 57, 33, "#101921");
  c.strokeStyle = white;
  c.lineWidth = 1.8;
  c.strokeRect(x - 2, 151, 57, 33);
  ink(c, x + 26, 168, center, 19, green, "center");
}
function terrain(c: Context, w: number, h: number) {
  const sky = c.createLinearGradient(0, 0, 0, h / 2);
  sky.addColorStop(0, "#348ac2");
  sky.addColorStop(1, "#83c3e0");
  c.fillStyle = sky;
  c.fillRect(0, 0, w, h / 2 + 3);
  rect(c, 0, h / 2, w, h / 2, "#715f3d");
  path(
    c,
    [
      [0, h * 0.54],
      [w * 0.13, h * 0.45],
      [w * 0.21, h * 0.49],
      [w * 0.35, h * 0.4],
      [w * 0.48, h * 0.48],
      [w * 0.58, h * 0.44],
      [w * 0.72, h * 0.51],
      [w * 0.79, h * 0.46],
      [w, h * 0.5],
      [w, h],
      [0, h],
    ],
    "#aa9460",
    1,
    true,
  );
  path(
    c,
    [
      [0, h * 0.69],
      [w * 0.15, h * 0.62],
      [w * 0.24, h * 0.64],
      [w * 0.42, h * 0.54],
      [w * 0.7, h * 0.64],
      [w * 0.83, h * 0.52],
      [w, h * 0.63],
      [w, h],
      [0, h],
    ],
    "#897947",
    1,
    true,
  );
  path(
    c,
    [
      [0, h * 0.77],
      [w * 0.3, h * 0.69],
      [w * 0.55, h * 0.79],
      [w * 0.76, h * 0.66],
      [w, h * 0.71],
      [w, h],
      [0, h],
    ],
    "#76683c",
    1,
    true,
  );
  for (const u of [-1, -0.5, 0.5, 1])
    path(
      c,
      [
        [w / 2 + u * w * 0.14, h * 0.61],
        [w / 2 + u * w * 0.51, h],
      ],
      "#a08a58",
      1,
    );
}
function attitude(c: Context, x: number) {
  c.save();
  c.translate(x, 35);
  terrain(c, 418, 210);
  path(
    c,
    [
      [63, 110],
      [354, 110],
    ],
    "#c4c9a7",
    1,
  );
  for (const i of [-3, -2, -1, 1, 2, 3]) {
    const v = 108 + i * 13,
      len = i % 2 === 0 ? 34 : 17;
    path(
      c,
      [
        [209 - len, v],
        [209 + len, v],
      ],
      white,
      1.8,
    );
    if (i % 2 === 0) ink(c, 209 + len + 11, v, String(Math.abs(i) * 5), 10);
  }
  path(
    c,
    [
      [145, 123],
      [176, 123],
      [189, 134],
      [207, 119],
      [225, 134],
      [238, 123],
      [273, 123],
    ],
    "#29241d",
    7,
  );
  path(
    c,
    [
      [145, 123],
      [176, 123],
      [189, 134],
      [207, 119],
      [225, 134],
      [238, 123],
      [273, 123],
    ],
    "#ffcf39",
    3,
  );
  path(
    c,
    [
      [195, 103],
      [209, 110],
      [223, 103],
    ],
    magenta,
    4,
  );
  c.restore();
  tape(c, x + 5, ["220", "210", "200", "190", "180"], "200");
  tape(c, x + 358, ["4300", "4200", "4100", "4000", "3900"], "4100");
  ink(c, x + 92, 54, "FMS", 14, green);
  ink(c, x + 266, 54, "ALT", 14, green);
}
function hsi(c: Context, x: number, y: number) {
  const r = 88;
  circle(c, x, y, r, white, 1.4);
  for (let i = 0; i < 36; i++) {
    const a = (i * Math.PI) / 18;
    const len = i % 3 === 0 ? 10 : 5;
    path(
      c,
      [
        [x + (r - len) * Math.sin(a), y - (r - len) * Math.cos(a)],
        [x + r * Math.sin(a), y - r * Math.cos(a)],
      ],
      white,
      1.6,
    );
    if (i % 3 === 0) {
      const s = i % 9 === 0 ? ["N", "E", "S", "W"][i / 9] : String(i);
      ink(c, x + (r - 18) * Math.sin(a), y - (r - 18) * Math.cos(a), s, 13, white, "center");
    }
  }
  path(
    c,
    [
      [x - 35, y + 69],
      [x + 31, y - 63],
      [x + 32, y - 47],
    ],
    magenta,
    3,
  );
  path(
    c,
    [
      [x - 22, y + 9],
      [x, y + 1],
      [x + 22, y + 9],
      [x, y + 3],
      [x, y - 16],
    ],
    white,
    2.5,
  );
}
function engineStrip(c: Context, x: number) {
  rect(c, x, 32, 209, 444, "#10191d");
  ink(c, x + 103, 50, "ENGINES", 13, cyan, "center");
  for (const [row, lab, val] of [
    [0, "N1", "71.8"],
    [1, "ITT", "654"],
    [2, "N2", "85.1"],
  ] as const) {
    const yy = 96 + 96 * row;
    ink(c, x + 105, yy - 16, lab, 14, white, "center");
    for (const offset of [43, 165]) {
      const cx = x + offset;
      c.beginPath();
      c.arc(cx, yy + 22, 27, Math.PI * 0.92, Math.PI * 1.98);
      c.strokeStyle = green;
      c.lineWidth = 3;
      c.stroke();
      path(
        c,
        [
          [cx, yy + 22],
          [cx + 4, yy - 3],
        ],
        white,
        2,
      );
      ink(c, cx, yy + 38, val, 15, green, "center");
    }
    rect(c, x + 10, yy + 58, 189, 1, "#394951");
  }
  ["FUEL FLOW", "OIL TEMP", "OIL PRESS"].forEach((t, i) => {
    const yy = 361 + i * 36;
    ink(c, x + 104, yy, t, 11, white, "center");
    ink(c, x + 26, yy, "▰", 14, green);
    ink(c, x + 165, yy, "▰", 14, green);
  });
}
function primary(c: Context, right: boolean) {
  rect(c, 0, 0, 640, 480, "#101a1f");
  strip(c, "PDU   FMS", "LNAV     ALT");
  const x = right ? 216 : 0;
  attitude(c, x);
  hsi(c, x + 210, 354);
  ink(c, x + 17, 272, "FMS 1", 13, magenta);
  ink(c, x + 15, 436, "GS 208", 12, white);
  ink(c, x + 390, 436, "1013", 13, cyan, "right");
  engineStrip(c, right ? 0 : 431);
}
function map(c: Context) {
  rect(c, 0, 0, 640, 480, "#101c1f");
  strip(c, "MAP   ·   FMS 1", "TRACK UP");
  rect(c, 5, 36, 434, 333, "#655e49");
  const ridges: Point[][] = [
    [
      [6, 113],
      [85, 84],
      [122, 97],
      [161, 71],
      [206, 64],
      [257, 91],
      [302, 70],
      [334, 38],
      [434, 38],
      [434, 143],
      [259, 155],
      [201, 132],
      [97, 179],
      [6, 156],
    ],
    [
      [6, 236],
      [47, 218],
      [100, 227],
      [153, 182],
      [213, 184],
      [252, 162],
      [331, 180],
      [361, 149],
      [437, 179],
      [437, 224],
      [302, 256],
      [192, 220],
      [127, 261],
      [6, 304],
    ],
    [
      [6, 347],
      [57, 298],
      [113, 313],
      [187, 278],
      [266, 302],
      [337, 256],
      [436, 282],
      [436, 367],
      [6, 367],
    ],
  ];
  ridges.forEach((points, i) => path(c, points, ["#82795a", "#5b6f4c", "#84905d"][i], 1, true));
  path(
    c,
    [
      [5, 224],
      [75, 207],
      [104, 179],
      [145, 169],
      [169, 123],
      [225, 120],
      [264, 84],
      [311, 72],
      [345, 38],
    ],
    "#80a8b5",
    3,
  );
  const route: Point[] = [
    [55, 344],
    [124, 277],
    [259, 240],
    [292, 120],
    [376, 58],
  ];
  path(c, route, magenta, 3);
  route.forEach(([x, y], i) => {
    path(
      c,
      [
        [x, y - 5],
        [x + 6, y],
        [x, y + 5],
        [x - 6, y],
        [x, y - 5],
      ],
      white,
      1.5,
    );
    ink(c, x + 9, y + 7, "WPT " + (i + 1), 11);
  });
  for (const d of [67, 131]) {
    c.beginPath();
    c.arc(225, 295, d, -Math.PI * 0.82, -Math.PI * 0.18);
    c.strokeStyle = "#bdc7aa";
    c.lineWidth = 1;
    c.stroke();
  }
  path(
    c,
    [
      [216, 302],
      [225, 279],
      [234, 302],
      [225, 297],
      [216, 302],
    ],
    white,
    2,
  );
  ink(c, 17, 350, "20 NM", 13);
  ink(c, 455, 54, "FLIGHT PLAN", 14, cyan);
  route.forEach((_, i) => {
    const y = 94 + i * 52;
    ink(c, 456, y, "WPT " + (i + 1), 16, i === 2 ? magenta : white);
    ink(c, 616, y + 19, String(14 + i * 4) + " NM", 12, green, "right");
    rect(c, 450, y + 30, 175, 1, "#46565b");
  });
  rect(c, 5, 377, 622, 90, "#1f3032");
  ink(c, 15, 393, "VERTICAL PROFILE", 12, cyan);
  path(
    c,
    [
      [10, 453],
      [83, 435],
      [125, 439],
      [195, 422],
      [226, 430],
      [310, 412],
      [381, 425],
      [404, 415],
      [462, 437],
      [527, 419],
      [621, 445],
    ],
    "#a18b58",
    2,
  );
  path(
    c,
    [
      [10, 405],
      [201, 405],
      [425, 428],
      [621, 428],
    ],
    magenta,
    2,
  );
}
function systems(c: Context) {
  rect(c, 0, 0, 640, 480, "#132227");
  strip(c, "SYSTEMS", "STATUS");
  const rows = ["FLIGHT CONTROLS", "FUEL", "HYDRAULICS", "ELECTRICAL", "ENVIRONMENT", "LANDING GEAR"];
  rows.forEach((t, i) => {
    const y = 50 + i * 51;
    rect(c, 12, y, 296, 43, i === 2 ? "#335654" : "#25353c");
    ink(c, 23, y + 21, t, 16, i === 2 ? white : "#b5cecc");
    ink(c, 294, y + 21, "●", 12, green, "right");
  });
  rect(c, 323, 50, 304, 290, "#1c2c32");
  ink(c, 342, 73, "SYSTEM OVERVIEW", 16, cyan);
  for (const xx of [385, 558]) {
    rect(c, xx - 32, 107, 64, 43, "#344b52");
    ink(c, xx, 128, "PUMP", 14, white, "center");
    path(
      c,
      [
        [xx, 150],
        [xx, 221],
        [xx + (xx < 450 ? 47 : -47), 221],
        [xx + (xx < 450 ? 47 : -47), 260],
      ],
      green,
      3,
    );
    rect(c, xx + (xx < 450 ? 19 : -74), 260, 55, 39, "#31484b");
  }
  ink(c, 476, 320, "SCHEMATIC", 11, "#92b4b7", "center");
  ["NORMAL", "CHECKLIST", "SYSTEMS", "CHARTS"].forEach((t, i) => {
    rect(c, 12 + i * 155, 396, 147, 46, i === 2 ? "#375662" : "#27383e");
    ink(c, 85 + i * 155, 419, t, 14, white, "center");
  });
}
function efb(c: Context, right: boolean) {
  rect(c, 0, 0, 640, 480, "#192e45");
  strip(c, "EFB", right ? "AIRPORT" : "FLIGHT");
  if (right) {
    rect(c, 24, 48, 592, 348, "#c1c5b5");
    const roads: Point[][] = [
      [
        [45, 325],
        [543, 97],
      ],
      [
        [166, 73],
        [406, 366],
      ],
      [
        [67, 278],
        [295, 174],
        [469, 100],
      ],
      [
        [129, 307],
        [335, 211],
        [417, 266],
      ],
    ];
    roads.forEach((r, i) => path(c, r, i < 2 ? "#626b70" : "#9f9c76", i < 2 ? 15 : 8));
    path(
      c,
      [
        [45, 325],
        [543, 97],
      ],
      white,
      1.6,
    );
    ink(c, 55, 71, "AIRPORT DIAGRAM", 18, "#334048");
  } else {
    ["FLIGHT PLAN", "CHARTS", "PERFORMANCE", "DOCUMENTS", "WEATHER", "AIRPORT"].forEach((t, i) => {
      const xx = 23 + (i % 2) * 301,
        yy = 63 + Math.floor(i / 2) * 106;
      rect(c, xx, yy, 284, 88, "#264b67");
      rect(c, xx + 16, yy + 15, 38, 34, "#4282a4");
      path(
        c,
        [
          [xx + 23, yy + 39],
          [xx + 32, yy + 27],
          [xx + 44, yy + 33],
        ],
        white,
        2,
      );
      ink(c, xx + 16, yy + 65, t, 15);
    });
  }
  ink(c, 33, 435, "FALCONSPHERE", 19, cyan);
}
function standby(c: Context) {
  rect(c, 0, 0, 640, 480, "#142226");
  rect(c, 28, 28, 584, 209, "#328db4");
  rect(c, 28, 237, 584, 203, "#876646");
  for (const y of [133, 181, 287, 331])
    path(
      c,
      [
        [271, y],
        [369, y],
      ],
      white,
      5,
    );
  path(
    c,
    [
      [126, 252],
      [239, 252],
      [264, 278],
      [321, 246],
      [378, 278],
      [406, 252],
      [514, 252],
    ],
    "#ffda46",
    9,
  );
  ink(c, 32, 412, "200", 48);
  ink(c, 597, 412, "4100", 48, white, "right");
}
const pduNote =
  "The outboard portion shows attitude, airspeed, altitude and heading. The inboard strip shows the two engines.";
const pages = {
  left: { draw: (c: Context) => primary(c, false), note: pduNote },
  right: { draw: (c: Context) => primary(c, true), note: pduNote },
  "upper-center": {
    draw: map,
    note: "The shared upper display presents an illustrative navigation map and flight profile.",
  },
  "lower-center": { draw: systems, note: "The lower multifunction display shows an example aircraft systems page." },
  "left-efb": {
    draw: (c: Context) => efb(c, false),
    note: "The electronic flight bag beside the captain displays a FalconSphere application menu.",
  },
  "right-efb": {
    draw: (c: Context) => efb(c, true),
    note: "The electronic flight bag beside the first officer displays a schematic airport chart.",
  },
  standby: {
    draw: standby,
    note: "The standby instrument beside the captain's main display provides a separate flight reference.",
  },
};
export const EASY_SCREENS: ScreenSpec[] = UNITS.map((unit) => ({
  key: unit.key,
  name: unit.name,
  ...pages[unit.key],
  sys: ["avionics"],
  pin: false,
  px: [640, 480],
  size: unit.size,
  pos: unit.pos,
  rot: panelRotation(unit.pitch),
}));
