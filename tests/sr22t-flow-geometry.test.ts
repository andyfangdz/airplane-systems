/** View changes retain rendering resources; Engine group visibility remains scoped to Engine. */
import type { ReactElement } from "react";
import * as THREE from "three";
import { afterEach, expect, it, vi } from "vitest";
import { Model } from "@/aircraft/sr22t/Airplane";
import { useEngineGroups } from "@/aircraft/sr22t/engine-group-store";
import { allGroups } from "@/aircraft/sr22t/engine-groups";
import { Flows } from "@/components/scene/Flows";
import { useView } from "@/lib/view";

// Exercise the actual Model -> Flows render path with persistent memo slots, without a WebGL context.
const hooks = vi.hoisted(() => ({
  scope: "model",
  index: 0,
  slots: new Map<string, { deps: unknown[]; value: unknown }>(),
  cleanups: [] as (() => void)[],
  reducedMotion: false,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useMemo: (create: () => unknown, deps: unknown[]) => {
    const key = hooks.scope + hooks.index++;
    const previous = hooks.slots.get(key);
    if (previous && deps.length === previous.deps.length && deps.every((d, i) => Object.is(d, previous.deps[i])))
      return previous.value;
    const value = create();
    hooks.slots.set(key, { deps, value });
    return value;
  },
  useRef: (current: unknown) => ({ current }),
  useEffect: (setup: () => void | (() => void)) => {
    const cleanup = setup();
    if (cleanup) hooks.cleanups.push(cleanup);
  },
}));
vi.mock("@react-three/fiber", () => ({ useFrame: () => {} }));
vi.mock("@/lib/useReducedMotion", () => ({ useReducedMotion: () => hooks.reducedMotion }));
vi.mock("@/lib/materials", async (original) => ({
  ...(await original<typeof import("@/lib/materials")>()),
  dotTex: () => null,
}));
vi.mock("@/lib/view", async (original) => {
  const actual = await original<typeof import("@/lib/view")>();
  return {
    ...actual,
    useView: Object.assign(
      (select: (s: ReturnType<typeof actual.useView.getState>) => unknown) => select(actual.useView.getState()),
      actual.useView,
    ),
  };
});
vi.mock("@/aircraft/sr22t/store", async (original) => {
  const actual = await original<typeof import("@/aircraft/sr22t/store")>();
  return {
    ...actual,
    useSR22T: Object.assign(
      (select: (s: ReturnType<typeof actual.useSR22T.getState>) => unknown) => select(actual.useSR22T.getState()),
      actual.useSR22T,
    ),
  };
});
vi.mock("@/aircraft/sr22t/engine-group-store", async (original) => {
  const actual = await original<typeof import("@/aircraft/sr22t/engine-group-store")>();
  return {
    ...actual,
    useEngineGroups: Object.assign(
      (select: (s: ReturnType<typeof actual.useEngineGroups.getState>) => unknown) =>
        select(actual.useEngineGroups.getState()),
      actual.useEngineGroups,
    ),
  };
});

const savedView = useView.getState();
const savedGroups = useEngineGroups.getState();
afterEach(() => {
  useView.setState(savedView);
  useEngineGroups.setState(savedGroups);
  for (const cleanup of hooks.cleanups) cleanup();
  hooks.cleanups = [];
  hooks.slots.clear();
  hooks.reducedMotion = false;
});

function renderFlows() {
  hooks.scope = "model";
  hooks.index = 0;
  const model = Model() as ReactElement<{ children: ReactElement[] }>;
  const flowElement = model.props.children.find((child) => child.type === Flows)!;
  hooks.scope = "flows";
  hooks.index = 0;
  const rendered = Flows(flowElement.props as Parameters<typeof Flows>[0]);
  const [groups, particles] = rendered.props.children as [
    ReactElement<{ children: ReactElement }>[],
    ReactElement<{ object: THREE.Points }>[],
  ];
  return {
    flows: groups.map((group) => ({
      key: group.key,
      tube: group.props.children && (group.props.children.props as { geometry: THREE.BufferGeometry }).geometry,
    })),
    particles: particles.map((particle) => particle.props.object),
  };
}

it.each([false, true])(
  "view switches preserve flow tubes and particle geometry when group visibility is unchanged (reduced motion %s)",
  (reducedMotion) => {
    hooks.reducedMotion = reducedMotion;
    useEngineGroups.setState({ shown: allGroups() });
    useView.setState({ sys: "engine" });
    const before = renderFlows();
    expect(before.flows.length).toBeGreaterThan(100);
    expect(before.particles).toHaveLength(1);
    for (const sys of ["fuel", "overview", "propeller", "engine"] as const) {
      useView.setState({ sys });
      const after = renderFlows();
      expect(after.flows.map((item) => item.key)).toEqual(before.flows.map((item) => item.key));
      after.flows.forEach((item, i) => {
        expect(item.tube).toBe(before.flows[i].tube);
      });
      after.particles.forEach((particle, i) => {
        expect(particle).toBe(before.particles[i]);
        expect(particle.geometry).toBe(before.particles[i].geometry);
      });
    }
    // A hidden group must still remove its flows in Engine and restore them elsewhere.
    useEngineGroups.getState().set("oil", false);
    const filtered = renderFlows();
    expect(filtered.flows.length).toBeLessThan(before.flows.length);
    useView.setState({ sys: "fuel" });
    const restored = renderFlows();
    expect(restored.flows.map((item) => item.key)).toEqual(before.flows.map((item) => item.key));
    restored.flows.forEach((item, i) => expect(item.tube).toBe(before.flows[i].tube));
    useView.setState({ sys: "overview" });
    const overview = renderFlows();
    overview.flows.forEach((item, i) => expect(item.tube).toBe(restored.flows[i].tube));
    overview.particles.forEach((particle, i) => expect(particle).toBe(restored.particles[i]));
  },
);
