import { describe, expect, it } from "vitest";
import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3 } from "three";
import { componentBounds, fitComponentCamera, visibleStageLabels, type StageRect } from "../lib/component-stage";

const rect = (left: number, top: number, right: number, bottom: number): StageRect => ({ left, top, right, bottom });

describe("component study labels", () => {
  it("keeps the selected part readable while removing collisions, clipped labels and labels behind instruments", () => {
    const labels = [
      { id: "Magnetos", rect: rect(50, 100, 150, 120), priority: 0 },
      { id: "Wastegate", rect: rect(80, 105, 180, 125), priority: 0, selected: true },
      { id: "Behind toolbar", rect: rect(200, 15, 280, 35), priority: 0 },
      { id: "Behind monitor", rect: rect(20, 305, 90, 325), priority: 0 },
      { id: "Clipped", rect: rect(350, 180, 410, 200), priority: 0 },
      { id: "Fuel pump", rect: rect(200, 180, 280, 200), priority: 0 },
    ];
    const viewport = rect(0, 0, 390, 400),
      obstacles = [rect(0, 0, 390, 50), rect(0, 300, 390, 400)];
    expect([...visibleStageLabels(labels, viewport, obstacles)]).toEqual(["Wastegate", "Fuel pump"]);
    expect(visibleStageLabels([...labels].reverse(), viewport, obstacles)).toEqual(
      visibleStageLabels(labels, viewport, obstacles),
    );
  });
  it("spends the small-screen budget on selected and principal assemblies before repeated cylinder labels", () => {
    const labels = Array.from({ length: 8 }, (_, i) => ({
      id: `Cyl ${i}`,
      rect: rect(10, i * 30 + 10, 80, i * 30 + 30),
      priority: 10,
      selected: i === 7,
    }));
    labels.push({ id: "Fuel divider", rect: rect(100, 10, 190, 30), priority: 0, selected: false });
    const visible = visibleStageLabels(labels, rect(0, 0, 390, 400), [], 6);
    expect(visible.size).toBe(6);
    expect(visible.has("Fuel divider")).toBe(true);
    expect([...visible][0]).toBe("Cyl 7");
  });
});

