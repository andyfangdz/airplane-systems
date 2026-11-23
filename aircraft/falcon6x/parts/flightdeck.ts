import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Catalogue } from "@/lib/catalogue";
import { box, cyl, loft, mergeGeos, tubeGeo } from "@/lib/geometry";
import { V } from "@/lib/math";
import { panelRotation, UNITS } from "../flightdeck-layout";
import { FUSE } from "../geometry";
import { guidanceFinish, guidanceWidth, selectors } from "./guidance-panel";

// The EBACE 2022 photograph of the Falcon 6X and the June 2026 Overview (p. 57)
// guide the external layout. Dimensions are fitted to the model's cockpit.
const softBox = (x: number, y: number, z: number, r: number) => new RoundedBoxGeometry(x, y, z, 2, r);
const rim = "#29303a",
  panel = "#404850";

function face(shape: THREE.Shape, depth: number) {
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 8 });
}

function mainPanel() {
  const s = new THREE.Shape();
  s.moveTo(-1.01, 0.24);
  s.quadraticCurveTo(-0.93, 0.33, -0.66, 0.339);
  s.quadraticCurveTo(0, 0.366, 0.66, 0.339);
  s.quadraticCurveTo(0.93, 0.33, 1.01, 0.24);
  s.lineTo(1.02, -0.126);
  s.quadraticCurveTo(0.98, -0.16, 0.88, -0.153);
  s.lineTo(0.258, -0.112);
  s.quadraticCurveTo(0.217, -0.108, 0.197, -0.154);
  s.lineTo(-0.197, -0.154);
  s.quadraticCurveTo(-0.217, -0.108, -0.258, -0.112);
  s.lineTo(-0.88, -0.153);
  s.quadraticCurveTo(-0.98, -0.16, -1.02, -0.126);
  s.closePath();
  return face(s, 0.115);
}

function coaming() {
  const spans = [-1.06, -1.03, -0.9, -0.66, -0.36, 0, 0.36, 0.66, 0.9, 1.03, 1.06];
  return loft(
    spans.map((z) => {
      const t = Math.abs(z / 1.06),
        top = 0.445 - 0.071 * t * t - 0.11 * t ** 6;
      const back = 9.4 + 0.1 * t * t,
        forward = 9.94 + 0.16 * (1 - t * t);
      return [
        V(back, top - 0.041, z),
        V(back - 0.006, top - 0.012, z),
        V(back + 0.015, top + 0.005, z),
        V(forward - 0.04, top + 0.013, z),
        V(forward, top - 0.005, z),
        V(forward, top - 0.046, z),
      ];
    }),
  );
}

function crewChair() {
  return mergeGeos([
    softBox(0.48, 0.23, 0.49, 0.045).translate(0, 0.12, 0),
    softBox(0.53, 0.105, 0.51, 0.042).translate(0.032, 0.277, 0),
    softBox(0.12, 0.54, 0.48, 0.05).rotateZ(0.1).translate(-0.211, 0.545, 0),
    softBox(0.15, 0.17, 0.3, 0.055).translate(-0.24, 0.865, 0),
  ]);
}

