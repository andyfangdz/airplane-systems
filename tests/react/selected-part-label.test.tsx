import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import * as THREE from "three";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "@/components/App";
import { PartsList } from "@/components/ui/controls";
import type { AircraftDef } from "@/aircraft/types";
import { Catalogue } from "@/lib/catalogue";
import { selectSys } from "@/lib/fleet";
import { useAircraftHover, useView } from "@/lib/view";

vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="mock-scene" /> }));
vi.mock("@/components/Fleet", () => ({ Fleet: () => <div /> }));
vi.mock("@/components/Loader", () => ({ Loader: () => null }));
vi.mock("@/components/Tour", () => ({ startTour: () => {} }));

function stubMatchMedia() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }));
}

function makeTestAircraft(): { def: AircraftDef; cat: Catalogue } {
  const cat = new Catalogue("test");
  cat.part(() => new THREE.BoxGeometry(0.1, 0.1, 0.1), ["fuel"], {
    id: "fuel-cap",
    name: "Fuel cap",
    note: "Flush locking fuel cap on the upper wing skin.",
    pin: true,
  });
  cat.part(() => new THREE.BoxGeometry(0.1, 0.1, 0.1), ["fuel"], {
    id: "fuel-vent",
    name: "Fuel vent",
    note: "Ram-air tank vent under the wing.",
    pin: true,
  });
  const FuelPanel = () => <PartsList cat={cat} sys="fuel" />;
  const OverviewPanel = () => <p className="lead">Overview</p>;
  const def: AircraftDef = {
    id: "c172s",
    name: "Test 172",
    short: "Test 172",
    sub: "Test",
    doc: "POH",
    systems: [
      {
        id: "overview",
        name: "Overview",
        pg: "7-1",
        blurb: "Overview",
        cam: [
          [5, 3, 5],
          [0, 0, 0],
        ],
      },
      {
        id: "fuel",
        name: "Fuel",
        pg: "7-28",
        blurb: "Fuel system",
        cam: [
          [3, 2, 3],
          [0, 0, 0],
        ],
      },
    ],
    panels: { overview: OverviewPanel, fuel: FuelPanel },
    Model: () => null,
    Alerts: () => null,
    advance: () => {},
    pivotX: 0,
    groundY: -1,
  };
  return { def, cat };
}

beforeEach(() => {
  stubMatchMedia();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  history.replaceState(null, "", "/c172s/fuel");
  useAircraftHover.setState({ hover: null, selected: null });
  useView.setState({
    ac: "c172s",
    session: null,
    sceneReady: null,
    selectedSys: "fuel",
    sys: "fuel",
    focus: null,
    spot: null,
    walking: false,
  });
});

afterEach(() => {
  cleanup();
  useAircraftHover.setState({ hover: null, selected: null });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("airplane view keeps a selected part's label visible from the parts list or 3D selection until dismissed", () => {
  const { def } = makeTestAircraft();
  render(<App def={def} sys="fuel" />);

  expect(document.querySelector(".tip")).toBeNull();

  // Selecting from the side panel's PartsList shows the pinned label on the 3D view.
  const capButton = screen.getByRole("button", { name: /Fuel cap/ });
  fireEvent.click(capButton);
  expect(capButton.getAttribute("aria-pressed")).toBe("true");
  const card = document.querySelector(".tip.tip-selected");
  expect(card).not.toBeNull();
  expect(within(card as HTMLElement).getByText("Fuel cap")).toBeDefined();
  expect(within(card as HTMLElement).getByText("Flush locking fuel cap on the upper wing skin.")).toBeDefined();

  // Hovering a different part previews it; unhovering restores the selected part's card.
  act(() =>
    useAircraftHover.getState().setHover({
      name: "Fuel vent",
      note: "Ram-air tank vent under the wing.",
      color: "#2F7FE6",
      x: 120,
      y: 140,
    }),
  );
  expect(document.querySelector(".tip.tip-selected")).toBeNull();
  expect(document.querySelector(".tip h4")?.textContent).toBe("Fuel vent");

  act(() => useAircraftHover.getState().setHover(null));
  expect(document.querySelector(".tip.tip-selected h4")?.textContent).toBe("Fuel cap");

  // Clicking the same part in the parts list toggles selection off.
  fireEvent.click(capButton);
  expect(document.querySelector(".tip")).toBeNull();
  expect(capButton.getAttribute("aria-pressed")).toBe("false");

  // Selecting directly (as on a 3D mesh click) places the tooltip at the same hover offset and dismisses on Escape.
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(900);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(220);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(70);
  act(() =>
    useAircraftHover.getState().setSelected({
      name: "Fuel vent",
      note: "Ram-air tank vent under the wing.",
      color: "#2F7FE6",
      x: 410,
      y: 250,
    }),
  );
  const placed = document.querySelector<HTMLElement>(".tip.tip-selected");
  expect(placed?.querySelector("h4")?.textContent).toBe("Fuel vent");
  expect(placed?.style.left).toBe("424px");
  expect(placed?.style.top).toBe("264px");
  expect(placed?.style.maxHeight).toBe("584px");
  fireEvent.keyDown(window, { key: "Escape" });
  expect(document.querySelector(".tip")).toBeNull();

  // In a short phone stage (210px), a tall note is capped to stage height - 16px and clamped at top 8px.
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(210);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(260);
  act(() =>
    useAircraftHover.getState().setSelected({
      name: "A/C compressor",
      note: "Long system note exceeding a 210px stage.",
      color: "#149C94",
      x: 150,
      y: 120,
    }),
  );
  const shortStageCard = document.querySelector<HTMLElement>(".tip.tip-selected");
  expect(shortStageCard?.style.maxHeight).toBe("194px");
  expect(shortStageCard?.style.top).toBe("8px");
  fireEvent.keyDown(window, { key: "Escape" });
  expect(document.querySelector(".tip")).toBeNull();

  // Dismiss button clears selection.
  act(() =>
    useAircraftHover.getState().setSelected({
      name: "Fuel cap",
      note: "Flush locking fuel cap on the upper wing skin.",
      color: "#2F7FE6",
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Dismiss part label" }));
  expect(document.querySelector(".tip")).toBeNull();

  // Switching systems clears selection.
  act(() =>
    useAircraftHover.getState().setSelected({
      name: "Fuel cap",
      note: "Flush locking fuel cap on the upper wing skin.",
      color: "#2F7FE6",
    }),
  );
  act(() => selectSys("overview"));
  expect(useAircraftHover.getState().selected).toBeNull();
  expect(document.querySelector(".tip")).toBeNull();
});
