import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test } from "vitest";
import { BusCard, PowerPath } from "@/aircraft/cirrus/panels";
import { initialSim as sr20Initial, solve as sr20Solve } from "@/aircraft/sr20/model";
import { initialSim as sr22tInitial, solve as sr22tSolve } from "@/aircraft/sr22t/model";
import { BreakerState, StudySection } from "@/components/ui/StudySection";
import { ScenarioButton, useScenarioMarks } from "@/components/ui/controls";

afterEach(cleanup);

for (const [name, initial] of [
  ["SR20", sr20Initial],
  ["SR22T", sr22tInitial],
] as const) {
  test(`${name}: Figure 7-10 explanation follows alternators, batteries and ESSENTIAL POWER`, () => {
    // Both models have the same power topology; each solver retains its own battery and field behavior.
    const s = structuredClone(initial);
    const solution = () =>
      name === "SR20" ? sr20Solve(s as typeof sr20Initial) : sr22tSolve(s as typeof sr22tInitial);
    const { rerender } = render(<PowerPath E={solution()} />);
    expect(screen.getByRole("status").textContent).toContain("ALT 1 supplies Main Dist Bus 1.");

    s.elec.fail.alt1 = true;
    rerender(<PowerPath E={solution()} />);
    expect(screen.getByRole("status").textContent).toContain("BAT 1 supplies Main Dist Bus 1 while ALT 1 is offline.");
    expect(screen.getByRole("status").textContent).toContain("ALT 2 supplies Main Dist Bus 2.");

    s.elec.fail.alt1 = false;
    s.elec.fail.alt2 = true;
    rerender(<PowerPath E={solution()} />);
    expect(screen.getByRole("status").textContent).toContain(
      "Main Dist Bus 1 feeds Main Dist Bus 2 through the diode.",
    );

    s.elec.fail.alt1 = s.elec.fail.bat1 = true;
    rerender(<PowerPath E={solution()} />);
    expect(screen.getByRole("status").textContent).toContain(
      "BAT 2 supplies ESS BUS 1 and feeds ESS BUS 2 through ESSENTIAL POWER.",
    );

    s.cb["ESSENTIAL POWER"] = true;
    rerender(<PowerPath E={solution()} />);
    expect(screen.getByRole("status").textContent).toContain("ESS BUS 2 is unpowered because ESSENTIAL POWER is open.");
    s.cb["BAT 2"] = true;
    rerender(<PowerPath E={solution()} />);
    expect(screen.getByRole("status").textContent).toContain("ESS BUS 1 is unpowered; ESS BUS 2 is unpowered.");
  });
}

function BreakerHarness({ voltage }: { voltage: number }) {
  const [s, set] = useState<{ cb: Record<string, boolean> }>({ cb: {} });
  return (
    <BusCard
      name="Essential"
      src="Battery"
      loads={[["PFD", 5]]}
      v={voltage}
      digits={1}
      cb={s.cb}
      up={(fn) =>
        set((previous) => {
          const next = structuredClone(previous);
          fn(next);
          return next;
        })
      }
    />
  );
}

test("a pulled breaker remains distinct from a closed breaker on an unpowered bus", () => {
  const { rerender } = render(<BreakerHarness voltage={0} />);
  let breaker = screen.getByRole("button", { name: /PFD/ });
  expect(breaker.textContent).toContain("Unpowered");
  expect(breaker.getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(breaker);
  expect(breaker.textContent).toContain("Pulled");
  expect(breaker.textContent).not.toContain("Unpowered");
  expect(breaker.getAttribute("aria-pressed")).toBe("true");
  rerender(<BreakerHarness voltage={28} />);
  breaker = screen.getByRole("button", { name: /PFD/ });
  expect(breaker.textContent).toContain("Pulled");
  fireEvent.click(breaker);
  expect(breaker.textContent).not.toMatch(/Pulled|Unpowered/);
});

test("non-pullable breakers identify a trip instead of a manual pull", () => {
  render(<BreakerState open powered trip />);
  expect(screen.getByText("Tripped")).toBeTruthy();
});

function ReadingHarness() {
  useScenarioMarks();
  return (
    <div className="panel">
      <ScenarioButton onClick={() => {}}>Normal cruise</ScenarioButton>
      <StudySection title="How power flows">
        <p>Original cited explanation.</p>
      </StudySection>
    </div>
  );
}

test("opening a reference disclosure preserves the loaded scenario and its content", () => {
  const { container } = render(<ReadingHarness />);
  const scenario = screen.getByRole("button", { name: "Normal cruise" });
  fireEvent.click(scenario);
  const details = container.querySelector("details")!;
  expect(details.open).toBe(false);
  fireEvent.click(screen.getByText("How power flows"));
  expect(details.open).toBe(true);
  expect(screen.getByText("Original cited explanation.")).toBeTruthy();
  expect(scenario.getAttribute("aria-pressed")).toBe("true");
});
