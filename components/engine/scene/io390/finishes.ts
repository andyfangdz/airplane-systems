// The physical surface coordinates are local to the part. A rotating shaft carries its machining marks with it.
// Cast and machined parts mix extrusions, lofts and cylinders with incompatible UVs; hose UVs follow the tube.
import * as THREE from "three";
import { disposeMats, makeMats, XRAY_MATS } from "../kit";
import type { EngineLayout } from "../layout";

type Grain = "casting" | "machining" | "paper" | "braid" | "duct" | "exhaust";
const tau = 2 * Math.PI;
const size = 128;

// Periodic value noise at integer lattice frequencies. Mipmaps average the grain down to a smooth finish at a distance.
function noise(x: number, y: number, cells: number) {
  const ix = Math.floor(x * cells),
    iy = Math.floor(y * cells);
  const hash = (i: number, j: number) => {
    let h = Math.imul((i % cells) + 71, 374761393) + Math.imul((j % cells) + 13, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const smooth = (v: number) => v * v * (3 - 2 * v);
  const fx = smooth(x * cells - ix),
    fy = smooth(y * cells - iy);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), fx),
    THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), fx),
    fy,
  );
}

function makeTile(grain: Grain, repeats: [number, number], relief: number) {
  const data = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const u = (i + 0.5) / size,
        v = (j + 0.5) / size;
      const grit = noise(u, v, 64),
        mid = noise(u, v, 16),
        cloud = noise(u, v, 4);
      let height: number, tone: number;
      switch (grain) {
        case "casting":
          height = 0.52 * grit + 0.32 * mid + 0.16 * cloud;
          tone = 0.67 + 0.29 * height;
          break;
        case "machining":
          height = 0.66 * cloud + 0.34 * grit;
          // Closely spaced tool marks with slight drift along the cut.
          height = 0.46 * height + 0.54 * (0.5 + 0.5 * Math.cos(tau * (v * 28 + 0.45 * cloud)));
          tone = 0.77 + 0.21 * height;
          break;
        case "exhaust":
          height = 0.43 * grit + 0.35 * mid + 0.22 * cloud;
          tone = 0.53 + 0.29 * cloud + 0.14 * height;
          break;
        case "paper":
          height = 0.45 * grit + 0.32 * mid + 0.23 * noise(u, (v * 4) % 1, 8);
          tone = 0.7 + 0.26 * height;
          break;
        case "braid": {
          const a = (u + v) * 2,
            b = (u - v) * 2;
          const strand = (t: number) => 0.5 - 0.5 * Math.cos(tau * t);
          const over = ((Math.floor(a) + Math.floor(b)) & 1) === 0;
          height = 0.72 * strand(over ? a : b) + 0.22 * strand(over ? b : a) + 0.06 * grit;
          tone = 0.5 + 0.48 * height;
          break;
        }
        case "duct": {
          const rib = (1 + Math.cos(tau * (u - v))) / 2;
          height = 0.85 * rib ** 3 + 0.15 * mid;
          tone = 0.58 + 0.27 * rib + 0.11 * grit;
          break;
        }
      }
      const index = 4 * (j * size + i);
      data[index] = Math.round(255 * tone);
      data[index + 1] = Math.round(255 * (0.2 + 0.6 * (1 - height)));
      data[index + 2] = Math.round(255 * height);
      data[index + 3] = 255;
    }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.name = grain;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeats);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.userData.relief = relief;
  texture.needsUpdate = true;
  return texture;
}

