/**
 * Scenario marks (components/ui/controls.tsx): a ScenarioButton shows pressed while its scenario is the one loaded,
 * until the user changes something in the panel, by pointer or keyboard; reading the panel keeps it.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test } from "vitest";
import { HoldButton, ScenarioButton, useScenarioMarks } from "@/components/ui/controls";

afterEach(cleanup);

function Page() {
  useScenarioMarks();
  const [open, setOpen] = useState(false);
  return (
    <div className="panel">
      <ScenarioButton onClick={() => {}}>Cruise</ScenarioButton>
      <HoldButton className="btn" onDown={() => {}}>
        Hold to START
      </HoldButton>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        Show the parts
      </button>
    </div>
  );
}

const loaded = () => screen.getByRole("button", { name: "Cruise" }).getAttribute("aria-pressed");

test("reading the panel keeps the scenario pressed; a keyboard press of a hold button clears it", () => {
  render(<Page />);
  expect(loaded()).toBe("false");
  act(() => fireEvent.click(screen.getByRole("button", { name: "Cruise" })));
  expect(loaded()).toBe("true");

  // a disclosure and a key that presses nothing change nothing
  act(() => fireEvent.click(screen.getByRole("button", { name: "Show the parts" })));
  const hold = screen.getByRole("button", { name: "Hold to START" });
  act(() => fireEvent.keyDown(hold, { key: "Tab" }));
  expect(loaded()).toBe("true");

  // HoldButton takes Space from the keyboard without a click
  act(() => {
    fireEvent.keyDown(hold, { key: " " });
    fireEvent.keyUp(hold, { key: " " });
  });
  expect(loaded()).toBe("false");
});

test("a pointer press of a hold button clears the scenario", () => {
  render(<Page />);
  act(() => fireEvent.click(screen.getByRole("button", { name: "Cruise" })));
  expect(loaded()).toBe("true");
  act(() => fireEvent.click(screen.getByRole("button", { name: "Hold to START" })));
  expect(loaded()).toBe("false");
});
