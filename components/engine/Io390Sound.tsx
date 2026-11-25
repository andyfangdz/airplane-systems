import { useEffect, useRef, useState } from "react";
import { Check } from "@/components/ui/controls";
import { soundFrame, soundLayout } from "@/engines/io390/sound";
import type { EngineSim } from "./store";

function listen(sim: EngineSim, onError: () => void) {
  const ctx = new AudioContext();
  const layout = soundLayout(sim.spec);
  let node: AudioWorkletNode | undefined;
  let closed = false;
  let active = false;
  let resets = -1;
  const update = () => {
    if (!node) return;
    if (document.hidden || sim.useUi.getState().view.paused) {
      if (active) node.port.postMessage(null);
      active = false;
      return;
    }
    node.port.postMessage({
      ...soundFrame(sim.spec, sim.s, layout.cylinders),
      reset: !active || resets !== sim.resets,
    });
    resets = sim.resets;
    active = true;
  };
  let elapsed = 0;
  const unsubscribeSteps = sim.subscribeSteps((dt) => {
    elapsed += dt;
    if (elapsed >= 1 / 30) {
      elapsed %= 1 / 30;
      update();
    }
  });
  const unsubscribeUi = sim.useUi.subscribe((ui, prev) => {
    if (ui.view.paused !== prev.view.paused) update();
  });
  document.addEventListener("visibilitychange", update);
  const close = () => {
    if (closed) return;
    closed = true;
    unsubscribeSteps();
    unsubscribeUi();
    document.removeEventListener("visibilitychange", update);
    node?.port.close();
    node?.disconnect();
    void ctx.close();
  };
  const fail = () => {
    if (!closed) {
      close();
      onError();
    }
  };
  const connect = async () => {
    // Request playback inside the input gesture, before the worklet fetch.
    await ctx.resume();
    if (closed) return;
    await ctx.audioWorklet.addModule(new URL("../../engines/io390/sound.worklet.js", import.meta.url));
    if (closed) return;
    node = new AudioWorkletNode(ctx, "io390-sound", {
      numberOfInputs: 0,
      outputChannelCount: [1],
      processorOptions: layout,
    });
    node.onprocessorerror = fail;
    update();
    node.connect(ctx.destination);
  };
  void connect().catch(fail);
  return close;
}

/** The listener belongs to this page and starts only when the user selects it. */
export function Io390Sound({ sim }: { sim: EngineSim }) {
  const stop = useRef<(() => void) | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => () => stop.current?.(), [sim]);

  const toggle = (on: boolean) => {
    setFailed(false);
    setEnabled(on);
    const fail = () => {
      stop.current = null;
      setFailed(true);
      setEnabled(false);
    };
    if (on) {
      try {
        stop.current = listen(sim, fail);
      } catch {
        fail();
      }
    } else {
      stop.current?.();
      stop.current = null;
    }
  };
  return (
    <div className="eng-sound">
      <Check
        id="engine-sound"
        label="Engine sound"
        checked={enabled}
        onChange={toggle}
        title="Hear the simulated exhaust, propeller and starter at actual engine speed"
      />
      {failed && <small role="status">Engine sound is unavailable in this browser session.</small>}
    </div>
  );
}
