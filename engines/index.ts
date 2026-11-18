/** Engines with a standalone simulation, in picker order. Each is an `EngineSpec`; `engines/model/` runs any of them. */
import { IO360_C172S } from "./io360-l2a/spec";
import { IO360_DA40 } from "./io360-m1a/spec";
import { IO390 } from "./io390/spec";
import { O360 } from "./o360/spec";
import { TSIO550K } from "./tsio550k/spec";
import type { EngineSpec } from "./types";

export const ENGINES: EngineSpec[] = [IO390, O360, TSIO550K, IO360_C172S, IO360_DA40];

export const ENGINE_IDS = ENGINES.map((e) => e.id);

export const engineById = (id: string) => ENGINES.find((e) => e.id === id);
