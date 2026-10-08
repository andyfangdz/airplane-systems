/** Reproduce the geometry/reference overlays. Node >=22.15; uses the installed TypeScript compiler.
 * No browser, remote images, render-camera perspective or app code changes are required. */
import { registerHooks } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import ts from "typescript";
import { execFileSync } from "node:child_process";
const root = fileURLToPath(new URL("../", import.meta.url));
const revision = process.argv[2] === "--baseline" ? process.argv[3] : undefined;
if (process.argv[2] && (!revision || !/^[a-f0-9]{40}$/.test(revision)))
  throw new Error("Use --baseline <full commit SHA>");
registerHooks({
  resolve(specifier, context, next) {
    let file;
    if (specifier.startsWith("@/")) file = path.join(root, specifier.slice(2));
    else if (specifier.startsWith(".") && context.parentURL?.startsWith(pathToFileURL(root).href))
      file = fileURLToPath(new URL(specifier, context.parentURL));
    if (file) {
      if (existsSync(file + ".ts")) file += ".ts";
      else if (existsSync(path.join(file, "index.ts"))) file = path.join(file, "index.ts");
      return next(pathToFileURL(file).href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(pathToFileURL(root).href) && url.endsWith(".ts")) {
      return {
        format: "module",
        shortCircuit: true,
        source: ts.transpileModule(
          revision
            ? execFileSync("git", ["show", revision + ":" + path.relative(root, fileURLToPath(url))], {
                cwd: root,
                encoding: "utf8",
              })
            : readFileSync(fileURLToPath(url), "utf8"),
          { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
        ).outputText,
      };
    }
    // Geometry's lettering module imports a static JSON glyph subset.
    if (url.startsWith(pathToFileURL(root).href) && url.endsWith(".json"))
      return {
        format: "module",
        shortCircuit: true,
        source: "export default " + readFileSync(fileURLToPath(url), "utf8"),
      };
    return next(url, context);
  },
});
const folder = path.join(root, "aircraft/reference-traces");
const refs = JSON.parse(readFileSync(path.join(folder, "handbook-traces.json"), "utf8"));
const baseline = JSON.parse(readFileSync(path.join(folder, "baseline.json"), "utf8"));
const models = {},
  metrics = {};
// Reference picks include rounded end caps: compare to the whole component
// perimeter, not an extrapolated leading/trailing-edge function alone.
const outline = (model, name) => {
  const pair = name.startsWith("fin")
    ? ["finLE", "finTE"]
    : name.startsWith("tail")
      ? ["tailLE", "tailTE"]
      : name === "wingLE" || name === "wingTE"
        ? ["wingLE", "wingTE"]
        : null;
  if (!pair) return model[name];
  const points = [...model[pair[0]], ...model[pair[1]].toReversed()];
  return [...points, points[0]];
};
const sample = (a, b, n, fn) =>
  Array.from({ length: n + 1 }, (_, i) => fn(a + ((b - a) * i) / n).map((v) => +v.toFixed(5)));
const esc = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
const distance = (p, line) =>
  Math.min(
    ...line.slice(1).map((b, i) => {
      const a = line[i],
        dx = b[0] - a[0],
        dy = b[1] - a[1],
        d = dx * dx + dy * dy;
      const t = d ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / d)) : 0;
      return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
    }),
  );
