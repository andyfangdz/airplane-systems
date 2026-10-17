// vitest: isolate
import { afterEach, expect, test } from "vitest";
import {
  advance as advanceGovernor,
  anim,
  governorClock,
  s,
  useGov,
  useGovView,
} from "@/components/engine/governor/store";
import { advance as advanceBench, bench, benchClock, useSfView, useUi } from "@/components/engine/surefly/store";

const govInitial = { s: structuredClone(s), anim: { ...anim }, ui: useGov.getState(), view: useGovView.getState() };
const benchInitial = { bench: structuredClone(bench), ui: useUi.getState(), view: useSfView.getState() };
function reset() {
  Object.assign(s, structuredClone(govInitial.s));
  Object.assign(anim, govInitial.anim);
  useGov.setState(govInitial.ui, true);
  useGovView.setState(govInitial.view, true);
  governorClock.reset();
  Object.assign(bench, structuredClone(benchInitial.bench));
  useUi.setState(benchInitial.ui, true);
  useSfView.setState(benchInitial.view, true);
  benchClock.reset();
}
afterEach(reset);

test("governor and ignition bench integrate the same physical state at 5, 20 and 60 rendering fps", () => {
  const snapshots = [5, 20, 60].map((fps) => {
    reset();
    useGov.getState().setControls({ throttle: 0.7 });
    useUi.getState().set({ rpm: 1600 });
    for (let i = 0; i < fps; i++) {
      advanceGovernor(1 / fps);
      advanceBench(1 / fps);
    }
    return structuredClone({
      s,
      anim,
      bench,
      governorClock: governorClock.checkpoint(),
      benchClock: benchClock.checkpoint(),
    });
  });
  expect(snapshots[1]).toEqual(snapshots[0]);
  expect(snapshots[2]).toEqual(snapshots[0]);
});

test("pausing an accessory preserves its integration remainder and does not advance the other accessory", () => {
  reset();
  advanceGovernor(0.013);
  const checkpoint = governorClock.checkpoint();
  const benchBefore = structuredClone(bench);
  useGovView.getState().set({ paused: true });
  advanceGovernor(0.5);
  expect(governorClock.checkpoint()).toEqual(checkpoint);
  expect(bench).toEqual(benchBefore);
});
