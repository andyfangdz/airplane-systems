/**
 * Every airplane's light meta (aircraft/<id>/meta.ts: names, document, systems), in picker order, and the view paths
 * they make: one route per airplane (app/(fleet)/<id>/[[...sys]]), at /<id> and /<id>/<system>. Nothing here imports an
 * airplane's code; tests and scripts that want every full definition import aircraft/index.ts.
 */
import type { AircraftMeta } from "./types";
import { C172S_META } from "./c172s/meta";
import { C182T_META } from "./c182t/meta";
import { DA40_META } from "./da40/meta";
import { M20C_META } from "./m20c/meta";
import { SR20_META } from "./sr20/meta";
import { SR22T_META } from "./sr22t/meta";

export const FLEET_META: AircraftMeta[] = [SR20_META, SR22T_META, C172S_META, C182T_META, DA40_META, M20C_META];

/** An airplane route's paths: /<id> (its last-viewed system, else its overview) and /<id>/<system> for each system. */
export const viewPathsOf = (meta: AircraftMeta) => [`/${meta.id}`, ...meta.systems.map((s) => `/${meta.id}/${s.id}`)];

/** Every view path, after the root (which opens the last-viewed airplane): what the build prerenders. */
export const VIEW_PATHS = ["/", ...FLEET_META.flatMap(viewPathsOf)];
