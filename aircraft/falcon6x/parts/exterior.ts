import * as THREE from "three";
import { afRing, cyl, loft, mergeGeos, tireGeo, tubeGeo } from "@/lib/geometry";
import {
  cockpitLiner,
  allOpenings,
  cabinOpening,
  cockpitOpening,
  skylightOpening,
  glassPane,
  windowFrame,
} from "../exterior-skin";
import { addEntry } from "./entry";
import { finishMat } from "@/lib/materials";
import { FUSE, GROUND_Y, WING } from "../geometry";
import type { Catalogue } from "@/lib/catalogue";

const cabinPaneMaterial = new THREE.MeshPhysicalMaterial({
  color: "#263f4c",
  roughness: 0.16,
  metalness: 0.17,
  clearcoat: 1,
  transparent: true,
  opacity: 0.58,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const cockpitPaneMaterial = cabinPaneMaterial.clone();
cockpitPaneMaterial.opacity = 0.48;
const cabinGlass = () => cabinPaneMaterial;
const cockpitGlass = () => cockpitPaneMaterial;
const sidewall = new THREE.MeshStandardMaterial({ color: "#48545a", roughness: 0.83, side: THREE.DoubleSide });
const linerMat = () => sidewall;

export function addExterior(cat: Catalogue) {
  // Two swept blade antennas are visible on the crown in the side photograph of F-WSIX.
  for (const [station, x, height, sweep] of [
    ["forward", 1.13, 0.3, 0.22],
    ["aft", -3.65, 0.22, 0.09],
  ] as const) {
    cat.part(
      () =>
        loft(
          [
            [-0.018, 0, 0.33, 0.062],
            [0.035, -0.02, 0.25, 0.035],
            [height, -sweep, 0.13, 0.025],
          ].map(([y, dx, chord, width]) =>
            afRing(0, 1, width / chord, 0, 8).map(([u, v]) => new THREE.Vector3(dx + (0.5 - u) * chord, y, v * chord)),
          ),
        ),
      ["airframe", "avionics"],
      {
        id: "exterior.dorsal-antenna",
        instance: station,
        name: "Dorsal blade antenna",
        pos: [x, FUSE.topY(x), 0],
        solidColor: "#CED4D5",
        ext: true,
      },
    );
  }

  for (const [side, sign] of [
    ["right", 1],
    ["left", -1],
  ] as const) {
    for (let window = 1; window <= 15; window++) {
      const opening = () => cabinOpening(window, sign);
      cat.part(() => glassPane(opening()), ["cabin", "airframe"], {
        id: "exterior.cabin-window",
        instance: [side, window],
        name: "Cabin windows",
        note: "Thirty windows run along the two sides of the cabin.",
        pin: window === 7,
        color: "#405361",
        solidMaterial: cabinGlass,
        ext: true,
      });
    }
    for (const pane of ["front", "side"] as const) {
      cat.part(() => glassPane(cockpitOpening(pane === "front", sign)), ["airframe", "avionics"], {
        id: "exterior.cockpit-glazing",
        instance: [side, pane],
        name: "Flight deck windshield",
        color: "#3F586D",
        solidMaterial: cockpitGlass,
        ext: true,
      });
    }
    cat.part(() => cockpitLiner(sign), ["avionics"], {
      id: "flight-deck.sidewall",
      instance: side,
      solidMaterial: linerMat,
      fairing: true,
    });
    // The radome joint and adjacent air-data probes are visible in the ground
    // photograph on p. 2 of the June 2026 Overview.
    cat.part(
      () =>
        tubeGeo(
          FUSE.ring(11.23, 1.003, 44, -Math.PI / 2, Math.PI / 2, false).map((p) => {
            p.z *= sign;
            return p;
          }),
          0.009,
        ),
      ["airframe"],
      {
        id: "exterior.radome-seam",
        instance: side,
        solidColor: "#7a8288",
        color: "#6b747d",
        ext: true,
      },
    );
    cat.part(
      () =>
        mergeGeos(
          [0.11, -0.19].map((y) => {
            const base = FUSE.onSkin(10.91, y, sign, 1);
            return tubeGeo(
              [
                base.clone().add(new THREE.Vector3(-0.02, 0, -sign * 0.02)),
                base.clone().add(new THREE.Vector3(0.045, 0.01, sign * 0.055)),
                base.clone().add(new THREE.Vector3(0.147, 0.01, sign * 0.07)),
              ],
              0.018,
            );
          }),
        ),
      ["airframe"],
      {
        id: "exterior.air-data-probes",
        instance: side,
        name: "Air data probes",
        solidMaterial: () => finishMat.polished,
        color: "#65737c",
        ext: true,
      },
    );
  }
  cat.part(() => glassPane(skylightOpening()), ["cabin"], {
    id: "exterior.skylight",
    name: "Entryway skylight",
    note: "A skylight admits daylight above the entrance.",
    color: "#405361",
    solidMaterial: cabinGlass,
    ext: true,
    pin: true,
  });
  cat.part(() => mergeGeos(allOpenings().map(windowFrame)), ["airframe", "cabin", "avionics"], {
    id: "exterior.glazing-seals",
    color: "#3c4147",
    solidColor: "#485158",
    ext: true,
  });

  addEntry(cat);

  // The rear-quarter photograph on p. 40 of the Overview shows the oval
  // metal exhaust lip just below the rudder. Its bore is recessed into the body.
  cat.part(
    () => {
      const section = FUSE.section(FUSE.xTail);
      const profile = [
        [0.027, 0.994],
        [-0.055, 0.99],
        [-0.15, 0.92],
        [-0.168, 0.85],
        [-0.164, 0.78],
        [-0.127, 0.764],
        [0.07, 0.72],
      ];
      return new THREE.LatheGeometry(
        profile.map(([dx, r]) => new THREE.Vector2(r, dx)),
        48,
      )
        .rotateZ(-Math.PI / 2)
        .scale(1, section.hh, section.hw)
        .translate(FUSE.xTail, section.cy, 0);
    },
    ["airframe"],
    {
      id: "exterior.tailcone-nozzle",
      name: "Tailcone exhaust",
      note: "The exhaust outlet sits at the aft end of the fuselage beneath the rudder.",
      solidMaterial: () => finishMat.polished,
      color: "#65717a",
      ext: true,
    },
  );
  cat.part(
    () => {
      const s = FUSE.section(FUSE.xTail);
      return new THREE.CircleGeometry(1, 48)
        .rotateY(-Math.PI / 2)
        .scale(1, 0.744 * s.hh, 0.744 * s.hw)
        .translate(FUSE.xTail + 0.06, s.cy, 0);
    },
    ["airframe"],
    { id: "exterior.tailcone-duct", name: "Tailcone exhaust", solidColor: "#22272c", color: "#354148", ext: true },
  );

  // Gear in the ramp position. Axles and door silhouettes follow the side and front
  // views in Facts & Figures, p. 3. Joint, rim and linkage profiles are illustrative.
  const up = new THREE.Vector3(0, 1, 0);
  function member(a: THREE.Vector3, b: THREE.Vector3, radius: number) {
    const axis = b.clone().sub(a);
    const mid = a.clone().lerp(b, 0.5);
    return cyl(radius, axis.length())
      .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, axis.normalize()))
      .translate(mid.x, mid.y, mid.z);
  }
  for (const [leg, x, z, r, w, spread] of [
    // Nominal tire diameter and section width from EASA.A.580, issue 04, p. 12.
    ["nose", 9.55, 0, 0.2032, 0.1524, 0.096],
    ["right-main", -1.96, 2.29, 0.4191, 0.2667, 0.215],
    ["left-main", -1.96, -2.29, 0.4191, 0.2667, 0.215],
  ] as const) {
    const nose = leg === "nose";
    const side = Math.sign(z);
    const centerY = GROUND_Y + r;
    const origin: [number, number, number] = [x, centerY, z];
    const axle = new THREE.Vector3();
    const knuckle = new THREE.Vector3(nose ? 0.06 : 0.39, nose ? 0.15 : 0.33, 0);
    // Anchor both main struts in the fixed wing ahead of the flap, following its local height.
    const wheelCenter = new THREE.Vector3(...origin);
    const mount = nose ? new THREE.Vector3(0.14, 1.34, 0) : WING.p(z - side * 0.11, 0.69).sub(wheelCenter);
    const gland = knuckle.clone().lerp(mount, nose ? 0.4 : 0.34);
    const outerRadius = nose ? 0.074 : 0.115;
    const name = nose ? "Nose landing gear" : "Main landing gear";
    cat.part(
      () => {
        const braceTop = nose
          ? mount.clone().add(new THREE.Vector3(-0.57, -0.02, 0))
          : WING.p(z - side * 0.73, 0.65).sub(wheelCenter);
        return mergeGeos([
          cyl(nose ? 0.048 : 0.086, spread * 2, "z"),
          member(axle, knuckle, nose ? 0.055 : 0.095),
          member(gland, mount, outerRadius),
          member(gland, gland.clone().lerp(mount, 0.15), outerRadius * 1.18),
          member(gland.clone().lerp(mount, 0.34), braceTop, outerRadius * 0.48),
          cyl(outerRadius * 1.09, outerRadius * 2.2, "z").translate(knuckle.x, knuckle.y, knuckle.z),
        ]);
      },
      ["airframe"],
      { id: "exterior.gear-leg", instance: leg, name, pos: origin, color: "#A6B0B6", ext: true },
    );
    cat.part(() => member(knuckle, gland, outerRadius * 0.68), ["airframe"], {
      id: "exterior.gear-piston",
      instance: leg,
      name: "Shock strut piston",
      pos: origin,
      color: "#DEE2E4",
      ext: true,
    });

    cat.part(
      () => {
        const upperPin = gland.clone().lerp(mount, 0.22);
        const elbow = upperPin.clone().lerp(knuckle, 0.56);
        elbow.x -= nose ? 0.14 : 0.22;
        const linkRadius = nose ? 0.022 : 0.035;
        return mergeGeos([
          member(upperPin, elbow, linkRadius),
          member(elbow, knuckle, linkRadius),
          cyl(linkRadius * 1.45, linkRadius * 3.8, "z", 16).translate(elbow.x, elbow.y, elbow.z),
        ]);
      },
      ["airframe"],
      {
        id: "exterior.gear-torque-link",
        instance: leg,
        name: "Torque links",
        pos: origin,
        color: "#667078",
        ext: true,
      },
    );

    // A narrow hinged edge, stiff center and turned lip give the open door its front-view profile.
    for (const direction of nose ? [-1, 1] : [side]) {
      cat.part(
        () => {
          const stations = nose
            ? [
                [1.23, 0.15, -0.27, 0.61],
                [0.88, 0.26, -0.23, 0.52],
              ]
            : [
                [WING.p(z + direction * 0.29, 0.68, -1).y - centerY + 0.015, 0.29, -0.12, 0.78],
                [0.5, 0.655, -0.48, 0.56],
                [0.21, 0.81, -0.59, 0.38],
                [0.31, 1.1, -0.48, 0.31],
              ];
          const rings = stations.map(([height, offset, aft, fore], i) => {
            const before = stations[Math.max(0, i - 1)];
            const after = stations[Math.min(stations.length - 1, i + 1)];
            const dy = after[0] - before[0];
            const dz = direction * (after[1] - before[1]);
            const halfThickness = 0.02 / Math.hypot(dy, dz);
            const ny = dz * halfThickness;
            const nz = -dy * halfThickness;
            const cross = direction * offset;
            return [
              new THREE.Vector3(aft, height - ny, cross - nz),
              new THREE.Vector3(fore, height - ny, cross - nz),
              new THREE.Vector3(fore, height + ny, cross + nz),
              new THREE.Vector3(aft, height + ny, cross + nz),
            ];
          });
          return loft(rings);
        },
        ["airframe"],
        {
          id: "exterior.gear-door",
          instance: [leg, direction < 0 ? "left" : "right"],
          pos: origin,
          name: nose ? "Nose gear door" : "Main gear door",
          color: "#ADBBC1",
          solidColor: "#DCE2E4",
          ext: true,
        },
      );
    }
    for (const [wheel, sign] of [
      ["left", -1],
      ["right", 1],
    ] as const) {
      const position: [number, number, number] = [x, centerY, z + sign * spread];
      cat.part(() => tireGeo(r, w), ["airframe"], {
        id: "exterior.tire",
        instance: [leg, wheel],
        pos: position,
        color: "#313B42",
        solidColor: "#23282C",
        ext: true,
        name: nose ? "Nose wheel" : "Main wheel",
        note: nose ? "EASA lists a 16 × 6.0 R6 nose tire." : "EASA lists an H33 × 10.5 R17 main tire.",
      });
      cat.part(
        () => {
          // Lathe a recessed wheel bowl and projecting bead; the hub cap sits proud of its bolt circle.
          const profile = [
            [0, -0.39],
            [0.47, -0.39],
            [0.49, 0.4],
            [0.47, 0.48],
            [0.41, 0.46],
            [0.37, 0.31],
            [0.18, 0.28],
            [0.15, 0.47],
            [0.09, 0.54],
            [0, 0.54],
          ];
          const rim = new THREE.LatheGeometry(
            profile.map(([radius, depth]) => new THREE.Vector2(radius * r, depth * w)),
            40,
          ).rotateX(Math.PI / 2);
          const bolts = Array.from({ length: 8 }, (_, i) => {
            const angle = (i * Math.PI) / 4;
            return cyl(r * 0.03, w * 0.055, "z", 6).translate(
              Math.cos(angle) * r * 0.29,
              Math.sin(angle) * r * 0.29,
              w * 0.32,
            );
          });
          const hub = mergeGeos([rim, ...bolts]);
          return sign === -1 ? hub.rotateY(Math.PI) : hub;
        },
        ["airframe"],
        {
          id: "exterior.wheel-hub",
          instance: [leg, wheel],
          pos: position,
          color: "#AAB0B2",
          ext: true,
        },
      );
    }
  }
}
