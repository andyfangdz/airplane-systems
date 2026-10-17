# Working on this repo

Interactive 3D study models of airplane systems (POH/AFM Section 7): Next.js 16, React Three Fiber, zustand. Start with
[README.md](README.md) (what's modelled, project structure, state model) and, before touching an airplane,
[aircraft/README.md](aircraft/README.md) (what goes in which file, shared code, conventions).

## Commands

- `npm run check`: formatting, generated fleet freshness, typecheck, React Compiler checks, all unit tests, compiled React tests and trusted-preview
  tests. Run it before you call a change done; CI also runs offline `npm run test:deploy`, builds geometry and both site
  targets, and runs discovered Playwright browser tests in six shards against those artifacts.
- `npm test` (Vitest, `tests/`), `npm run typecheck`, `npm run build`.
- `npm run test:changed`: local iteration shortcut, selecting test files whose imports reach a file changed since
  `origin/main` (committed or not). Pull requests and pushes to main both run the full check suite in CI.
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
- Tests use isolated module graphs by default. Only the explicit suites in `tests/setup/shared-tests.json` share a
  graph to reuse expensive catalogue construction (`vitest.config.mts`); they must leave imported module state as
  they found it. Remove a suite from that allowlist before adding store/live mutation, mocks or global stubs; add
  new suites only after checking that they own their mutable data. Shells and surfaces are built once per worker
  or file and handed out as clones (`tests/setup/geometry-cache.ts`); compare factories with `factoryOf(spec)`, not
  `spec.geo`.
- A test that reads a repo file through fs (`readFileSync`, a spawned script) lists it with a lazy
  `import.meta.glob("../path")` that it never calls, so `--changed` sees the dependency (see
  `tests/cloudfront-view-rewrite.test.ts`). Don't wrap it in `Object.keys(...)`: Vite then compiles in the keys alone
  and the dependency is lost.

## Things that are easy to get wrong

- **Accuracy.** Every number and claim in notes and panels comes from the airplane's POH/AFM (or the supplement it
  cites). Never invent or "round off" a value; cite the page where helpful, and say so when sources differ or the model
  is approximate. CAS and annunciation text must match the documents exactly. If you can't source something, ask.
- **Part identity and order.** Parts and shells declare authored `id` tokens, qualified by an explicit `instance` for
  repeated declarations. IDs never derive from coordinates, display names or registration counts; keep each fixed row
  token with its row when reordering authored arrays. Existing numeric suffixes are
  frozen source tokens, not counters to regenerate after an insertion. Scene baselines and compiled geometry use these
  identities. The first pinned part with a given name still carries its label, so declaration order affects label
  policy. Add a part to its section and preserve `parts/index.ts` import order and dependency direction.
- **State.** Each aircraft's `simulation.ts` factory owns discrete state, derived `E`, mutable live values, explicit latch
  memory and a fixed-step clock. `step.ts` and commands receive their runtime context; never read the presentation
  singleton from simulation logic. `store.ts` binds one runtime to the React store/live facade. The route owns the
  driver and scene registrations; a walk activates a temporary fork and releases it on exit. In `lib/view.ts`,
  `selectedSys` drives navigation and `sys` drives the scene; hover has its own store. React renders sampled snapshots
  or selectors from `useLiveSnapshot.ts`, never mutable live reads hidden in render helpers.
- **Shared code first.** Before writing a helper in an airplane folder, look in `lib/` (`anims.ts`, `geometry.ts`,
  `math.ts`, `catalogue.ts`), `components/ui/`, `lib/avionics/` and, for the Cessnas, `aircraft/cessna/`.
- **File names** must not differ only in letter case.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
