import * as THREE from "three";
import { sidePaintUV, paintAtlas } from "@/lib/livery";
import { finishMat } from "@/lib/materials";
import { loft, tubeGeo } from "@/lib/geometry";
import type { Catalogue } from "@/lib/catalogue";
import { FIN, FUSE, STAB, WING, wingtipStations, wingtipSection, finHeights } from "../geometry";
import { hull, paintHull } from "../exterior-skin";
import { useFlaperonStudy } from "../flaperons";
import { FALCON_PEARL } from "../paint";

// Project the published wing panel layout in chord/span coordinates. Separate atlas halves
// keep the upper access covers off the lower face and maintain continuity at all span stations.
function wingUV(geo: THREE.BufferGeometry) {
  const p = geo.getAttribute("position"),
    n = geo.getAttribute("normal");
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const span = Math.abs(p.getZ(i));
    uv[2 * i] = ((WING.le(span) - p.getX(i)) / WING.chord(span) + (n.getY(i) < 0 ? 1 : 0)) / 2;
    uv[2 * i + 1] = span / 12.97;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geo;
}

function wingPaint() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 1024;
  const g = c.getContext("2d")!;
  g.fillStyle = FALCON_PEARL;
  g.fillRect(0, 0, c.width, c.height);
  // The spanwise stepped line just ahead of the trailing devices is visible on the
  // plan view (Facts & Figures, p. 3). Actual access-panel dimensions are approximate.
  const line = [
    [0.5, 1.5],
    [0.5, 2.1],
    [0.575, 2.1],
    [0.575, 3.1],
    [0.61, 3.1],
    [0.61, 6.85],
    [0.64, 7.4],
    [0.64, 10.3],
    [0.57, 10.35],
    [0.57, 11.55],
  ];
  g.strokeStyle = "#909ca4";
  g.lineWidth = 1.2;
  g.beginPath();
  line.forEach(([u, z], i) => {
    const x = 256 * u,
      y = 1024 * (1 - z / 12.97);
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  });
  g.stroke();
  const texture = new THREE.CanvasTexture(c);
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const neutralPaint = () => {
  const sample = document.createElement("canvas");
  sample.width = sample.height = 1;
  const ctx = sample.getContext("2d")!;
  ctx.fillStyle = FALCON_PEARL;
  ctx.fillRect(0, 0, 1, 1);
  const texture = new THREE.CanvasTexture(sample);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};
const tailPaintBox = { x0: -12.9, x1: -4.65, y0: 0.7, y1: 5.06 };
const surfacePaint = { box: tailPaintBox, skin: neutralPaint };

function finPaint() {
  const base = document.createElement("canvas");
  base.width = 1024;
  base.height = 512;
  const g = base.getContext("2d")!;
  g.fillStyle = FALCON_PEARL;
  g.fillRect(0, 0, base.width, base.height);
  const sx = base.width / (tailPaintBox.x1 - tailPaintBox.x0);
  const sy = base.height / (tailPaintBox.y1 - tailPaintBox.y0);
  const P = ([x, y]: number[]) => [(x - tailPaintBox.x0) * sx, (tailPaintBox.y1 - y) * sy];
  g.setTransform(sx, 0, 0, -sy, -tailPaintBox.x0 * sx, tailPaintBox.y1 * sy);
  // Demonstrator tail markings on the September 2023 three-view, continued across
  // the rudder with the same projected coordinates as the fixed fin.
  g.fillStyle = "#323d49";
  g.beginPath();
  g.moveTo(-6.0, 2.36);
  g.bezierCurveTo(-7.1, 1.56, -9.13, 1.34, -12.48, 1.1);
  g.lineTo(-12.48, 1.62);
  g.bezierCurveTo(-9.0, 1.75, -7.27, 1.68, -6.0, 2.36);
  g.fill();
  g.fillStyle = "#75818b";
  g.beginPath();
  g.moveTo(-7.13, 2.72);
  g.bezierCurveTo(-8.4, 2.08, -9.8, 1.96, -12.44, 2.03);
  g.lineTo(-12.5, 1.78);
  g.bezierCurveTo(-9.8, 1.84, -8.13, 1.9, -7.13, 2.72);
  g.fill();
  g.fillStyle = "#b22735";
  g.beginPath();
  g.moveTo(-9.26, 3.48);
  g.bezierCurveTo(-10.05, 4.35, -10.68, 4.51, -12.34, 4.44);
  g.bezierCurveTo(-11.29, 4.31, -10.0, 3.85, -9.26, 3.48);
  g.fill();
  g.fillStyle = "#47535e";
  g.beginPath();
  g.moveTo(-10.72, 4.14);
  g.bezierCurveTo(-11.29, 4.43, -11.84, 4.4, -12.34, 4.44);
  g.bezierCurveTo(-11.76, 4.24, -11.31, 4.11, -10.72, 4.14);
  g.fill();
  const texture = paintAtlas(base, P);
  // Each side reads forward. Use the same projected ink dimensions on both sides.
  const atlas = texture.image as HTMLCanvasElement;
  const text = atlas.getContext("2d")!;
  const [left, top] = P([-11.48, 3.42]),
    [right, bottom] = P([-10.16, 2.82]);
  text.fillStyle = "#36414d";
  text.font = "italic 600 100px Arial, sans-serif";
  for (const x of [left, atlas.width - right]) {
    text.save();
    text.translate(x, bottom);
    text.scale((right - left) / text.measureText("6X").width, (bottom - top) / 72);
    text.fillText("6X", 0, 0);
    text.restore();
  }
  return texture;
}

