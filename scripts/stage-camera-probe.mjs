/** Track consecutive rendered frames with the same component-stage camera pose. */
export async function observeStageCamera(context) {
  await context.addInitScript(() => {
    window.__stageCameraProbe = { camera: null, stable: 0, previous: "" };
    const devtools = new EventTarget();
    devtools.addEventListener("observe", ({ detail: renderer }) => {
      if (!renderer?.isWebGLRenderer) return;
      const render = renderer.render.bind(renderer);
      renderer.render = (scene, camera) => {
        const probe = window.__stageCameraProbe;
        probe.camera = camera;
        const offset = camera.view?.enabled ? [camera.view.offsetX, camera.view.offsetY] : [0, 0];
        const pose = [...camera.position.toArray(), ...camera.quaternion.toArray(), ...offset]
          .map((x) => x.toFixed(5))
          .join(",");
        probe.stable = probe.previous === pose ? probe.stable + 1 : 0;
        probe.previous = pose;
        return render(scene, camera);
      };
    });
    window.__THREE_DEVTOOLS__ = devtools;
  });
}

export async function waitForStageCamera(page) {
  await page.evaluate(() => {
    window.__stageCameraProbe.stable = 0;
  });
  await page.waitForFunction(() => window.__stageCameraProbe.stable > 10);
}
