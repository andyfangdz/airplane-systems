import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { IO390 } from "@/engines/io390/spec";
import { soundFrame, soundLayout } from "@/engines/io390/sound";
import { initialState } from "@/engines/model/engine";
import { beginStartCycle } from "@/engines/model/start-cycle";

const layout = soundLayout(IO390);
const sources = import.meta.glob<string>("../engines/io390/sound.worklet.js", {
  query: "?raw",
  import: "default",
  eager: true,
});

type Frame = ReturnType<typeof soundFrame>;
interface Processor {
  port: { onmessage: (message: { data: Frame | null }) => void };
  process(inputs: never[], outputs: Float32Array[][]): boolean;
}

/** Run the browser's processor at a known device sample rate and measure the PCM it actually emits. */
function listener(rate: number) {
  let processor!: Processor;
  runInNewContext(Object.values(sources)[0], {
    sampleRate: rate,
    Math,
    AudioWorkletProcessor: class {
      port = {};
    },
    registerProcessor: (_name: string, ctor: new (options: object) => Processor) => {
      processor = new ctor({ processorOptions: layout });
    },
  });
  return {
    send: (data: Frame | null) => processor.port.onmessage({ data }),
    render: () => {
      const pcm = new Float32Array(rate);
      for (let i = 0; i < rate; i += 128) processor.process([], [[pcm.subarray(i, i + 128)]]);
      return pcm;
    },
  };
}

function tone(pcm: Float32Array, hz: number) {
  let x = 0,
    y = 0;
  for (let i = 0; i < pcm.length; i++) {
    const phase = (2 * Math.PI * hz * i) / pcm.length;
    x += pcm[i] * Math.cos(phase);
    y += pcm[i] * Math.sin(phase);
  }
  return (2 * Math.hypot(x, y)) / pcm.length;
}

describe("IO-390-C3B6 sound experiment", () => {
  it("uses 1-3-2-4 cylinder work and the mixture model's firing probability (IOM Table A-1, p. 51)", () => {
    const s = initialState(IO390);
    s.rpm = 2000;
    s.cyl.forEach((c, i) => Object.assign(c, { hp: 10 + i, plugs: 2, lambda: 1 }));
    s.cyl[2].plugs = 0;
    s.cyl[1].lambda = 1.55; // halfway across the model's lean misfire range
    const pulses = soundFrame(IO390, s, layout.cylinders).pulses;
    expect(pulses[0].chance).toBe(1);
    expect(pulses[1]).toEqual({ chance: 0, strength: 0 });
    expect(pulses[2].chance).toBeCloseTo(0.5);
    expect(pulses[3].strength).toBeGreaterThan(pulses[0].strength);
  });

  it("sounds only charges that fired during the start, even if the key and mixture have since moved", () => {
    const s = initialState(IO390);
    s.rpm = 450;
    s.startCycle = beginStartCycle(IO390, 0);
    s.startCycle.cylinders[2].firedWork = 0.6;
    s.cyl.forEach((c) => Object.assign(c, { hp: 2, work: 0.3, plugs: 2, lambda: 1 }));
    Object.assign(s.cyl[2], { plugs: 0, lambda: Infinity });
    const pulses = soundFrame(IO390, s, layout.cylinders).pulses;
    expect(pulses.map((p) => p.chance)).toEqual([0, 1, 0, 0]);
    expect(pulses[1].strength).toBeGreaterThan(0);
  });

  it("leaves the missing beat in cylinder three's exhaust slot", () => {
    // A 2400 rpm engine completes a 720° cycle every 50 ms. Begin at #1 exhaust opening.
    const s = initialState(IO390);
    s.rpm = 2400;
    s.crank = layout.exhaustOpen;
    s.cyl.forEach((c) => Object.assign(c, { hp: 40, plugs: 2, lambda: 1 }));
    s.cyl[2].plugs = 0;
    const at48k = listener(48000);
    at48k.send(soundFrame(IO390, s, layout.cylinders));
    const pcm = at48k.render();
    // One exhaust event every 600 samples. Include the pressure wave's travel down the longer crossover.
    const peaks = Array.from({ length: 4 }, (_, slot) => {
      const start = 24000 + slot * 600;
      return pcm.slice(start, start + 300).reduce((peak, v) => Math.max(peak, Math.abs(v)), 0);
    });
    expect(peaks[1]).toBeLessThan(Math.min(peaks[0], peaks[2], peaks[3]) / 2);
  });

  it("makes the three propeller sweeps dominate the geared starter during cranking (SR20 POH 7-40, IOM Table A-1)", () => {
    const s = initialState(IO390);
    s.rpm = 180;
    const render = (starter: boolean) => {
      s.starterEngaged = starter;
      const out = listener(48000);
      out.send(soundFrame(IO390, s, layout.cylinders));
      return out.render();
    };
    const withMotor = render(true);
    const propTurning = render(false);
    const motor = withMotor.map((v, i) => v - propTurning[i]);
    const rms = (pcm: Float32Array) => Math.sqrt(pcm.reduce((sum, v) => sum + v * v, 0) / pcm.length);
    const gearHz = (s.rpm * IO390.accessories.starterRatio) / 60;
    expect(rms(propTurning)).toBeGreaterThan(4 * rms(motor));
    expect(tone(motor, gearHz)).toBeGreaterThan(0.001);
    expect(tone(motor, 8 * gearHz)).toBeLessThan(0.0002);
    // The air bursts repeat nine times in one second, including on coast-down after starter release.
    const envelope = propTurning.map(Math.abs);
    expect(tone(envelope, 9)).toBeGreaterThan(4 * tone(envelope, 6));
  });

  it.each([44100, 48000])(
    "renders two exhaust beats and three blade passes per revolution at %i Hz (POH 7-40)",
    (rate) => {
      const listenerAtRate = listener(rate);
      const s = initialState(IO390);
      const stopped = soundFrame(IO390, s, layout.cylinders);
      listenerAtRate.send(stopped);
      expect(listenerAtRate.render().every((v) => v === 0)).toBe(true);
      s.rpm = 2400;
      s.pct = 75;
      s.cyl.forEach((c) => Object.assign(c, { hp: 40, plugs: 2, lambda: 1 }));
      const firing = soundFrame(IO390, s, layout.cylinders);
      listenerAtRate.send(firing);
      listenerAtRate.render(); // let speed and pressure settle before measuring one whole second
      const pcm = listenerAtRate.render();
      expect(tone(pcm, 80)).toBeGreaterThan(0.045);
      expect(tone(pcm, 120)).toBeGreaterThan(0.045);
      expect(tone(pcm, 83)).toBeLessThan(0.015);
      expect(pcm.every((v) => Math.abs(v) < 1)).toBe(true);
      listenerAtRate.send(null);
      listenerAtRate.render();
      expect(listenerAtRate.render().every((v) => v === 0)).toBe(true);
    },
  );
});
