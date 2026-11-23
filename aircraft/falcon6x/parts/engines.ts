import * as THREE from "three";
import { FALCON_PEARL } from "../paint";
import { LIVERY_REGISTRATION } from "@/aircraft/liveries";
import type { Catalogue } from "@/lib/catalogue";
import { afRing, loft, mergeGeos } from "@/lib/geometry";
import { sidePaintUV } from "@/lib/livery";
import { finishMat, skinMat } from "@/lib/materials";
import { V, type Vec3 } from "@/lib/math";

// Local x is forward along the shaft. Stations and pylon outlines follow the top and
// front views on p. 3 of Facts & Figures (Sept 2023); internal contours are schematic.
const paintBox = { x0: -2.4, x1: 2.4, y0: -1, y1: 1 };
const cowlProfile: [number, number][] = [
  [-2.21, 0.52],
  [-2.13, 0.54],
  [-1.94, 0.602],
  [-1.62, 0.693],
  [-1.21, 0.774],
  [-0.72, 0.839],
  [-0.17, 0.878],
  [0.45, 0.892],
  [0.99, 0.889],
  [1.47, 0.868],
  [1.89, 0.834],
  [2.16, 0.802],
];

function turned(profile: [number, number][]) {
  return new THREE.LatheGeometry(
    profile.map(([x, r]) => new THREE.Vector2(r, x)),
    64,
  ).rotateZ(-Math.PI / 2);
}

