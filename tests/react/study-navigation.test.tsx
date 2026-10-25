import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { selectSys } from "@/lib/fleet";
import { ScenarioButton, showStudyExample, Slider, TryLink, useScenarioMarks } from "@/components/ui/controls";

vi.mock("@/lib/fleet", () => ({ selectSys: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

test("finding an experiment focuses its existing action without running its scenario", () => {
  const runScenario = vi.fn();
  function Page() {
    useScenarioMarks();
    return (
      <>
        <TryLink sys="electrical" mark="Alternator failure" title="Try the alternator failure">
          Watch the buses change.
        </TryLink>
        <ScenarioButton mark="Alternator failure" onClick={runScenario}>
          Load failure
        </ScenarioButton>
      </>
    );
  }
  render(<Page />);
  act(() => showStudyExample());
  const example = screen.getByRole("button", { name: /Try the alternator failure/ });
  expect(document.activeElement).toBe(example);
  expect(selectSys).toHaveBeenLastCalledWith("overview");
  expect(runScenario).not.toHaveBeenCalled();
  fireEvent.click(example);
  expect(selectSys).toHaveBeenLastCalledWith("electrical");
  expect(runScenario).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Load failure" }).getAttribute("aria-pressed")).toBe("true");
});

test("a range announces formatted units as its value changes", () => {
  const onChange = vi.fn();
  const props = {
    id: "battery-time",
    label: "Time on batteries",
    min: 0,
    max: 60,
    step: 1,
    onChange,
    fmt: (v: number) => `${v} minutes`,
  };
  const { rerender } = render(<Slider {...props} value={15} />);
  const slider = screen.getByRole("slider");
  expect(slider.getAttribute("aria-valuetext")).toBe("15 minutes");
  fireEvent.change(slider, { target: { value: "30" } });
  expect(onChange).toHaveBeenCalledWith(30);
  rerender(<Slider {...props} value={30} />);
  expect(slider.getAttribute("aria-valuetext")).toBe("30 minutes");
});
