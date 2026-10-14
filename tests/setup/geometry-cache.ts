/**
 * Each shell and surface is built once per module graph: once per file for isolated files, once per worker for the
 * shared ones (vitest.config.mts). Later calls get a clone, which keeps the geometry's class, parameters, groups,
 * index and userData (by reference, so treat it as read-only); factoryOf still names the registered factory. No
 * imports, so a test's vi.mock still applies.
 */
import type * as THREE from "three";

(globalThis as { __geometrySource?: unknown }).__geometrySource = (geo: () => THREE.BufferGeometry) => {
  let built: THREE.BufferGeometry | undefined;
  return () => (built ??= geo()).clone();
};
