import { chromium } from "@playwright/test";
import { softwareGL } from "./software-gl.mjs";

/** Print the WebGL renderer the Chromium projects get, so a slow run shows whether llvmpipe or a fallback drew it. */
export default async function reportRenderer() {
  const browser = await chromium.launch({ args: softwareGL });
  try {
    const page = await browser.newPage();
    const renderer = await page.evaluate(() => {
      const gl = document.createElement("canvas").getContext("webgl2");
      const info = gl?.getExtension("WEBGL_debug_renderer_info");
      return gl ? (info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "unknown") : "no WebGL 2";
    });
    console.log(`WebGL renderer: ${renderer} (${softwareGL.join(" ")})`);
  } finally {
    await browser.close();
  }
}