describe("component study framing", () => {
  it.each([
    { width: 1020, height: 1000, safe: rect(28, 70, 992, 760) },
    { width: 390, height: 354, safe: rect(20, 70, 370, 334) },
    { width: 480, height: 800, safe: rect(20, 100, 460, 560) },
  ])("fits every assembly corner clear of the toolbar and monitor at $width × $height", ({ width, height, safe }) => {
    const bounds = new Box3(new Vector3(-0.8, -1, -0.4), new Vector3(0.6, 1.1, 0.5));
    const pose = fitComponentCamera(bounds, new Vector3(0.4, 0.3, 1), 38, width, height, safe)!;
    const camera = new PerspectiveCamera(38, width / height, 0.01, 40);
    camera.position.copy(pose.position);
    camera.lookAt(pose.target);
    camera.updateMatrixWorld();
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z]) {
          const p = new Vector3(x, y, z).project(camera);
          const px = ((p.x + 1) / 2) * width,
            py = ((1 - p.y) / 2) * height;
          expect(px).toBeGreaterThanOrEqual(safe.left - 0.001);
          expect(px).toBeLessThanOrEqual(safe.right + 0.001);
          expect(py).toBeGreaterThanOrEqual(safe.top - 0.001);
          expect(py).toBeLessThanOrEqual(safe.bottom + 0.001);
        }
  });
  it("excludes hidden groups and decorative/selection descendants from physical framing", () => {
    const root = new Group();
    const geo = new BoxGeometry(2, 4, 6),
      mat = new MeshBasicMaterial();
    try {
      const physical = new Mesh(geo, mat);
      physical.position.set(1, 2, 3);
      root.add(physical);
      for (const excluded of ["hidden", "decoration"] as const) {
        const group = new Group();
        group.visible = excluded !== "hidden";
        group.userData.cameraBounds = excluded !== "decoration";
        group.position.set(100, 100, 100);
        group.add(new Mesh(geo, mat));
        root.add(group);
      }
      const bounds = componentBounds(root);
      expect(bounds.min.distanceTo(new Vector3(0, 0, 0))).toBe(0);
      expect(bounds.max.distanceTo(new Vector3(2, 4, 6))).toBe(0);
    } finally {
      geo.dispose();
      mat.dispose();
    }
  });
  it.each([
    { width: 382, height: 260, safe: rect(20, 74, 362, 240) },
    { width: 382, height: 210, safe: rect(20, 74, 362, 190) },
    { width: 1020, height: 900, safe: rect(28, 70, 992, 650) },
  ])("uses physical corners instead of empty world-box corners at $width × $height", ({ width, height, safe }) => {
    const model = new Group();
    const geometry = new BoxGeometry(0.2, 0.3, 2),
      material = new MeshBasicMaterial();
    const mesh = new Mesh(geometry, material);
    mesh.rotation.set(0.3, 0.8, -0.15);
    mesh.position.set(0.4, -0.2, 0.1);
    model.add(mesh);
    const direction = new Vector3(0, 0, 1).applyEuler(mesh.rotation);
    try {
      const fit = fitComponentCamera(model, direction, 38, width, height, safe)!;
      const enclosingBoxFit = fitComponentCamera(componentBounds(model), direction, 38, width, height, safe)!;
      expect(fit.position.distanceTo(fit.target)).toBeLessThan(
        enclosingBoxFit.position.distanceTo(enclosingBoxFit.target) * 0.8,
      );
      const camera = new PerspectiveCamera(38, width / height, 0.01, 40);
      camera.position.copy(fit.position);
      camera.lookAt(fit.target);
      camera.updateMatrixWorld();
      const vertices = geometry.getAttribute("position");
      for (let i = 0; i < vertices.count; i++) {
        const point = new Vector3().fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld).project(camera);
        const x = ((point.x + 1) / 2) * width,
          y = ((1 - point.y) / 2) * height;
        expect(x).toBeGreaterThanOrEqual(safe.left - 0.001);
        expect(x).toBeLessThanOrEqual(safe.right + 0.001);
        expect(y).toBeGreaterThanOrEqual(safe.top - 0.001);
        expect(y).toBeLessThanOrEqual(safe.bottom + 0.001);
      }
    } finally {
      geometry.dispose();
      material.dispose();
    }
  });
  it.each([
    { width: 1020, height: 900, safe: rect(28, 70, 992, 660) },
    { width: 390, height: 354, safe: rect(20, 82, 370, 334) },
  ])("orbits the working hardware at the safe frame centre at $width × $height", ({ width, height, safe }) => {
    const model = new Group(),
      hardware = new Group();
    hardware.userData.cameraSubject = true;
    hardware.position.set(0.25, -0.1, 0.4);
    hardware.rotation.set(0.2, 0.3, 0.1);
    const geo = new BoxGeometry(0.4, 0.2, 0.3),
      mat = new MeshBasicMaterial();
    const body = new Mesh(geo, mat),
      lead = new Mesh(geo, mat);
    lead.scale.set(12, 0.02, 0.02);
    lead.position.x = 2.5;
    hardware.add(body);
    model.add(hardware, lead);
    const direction = new Vector3(1, 0.35, 0.8);
    const fit = (focused: boolean) => fitComponentCamera(model, direction, 38, width, height, safe, focused)!;
    try {
      const overview = fit(false),
        focus = fit(true);
      expect(focus.target.distanceTo(hardware.position)).toBeLessThan(1e-9);
      expect(overview.position.distanceTo(overview.target)).toBeGreaterThan(
        focus.position.distanceTo(focus.target) * 2,
      );
      const camera = new PerspectiveCamera(38, width / height, 0.01, 40);
      camera.setViewOffset(width, height, focus.viewOffset.x, focus.viewOffset.y, width, height);
      camera.position.copy(focus.position);
      camera.lookAt(focus.target);
      camera.updateMatrixWorld();
      const pixels = (p: Vector3) => {
        p.project(camera);
        return [((1 + p.x) * width) / 2, ((1 - p.y) * height) / 2];
      };
      const [x, y] = pixels(hardware.position.clone());
      expect(x).toBeCloseTo((safe.left + safe.right) / 2);
      expect(y).toBeCloseTo((safe.top + safe.bottom) / 2);
      const vertices = geo.getAttribute("position");
      for (let i = 0; i < vertices.count; i++) {
        const [px, py] = pixels(new Vector3().fromBufferAttribute(vertices, i).applyMatrix4(body.matrixWorld));
        expect(px).toBeGreaterThanOrEqual(safe.left - 0.001);
        expect(px).toBeLessThanOrEqual(safe.right + 0.001);
        expect(py).toBeGreaterThanOrEqual(safe.top - 0.001);
        expect(py).toBeLessThanOrEqual(safe.bottom + 0.001);
      }
      // A study filter can hide all nominated hardware. Fit what is still visible.
      hardware.visible = false;
      expect(fit(true).target.distanceTo(lead.position)).toBeLessThan(1e-9);
    } finally {
      geo.dispose();
      mat.dispose();
    }
  });

  it("waits for physical geometry and nonzero layout instead of generating a non-finite camera", () => {
    expect(fitComponentCamera(new Box3(), new Vector3(0, 0, 1), 38, 390, 400, rect(20, 50, 370, 380))).toBeNull();
    expect(fitComponentCamera(new Group(), new Vector3(0, 0, 1), 38, 390, 400, rect(20, 50, 370, 380))).toBeNull();
    const bounds = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));
    expect(fitComponentCamera(bounds, new Vector3(0, 0, 1), 38, 0, 400, rect(0, 0, 0, 400))).toBeNull();
  });
});
