import { afterEach, expect, test } from "vitest";
import * as THREE from "three";
import { advanceFlows } from "@/components/scene/Flows";
import { createFlowDirection } from "@/lib/scene/flow-directions";
import { FlowResources } from "@/lib/scene/flow-resources";
import { useView } from "@/lib/view";

const initial = useView.getState();
afterEach(() => useView.setState(initial, true));

test("reduced motion replaces travel with a stationary live direction, including reversal, stoppage and resuming motion", () => {
  useView.setState({ sys: "fuel", spot: null });
  const resources = new FlowResources(null);
  const items = resources.select([
    {
      key: "supply",
      pts: [
        [0, 0, 0],
        [2, 0, 0],
      ],
      sys: ["fuel"],
    },
  ]);
  const [item] = items;
  const arrow = createFlowDirection(item);
  const tmp = new THREE.Vector3(),
    color = new THREE.Color();
  let rate = 1;
  const frame = (reduce: boolean) =>
    advanceFlows(items, 0.1, () => ({ supply: rate }), undefined, tmp, color, [arrow], reduce);
  frame(false);
  expect(item.pts.visible).toBe(true);
  expect(arrow.mesh.visible).toBe(false);
  const phase = item.t;
  frame(true);
  const position = arrow.mesh.position.clone();
  expect(item.pts.visible).toBe(false);
  expect(arrow.mesh.visible).toBe(true);
  expect(new THREE.Vector3(0, 1, 0).applyQuaternion(arrow.mesh.quaternion).x).toBeCloseTo(1);
  rate = -2;
  frame(true);
  expect(item.t).toBe(phase);
  expect(arrow.mesh.position).toEqual(position);
  expect(new THREE.Vector3(0, 1, 0).applyQuaternion(arrow.mesh.quaternion).x).toBeCloseTo(-1);
  rate = 0;
  frame(true);
  expect(arrow.mesh.visible).toBe(false);
  rate = 1;
  useView.setState({ sys: "electrical" });
  frame(true);
  expect(arrow.mesh.visible).toBe(false);
  useView.setState({ sys: "fuel" });
  frame(false);
  expect(item.t).toBeGreaterThan(phase);
  expect(arrow.mesh.visible).toBe(false);
  expect(item.pts.visible).toBe(true);
  expect(arrow.mesh.userData).toEqual({ presentation: true, cameraBounds: false });
  arrow.mesh.geometry.dispose();
  arrow.mesh.material.dispose();
  resources.dispose();
});
