import { StrictMode } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "@/components/App";
import { C172S } from "@/aircraft/c172s";
import { walkController } from "@/aircraft/c172s/walk-store";
import { c172Runtime } from "@/aircraft/c172s/store";
import { useView } from "@/lib/view";
import type { AircraftDef } from "@/aircraft/types";

vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="deferred-scene" /> }));
vi.mock("@/components/Fleet", () => ({ Fleet: () => <div /> }));
vi.mock("@/components/Loader", () => ({ Loader: () => null }));
vi.mock("@/components/Tour", () => ({ startTour: () => {} }));

const initialView = useView.getState();
const initialSimulation = c172Runtime.current().checkpoint();
const def: AircraftDef = { ...C172S, Alerts: () => null, panels: {} };

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", (media: string) => ({
    media,
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  // jsdom has no layout observer; responsive navigation is exercised in the browser suite.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  localStorage.clear();
  useView.setState(initialView, true);
  history.replaceState(null, "", "/c172s/fuel?walk=3");
});

afterEach(() => {
  cleanup();
  walkController.close();
  c172Runtime.current().restore(initialSimulation);
  useView.setState(initialView, true);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("Strict Mode preserves a consumed walk deep link and route unmount releases its fork", () => {
  const navigation = { retainedRoute: "c172s" };
  history.replaceState(navigation, "", location.href);
  const original = c172Runtime.current();
  const { unmount } = render(
    <StrictMode>
      <App def={def} sys="fuel" />
    </StrictMode>,
  );
  expect(walkController.store.getState()).toMatchObject({ phase: "intro", from: 3 });
  expect(useView.getState()).toMatchObject({ ac: "c172s", selectedSys: "fuel", walking: true });
  expect(useView.getState().session?.aircraft).toBe("c172s");
  expect(location.search).toBe("");
  expect(history.state).toEqual(navigation);
  expect(c172Runtime.current()).not.toBe(original);
  unmount();
  expect(c172Runtime.current()).toBe(original);
  expect(walkController.session().prior).toBeNull();
  expect(useView.getState()).toMatchObject({ session: null, walking: false });
});

test("the mounted route advances simulation before WebGL loads and stops on exit", () => {
  history.replaceState(null, "", "/c172s/fuel");
  const advance = vi.fn();
  const { unmount, getByTestId } = render(<App def={{ ...def, advance }} sys="fuel" />);
  expect(getByTestId("deferred-scene")).toBeTruthy();
  act(() => vi.advanceTimersByTime(100));
  expect(advance).toHaveBeenCalled();
  unmount();
  advance.mockClear();
  act(() => vi.advanceTimersByTime(100));
  expect(advance).not.toHaveBeenCalled();
});

test("a retained route applies its new system parameter without replacing the aircraft session", () => {
  history.replaceState(null, "", "/c172s/fuel");
  const original = c172Runtime.current();
  const { rerender } = render(<App def={def} sys="fuel" />);
  const owner = useView.getState().session;
  act(() => {
    walkController.open();
    walkController.begin();
  });
  expect(c172Runtime.current()).not.toBe(original);
  history.replaceState(history.state, "", "/c172s/electrical");
  rerender(<App def={def} sys="electrical" />);
  expect(useView.getState()).toMatchObject({
    session: owner,
    selectedSys: "electrical",
    sys: "electrical",
    walking: false,
  });
  expect(c172Runtime.current()).toBe(original);
  expect(location.pathname).toBe("/c172s/electrical");
});
