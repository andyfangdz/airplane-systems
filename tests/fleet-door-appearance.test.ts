import { afterEach, expect, it, vi } from "vitest";
import * as THREE from "three";
import { Part } from "@/components/scene/Part";
import { CAT } from "@/aircraft/c172s/parts";
import { useView } from "@/lib/view";
import { dimSolidMat, mats } from "@/lib/materials";
import { SPOT_COLOR } from "@/lib/spot";
import type { PartSpec } from "@/lib/catalogue";
import type { ReactElement } from "react";
const frame = vi.hoisted(() => ({ callbacks: [] as ((s: unknown) => void)[] }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useRef: () => ({ current: null }),
  useEffect: () => {},
}));
vi.mock("@react-three/fiber", () => ({ useFrame: (cb: (s: unknown) => void) => frame.callbacks.push(cb) }));
vi.mock("@/lib/materials", async (original) => ({
  ...(await original<typeof import("@/lib/materials")>()),
  skinMat: () => new THREE.MeshStandardMaterial({ map: new THREE.Texture(), side: THREE.DoubleSide }),
}));
vi.mock("@/lib/view", async (original) => {
  const actual = await original<typeof import("@/lib/view")>();
  return {
    ...actual,
    useView: Object.assign(
      (select: (s: ReturnType<typeof actual.useView.getState>) => unknown) => select(actual.useView.getState()),
      actual.useView,
    ),
    useNarrowLayout: () => false,
  };
});
const saved = useView.getState();
afterEach(() => useView.setState(saved));
function draw(spec: PartSpec) {
  frame.callbacks = [];
  const el = Part({ spec, cat: CAT }) as ReactElement<{ ref: { current: THREE.Mesh }; material: THREE.Material }>;
  const mesh = new THREE.Mesh();
  el.props.ref.current = mesh;
  frame.callbacks.forEach((cb) => cb({ clock: { elapsedTime: 0 } }));
  return mesh.material;
}
it.each(["Right cabin door", "Right door window", "Baggage door panel"])(
  "%s keeps its finish outside Cabin, with focus and X-ray taking precedence",
  (name) => {
    const registered = CAT.parts.find((p) => p.name === name)!;
    // Geometry is covered separately; exercise the real registered finish and the component's frame policy.
    const spec = { ...registered, geo: () => new THREE.BoxGeometry() };
    useView.setState({ ac: "c172s", sys: "electrical", xray: false, spot: null, focus: null, labels: false });
    const finish = spec.solidMaterial!();
    expect(draw(spec)).toBe(finish);
    expect(finish.side).toBe(THREE.DoubleSide);
    if (name.includes("window")) expect(finish.map).toBeNull();
    else expect(finish.map).not.toBeNull();
    useView.setState({ focus: name });
    expect(draw(spec)).toBe(mats(spec.color!).hi);
    useView.setState({ focus: null, spot: { names: ["Starter"], side: 0 } });
    expect(draw(spec)).toBe(dimSolidMat(finish));
    useView.setState({ spot: { names: [name], side: 0 } });
    expect(draw(spec)).toBe(mats(SPOT_COLOR).hi);
    useView.setState({ spot: null, xray: true });
    expect(draw(spec)).toBe(mats(spec.color!).dim);
    useView.setState({ sys: "cabin" });
    expect(draw(spec)).not.toBe(finish);
  },
);
