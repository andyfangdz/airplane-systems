/** Runs a "Start from" setup off the page's thread: settling an engine to cruise takes thousands of model steps. */
import { engineById } from "@/engines";
import type { Failures } from "@/engines/model/engine";
import { SCENARIOS } from "@/engines/model/scenarios";

self.onmessage = ({ data }: MessageEvent<{ seq: number; engine: string; scenario: string; failures: Failures }>) => {
  try {
    const spec = engineById(data.engine),
      sc = SCENARIOS.find((x) => x.id === data.scenario);
    if (!spec || !sc) throw new Error(`Unknown engine or scenario: ${data.engine} ${data.scenario}`);
    postMessage({ seq: data.seq, setup: sc.run(spec, data.failures) });
  } catch (error) {
    postMessage({ seq: data.seq, error: String(error) });
  }
};
