import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { PartInspectionProvider, PartInspector, usePartInspectionStore } from "@/components/engine/PartInspector";
import { HoverTip, useHover } from "@/components/engine/scene/parts";

afterEach(() => {
  cleanup();
  useHover.setState({ hover: null });
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

test("selecting an engine part keeps its stage label visible, previews other hovered parts, and dismisses cleanly", () => {
  render(
    <PartInspectionProvider>
      <RegisteredParts model="Engine" />
      <div className="eng-view">
        <div className="toolbar" />
        <HoverTip />
      </div>
      <PartInspector />
    </PartInspectionProvider>,
  );
  expect(document.querySelector(".eng-tip")).toBeNull();
  fireEvent.click(screen.getByText("Inspect a part"));
  const pump = screen.getByRole("button", { name: "Engine pump" });
  fireEvent.click(pump);

  const selectedCard = document.querySelector(".eng-tip.eng-tip-selected");
  expect(selectedCard).not.toBeNull();
  expect(within(selectedCard as HTMLElement).getByText("Engine pump")).toBeDefined();
  expect(within(selectedCard as HTMLElement).getByText("Supplies lubrication. Existing manual note.")).toBeDefined();

  // Hovering a different part previews it; clearing hover restores the selected part's card.
  act(() => useHover.setState({ hover: { name: "Engine valve", note: "Controls the flow.", x: 100, y: 120 } }));
  expect(document.querySelector(".eng-tip.eng-tip-selected")).toBeNull();
  expect(document.querySelector(".eng-tip b")?.textContent).toBe("Engine valve");
  act(() => useHover.setState({ hover: null }));
  expect(document.querySelector(".eng-tip.eng-tip-selected b")?.textContent).toBe("Engine pump");

  // Pressing Escape clears the selection and removes the stage label.
  fireEvent.keyDown(window, { key: "Escape" });
  expect(document.querySelector(".eng-tip")).toBeNull();
  expect(pump.getAttribute("aria-pressed")).toBe("false");

  // Re-selecting from the inspector list keeps it selected (e.g. across viewport rotations) until explicitly dismissed.
  fireEvent.click(pump);
  expect(document.querySelector(".eng-tip.eng-tip-selected")).not.toBeNull();
  fireEvent.click(pump);
  expect(document.querySelector(".eng-tip.eng-tip-selected")).not.toBeNull();

  // Clicking the card's dismiss button clears the selection.
  fireEvent.click(screen.getByRole("button", { name: "Dismiss part label" }));
  expect(document.querySelector(".eng-tip")).toBeNull();
});

test("a selected engine tooltip appears at the same offset as a hover tooltip and flips above near the bottom", () => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(220);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(70);

  function PickAt({ x, y }: { x: number; y: number }) {
    const store = usePartInspectionStore();
    return (
      <button type="button" onClick={() => store.getState().select("Engine pump", true, { x, y })}>
        Pick at {x},{y}
      </button>
    );
  }

  render(
    <PartInspectionProvider>
      <RegisteredParts model="Engine" />
      <div className="eng-view">
        <HoverTip />
      </div>
      <PickAt x={300} y={150} />
      <PickAt x={300} y={360} />
    </PartInspectionProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Pick at 300,150" }));
  const card = document.querySelector<HTMLElement>(".eng-tip.eng-tip-selected");
  expect(card?.style.left).toBe("314px");
  expect(card?.style.top).toBe("164px");

  // Near the bottom edge, it flips above the anchor just like hover does.
  fireEvent.click(screen.getByRole("button", { name: "Pick at 300,360" }));
  expect(card?.style.left).toBe("314px");
  expect(card?.style.top).toBe("276px");
});
