import { existsSync, readdirSync } from "node:fs";

/** Whether a shared library is installed in /usr/lib or one of its multiarch directories (Debian, Ubuntu). */
const hasLibrary = (file) => {
  try {
    return (
      existsSync(`/usr/lib/${file}`) || readdirSync("/usr/lib").some((dir) => existsSync(`/usr/lib/${dir}/${file}`))
    );
  } catch {
    return false;
  }
};

/**
 * Chromium flags for software WebGL in the Playwright configs. Where Mesa's EGL is installed (Linux; CI installs it),
 * ANGLE over it renders with llvmpipe, about 2.4× faster than SwiftShader (same pixels). Without it those flags fall
 * into a far slower path than plain SwiftShader, so everything else, and SOFTWARE_GL=swiftshader, uses SwiftShader.
 */
const llvmpipe =
  process.env.SOFTWARE_GL !== "swiftshader" &&
  existsSync("/usr/share/glvnd/egl_vendor.d/50_mesa.json") &&
  hasLibrary("libEGL.so.1");
export const softwareGL = llvmpipe
  ? ["--use-gl=angle", "--use-angle=gl-egl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"]
  : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