// Rounded sections of the belly canoe, stabilizer pivot fairing and fin-tip cap.
// Their ends run back into the surrounding skin as on the manufacturer's three-view.
function bodyLoft(stations: number[][]) {
  return loft(
    stations.map(([x, y, halfWidth, halfHeight]) =>
      Array.from({ length: 40 }, (_, i) => {
        const a = (i * 2 * Math.PI) / 40;
        return new THREE.Vector3(x, y + halfHeight * Math.sin(a), halfWidth * Math.cos(a));
      }),
    ),
  );
}

// Remove the buried faces of surfaces which join the fuselage. Preserve a small
// overlap at the joint and keep the upper faces beneath the interior floor.
function outsideFuselage(geo: THREE.BufferGeometry) {
  const p = geo.getAttribute("position");
  const inside = Array.from({ length: p.count }, (_, i) =>
    FUSE.inside(new THREE.Vector3().fromBufferAttribute(p, i), 0.045),
  );
  const index = geo.getIndex()!;
  const skin: number[] = [];
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i),
      b = index.getX(i + 1),
      c = index.getX(i + 2);
    if (!(inside[a] && inside[b] && inside[c])) skin.push(a, b, c);
  }
  geo.setIndex(skin);
  return geo;
}

export function addAirframe(cat: Catalogue) {
  cat.shell(
    hull,
    "Fuselage",
    "Dassault lists an overall aircraft length of 25.68 m. The study model follows the exterior outline in Facts & Figures, p. 3.",
    paintHull,
    "airframe.fuselage",
  );

  cat.shell(
    () =>
      sidePaintUV(
        outsideFuselage(
          bodyLoft([
            [5.45, -0.61, 0.53, 0.14],
            [4.75, -0.72, 1.01, 0.27],
            [3.75, -0.81, 1.28, 0.4],
            [2.55, -0.86, 1.47, 0.48],
            [1.4, -0.88, 1.62, 0.53],
            [-0.8, -0.89, 1.71, 0.56],
            [-2.45, -0.87, 1.68, 0.54],
            [-3.65, -0.77, 1.57, 0.49],
            [-4.7, -0.59, 1.37, 0.4],
            [-5.65, -0.38, 1.08, 0.31],
            [-6.62, -0.12, 0.5, 0.14],
          ]),
        ),
        tailPaintBox,
      ),
    "Wing-body fairing",
    "A long fairing blends the wing roots into the underside of the fuselage.",
    neutralPaint,
    "airframe.wing-body-fairing",
  );
  cat.shell(
    () =>
      sidePaintUV(
        bodyLoft([
          [-8.39, 2.28, 0.05, 0.04],
          [-8.63, 2.28, 0.15, 0.105],
          [-9.23, 2.28, 0.228, 0.145],
          [-10.48, 2.28, 0.23, 0.15],
          [-11.35, 2.28, 0.18, 0.12],
          [-12.0, 2.28, 0.105, 0.07],
          [-12.55, 2.28, 0.012, 0.012],
        ]),
        tailPaintBox,
      ),
    "Stabilizer fairing",
    "The horizontal tail blends into the fin at this fairing.",
    neutralPaint,
    "airframe.stabilizer-fairing",
  );
  cat.shell(
    () =>
      sidePaintUV(
        bodyLoft([
          [-10.36, 4.87, 0.027, 0.026],
          [-10.57, 4.85, 0.11, 0.1],
          [-10.93, 4.85, 0.145, 0.17],
          [-11.6, 4.86, 0.14, 0.15],
          [-12.35, 4.88, 0.102, 0.1],
          [-12.82, 4.91, 0.015, 0.015],
        ]),
        tailPaintBox,
      ),
    "Fin tip",
    "Streamlined cap at the upper tip of the vertical stabilizer.",
    neutralPaint,
    "airframe.fin-tip",
  );
  // Span stations follow the manufacturer’s top view. The trailing-edge devices run
  // inboard to outboard as shown on p. 60 of the June 2026 Overview.
  const boundaries = [1.42, 2.75, 4.25, 5.8, 7.25, 8.65, 10.25, 11.65, 12.2];
  for (const [side, sign, suffix] of [
    ["right", 1, "R"],
    ["left", -1, "L"],
  ] as const) {
    const rib = (z: number, a: number, b: number) => WING.sec(sign * z, a, b);
    cat.shell(
      () => wingUV(loft(boundaries.map((z) => rib(z, 0.14, 0.735)))),
      "Main wing",
      "The swept wing carries leading-edge slats and several distinct trailing-edge control surfaces.",
      wingPaint,
      "airframe.wing",
      side,
    );
    cat.shell(
      () => wingUV(outsideFuselage(loft([0.6, 0.9, 1, 1.08, 1.14, 1.2, 1.415].map((z) => rib(z, 0, 1))))),
      "Wing root",
      "The wing joins the underside of the fuselage.",
      wingPaint,
      "airframe.wing-root",
      side,
    );
    cat.part(() => loft(wingtipStations.map((span) => wingtipSection(sign * span))), ["airframe"], {
      id: "airframe.winglet",
      instance: side,
      name: "Winglet",
      note: "The wing sweeps upward at the tip. Overall wingspan is 25.94 m.",
      solidColor: FALCON_PEARL,
      pin: true,
      ext: true,
    });
    for (const [section, z0, z1] of [
      ["inboard", 1.42, 4.85],
      ["middle", 4.86, 8.7],
      ["outboard", 8.71, 11.65],
    ] as const) {
      cat.part(
        () => loft([z0, ...boundaries.filter((z) => z > z0 && z < z1), z1].map((z) => rib(z, 0, 0.138))),
        ["controls", "airframe"],
        {
          id: "controls.leading-edge-slat",
          instance: [side, section],
          name: "Leading-edge slat",
          note: "Three slat panels extend forward of each wing in the high-lift study pose. The slot opens between the slats and the fixed leading edge.",
          anim: (mesh) => {
            const extended = useFlaperonStudy.getState().pose === "lift";
            mesh.position.set(extended ? 0.175 : 0, extended ? -0.075 : 0, 0);
          },
          pin: true,
          ext: true,
          solidMaterial: () => finishMat.polished,
        },
      );
    }
    cat.shell(
      () => wingUV(loft([11.65, 12.2].map((z) => rib(z, 0, 0.14)))),
      "Outer leading edge",
      "",
      wingPaint,
      "airframe.tip-leading-edge",
      side,
    );
    // The manufacturer's wing close-up identifies two airbrake panels ahead of the flap.
    // Give their slightly crowned upper skins a thin edge in the retracted pose.
    for (const [station, inner, outer] of [
      ["inboard", 2.25, 3.82],
      ["outboard", 4.04, 5.62],
    ] as const) {
      cat.part(
        () =>
          loft(
            [inner, (inner + outer) / 2, outer].map((z, i) => {
              const fore = i === 1 ? 0.555 : 0.575;
              const aft = 0.729;
              const top = Array.from({ length: 7 }, (_, j) => {
                const p = WING.p(sign * z, fore + ((aft - fore) * j) / 6, 1);
                p.y += 0.012;
                return p;
              });
              return [...top, ...top.map((p) => p.clone().add(new THREE.Vector3(0, -0.016, 0))).reverse()];
            }),
          ),
        ["controls", "airframe"],
        {
          id: "controls.airbrake",
          instance: [side, station],
          name: "Airbrake panel",
          note: "The upper-wing airbrake panels sit ahead of the trailing-edge surfaces. Both are shown retracted.",
          ext: true,
          solidColor: "#b5bec5",
          pin: station === "inboard",
        },
      );
    }
    for (const [key, name, z0, z1, note] of [
      ["flap", "Flap", 1.42, 5.79, "The inboard flap increases wing lift for low-speed flight."],
      [
        "ail",
        "Flaperon",
        5.8,
        8.64,
        "Between the flap and aileron, the flaperon combines high-lift and roll-control functions.",
      ],
      ["outboardAil", "Aileron", 8.65, 11.65, "The outboard aileron contributes to roll control."],
    ] as const) {
      const mid = (z0 + z1) / 2;
      cat.loftSurface(
        key + suffix,
        () => [z0, ...boundaries.filter((z) => z > z0 && z < z1), z1].map((z) => rib(z, 0.742, 1)),
        WING.p(sign * z0, 0.74),
        WING.p(sign * z1, 0.74),
        ["controls"],
        name,
        note,
        surfacePaint,
      );
      if (key === "ail") {
        cat.part(
          () => tubeGeo([WING.p(sign * (mid - 0.29), 0.74, 1), WING.p(sign * (mid + 0.29), 0.74, 1)], 0.025),
          ["controls"],
          {
            id: "controls.flaperon-hinge",
            instance: side,
            name: "Flaperon",
            note,
            pin: true,
            ext: true,
            chan: ["aileron"],
            solidColor: "#64717C",
          },
        );
      }
    }
    cat.shell(
      () => wingUV(loft([11.65, 12.2].map((z) => rib(z, 0.735, 1)))),
      "Outer trailing edge",
      "",
      wingPaint,
      "airframe.tip-trailing-edge",
      side,
    );
    // Three tapered fairings beneath each wing project past the curved trailing edge in
    // the June 2026 Overview three-view (p. 7). Their external envelopes are schematic.
    for (const [station, span, extension] of [
      ["inboard", 3.02, 0.28],
      ["middle", 4.98, 0.31],
      ["outer", 7.78, 0.27],
    ] as const) {
      const z = sign * span;
      const te = WING.p(z, 1),
        front = WING.p(z, 0.48, -1);
      cat.part(
        () =>
          bodyLoft([
            [front.x, front.y - 0.01, 0.025, 0.02],
            [WING.p(z, 0.6).x, front.y - 0.03, 0.078, 0.063],
            [WING.p(z, 0.8).x, te.y - 0.087, 0.099, 0.075],
            [te.x - 0.01, te.y - 0.057, 0.078, 0.058],
            [te.x - extension, te.y - 0.022, 0.012, 0.012],
          ]),
        ["airframe", "controls"],
        {
          id: "airframe.trailing-edge-fairing",
          instance: [side, station],
          pos: [0, 0, z],
          name: "Trailing-edge fairing",
          note: "A streamlined fairing extends aft beneath the wing.",
          solidColor: FALCON_PEARL,
          ext: true,
        },
      );
    }
    const stabSpans = [0.1, 0.55, 2.65, 4.62, 4.84, 4.94];
    cat.shell(
      () => sidePaintUV(loft(stabSpans.map((z) => STAB.sec(sign * z, 0, 0.65))), tailPaintBox),
      "Horizontal stabilizer",
      "The swept horizontal stabilizer intersects the vertical fin above the engines.",
      neutralPaint,
      "airframe.horizontal-stabilizer",
      side,
    );
    cat.loftSurface(
      "elev" + suffix,
      () => stabSpans.map((z) => STAB.sec(sign * z, 0.659, 1)),
      STAB.p(sign * 0.1, 0.65),
      STAB.p(sign * 4.94, 0.65),
      ["controls"],
      "Elevator",
      "The elevators move to control pitch.",
      surfacePaint,
    );
  }
  cat.shell(
    () => sidePaintUV(loft(finHeights.map((h) => FIN.sec(h, 0, 0.7))), tailPaintBox),
    "Vertical stabilizer",
    "The swept fin carries the rudder and horizontal stabilizer.",
    finPaint,
    "airframe.vertical-stabilizer",
  );
  cat.loftSurface(
    "rudder",
    () => finHeights.map((h) => FIN.sec(h, 0.709, 1)),
    FIN.p(finHeights[0], 0.7),
    FIN.p(finHeights[finHeights.length - 1], 0.7),
    ["controls"],
    "Rudder",
    "The rudder on the trailing edge of the fin controls yaw.",
    { box: tailPaintBox, skin: finPaint },
  );
}
