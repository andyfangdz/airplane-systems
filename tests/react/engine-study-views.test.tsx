import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { StudyViews, MotionState } from "@/components/engine/StudyViews";
import { createEngineSimulation } from "@/components/engine/store";
import { IO390 } from "@/engines/io390/spec";
import { TSIO550K } from "@/engines/tsio550k/spec";

afterEach(cleanup);

test.each([IO390, TSIO550K])("study presets change visibility without changing $id engine conditions", (spec) => {
  const sim = createEngineSimulation(spec);
  sim.useUi.getState().setControls({ throttle: 0.7 });
  const before = sim.checkpoint();
  render(<StudyViews sim={sim} />);
  const select = screen.getByRole("combobox", { name: "Study view" });
  act(() => fireEvent.change(select, { target: { value: "fuel" } }));
  const { view, controls, env, failures } = sim.useUi.getState();
  expect(view.prop).toBe(false);
  expect(view.xray).toBe(true);
  expect(view.hidden).toContain("ignition");
  expect(view.hidden).not.toContain("fuel");
  expect(view.hidden).not.toContain("turbo");
  expect(controls).toEqual(before.ui.controls);
  expect(env).toEqual(before.ui.env);
  expect(failures).toEqual(before.ui.failures);
  expect(sim.s).toEqual(before.s);
  expect(sim.clock.checkpoint()).toEqual(before.clock);

  act(() => sim.useUi.getState().setView({ prop: true }));
  expect((select as HTMLSelectElement).value).toBe("custom");
  act(() => fireEvent.change(select, { target: { value: "installed" } }));
  expect(sim.useUi.getState().view.hidden).toEqual([]);
  expect(sim.useUi.getState().view.prop).toBe(true);
  sim.dispose();
});

test("time caption distinguishes slowed motion, accelerated temperature and pause", () => {
  const sim = createEngineSimulation(IO390);
  render(<MotionState sim={sim} />);
  expect(screen.queryByRole("status")).toBeNull();
  act(() => sim.useUi.getState().setView({ slow: true, thermal: 10 }));
  expect(screen.getByRole("status").textContent).toBe(
    "Motion slowed; instruments in real time; temperatures 10× faster",
  );
  act(() => sim.useUi.getState().setView({ paused: true }));
  expect(screen.getByRole("status").textContent).toBe("Simulation paused");
  sim.dispose();
});