export function addFlightDeck(cat: Catalogue) {
  cat.part(
    () =>
      loft(
        [8.5, 8.8, 9.2, 9.6, 10.02].map((x) => {
          const w = Math.min(1.08, FUSE.onSkin(x, -0.79, 1, 0.95).z);
          return [V(x, -0.79, -w), V(x, -0.79, w), V(x, -0.74, w), V(x, -0.74, -w)];
        }),
      ),
    ["avionics"],
    { id: "flight-deck.floor", color: "#545b60", name: "Cockpit floor" },
  );
  // Fitted kick panels close the footwells below the instrument panel. They follow the
  // taper of the pressure shell at the forward edge and leave each pilot's pedals free.
  cat.part(
    () =>
      loft(
        [-0.74, -0.55, -0.28, -0.12, 0.09].map((y) => {
          const x = 9.945 - Math.max(0, y + 0.48) * 0.19;
          const width = Math.min(FUSE.onSkin(x, y, 1, 0.975).z, 1.018 + Math.max(0, -y));
          return [V(x, y, -width), V(x, y, width), V(x + 0.042, y, width), V(x + 0.042, y, -width)];
        }),
      ),
    ["avionics"],
    { id: "flight-deck.footwell-closeout", color: "#252a30", name: "Footwell lining" },
  );
  cat.part(
    () =>
      loft(
        [
          [9.57, -0.438, 0.205],
          [9.6, -0.275, 0.206],
          [9.665, -0.105, 0.2],
          [9.717, -0.074, 0.197],
        ].map(([x, y, z]) => [V(x - 0.09, y, -z), V(x - 0.09, y, z), V(9.91, y, z + 0.025), V(9.91, y, -z - 0.025)]),
      ),
    ["avionics"],
    { id: "flight-deck.lower-instrument-support", color: panel },
  );
  cat.part(mainPanel, ["avionics"], {
    id: "flight-deck.instrument-panel",
    pos: [9.732, 0, 0],
    rot: panelRotation(0.11),
    color: panel,
    name: "EASy IV instrument panel",
    note: "Two outboard primary display units flank a vertically stacked pair of shared multifunction displays. The drawing on each display is an illustrative still.",
    pin: true,
  });
  cat.part(coaming, ["avionics"], { id: "flight-deck.glareshield", color: "#343942", name: "Glareshield" });
  cat.part(() => box(0.08, 0.086, guidanceWidth), ["avionics"], {
    id: "flight-deck.guidance-panel",
    pos: [9.534, 0.316, 0],
    color: "#56616a",
    solidMaterial: guidanceFinish,
    name: "Flight guidance panel",
    note: "The flight guidance controls occupy the center of the glareshield above the primary and multifunction displays.",
    pin: true,
  });
  cat.part(
    () => mergeGeos(selectors.map((z) => cyl(0.017, 0.03, "x", 24).translate(9.48, 0.298, z - 0.036))),
    ["avionics"],
    { id: "flight-deck.guidance-selectors", color: "#1d252c" },
  );
  cat.part(
    () => mergeGeos(selectors.map((z) => box(0.009, 0.011, 0.023).translate(9.489, 0.308, z + 0.039))),
    ["avionics"],
    { id: "flight-deck.mode-keys", color: "#242e34" },
  );

  for (const [label, color, positions, y] of [
    ["caution", "#ffb92d", [-0.591, 0.591], 0.321],
    ["warning", "#b25444", [-0.648, 0.648], 0.321],
    ["engaged", "#71c98e", [-0.137, 0.039, 0.215], 0.313],
  ] as const) {
    cat.part(() => mergeGeos(positions.map((z) => box(0.012, 0.007, 0.019).translate(9.488, y, z))), ["avionics"], {
      id: "flight-deck.guidance-annunciators",
      instance: label,
      color,
    });
  }

  for (const unit of UNITS) {
    const [x, y, z] = unit.pos,
      [w, h] = unit.size;
    cat.part(() => softBox(w + 0.034, h + 0.033, 0.032, 0.008), ["avionics"], {
      id: "flight-deck.display-bezel",
      instance: unit.key,
      pos: [x + 0.019 * Math.cos(unit.pitch), y - 0.019 * Math.sin(unit.pitch), z],
      rot: panelRotation(unit.pitch),
      color: rim,
      name: unit.key.includes("efb")
        ? "Electronic flight bag bezel"
        : unit.key === "standby"
          ? "Standby display bezel"
          : "Display bezel",
    });
  }
  // The wider lower display rises out of the pedestal, leaving continuous footwells at each side.
  cat.part(
    () =>
      loft(
        [
          [9.57, -0.41, 0.205],
          [9.43, -0.438, 0.208],
          [9.2, -0.432, 0.208],
          [8.86, -0.427, 0.192],
          [8.44, -0.431, 0.176],
        ].map(([x, top, z]) => [V(x, top, -z), V(x, top, z), V(x, -0.755, z - 0.038), V(x, -0.755, -z + 0.038)]),
      ),
    ["avionics"],
    {
      id: "flight-deck.pedestal",
      color: "#596169",
      name: "Center pedestal",
      note: "The pedestal carries two thrust levers and paired keyboards and cursor controls.",
      pin: true,
    },
  );
  cat.part(() => softBox(0.77, 0.022, 0.347, 0.009), ["avionics"], {
    id: "flight-deck.pedestal-top",
    pos: [8.955, -0.412, 0],
    color: "#232a31",
  });
  cat.part(() => softBox(0.269, 0.07, 0.151, 0.014), ["avionics"], {
    id: "flight-deck.throttle-base",
    pos: [9.105, -0.375, 0],
    color: "#424a50",
  });
  for (const [side, sign] of [
    ["left", -1],
    ["right", 1],
  ] as const) {
    cat.part(
      () =>
        loft(
          [
            [8.55, -0.22],
            [8.9, -0.16],
            [9.28, -0.19],
            [9.55, -0.078],
            [9.95, 0.12],
          ].map(([x, top]) => {
            const bottom = -0.73,
              innerTop = FUSE.onSkin(x, top, 1, 0.91).z,
              innerBottom = FUSE.onSkin(x, bottom, 1, 0.91).z;
            return [
              V(x, top, sign * innerTop),
              V(x, top, sign * (innerTop + 0.042)),
              V(x, bottom, sign * (innerBottom + 0.042)),
              V(x, bottom, sign * innerBottom),
            ];
          }),
        ),
      ["avionics"],
      { id: "flight-deck.footwell-side", instance: side, color: "#393e43" },
    );
    cat.part(crewChair, ["avionics"], {
      id: "flight-deck.crew-seat",
      instance: side,
      pos: [8.64, -0.72, sign * 0.54],
      color: "#979996",
      name: "Pilot seat",
    });
    cat.part(
      () =>
        mergeGeos([
          softBox(0.49, 0.21, 0.227, 0.042).translate(0, -0.095, 0),
          softBox(0.139, 0.039, 0.127, 0.013).translate(0.078, 0.021, 0),
          softBox(0.109, 0.039, 0.103, 0.013).translate(0.078, 0.049, 0),
        ]),
      ["avionics"],
      { id: "flight-deck.side-console", instance: side, pos: [8.81, -0.148, sign * 0.958], color: panel },
    );
    cat.part(
      () =>
        mergeGeos([
          tubeGeo(
            [
              [-0.08, 0, 0],
              [-0.022, 0.074, -sign * 0.013],
              [-0.033, 0.155, -sign * 0.026],
            ],
            0.025,
          ),
          softBox(0.065, 0.088, 0.066, 0.023)
            .rotateZ(-0.25)
            .translate(-0.029, 0.163, -sign * 0.024),
        ]),
      ["avionics"],
      {
        id: "flight-deck.sidestick",
        instance: side,
        pos: [8.944, -0.085, sign * 0.958],
        color: "#272c31",
        name: "Smart sidestick",
        note: "Each pilot commands the digital flight control system through an outboard sidestick.",
      },
    );
    cat.part(
      () =>
        mergeGeos([
          box(0.026, 0.107, 0.025).rotateZ(-0.25),
          softBox(0.104, 0.05, 0.048, 0.011).translate(0.009, 0.062, 0),
        ]),
      ["avionics"],
      {
        id: "flight-deck.thrust-lever",
        instance: side,
        pos: [9.1, -0.289, sign * 0.033],
        color: "#c4c5bd",
        name: "Thrust levers",
        note: "Two levers sit at the center of the pedestal, one for each PW812D.",
        pin: true,
      },
    );
    cat.part(() => softBox(0.176, 0.019, 0.128, 0.008), ["avionics"], {
      id: "flight-deck.keyboard",
      instance: side,
      pos: [8.898, -0.393, sign * 0.096],
      color: "#454c53",
      name: "Multifunction keyboard",
    });
    cat.part(
      () =>
        mergeGeos(
          Array.from({ length: 28 }, (_, i) =>
            box(0.015, 0.004, 0.014).translate((i % 4) * 0.0205 - 0.032, 0, Math.floor(i / 4) * 0.0156 - 0.047),
          ),
        ),
      ["avionics"],
      { id: "flight-deck.keyboard-keys", instance: side, pos: [8.898, -0.381, sign * 0.097], color: "#1c2228" },
    );
    cat.part(
      () =>
        mergeGeos([
          softBox(0.134, 0.048, 0.096, 0.023),
          new THREE.SphereGeometry(0.034, 20, 14).scale(1, 0.67, 1).translate(0.042, 0.022, 0),
          softBox(0.078, 0.052, 0.083, 0.021).translate(-0.037, 0.028, 0),
        ]),
      ["avionics"],
      {
        id: "flight-deck.cursor-controller",
        instance: side,
        pos: [8.718, -0.38, sign * 0.114],
        color: "#555c62",
        name: "Cursor control device",
        note: "Each pilot has a pedestal-mounted trackball to control the EASy display cursor.",
        pin: true,
      },
    );
    cat.part(
      () =>
        mergeGeos(
          [-0.08, 0.08].flatMap((z) => [
            box(0.033, 0.184, 0.025).rotateZ(0.22).translate(0.055, 0.092, z),
            softBox(0.058, 0.061, 0.105, 0.009).rotateZ(-0.25).translate(0, 0, z),
            ...[-0.016, 0, 0.016].map((y) => box(0.007, 0.004, 0.094).translate(-0.03, y, z)),
          ]),
        ),
      ["avionics"],
      {
        id: "flight-deck.pedals",
        instance: side,
        pos: [9.68, -0.59, sign * 0.5],
        color: "#5e6365",
        name: "Rudder pedals",
      },
    );
  }

  cat.part(() => softBox(0.77, 0.052, 0.47, 0.025), ["avionics"], {
    id: "flight-deck.overhead-panel",
    pos: [8.97, 1.13, 0],
    color: panel,
    name: "Overhead control panel",
  });
  cat.part(
    () =>
      mergeGeos(
        Array.from({ length: 28 }, (_, i) =>
          box(0.034, 0.013, 0.041).translate(8.73 + (i % 7) * 0.08, 1.098, -0.145 + Math.floor(i / 7) * 0.095),
        ),
      ),
    ["avionics"],
    { id: "flight-deck.overhead-switches", color: rim },
  );
  cat.part(
    () =>
      mergeGeos([
        box(0.125, 0.109, 0.107),
        tubeGeo(
          [
            [0, 0, 0],
            [-0.062, -0.09, 0],
            [-0.101, -0.16, 0],
          ],
          0.019,
        ),
      ]),
    ["avionics"],
    { id: "flight-deck.hud-mount", pos: [9.39, 1.049, -0.42], color: rim, name: "HUD mount" },
  );
  cat.part(
    () => {
      const s = new THREE.Shape();
      s.moveTo(-0.137, -0.088);
      s.quadraticCurveTo(-0.151, -0.082, -0.148, -0.048);
      s.lineTo(-0.135, 0.075);
      s.quadraticCurveTo(-0.129, 0.107, -0.106, 0.108);
      s.lineTo(0.109, 0.108);
      s.quadraticCurveTo(0.139, 0.107, 0.146, 0.065);
      s.lineTo(0.149, -0.058);
      s.quadraticCurveTo(0.151, -0.092, 0.116, -0.092);
      s.closePath();
      return face(s, 0.005);
    },
    ["avionics"],
    {
      id: "flight-deck.hud",
      pos: [9.29, 0.778, -0.475],
      rot: panelRotation(-0.19),
      plate: true,
      name: "FalconEye head-up display",
      note: "The crew sees combined enhanced and synthetic vision through the combiner. This model shows the pilot-side installation.",
    },
  );
}