for (const id of Object.keys(refs)) {
  const g = await import(pathToFileURL(path.join(root, `aircraft/${id}/geometry.ts`)).href);
  const f = g.FUSE,
    cessna = !!g.SPEC;
  const tip = cessna ? g.Z(g.SPEC.wing.tipBL) : g.WTIP;
  const tailTip = cessna ? g.Z(g.SPEC.stab.halfSpan) : g.SSPAN;
  const fy0 = cessna ? g.Y(g.SPEC.fin[0][0]) : id === "sr20" ? g.FIN[0][0] : g.RUD_BOT;
  const fy1 = cessna ? g.Y(g.SPEC.fin.at(-1)[0]) : g.FIN.at(-1)[0];
  const finStations = cessna ? g.SPEC.fin.map((row) => g.Y(row[0])) : g.FIN.map((row) => row[0]);
  const heights = [...new Set([...sample(fy0, fy1, 160, (y) => [y]).flat(), ...finStations])].sort((a, b) => a - b);
  const m = {
    fuselageUpper: sample(f.xTail, f.xNose, 160, (x) => [x, g.topY(x)]),
    fuselageLower: sample(f.xTail, f.xNose, 160, (x) => [x, g.botY(x)]),
    wingLE: sample(0, tip, 240, (z) => [g.wLE(z), z]),
    wingTE: sample(0, tip, 240, (z) => [g.wLE(z) - g.wC(z), z]),
    wingFront: sample(0, tip, 160, (z) => [z, Math.max(...g.wingSec(z, 0, 1).map((p) => p.y))]),
    tailLE: sample(0, tailTip, 160, (z) => [g.sLE(z), z]),
    tailTE: sample(0, tailTip, 160, (z) => [g.sLE(z) - g.sC(z), z]),
    finLE: heights.map((y) => [g.fLE(y), y]),
    finTE: heights.map((y) => [g.fLE(y) - g.fC(y), y]),
  };
  models[id] = m;
  if (revision) continue;
  metrics[id] = {};
  const project = (view, [a, b]) =>
    view === "side"
      ? [40 + (4.5 - a) * 80, 115 + (1.8 - b) * 80]
      : view === "top"
        ? [930 + b * 60, 115 + (4.5 - a) * 60]
        : [45 + a * 115, 465 + (1.2 - b) * 115];
  const paths = { reference: [], before: [], after: [] };
  for (const [name, trace] of Object.entries(refs[id].traces)) {
    for (const [layer, points] of [
      ["reference", trace.points],
      ["before", baseline[id][name]],
      ["after", m[name]],
    ]) {
      paths[layer].push(
        `<path d="${points
          .map(
            (p, i) =>
              (i ? "L" : "M") +
              project(trace.view, p)
                .map((v) => v.toFixed(2))
                .join(","),
          )
          .join(" ")}"/>`,
      );
    }
    const distances = trace.points.map((p) => distance(p, outline(m, name)));
    const old = trace.points.map((p) => distance(p, outline(baseline[id], name)));
    metrics[id][name] = {
      samples: distances.length,
      beforeMean: +(old.reduce((a, b) => a + b, 0) / old.length).toFixed(3),
      afterMean: +(distances.reduce((a, b) => a + b, 0) / distances.length).toFixed(3),
      afterMax: +Math.max(...distances).toFixed(3),
    };
  }
  const grid = [];
  for (let x = -5; x <= 4; x++) grid.push(`<path d="M${project("side", [x, -1])[0]},100 V355"/>`);
  for (let y = -1; y <= 1.5; y += 0.5) grid.push(`<path d="M40,${project("side", [0, y])[1]} H835"/>`);
  for (let z = 0; z <= 6; z++) grid.push(`<path d="M${930 + z * 60},110 V720"/>`);
  for (let x = -5; x <= 4; x++) grid.push(`<path d="M925,${115 + (4.5 - x) * 60} H1305"/>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1340" height="820" viewBox="0 0 1340 820">
<style>text{font-family:system-ui,sans-serif;fill:#243340}path{fill:none;stroke-linejoin:round;stroke-linecap:round}.reference{stroke:#222f3b;stroke-width:2.3}.before{stroke:#d98235;stroke-width:2;stroke-dasharray:6 4}.after{stroke:#0089ae;stroke-width:2}.grid{stroke:#e4e9ed;stroke-width:1}</style>
<rect width="1340" height="820" fill="white"/>
<text x="35" y="35" font-size="24" font-weight="700">${id.toUpperCase()} — handbook outline comparison</text>
<text x="35" y="60" font-size="13">${esc(refs[id].source.document)}</text>
<text x="40" y="90" font-size="16">SIDE · x/y metres · nose left</text><text x="930" y="90" font-size="16">HALF PLAN · span / fore-aft</text>
<text x="40" y="420" font-size="16">HALF FRONT · span / height · upper wing envelope</text>
<g class="grid">${grid.join("")}</g>
<g class="before">${paths.before.join("")}</g><g class="after">${paths.after.join("")}</g><g class="reference">${paths.reference.join("")}</g>
<path class="reference" d="M40,730 h35"/><text x="85" y="735" font-size="14">Digitized reference</text>
<path class="before" d="M280,730 h35"/><text x="325" y="735" font-size="14">Before this audit</text>
<path class="after" d="M525,730 h35"/><text x="570" y="735" font-size="14">Current geometry</text>
<text x="40" y="775" font-size="13">Component curves include hidden portions. Reference line thickness and registration limit precision; these are not engineering tolerances.</text>
<text x="40" y="798" font-size="13">Cessna side views use uniform length scale and hub registration; schematic residuals are not measured aircraft errors. See RESOLUTION.md.</text>
</svg>`;
  writeFileSync(path.join(folder, `${id}.svg`), svg);
}
if (revision) {
  writeFileSync(path.join(folder, "baseline.json"), JSON.stringify(models) + "\n");
  console.log("Captured geometry at " + revision);
} else {
  writeFileSync(path.join(folder, "measurements.json"), JSON.stringify(metrics, null, 2) + "\n");
  mkdirSync(path.join(root, ".shots"), { recursive: true });
  writeFileSync(path.join(root, ".shots/trace-after.json"), JSON.stringify(models));
  // Close-up of the resolved feature. Station x is independently cross-checked;
  // heights remain the model's approximate blend, not a manufacturer loft.
  const dorsalPoint = ([x, y]) => [70 + (100 - x / 0.0254 - 120) * 5, 105 + (112 - (y / 0.0254 + 50.375)) * 6];
  const dorsalPath = (points) =>
    points
      .map(
        (p, i) =>
          (i ? "L" : "M") +
          dorsalPoint(p)
            .map((v) => v.toFixed(2))
            .join(","),
      )
      .join(" ");
  const ticks = [140, 160, 180, 200, 220, 240, 260, 280]
    .map((fs) => {
      const x = 70 + (fs - 120) * 5;
      return `<path d="M${x},100 V485" stroke="#e3e8ee"/><text x="${x}" y="508" text-anchor="middle">${fs}</text>`;
    })
    .join("");
  writeFileSync(
    path.join(folder, "resolution-dorsal.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" width="980" height="620" viewBox="0 0 980 620">
<rect width="980" height="620" fill="white"/><style>text{font:16px system-ui,sans-serif;fill:#243340}path{fill:none;stroke-linejoin:round;stroke-linecap:round}</style>
<text x="35" y="38" style="font-size:25px;font-weight:700">C182T: extend the dorsal fairing forward</text>
<text x="35" y="68">Maintenance station drawing and side photographs agree on the long transition.</text>
${ticks}
<path d="M170,105 V485" stroke="#21855a" stroke-width="2" stroke-dasharray="4 4"/>
<text x="185" y="135" fill="#21855a">Approximate onset near FS 140</text>
<text x="185" y="158">MM 6-15-00, Fig 1 (PDF 121)</text>
<g stroke-width="3" clip-path="url(#plot)">
<path stroke="#d98235" stroke-dasharray="7 5" d="${dorsalPath(baseline.c182t.finLE)}"/>
<path stroke="#0089ae" d="${dorsalPath(models.c182t.finLE)}"/>
<path stroke="#4b5965" d="${dorsalPath(models.c182t.fuselageUpper)}"/>
</g><defs><clipPath id="plot"><rect x="70" y="100" width="830" height="385"/></clipPath></defs>
<text x="300" y="537">Fuselage station (inches aft of firewall) →</text>
<path stroke="#d98235" stroke-width="3" stroke-dasharray="7 5" d="M40,565 h35"/><text x="85" y="570">Previous fin</text>
<path stroke="#0089ae" stroke-width="3" d="M265,565 h35"/><text x="310" y="570">Corrected fin</text>
<path stroke="#4b5965" stroke-width="3" d="M500,565 h35"/><text x="545" y="570">Fuselage crown</text>
<text x="35" y="603" style="font-size:14px">Component outlines include buried roots. Heights are an approximate blend; this is not a dimensioned loft.</text>
</svg>`,
  );
  console.log("Updated four comparison SVGs, dorsal close-up and measurements.json");
}
