/** Engines with a standalone simulation, in picker order. Each is an `EngineSpec`; `engines/model/` runs any of them. */
import { IO390 } from "./io390/spec";
import { O360 } from "./o360/spec";
import type { EngineSpec } from "./types";

export const ENGINES: EngineSpec[] = [IO390, O360];

export const ENGINE_IDS = ENGINES.map((e) => e.id);

export const engineById = (id: string) => ENGINES.find((e) => e.id === id);