// One packed linear sample supplies albedo variation, roughness and microrelief. Keep Three's standard
// lighting, environment reflections, live emissive colours and shadow chunks for every finish.
class FinishMaterial extends THREE.MeshStandardMaterial {
  private get tubeUv() {
    return this.map?.name === "braid" || this.map?.name === "duct";
  }
  override customProgramCacheKey() {
    if (!this.map) return "untextured";
    if (this.userData.turned) return "io390-turned";
    if (this.userData.header) return "io390-header";
    return this.tubeUv ? "io390-tube" : "io390-projected";
  }
  override onBeforeCompile(shader: THREE.WebGLProgramParametersWithUniforms) {
    if (!this.map) return;
    shader.uniforms.finishRelief = { value: this.map.userData.relief };
    let sample = "vec3 surface = texture2D(map, vMapUv).rgb;";
    if (!this.tubeUv) {
      const varyings = "varying vec3 vFinishPosition;\nvarying vec3 vFinishNormal;";
      shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\n" + varyings).replace(
        "#include <uv_vertex>",
        `#include <uv_vertex>
          vFinishPosition = position * mapTransform[0][0];
          vFinishNormal = normal;`,
      );
      shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\n" + varyings);
      sample = `vec3 weights = pow(abs(vFinishNormal), vec3(4.0));
        weights /= max(dot(weights, vec3(1.0)), 0.00001);
        vec3 surface = texture2D(map, vFinishPosition.zy).rgb * weights.x
          + texture2D(map, vFinishPosition.xz).rgb * weights.y
          + texture2D(map, vFinishPosition.xy).rgb * weights.z;`;
    }
    // The flange and flywheel share the crank's X axis. The same brushing tile reads as
    // circular lathe marks on their faces and axial highlights around their rims.
    if (this.userData.turned) {
      sample = `vec2 faceUv = vec2(atan(vFinishPosition.y, vFinishPosition.z) / 6.2831853,
          length(vFinishPosition.yz));
        vec3 surface = texture2D(map, faceUv).rgb;`;
    }
    const pigment = this.userData.header
      ? `
      // Raw tube U runs from the exhaust port to the collector. The oxide colour remains
      // on the pipe when cold; running EGT drives the separate emissive term.
      float station = vMapUv.x / ${this.map.repeat.x.toFixed(1)};
      float nearPort = 1.0 - smoothstep(0.03, 0.40, station + (surface.g - 0.5) * 0.09);
      vec3 oxide = mix(vec3(0.95, 0.73, 0.50), vec3(0.62, 0.55, 0.62), nearPort);
      diffuseColor.rgb *= mix(vec3(1.0), oxide, 1.0 - smoothstep(0.1, 0.75, station));`
      : "";
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <map_pars_fragment>", "#include <map_pars_fragment>\nuniform float finishRelief;")
      .replace("#include <map_fragment>", sample + "\ndiffuseColor.rgb *= surface.r;" + pigment)
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (surface.g - 0.5) * 0.42, 0.045, 1.0);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        // Surface-gradient bump mapping in metres, using the same filtered height as the albedo.
        vec3 rx = cross(dFdy(-vViewPosition), normal);
        vec3 ry = cross(normal, dFdx(-vViewPosition));
        float det = dot(dFdx(-vViewPosition), rx) * faceDirection;
        vec3 gradient = rx * dFdx(surface.b) + ry * dFdy(surface.b);
        normal = normalize(normal - sign(det) * finishRelief * gradient / max(abs(det), 1.e-12));`,
      );
  }
}

// The factory's printed plug-reach marking in AOPA's 2017 SR20 close-up.
function coverPlacard() {
  if (typeof document === "undefined") return;
  const plate = document.createElement("canvas");
  plate.width = 512;
  plate.height = 100;
  const ctx = plate.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#555a61";
  ctx.fillRect(0, 0, 512, 100);
  ctx.textAlign = "center";
  ctx.fillStyle = "#18191c";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText("CAUTION", 256, 28);
  ctx.font = "bold 20px sans-serif";
  ctx.fillText("USE PROPER REACH (THREAD LENGTH)", 256, 56);
  ctx.fillText("SPARK PLUGS IN THIS CYLINDER HEAD", 256, 82);
  const texture = new THREE.CanvasTexture(plate);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function makeSolidFinishes(layout: EngineLayout) {
  const mats = makeMats(
    layout,
    (color, extra = {}) => new FinishMaterial({ color, roughness: 0.55, metalness: 0.35, ...extra }),
  );
  const tiles = {
    casting: makeTile("casting", [20, 20], 0.0002),
    machining: makeTile("machining", [15, 15], 0.000035),
    exhaust: makeTile("exhaust", [14, 14], 0.0001),
    paper: makeTile("paper", [26, 26], 0.00016),
    braid: makeTile("braid", [26, 5], 0.00032),
    duct: makeTile("duct", [24, 1], 0.0018),
  };
  const finish = (
    material: THREE.MeshStandardMaterial,
    color: string,
    metalness: number,
    roughness: number,
    grain?: Grain,
  ) => {
    material.color.set(color);
    material.metalness = metalness;
    material.roughness = roughness;
    if (grain) material.map = tiles[grain];
    material.userData.receivesEngineShadow = true;
  };
  // Representative gray engine enamel over castings (MM-IO-390-C, 72-10 pp. 105–107).
  finish(mats.case, "#515c61", 0.12, 0.43, "casting");
  finish(mats.sump, "#555e60", 0.15, 0.5, "casting");
  finish(mats.acc, "#687071", 0.2, 0.46, "casting");
  finish(mats.barrel, "#33393a", 0.58, 0.54, "machining");
  finish(mats.head, "#898c89", 0.52, 0.51, "casting");
  finish(mats.cover, layout.parallelValve ? "#909699" : "#555a61", 0.19, 0.29);
  finish(mats.shroud, "#a1a8a7", 0.82, 0.3, "machining");
  finish(mats.steel, "#bbc1c1", 0.91, 0.24, "machining");
  finish(mats.darkSteel, "#5a6163", 0.83, 0.39, "machining");
  finish(mats.piston, "#b6b9b5", 0.84, 0.29, "machining");
  finish(mats.ring, "#515559", 0.83, 0.36, "machining");
  finish(mats.bearing, "#b59156", 0.78, 0.32, "machining");
  finish(mats.gear, "#80827e", 0.86, 0.37, "machining");
  finish(mats.spring, "#41464c", 0.83, 0.27);
  finish(mats.valveI, "#979d9c", 0.86, 0.28, "machining");
  finish(mats.valveE, "#736e66", 0.8, 0.36, "machining");
  finish(mats.mag, "#353839", 0.13, 0.37, "casting");
  finish(mats.magCap, "#b88421", 0.07, 0.35);
  finish(mats.lead, "#b9b5aa", 0.66, 0.41, "braid");
  finish(mats.plug, "#dbd7c8", 0.03, 0.25);
  finish(mats.black, "#2a2c2c", 0.03, 0.67);
  finish(mats.alt, "#919693", 0.73, 0.47, "casting");
  finish(mats.belt, "#2b2b29", 0.01, 0.87);
  finish(mats.filter, "#d9d8cc", 0.07, 0.31);
  finish(mats.paper, "#c4a16e", 0, 0.91, "paper");
  finish(mats.duct, "#955035", 0.025, 0.64, "duct");
  finish(mats.oilHose, "#3a3b38", 0.09, 0.7, "braid");
  finish(mats.copper, "#aa5936", 0.76, 0.32, "machining");
  finish(mats.exhaust, "#91877b", 0.78, 0.45, "exhaust");
  finish(mats.intake, "#9b9e97", 0.76, 0.33, "machining");
  finish(mats.fuel, "#a9a9a0", 0.79, 0.34, "machining");
  mats.fuel.emissive.set(0); // The solid delivery tubes are opaque to the fuel-flow indication.
  finish(mats.fuelBody, "#898b82", 0.67, 0.51, "casting");
  finish(mats.prop, "#383c3e", 0.08, 0.4);
  finish(mats.spinner, "#c0c3c4", 0.97, 0.16, "machining");
  mats.nozzle = mats.bearing;
  mats.plugShield = mats.steel;
  mats.fuelHose = mats.oilHose;
  mats.baffleSeal = mats.black.clone();
  finish(mats.baffleSeal, layout.parallelValve ? "#393c3c" : "#a74836", 0.015, 0.78);
  mats.baffleSheet = mats.shroud.clone();
  finish(mats.baffleSheet, "#b7ad94", 0.54, 0.44, "machining");
  mats.baffleSheet.transparent = false;
  if (!layout.parallelValve) {
    mats.inletSheet = mats.baffleSheet.clone();
    finish(mats.inletSheet, "#363b3e", 0.28, 0.44, "machining");
  }
  mats.coverMark = new THREE.MeshStandardMaterial({ color: mats.cover.color, roughness: 0.36, metalness: 0.17 });
  const label = layout.parallelValve ? undefined : coverPlacard();
  if (label) {
    mats.coverMark.color.set(0xffffff);
    mats.coverMark.map = label;
  }
  mats.pushrodTube = mats.cover;
  mats.propFlange = mats.steel.clone();
  mats.propFlange.userData.turned = true;
  mats.ringSupport = mats.propFlange.clone();
  mats.ringSupport.color.set("#a2a7a5");
  mats.ringSupport.roughness = 0.34;
  mats.ringSupport.userData.castsEngineShadow = true;
  for (const k of XRAY_MATS) mats[k].transparent = false;
  // Only the larger assemblies cast. The small fasteners still receive contact shadows.
  for (const m of [
    mats.case,
    mats.sump,
    mats.acc,
    mats.head,
    mats.barrel,
    mats.cover,
    mats.alt,
    mats.intake,
    mats.exhaust,
    mats.mag,
    mats.filter,
    mats.duct,
    mats.prop,
    mats.fuelBody,
  ])
    m.userData.castsEngineShadow = true;
  return {
    mats,
    dispose() {
      mats.coverMark.map?.dispose();
      disposeMats(mats);
      Object.values(tiles).forEach((t) => t.dispose());
    },
  };
}
