# Working on this repo

Interactive 3D study models of airplane systems (POH/AFM Section 7): Next.js 16, React Three Fiber, zustand. Start with
[README.md](README.md) (what's modelled, project structure, state model) and, before touching an airplane,
[aircraft/README.md](aircraft/README.md) (what goes in which file, shared code, conventions).

## Commands

- `npm run check`: formatting, typecheck and tests. Run it before you call a change done; CI runs it plus `npm run build`.
- `npm test` (Vitest, `tests/`), `npm run typecheck`, `npm run build`.
- `npm run format`: Prettier. A Claude Code hook formats each file you edit and the pre-commit hook formats staged files,
  so you rarely need it; don't hand-format or fight the formatter.
- `npm run shot -- <view>…`: screenshots into `.shots/` (starts `next dev` itself). A view is `c172s/electrical`, an
  airplane (`da40`: all its systems) or `all`. Options: `--theme dark`, `--phone`, `--solid` (X-ray off),
  `--no-labels`, `--out <dir>`, `--compare <dir>`. It prints the page's console errors and warnings.

## Checking your work

- **Logic** (solvers, alerts, autopilot, scenarios): add or update a test in `tests/` next to the behaviour you changed.
  Tests are named after what the POH/AFM documents and cite the page; `tests/helpers.ts` has `patched(base, patch)`.
- **Anything visible** (parts, geometry, panels, labels, CSS): run `npm run shot` for the views you touched and look at
  the PNGs. For a refactor that should change nothing, capture before and after:
  `npm run shot -- c182t --out .shots/before`, change, then `npm run shot -- c182t --out .shots/after --compare .shots/before`.
  Changed views get a `<view>.diff.png` with the differing pixels in red. Views with the engine running always differ a
  little (propeller, strobes, spark plugs, flow particles).
- `tests/fleet.test.ts` checks every airplane definition and catalogue: rail order, colours, panels, unique part ids,
  and that label lists name pinned parts.

## Things that are easy to get wrong

- **Accuracy.** Every number and claim in notes and panels comes from the airplane's POH/AFM (or the supplement it
  cites). Never invent or "round off" a value; cite the page where helpful, and say so when sources differ or the model
  is approximate. CAS and annunciation text must match the documents exactly. If you can't source something, ask.
- **Part order.** Part ids come from a counter, and the first part with a given name carries its label pin, so the order
  parts register in matters. Each airplane's `parts/index.ts` imports the section files in order; add a part to the
  section it belongs to, and don't reorder sections or import a later section from an earlier one.
- **State.** View state is in `lib/view.ts`; switches and failures in the airplane's store (`update` recomputes the
  solution `E` with the pure `solve`); per-frame values in its mutable `live` object, never React state.
- **Shared code first.** Before writing a helper in an airplane folder, look in `lib/` (`anims.ts`, `geometry.ts`,
  `math.ts`, `catalogue.ts`), `components/ui/`, `lib/avionics/` and, for the Cessnas, `aircraft/cessna/`.
- **File names** must not differ only in letter case.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
