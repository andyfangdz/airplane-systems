import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { PartInspectionProvider, PartInspector, usePartInspectionStore } from "@/components/engine/PartInspector";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function RegisteredParts({ model }: { model: string }) {
  const store = usePartInspectionStore();
  useLayoutEffect(() => {
    const removePump = store.getState().register({
      id: "pump",
      name: `${model} pump`,
      note: "Supplies lubrication. Existing manual note.",
      available: () => true,
    });
    const removeValve = store.getState().register({
      id: "valve",
      name: `${model} valve`,
      note: "Controls the flow.",
      available: () => true,
    });
    return () => {
      removePump();
      removeValve();
    };
  }, [model, store]);
  return null;
}

function Page({ model }: { model: string }) {
  return (
    <PartInspectionProvider key={model}>
      <RegisteredParts model={model} />
      <PartInspector />
    </PartInspectionProvider>
  );
}

test("search and native buttons expose a persistent explanation that can be dismissed", () => {
  render(<Page model="Engine" />);
  fireEvent.click(screen.getByText("Inspect a part"));
  fireEvent.change(screen.getByRole("searchbox", { name: "Find a part" }), { target: { value: "lubrication" } });
  const list = screen.getByRole("list", { name: "Parts in this view" });
  expect(within(list).getAllByRole("button")).toHaveLength(1);
  const pump = within(list).getByRole("button", { name: "Engine pump" });
  pump.focus();
  expect(document.activeElement).toBe(pump);
  act(() => fireEvent.click(pump));
  expect(pump.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("heading", { name: "Engine pump" })).toBeDefined();
  expect(screen.getByText("Supplies lubrication. Existing manual note.")).toBeDefined();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "valve" } });
  expect(screen.getByRole("heading", { name: "Engine pump" })).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Clear selected part" }));
  expect(screen.queryByRole("heading", { name: "Engine pump" })).toBeNull();
});

test("switching model clears selection and the previous search", () => {
  const page = render(<Page model="First" />);
  fireEvent.click(screen.getByText("Inspect a part"));
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "pump" } });
  fireEvent.click(screen.getByRole("button", { name: "First pump" }));
  page.rerender(<Page model="Second" />);
  expect(screen.queryByRole("heading", { name: "First pump" })).toBeNull();
  fireEvent.click(screen.getByText("Inspect a part"));
  expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("");
  expect(screen.getByRole("button", { name: "Second pump" })).toBeDefined();
});

function PickFromScene() {
  const store = usePartInspectionStore();
  return <button onClick={() => store.getState().select("Engine pump", true)}>Pick the pump in the scene</button>;
}

function RevealPage({ sticky, monitor }: { sticky: boolean; monitor: boolean }) {
  return (
    <PartInspectionProvider>
      <RegisteredParts model="Engine" />
      <div className="eng-app">
        <div className="eng-stage" style={{ position: sticky ? "sticky" : "relative", top: sticky ? 47 : "auto" }}>
          <PickFromScene />
        </div>
        {monitor && (
          <div className="eng-foot" style={{ position: sticky ? "sticky" : "relative", top: sticky ? 347 : "auto" }} />
        )}
        <div className="panel" style={{ overflowY: "visible" }}>
          <PartInspector />
        </div>
      </div>
    </PartInspectionProvider>
  );
}

test.each([
  { name: "portrait stage and instrument strip", sticky: true, monitor: true, inset: 467 },
  { name: "portrait stage without an instrument strip", sticky: true, monitor: false, inset: 347 },
  { name: "landscape with scrolling stage and instruments", sticky: false, monitor: true, inset: 0 },
])("scene selection reveals the note below the $name without moving focus", ({ sticky, monitor, inset }) => {
  vi.stubGlobal("scrollY", 150);
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains("eng-stage")) return new DOMRect(0, 200, 390, 300);
    if (this.classList.contains("eng-foot")) return new DOMRect(0, 500, 390, 120);
    if (this.classList.contains("part-explanation")) return new DOMRect(0, 900, 390, 100);
    return new DOMRect();
  });
  render(<RevealPage sticky={sticky} monitor={monitor} />);
  const pick = screen.getByRole("button", { name: "Pick the pump in the scene" });
  pick.focus();
  fireEvent.click(pick);
  expect(screen.getByRole("heading", { name: "Engine pump" })).toBeDefined();
  expect(scroll).toHaveBeenCalledWith({ top: 150 + 900 - inset - 12, behavior: "instant" });
  expect(document.activeElement).toBe(pick);
});