// Paint the curved access doors and the photographed F-WSIX registration on the
// outboard flank. Each half of the atlas has its own left-to-right lettering space.
function nacellePaint(sign: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 448;
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width / 2,
    h = canvas.height;
  ctx.fillStyle = FALCON_PEARL;
  ctx.fillRect(0, 0, canvas.width, h);
  for (const flank of [1, -1]) {
    ctx.save();
    ctx.translate(flank === 1 ? w / 2 : w * 1.5, h / 2);
    ctx.scale((flank * w) / (paintBox.x1 - paintBox.x0), -h / (paintBox.y1 - paintBox.y0));
    ctx.strokeStyle = "#a5a8a7";
    ctx.lineWidth = 0.013;
    ctx.beginPath();
    ctx.moveTo(1.7, 1);
    ctx.bezierCurveTo(1.68, 0.35, 1.66, -0.55, 1.71, -1);
    ctx.moveTo(-1.43, 1);
    ctx.bezierCurveTo(-1.28, 0.64, -1.33, 0.29, -1.47, 0.12);
    ctx.bezierCurveTo(-1.6, 0.01, -1.63, -0.13, -1.49, -0.26);
    ctx.bezierCurveTo(-1.38, -0.38, -1.36, -0.69, -1.38, -1);
    ctx.moveTo(-1.43, 0.05);
    ctx.lineTo(-2.18, 0.04);
    ctx.stroke();
    ctx.restore();
  }
  const label = LIVERY_REGISTRATION.falcon6x;
  const center = sign === 1 ? w / 2 : 1.5 * w;
  ctx.translate(center + sign * ((0.24 * w) / 4.8), h / 2);
  ctx.font = "500 100px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const metrics = ctx.measureText(label);
  ctx.scale((1.73 * w) / 4.8 / metrics.width, (0.38 * h) / 2 / metrics.actualBoundingBoxAscent);
  ctx.fillStyle = "#232c33";
  ctx.fillText(label, 0, metrics.actualBoundingBoxAscent / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function fan() {
  // Cambered radial sections turn from root to tip, as visible on the single-piece
  // fan in the June 2026 Overview, p. 65. Blade count and pitch are illustrative.
  const section = afRing(0, 1, 0.047, 0.035, 7);
  const rings = Array.from({ length: 10 }, (_, i) => {
    const span = i / 9,
      radius = 0.17 + 0.551 * span;
    const sweep = -0.35 * span * span + 0.12 * Math.sin(Math.PI * span);
    return section.map(([u, v]) => {
      const angle = sweep + u * (0.45 - 0.19 * span) + v * 0.12;
      return V(
        1.59 + 0.09 * span - u * (0.14 + 0.085 * span) + v * 0.25,
        radius * Math.cos(angle),
        radius * Math.sin(angle),
      );
    });
  });
  const blade = loft(rings);
  const blades = Array.from({ length: 24 }, (_, i) => blade.clone().rotateX((i * Math.PI) / 12));
  blade.dispose();
  return mergeGeos(blades);
}

const pylonCoat = new THREE.MeshStandardMaterial({ color: FALCON_PEARL, roughness: 0.36, metalness: 0.05 });
const fanMetal = new THREE.MeshStandardMaterial({ color: "#606976", metalness: 0.45, roughness: 0.37 });

export function addEngines(cat: Catalogue) {
  for (const [side, sign] of [
    ["left", -1],
    ["right", 1],
  ] as const) {
    const position: Vec3 = [-6.83, 0.56, sign * 2.17];
    const paint = () => nacellePaint(sign);
    cat.part(() => sidePaintUV(turned(cowlProfile), paintBox), ["engine"], {
      id: "engine.nacelle",
      instance: side,
      pos: position,
      name: `${side === "left" ? "Left" : "Right"} PW812D`,
      note: "Pratt & Whitney Canada supplies the Falcon 6X's two aft-mounted PW812D turbofans. Dassault rates each at 13,500 lbf thrust at sea level in standard conditions.",
      solidMaterial: () => skinMat(paint),
      fairing: true,
      ext: true,
      pin: true,
    });
    cat.part(
      () =>
        turned([
          [2.16, 0.802],
          [2.25, 0.793],
          [2.32, 0.78],
          [2.365, 0.762],
          [2.386, 0.741],
          [2.389, 0.724],
          [2.379, 0.708],
          [2.352, 0.698],
          [2.29, 0.691],
          [2.22, 0.691],
        ]),
      ["engine"],
      {
        id: "engine.inlet-lip",
        instance: side,
        pos: position,
        name: "Inlet lip",
        note: "The rounded inlet lip leads into the fan duct.",
        color: "#9BA9B6",
        solidMaterial: () => finishMat.polished,
        ext: true,
      },
    );
    cat.part(
      () =>
        turned([
          [2.22, 0.691],
          [2.12, 0.695],
          [1.99, 0.701],
          [1.78, 0.717],
          [1.66, 0.724],
          [1.42, 0.725],
          [1.32, 0.712],
          [1.32, 0],
        ]),
      ["engine"],
      {
        id: "engine.inlet-duct",
        instance: side,
        pos: position,
        name: "Inlet duct",
        solidColor: "#24282c",
        ext: true,
      },
    );
    cat.part(fan, ["engine"], {
      id: "engine.fan",
      instance: side,
      pos: position,
      name: "Fan",
      note: "The forward fan draws air through the inlet. The blade arrangement is schematic.",
      solidMaterial: () => fanMetal,
      ext: true,
      pin: true,
    });
    cat.part(
      () =>
        turned([
          [1.42, 0.193],
          [1.58, 0.193],
          [1.65, 0.177],
          [1.72, 0.142],
          [1.79, 0.091],
          [1.84, 0.039],
          [1.86, 0.001],
        ]),
      ["engine"],
      {
        id: "engine.fan-spinner",
        instance: side,
        pos: position,
        name: "Fan spinner",
        solidColor: "#33383c",
        ext: true,
      },
    );
    cat.part(
      () =>
        turned([
          [-2.38, 0.476],
          [-2.33, 0.491],
          [-2.21, 0.52],
        ]),
      ["engine"],
      {
        id: "engine.nozzle",
        instance: side,
        pos: position,
        name: "Exhaust nozzle",
        note: "At the aft end of the engine, the nozzle directs the exhaust stream rearward.",
        solidColor: "#747679",
        ext: true,
        pin: true,
      },
    );
    cat.part(
      () =>
        turned([
          [-1.52, 0.295],
          [-1.52, 0.511],
          [-1.9, 0.502],
          [-2.25, 0.478],
          [-2.38, 0.462],
          [-2.38, 0.476],
        ]),
      ["engine"],
      {
        id: "engine.exhaust-liner",
        instance: side,
        pos: position,
        name: "Exhaust duct",
        solidColor: "#393d40",
        ext: true,
      },
    );
    cat.part(
      () =>
        turned([
          [-2.19, 0.015],
          [-2.08, 0.106],
          [-1.87, 0.229],
          [-1.52, 0.313],
          [-1.14, 0.438],
          [-0.66, 0.505],
          [0.32, 0.465],
          [1.36, 0.314],
        ]),
      ["engine"],
      {
        id: "engine.core",
        instance: side,
        pos: position,
        name: "Engine core",
        note: "This simplified body marks the core inside the nacelle.",
        solidColor: "#414548",
      },
    );
    cat.part(
      () =>
        loft(
          [
            [0.54, 0.36, -5.03, 4.37, 0.104],
            [0.94, 0.415, -4.99, 4.3, 0.096],
            [1.15, 0.47, -5.04, 4.2, 0.083],
            [1.45, 0.54, -5.57, 3.56, 0.082],
            [1.76, 0.565, -5.96, 3.05, 0.078],
          ].map(([z, y, leadingX, chord, thickness]) =>
            afRing(0, 1, thickness, 0.008).map(([u, v]) => V(leadingX - u * chord, y + v * chord, sign * z)),
          ),
        ),
      ["engine"],
      {
        id: "engine.pylon",
        instance: side,
        name: "Engine pylon",
        note: "A short pylon connects each nacelle to the aft fuselage.",
        solidMaterial: () => pylonCoat,
        ext: true,
      },
    );
  }
}
