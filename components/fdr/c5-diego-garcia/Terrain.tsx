"use client";
/**
 * Diego Garcia under the replay: Google's photorealistic 3D tiles. The track is east and north of the runway 31 end
 * (`TRACK` in fdr/c5-diego-garcia/model.ts), so the tiles are set in that frame. The tiles' heights are above the WGS84
 * ellipsoid, so the frame's origin sits at the runway 31 end on the EGM96 geoid: its zero is sea level, as the
 * replay's altitude is.
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import {
  GLTFExtensionsPlugin,
  GoogleCloudAuthPlugin,
  TileCompressionPlugin,
  TilesFadePlugin,
} from "3d-tiles-renderer/plugins";
import { TilesPlugin, TilesRenderer } from "3d-tiles-renderer/r3f";
import { WGS84_ELLIPSOID, type TilesRenderer as Tiles } from "3d-tiles-renderer/three";
import { spec, TILES_KEY, useTerrain } from "./store";

const D2R = Math.PI / 180;
const draco = new DRACOLoader().setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");

/** Earth-centred coordinates to the runway 31 end's east-north-up frame at sea level, on the world's axes (east x, up
 * y, south z). */
const ECEF_TO_LOCAL = (() => {
  const { lat, lon } = spec.airport.runway.end31;
  const enu = WGS84_ELLIPSOID.getEastNorthUpFrame(lat * D2R, lon * D2R, spec.airport.geoidM, new THREE.Matrix4());
  return new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1).multiply(enu.invert());
})();
/** Tile errors in a row before the island is given up on: sporadic misses recover on their own. */
const GIVE_UP = 16;

/** The data providers of the tiles in view, which Google requires shown with them. */
function credit(tiles: Tiles) {
  const out: string[] = [];
  for (const a of tiles.getAttributions()) if (a.type === "string" && a.value) out.push(String(a.value));
  return out.join("; ");
}

export function Terrain() {
  const errors = useRef(0);
  const tiles = useRef<Tiles>(null);
  useEffect(() => {
    useTerrain.setState({ state: "loading", credit: "" });
    return () => useTerrain.setState({ state: "loading", credit: "" });
  }, []);
  const recredit = () => {
    const c = tiles.current && credit(tiles.current);
    if (c != null && c !== useTerrain.getState().credit) useTerrain.setState({ credit: c });
  };
  return (
    <group matrixAutoUpdate={false} matrix={ECEF_TO_LOCAL}>
      <TilesRenderer
        ref={tiles}
        onTileVisibilityChange={recredit}
        onLoadModel={() => {
          errors.current = 0;
          if (useTerrain.getState().state !== "shown") useTerrain.setState({ state: "shown" });
        }}
        onLoadError={() => {
          if (++errors.current >= GIVE_UP && useTerrain.getState().state !== "shown")
            useTerrain.setState({ state: "failed" });
        }}
      >
        <TilesPlugin plugin={GoogleCloudAuthPlugin} args={[{ apiToken: TILES_KEY, autoRefreshToken: true }]} />
        <TilesPlugin plugin={GLTFExtensionsPlugin} dracoLoader={draco} />
        <TilesPlugin plugin={TileCompressionPlugin} />
        <TilesPlugin plugin={TilesFadePlugin} />
      </TilesRenderer>
    </group>
  );
}
