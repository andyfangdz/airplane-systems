import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { BoxGeometry, Matrix4 } from "three";
import { FleetWalkMarker, FleetWalkPanel } from "@/components/FleetWalkaround";
import { markAircraftSceneReady } from "@/lib/aircraft-session";
import { Catalogue, primeGeo } from "@/lib/catalogue";
import { createFleetWalk } from "@/lib/fleet-walk";
import { createFleetWalkStore } from "@/lib/fleet-walk-store";
import { view as scene } from "@/lib/registry";
import { createSimulation } from "@/lib/simulation";
import { bindSimulation } from "@/lib/simulationBinding";
import type { SysDef } from "@/lib/systems";
import { useView, type AircraftSessionOwner } from "@/lib/view";

vi.mock("@react-three/fiber", () => ({ useFrame: () => {} }));
vi.mock("@/components/scene/Part", () => ({ Pin: () => <span data-testid="walk-marker" /> }));

const initialView = useView.getState();
const systems: SysDef[] = [
  {
    id: "overview",
    name: "Overview",
    pg: "1",
    cam: [
      [5, 2, 5],
      [0, 0, 0],
    ],
    blurb: "",
  },
];
const disposals: (() => void)[] = [];
let owner: AircraftSessionOwner;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  localStorage.clear();
  owner = { aircraft: "sr20", token: Symbol("loading scene") };
  useView.setState({ ...initialView, ac: "sr20", session: owner, sceneReady: null });
});
afterEach(() => {
  cleanup();
  disposals
    .splice(0)
    .reverse()
    .forEach((dispose) => dispose());
  useView.setState(initialView, true);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function fixture() {
  const cat = new Catalogue("sr20");
  // Production specializations deliberately have no synchronous geometry fallback in the route chunk.
  const factory = vi.fn(() => {
    throw new Error("Compiled geometry is not ready");
  });
  const part = cat.part(factory, ["fuel"], { id: "probe", name: "Probe", pos: [2, 0, 0] });
  const logic = createFleetWalk({
    cat,
    data: {
      id: "sr20",
      short: "SR20",
      source: "Fixture",
      applicability: "Fixture",
      general: "Fixture",
      throughout: ["Fixture"],
      next: "Fixture",
      missing: {},
      stations: [1, 2].map((n) => ({
        n,
        title: `Station ${n}`,
        cam: { p: [5, 2, 5], t: [0, 0, 0] },
        map: [n, n],
        items: ["a", "b"].map((suffix) => ({
          id: `${n}${suffix}`,
          text: "Probe",
          standard: "CHECK",
          parts: ["Probe"],
          system: "fuel",
          ref: "Fixture",
        })),
      })),
    },
    groundY: -1,
    ramp: (prior: object) => ({ ...prior }),
    groupMatrix: () => new Matrix4(),
  });
  const simulation = createSimulation({
    id: "sr20",
    initialState: () => ({}),
    initialLive: () => ({}),
    initialMemory: () => ({}),
    solve: () => ({}),
    memoryFrom: () => ({}),
    step: () => {},
  });
  const controller = createFleetWalkStore({
    logic,
    systems,
    runtime: bindSimulation(simulation, {}),
    resetLive: () => {},
  });
  disposals.push(() => simulation.dispose(), controller.close);
  const frame = vi.spyOn(controller, "frame");
  const loaded = () => {
    const geometry = new BoxGeometry(0.2, 0.2, 0.2);
    primeGeo(part, geometry);
    disposals.push(() => geometry.dispose());
    markAircraftSceneReady(owner);
  };
  const ui = () =>
    render(
      <>
        <FleetWalkPanel controller={controller} />
        <FleetWalkMarker controller={controller} />
      </>,
    );
  return { controller, logic, factory, frame, loaded, ui };
}

test("Resume keeps its saved item usable before compiled geometry is ready, then projects the current item", () => {
  const { controller, logic, factory, frame, loaded, ui } = fixture();
  logic.saveProgress({ v: 1, at: "2b", marks: { "2a": "ok" }, ms: 1000, done: false });
  controller.open();
  const page = ui();
  fireEvent.click(page.getByRole("button", { name: "Resume" }));
  expect(page.container.querySelector(".walk-id")?.textContent).toBe("2b");
  expect(controller.store.getState().marks).toEqual({ "2a": "ok" });
  expect(page.queryByTestId("walk-marker")).toBeNull();
  act(() => vi.advanceTimersByTime(5000));
  expect(factory).not.toHaveBeenCalled();
  expect(frame).not.toHaveBeenCalled();
  expect(useView.getState().spot?.names).toEqual(["Probe"]);
  act(loaded);
  expect(frame).toHaveBeenCalledWith(controller.store.getState().steps[3]);
  expect(page.getByTestId("walk-marker")).toBeTruthy();
  expect(factory).not.toHaveBeenCalled();
});

test("a cold deep link supports Begin and step navigation while assets are pending", () => {
  const { controller, factory, frame, loaded, ui } = fixture();
  controller.boot("?walk=2");
  const page = ui();
  fireEvent.click(page.getByRole("button", { name: "Begin at station 2" }));
  fireEvent.click(page.getByRole("button", { name: "Next item" }));
  expect(page.container.querySelector(".walk-id")?.textContent).toBe("2b");
  expect(factory).not.toHaveBeenCalled();
  expect(frame).not.toHaveBeenCalled();
  act(loaded);
  expect(frame).toHaveBeenCalledExactlyOnceWith(controller.store.getState().steps[3]);
});

test.each(["gesture", "request"])("a camera %s during loading cancels deferred framing", (kind) => {
  const { controller, frame, loaded, ui } = fixture();
  controller.open(2);
  const page = ui();
  fireEvent.click(page.getByRole("button", { name: "Begin at station 2" }));
  if (kind === "gesture") scene.moves++;
  else useView.getState().flyTo([8, 2, 8], [0, 0, 0]);
  const camera = useView.getState().cam;
  act(loaded);
  expect(frame).not.toHaveBeenCalled();
  expect(useView.getState().cam).toBe(camera);
});

test("another scene's readiness and a stale completion cannot unlock this session", () => {
  const { controller, factory, frame, loaded, ui } = fixture();
  const previous = { aircraft: "sr20", token: Symbol("previous scene") } satisfies AircraftSessionOwner;
  useView.setState({ sceneReady: previous });
  controller.open(2);
  const page = ui();
  fireEvent.click(page.getByRole("button", { name: "Begin at station 2" }));
  act(() => markAircraftSceneReady(previous));
  expect(useView.getState().sceneReady).toBe(previous);
  expect(factory).not.toHaveBeenCalled();
  expect(frame).not.toHaveBeenCalled();
  act(loaded);
  expect(frame).toHaveBeenCalledOnce();
});

test("completing the scene leaves the intro's user-selected camera unchanged", () => {
  const { controller, frame, loaded, ui } = fixture();
  controller.open(2);
  ui();
  useView.getState().flyTo([8, 2, 8], [0, 0, 0]);
  const camera = useView.getState().cam;
  act(loaded);
  expect(frame).not.toHaveBeenCalled();
  expect(useView.getState().cam).toBe(camera);
});
