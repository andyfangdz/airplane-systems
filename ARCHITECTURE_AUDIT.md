# Architectural audit

Audited on 2026-10-17, starting from freshly fetched `origin/main` at
`bcdece1aba69597cbd79239c9835d5edd5ee15b1`. Compatibility with existing internal APIs, saved state, and asset formats is
not a design constraint. This document preserves the original audit and proposed execution plan. The resulting
implementation and validation are recorded in [ARCHITECTURE_IMPLEMENTATION.md](ARCHITECTURE_IMPLEMENTATION.md).

## Recommendation

Make the project a **source-backed aircraft model with several presentations**, with a clear boundary between its
authoring tools and its browser runtime. The most valuable changes are:

1. Give every simulation and study session an explicit owner, complete state, commands, and lifecycle.
2. Compile aircraft definitions into runtime assets; keep procedural construction out of the normal production path.
3. Give equipment stable semantic identities and author its connectivity once, then bind diagrams, particles,
   instructional targets, and availability calculations to that definition.
4. Render the compiled model in batches, updating only the parts that change.
5. Build and test a release artifact once, then promote those exact bytes.

The code already contains much of the foundation: pure electrical solvers, source-specific aircraft modules, shared
Cessna/Cirrus implementations, calibrated engine specifications, lossless prebuilt geometry, and extensive behavioral
and geometric tests. Preserve that investment. The main problem is that ownership and identity cross too many implicit
boundaries: module imports create mutable catalogues and stores, display names identify equipment, view state doubles
as navigation and study state, and production still carries geometry authoring code.

The product is an explanatory study aid. Its core invariant should be: **a control, indication, animated connection,
and explanatory note describe the same selected installation and the same simulation state**. More detailed physics
or more triangles are useful only when they improve that invariant or teach a documented relationship.

## Evidence and confidence

Five focused audits covered simulation, application state, rendering, authoring, and delivery. The findings below
distinguish reproduced state-transition defects, directly observed code/configuration properties, and proposals that
still require performance measurement. Line references refer to the audited commit.

Two lightweight harnesses load the real modules through Vite with minimal worker/browser adapters. They reproduce the
failure mechanisms without changing repository source:

```sh
node /workspace/scratch/simulation-audit.mjs
node /workspace/scratch/app-state-audit.mjs
```

The parent audit reran both successfully. These are module-level reproductions, not end-to-end browser verification.
Production frame rates, heap retention, deployed CDN headers, and real-device load times were not measured. Resource
retention and proposed rendering speedups must not be treated as established performance results.

Baseline verification results are recorded at the end of this document.

## 1. Replace fragmented simulation state with explicit runtime instances

**Priority: P1. Large structural change, with small immediate fixes.**

The fleet stores immutable discrete state `s`, a derived solution `E`, and a separate mutable module-level `live` object.
`E` is not entirely derived: `createSimStore` passes the previous solution into `solve` to retain latches
(`lib/simStore.ts:20–27`). Resets must therefore coordinate three representations. Panels, animation closures, and
walk sessions can retain references into them.

This causes concrete defects:

| Reproduction                                                                                                                           | Observed result                                                                                  | Cause                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Start SR22T “Low oxygen at FL180,” advance 30 seconds, then select “Climbing above 14,000 ft with oxygen off” and advance 0.05 seconds | Stored exposure is reset to zero, but live exposure becomes 0.500833 minutes instead of 0.000833 | `aircraft/sr22t/store.ts:38–39` resets discrete state only; `tick.ts:92–93` detects resets by value inequality, so resetting zero to zero is invisible                                                 |
| Start an IO-390 scenario, then an O-360 scenario before the first worker reply                                                         | First simulation remains `loading: "idle"` with zero resets; second completes                    | `components/engine/store.ts:65–75,154–185` shares a global request sequence and overwrites the worker's message handler; superseding another simulation does not clear that simulation's loading state |

Introduce a runtime factory with a contract along these lines:

```ts
interface SimulationRuntime<Command, Checkpoint, Snapshot> {
  dispatch(command: Command): void;
  advance(elapsedSeconds: number): void;
  checkpoint(): Checkpoint;
  restore(checkpoint: Checkpoint): void;
  getSnapshot(): Snapshot;
  subscribe(notify: () => void): () => void;
  dispose(): void;
}
```

The checkpoint includes controls, failures, quantities, continuous integrator state, latches, timers, and simulation
time. Move history such as alternator excitation into explicit state; compute observations from that state. A scenario
is an atomic replacement/transition with an explicit policy for retaining fuel, equipment, trim, and lifetime counters.
User controls should dispatch semantic commands instead of arbitrary draft mutations across UI files.

Keep mutable numerical buffers inside the runtime and detached snapshots at the React boundary. A giant immutable
reducer at animation frequency would add copying without solving ownership. Workers may remain shared services, but
requests need instance IDs, per-instance cancellation, and terminal success/error/cancel states.

**Acceptance:** independent instances cannot affect each other; checkpoint/restore followed by the same commands
produces the same observations; scenario resets do not depend on whether a field's value changed; every asynchronous
request reaches a terminal state. Preserve source-cited solver tests while moving their setup to fresh instances.

## 2. Make study sessions route-owned, and stop mutating the user's simulation for a walk

**Priority: P1. Confirmed lifecycle and navigation defects.**

The walk controller closes only when `useView.ac` changes (`lib/fleet-walk-store.ts:254–257`). Links to engine and
component pages do not change that field (`components/pickerEntries.ts:16,24`; `components/Picker.tsx:171`), and walk
panel cleanup only removes event handlers (`components/FleetWalkaround.tsx:120`).

The module harness reproduced:

- Aircraft walk → engine: `walking` remains true, the aircraft remains in the temporary ramp state, `prior` remains
  retained, and elapsed time continues. Returning to the same aircraft keeps the previous `since` and walk phase.
- Enter a walk from `/c172s/fuel`, select Electrical in the rail, then close: the Fuel system is restored while the URL
  remains `/c172s/electrical`. `close()` restores `sys` directly without restoring navigation (`fleet-walk-store.ts:242`).
- With a previous scene camera at `[37,18,21]` and the new route's requested camera at `[2,2,2]`, opening and closing a
  walk restores the previous scene camera. `Scene.tsx:179–182` publishes camera references without clearing them on
  unmount; route boot opens walks before mounting its new scene (`components/App.tsx:286–317`); `framing()` trusts the
  global reference (`fleet-walk-store.ts:106–113`).

A mounted `StudySession` should own the camera, loading state, hover, navigation selection, and active walk. Dispose it
when leaving that aircraft/engine/component identity, regardless of destination. Changing systems within the same
aircraft remains an in-session navigation and must not destroy its viewport or walk. Persist the user's simulation
checkpoint and walk progress separately from the mounted session; returning to an aircraft can still restore its
switches as the product currently promises.

Separate `selectedSystem` from a walk's `highlightedSystem`. The former drives the route and main panel; the latter is
a temporary presentation filter. Give camera handles a session identity and clear them on disposal.

The larger simplification is to **fork a study simulation**: pause the user's instance, create a walk instance from its
equipment configuration, and discard that instance on exit. Current code recursively captures and restores original
object identities (`fleet-walk-store.ts:73–103`) because animation code holds references. Runtime injection removes
the need for this restoration machinery. Immutable definitions and geometry remain shared between instances.

**Tradeoff:** animation callbacks currently close over aircraft globals. This requires a real dependency change, not
just adding React context around the existing singletons. Pilot one aircraft and its walk before converting the fleet.

**Acceptance:** aircraft → engine/component → same aircraft; another aircraft with saved walk progress; rail changes
during a walk; repeated open/close; delayed phone resize; and disposal while asynchronous work is pending all have
explicit, tested outcomes. URL, visible system, and camera owner agree after every transition.

## 3. Separate aircraft authoring from the production runtime

**Priority: P1 architectural investment. Large change.**

Production geometry is already baked, indexed, losslessly encoded, and decoded in a short-lived worker. Repeating that
optimization is not the next step. The remaining coupling is that runtime catalogues still import the source factories,
their procedural geometry dependencies, mutable registration, and state-bound animation closures.

`scripts/build-geometry.mjs:24–27` evaluates the same catalogues the browser imports. `PartSpec.geo` remains required
(`lib/catalogue.ts:64`), and `prepareGeometry` primes that catalogue or falls back to it (`lib/mesh/prebuilt.ts:38–80`).
The fallback is valuable, but keeping it on the normal import path mixes two very different workloads.

Compile authoring definitions into:

- A lightweight equipment/scene manifest: explicit IDs, hierarchy, transforms, bounds, labels, picking metadata,
  material classes, source references, and animation binding IDs.
- Mesh buffers, with static flow tubes included; flows currently construct tubes again on mount
  (`components/scene/Flows.tsx:17–41`) and are outside `geometryEntries` (`lib/mesh/prebuilt.ts:6–12`).
- Small aircraft runtime bindings for simulation outputs, articulated assemblies, and genuinely deforming geometry.

Keep procedural factories in an authoring/build module. Development can use them directly. Production can load a
separate recovery bundle on demand, or offer an explicit retry/recovery path if shipping that bundle is not worthwhile.
Asset integrity should bind manifest and buffers to a format version and definition digest. Existing hashed URLs and
whole-catalogue validation are useful foundations.

This also enables a proper build cache: key an aircraft build by its transitive inputs, format/encoder version, and
toolchain. The current content hash is computed after constructing every mesh, so it avoids neither reconstruction
nor encoding.

Once this boundary works, consider assembly-level assets: shell and selected-system dependencies first, finer detail
later. The current worker decompresses and decodes the entire aircraft before returning it
(`lib/mesh/geometry.worker.ts:9–11`). Precomputed bounds can frame a useful initial view before all geometry arrives.
Only add this streaming complexity if the measured first-use load warrants it.

**Acceptance:** inspect actual emitted module graphs and transferred bytes; geometry construction/triangulation code
does not enter the normal aircraft runtime bundle; decoded geometry remains equivalent to the source; recovery,
optional equipment, moving assemblies, picking, and source notes still work. Do not predict a byte or load-time saving
until the new bundle is measured.

## 4. Use stable equipment IDs and installation-specific connectivity

**Priority: P2. Foundational authoring improvement.**

Currently a part's identity is its display name plus its same-name registration ordinal (`lib/catalogue.ts:233–246`).
Authors cannot supply an ID through `PartOpts` (`:159`). Walk targets and label policies use names; the walk resolver
distinguishes repeated equipment partly by spatial side (`lib/fleet-walk.ts:27–34,280–372`). Import order determines
registration and label identity (`aircraft/sr20/parts/index.ts:24`). Hardware refinements also select by name
(`lib/hardware.ts:105,143`). This is structural coupling, not a claim that an existing reference is currently broken.

Give equipment and submeshes explicit identities, for example `electrical.adahrs2` and
`electrical.adahrs2.mount`. Keep display names independent. A target can name one instance or an explicit group such
as both main wheels. Assemble immutable definitions deterministically; reject missing references at build time.

The best first connectivity slice is SR20 electrical. The same feed relationships are authored in:

| Representation                                 | Evidence                                                  |
| ---------------------------------------------- | --------------------------------------------------------- |
| Load availability solver                       | `aircraft/sr20/model.ts:201–221`                          |
| Breaker panel bus/load table                   | `aircraft/sr20/model.ts:284–389`                          |
| Redundant display feed routes and ratings      | `aircraft/sr20/electrical-avionics-depth-flow.ts:146–158` |
| Particle flow gating                           | The same file, `:503–528`                                 |
| Equipment notes and optional ADAHRS predicates | `aircraft/sr20/parts/avionics.ts:82–106`                  |
| Diagram connections and energized segments     | `aircraft/cirrus/distribution.tsx:44–205`                 |

Define typed ports and directed edges for sources, buses, breakers, and loads. Put equipment applicability and source
references on that installation definition. Keep visual bends and SVG positions as separate layouts keyed by edge ID.
The solver exposes edge/load status that diagrams and particle animations consume. `FlowSpec` currently has geometry
and string keys but no semantic endpoints (`lib/catalogue.ts:128`); `Record<string, number>` rates cannot establish
correspondence between authored edges and simulated flows.

Start with this constrained graph. Keep explicit algorithms for latches, power allocation, and aircraft-specific
behavior. Automatic diagram layout, a generic physical-network solver, or a graph database is unnecessary. Extend to
fuel, pitot, or data links only where it removes demonstrated repetition.

**Acceptance:** missing ports, wrong media, unknown breaker IDs, dangling optional equipment, and rename-dependent
references fail at assembly. Preserve independent POH-based tests such as
`tests/sr20-electrical-avionics-depth.test.ts:110–206`; deriving expected answers from the same graph would hide errors.

## 5. Structure facts and compose simulation kernels without erasing installation differences

**Priority: P2. Long-term correctness and reuse.**

The engine subsystem provides a useful pattern: an `EngineSpec`, explicit state, and a common mean-value model.
`Limit` and `Marking` already combine values, units, and provenance (`engines/types.ts:31–60`). The fleet still contains
separate engine/power/fuel approximations, while component pages have their own runtime adapters.

Share the numerical kernels and specifications where the installation supports them. An aircraft adapter supplies
electrical starter availability, selected fuel source, boost-pump state, cooling/ram conditions, propeller type, and
control linkage. Keep explanatory cylinder-pressure and 3D detail demand-loaded. The existing engine model already
uses short mean-value integration steps; it is not a crank-resolved combustion solver that must run a pressure trace
each frame. C172 fixed-pitch behavior and aircraft-specific calibration still need explicit work.

Do not consolidate helpers by similar names alone. `aircraft/cessna/engine.ts:6–7` calls fuel/air relative richness
`lambda` (rich > 1), while `engines/model/engine.ts:622` uses excess-air lambda (lean > 1). Both conventions can be
internally valid; an untyped integration could reverse mixture meaning. Introduce canonical domain quantities and
explicit conversions at interfaces, including time, pressure, temperature, volume, angle, and mixture convention.

Likewise, turn important published/calibrated facts into structured records containing value, unit, document/page,
installation applicability, and status: published, digitized, calibrated, or illustrative. Retain conflicting claims
and the modeling decision. `aircraft/sr20/SOURCES.md:28–30,53–67` already records real POH/AMM disagreements; those
decisions must survive reuse. A component's standalone manual is not automatically authoritative for every airframe.

Keep free instructional prose and schematic geometry. A heavyweight unit algebra in every Three.js expression would
be counterproductive. Start at model boundaries and shared operational limits, where mistakes have real consequences.

**Acceptance:** the same operating point has consistent meanings across aircraft/engine/component views; installation
overrides remain explicit and cited; gauge bands and alerts consume the same limit definitions; independent source
calibration tests still establish accuracy.

## 6. Render static structure in batches and publish only meaningful observations

**Priority: P2. Strong optimization opportunity; gains remain to be measured.**

A lightweight catalogue import produced these counts. The SR22T flow count is with FIKI disabled; counts are authored
specifications, not measured draw calls or per-frame timings.

| Aircraft | Parts | Parts with `anim` | Flows |
| -------- | ----: | ----------------: | ----: |
| SR22T    | 1,221 |               269 |   146 |
| SR20     |   799 |               126 |   227 |
| C172S    |   568 |                80 |   174 |
| C182T    |   638 |               107 |   222 |
| DA40     |   529 |                84 |   173 |
| M20C     |   466 |                79 |   149 |

Approximately 78–86% of parts have no per-part animation, yet every `Part` subscribes to view state seven times and
installs a frame callback (`components/scene/Part.tsx:56–62,112–116`). This callback also enforces presentation policy
and build glow, so deleting it blindly would change behavior. Move persistent appearance changes to policy updates;
schedule transient glow and actual animation explicitly.

Batch compatible static meshes by parent, material class, and visibility/picking policy. Instance repeated primitives
where useful. Keep independently moving, deforming, transparent, or individually highlighted pieces separate where
batching would complicate correctness. Preserve per-equipment selection through instance IDs or triangle-range metadata.
Measure draw calls, raycasting, update time, and frame-time distribution before selecting the batch strategy.

Additional opportunities:

- Hover shares the global view store with scene policy. Every pointer move publishes a new hover object
  (`Scene.tsx:262`; `lib/view.ts:117`), causing all store subscribers to evaluate even when React selector equality
  prevents rendering. Separate transient DOM hover from scene appearance state.
- Flows update CPU particle positions and GPU buffers each frame (`Flows.tsx:54–73`). Precompute curve samples and
  evaluate shader-based path motion if profiling shows this loop matters. Keep directional rate and picking semantics.
- Filtering the C172S flow list when entering Engine changes the list identity (`aircraft/c172s/Airplane.tsx:368`),
  triggering complete flow resource reconstruction (`Flows.tsx:96`). Keep stable resources and change visibility.
- Flow particles change position without updating their bounding sphere (`Flows.tsx:28,67–73`). Three's cached bounds
  can consequently reject particles that have moved into view. A small Three-only probe reproduced that culling
  mechanism; an application-visible disappearance was not verified. Assign a conservative whole-path bound once.
- `useLiveSnapshot` clones the full source once per distinct sampling interval and always notifies
  (`lib/useLiveSnapshot.ts:5–16,33–39`). The engine page uses 150/200/250/300 ms consumers. A runtime-owned observation
  publisher can sample once, expose selectors/revisions, and stop unchanged/paused notifications.
- Introduce an explicit resource cache budget and ownership policy. Global geometry/material caches optimize revisits,
  but their residency should be measurable and evictable. Repeated route-switch memory growth is a test to run, not a
  leak established by this audit.

After ownership is explicit, compare a persistent fleet Canvas with today's per-route Canvas teardown. A persistent
viewport could preserve shader/upload work, but needs bounded residency, session-tagged async completion, and retained
aircraft-level lazy loading. Do not retain every aircraft merely to avoid context recreation. Screens and label layout
can also use input revisions: screens currently redraw at 5 Hz (`Screens.tsx:45–64`), and label decluttering repeatedly
measures DOM rectangles (`PinDeclutter.tsx:52–86`) even when their inputs have not changed.

The Canvas currently renders continuously at DPR up to 2 (`Scene.tsx:346–348`). Once simulation time is independent,
measure idle/paused work and consider demand rendering for quiescent scenes. Camera easing, particles, gauges,
progressive glow, and controls need an explicit wake/invalidation contract; changing the frame-loop flag alone is unsafe.

**Acceptance:** compare cold first-use, warm revisit, repeated aircraft switching, solid/X-ray, and walk highlighting on
desktop and a representative phone. Establish targets from these baselines; triangle count alone is insufficient.

## 7. Make time and tests independent of rendering and module history

**Priority: P2. Supports the runtime refactor.**

The fleet advances inside R3F (`components/scene/Scene.tsx:223`), with variable steps bounded at 50 ms and one second
of catch-up (`lib/simulationClock.ts:1–13`). Engine/component pages use a separate RAF loop and clipping policy
(`components/engine/sim.ts:15–31`; `store.ts:192`).

The audit reproduced a modest cadence dependence: the same one-second DA40 shutdown produced 714.13 RPM at 60 FPS
and 696.25 RPM at 20/5 FPS. Existing tests correctly verify elapsed-time accounting and selected linear behaviors;
they do not establish trajectory equivalence for every integrator. This difference is an architectural observation,
not a claim of a severe operational defect.

Move time advancement into the runtime. Use a fixed-step accumulator or numerically stable rate-independent updates
where appropriate, explicit background/pause/catch-up policy, and rendering interpolation. Timestamp commands against
simulation time. Preserve faster substeps where shaft/governor integration requires them; lower-frequency thermal or
avionics scheduling should follow convergence checks and profiling.

Testing should follow the resulting boundaries:

- Pure domain tests for source-derived behavior and invariants, with fresh state.
- Command/replay tests for scenario transitions, reset completeness, independent instances, and cadence convergence.
- Asset tests for lossless encoding, identifiers, geometry budgets, containment, and negative controls.
- Browser tests for actual route lifecycle, picking, framing, visibility, and failure recovery.

`vitest.config.mts:9–16` currently infers state isolation with a source-text regex. Indirect helper mutations can escape
that inference. The geometry setup also substitutes factories through a global hook (`tests/setup/geometry-cache.ts:9`).
This is a maintainability risk, not a demonstrated contaminated test. Explicit test projects and instance factories
would make sharing safe by construction while retaining cached immutable geometry fixtures.

## 8. Close delivery gaps, then promote verified artifacts

**Priority: P1 for coverage/cache gaps; P2 for the artifact pipeline.**

### Existing checks are absent from CI

The manual UI filename matrix (`.github/workflows/ci.yml:45–59`) omits:

- `scripts/test-load-ui.mjs`: progressive loading, scene fingerprints, pending-hull camera arbitration, and switching.
- `scripts/test-walkaround-ui.mjs`: SR22T walk behavior, including mobile camera restoration.
- `scripts/test-sr20-walkaround-ui.mjs`: SR20 walk behavior.

Playwright discovery reports 13 configured cases across them, two intentionally skipped on desktop. The fleet-depth
suite covers only the other four aircraft (`scripts/test-fleet-depth-ui.mjs:7–12`), so it does not replace these checks.
The offline AWS deploy suite is also excluded from normal Vitest (`vitest.config.mts:5`) and never invoked by CI.

Use discovery-based sharding or a coverage manifest that proves every configured test is assigned to a job. Keep a
single software-WebGL worker within each job. Add `test:deploy` to the appropriate checks. Preserve independent
behavioral assertions; this is a scheduling gap, not evidence that the project lacks tests.

### Hashed geometry receives the HTML cache policy

`scripts/build-geometry.mjs:30–33` emits content-addressed geometry filenames. The AWS uploader applies immutable
caching only to `_next/static` (`scripts/deploy-aws.sh:502–517`); geometry receives `public, max-age=60`. CloudFront has
only the `_next/static` special behavior (`infra/aws/site.json:246`), so geometry also gets the default policy's
300-second maximum TTL (`:157–167`). The smoke check discovers only `_next/static` assets (`scripts/smoke.mjs:24–27`).

Set immutable caching for hashed geometry in both the uploader and CDN behavior, keep the mutable manifest short-lived,
and check those policies through the release manifest. Changing only origin headers leaves the CDN cap in place.
This is verified configuration behavior; live deployed headers were not inspected.

### Build once and promote the tested bytes

CI currently performs six normal builds and one static build (`.github/workflows/ci.yml:33,67`), each baking the whole
fleet. Deployment builds again (`scripts/deploy-aws.sh:489`). Source cleanliness and exact-commit checks are useful,
but they do not prove that production receives the bytes tested by CI.

Use this artifact flow:

```mermaid
flowchart LR
  S[Source, lockfile, toolchain] --> G[Geometry compiler]
  G --> A[Versioned geometry assets]
  A --> B[Site build]
  B --> R[Release artifact and manifest]
  R --> T[Parallel browser and artifact checks]
  T --> P[Promote verified artifact]
  P --> H[Static host]
```

The release manifest records commit, toolchain, checksums, routes, asset paths, and cache classes. UI shards consume the
same artifact for their target mode. Deploy and rollback select verified artifacts. While both site modes exist,
build geometry once and produce separately identified Next-server and static-export artifacts; test each and promote
the tested static artifact to AWS. If a Next-server deployment is retained, promote its own tested artifact. Artifact
storage/provenance adds machinery, and the initial build becomes a dependency for UI jobs; measure
wall time instead of assuming that eliminating repeated CPU work necessarily shortens the critical path.

The current live-prefix upload also has no atomic release boundary (`scripts/deploy-aws.sh:515`). Hashed JS is uploaded
first, but HTML, RSC payloads, and geometry are overwritten/copied in the following pass. Prefer the host's atomic
deployment primitive or immutable release prefixes with an explicit active-release switch. Retain manifests for the
current and chosen rollback releases, then garbage-collect unreachable assets after a grace period. The existing
bucket lifecycle expires noncurrent object versions (`infra/aws/site.json:75`), not old uniquely named current keys.

## 9. Simplify the application platform after the boundaries are fixed

**Priority: P3. Conditional simplification, not the first rewrite.**

The app already supports a complete static export and has no application API routes or server actions. Make one static
release artifact the preferred deployment contract if there is no near-term server requirement. This would reduce
differences between previews and production. Preserve route-specific HTML/title metadata, deep links, 404 behavior,
lazy aircraft loading, and load recovery.

Next.js can continue producing that artifact. Evaluate a smaller static React/router build only after measuring its
effect on bundles, navigation, and maintenance. Replacing Next alone does not solve the model/runtime coupling and
would recreate useful routing behavior. React, R3F, Three, and Zustand are not themselves demonstrated bottlenecks.

Generate registrations from one lightweight build-time manifest. Today IDs, picker names, metadata, full definition
lists, route files, CloudFront routing, and embedded infrastructure function code must be synchronized
(`lib/systems.ts:4`; `lib/fleet-index.ts:7`; `aircraft/metas.ts:14`; `aircraft/index.ts:13`;
`infra/cloudfront/view-rewrite.js:5`; `infra/aws/site.json:184`). Generate explicit lazy import entries, not a runtime
registry that eagerly imports every aircraft. Enforce boundaries through bundler/compiler graphs and route byte
budgets, supplementing the current source-import test.

## Target boundaries

These can begin as directories in the existing repository. Separate publishable packages, a new monorepo tool, or
services are unnecessary.

```text
model/          Source references, installation specs, units, domain kernels, commands/checkpoints
authoring/      Procedural geometry, layouts, definition validation, asset compilation
runtime/        Simulation instances, clocks, worker requests, observation publication, resource ownership
presentation/   Compiled scene renderer, instruments, panels, walk presentation
app/            Routes, mounted study sessions, navigation, persisted preferences
release/        Generated route/asset manifests, build verification, promotion
```

Dependency rules matter more than folder names: domain kernels do not import React, browser globals, or Three;
production presentation does not import the authoring compiler; immutable definitions do not create stores; renderers
receive a runtime instead of importing one; asynchronous replies carry an owning instance/session ID.

## Execution sequence

| Stage                             | Concrete deliverable                                                                                                                               | Completion gate                                                                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Repair known gaps              | Oxygen reset, per-instance worker completion, route-exit walk handling, URL/camera ownership; missing CI suites; geometry cache policy             | Reproductions become regressions and pass; CI assigns every browser case; artifact cache checks cover geometry                        |
| 2. Establish the release baseline | Build once; release manifest; lifecycle metrics for code-ready, decode, first useful scene, completion; route bytes/draw calls/memory measurements | Every browser job and deployment consumes identified bytes; measurements distinguish download, decode, construction, and render costs |
| 3. Prove runtime ownership        | One aircraft gets `createRuntime`, semantic commands, complete checkpoints, and a forked walk                                                      | Two instances run independently; reset/replay/lifecycle tests pass; no animation closure reaches its old global runtime               |
| 4. Prove model authoring          | Explicit IDs and the SR20 electrical installation slice, including diagram and flow bindings                                                       | Rename/order-independent identity; typed endpoints; independent redundancy/failure tests pass; fewer handwritten feed mappings        |
| 5. Compile and batch              | Runtime manifest and build-only geometry pipeline; pilot static batching and stable flow resources                                                 | Normal route excludes construction code; equivalence/visual tests pass; measured load and frame costs improve                         |
| 6. Scale and delete               | Migrate remaining aircraft/components, consolidate validated engine kernels, remove legacy singletons/registration paths                           | One state/lifecycle contract, no duplicate topology copies for migrated systems, per-route performance budgets hold                   |
| 7. Reassess framework             | Canonical static hosting and optional Next replacement experiment                                                                                  | Deep-link/metadata/404/loading behavior retained with demonstrated maintenance or runtime benefit                                     |

Stages 2, 3, and 4 can proceed in parallel after the immediate fixes and agreement on identity/runtime interfaces.
Artifact promotion and performance measurement must not block correctness work. Measurements do gate optimization
claims in Stage 5, which need not wait for every aircraft's physics migration. Compatibility is explicitly disposable:
migrate a vertical slice decisively and delete its old path, rather than keeping both architectures indefinitely.

For the runtime pilot, C172S offers electrical state, AFCS, moving assemblies, and a full walk without the SR22T's extra
CAPS/FIKI/loading complexity. Use SR20 electrical for the authoring pilot because its repeated feed definitions make
the benefit measurable. After each pilot, check a structurally different installation such as M20C before declaring
an abstraction fleet-wide.

## Verification record

- Dependency installation: `npm ci --ignore-scripts` completed from the committed lockfile.
- Targeted simulation and app-state harnesses: reproduced the results above, rerun by the parent audit.
- `npm run check`: passed formatting, typechecking, React Compiler validation (387 functions, zero failed files),
  4,365 unit tests in 232 files, 23 compiler-transformed React tests, and 99 trusted-preview controller tests.
- `npm run build`: passed the complete six-aircraft geometry bake and Next production build, generating 112 pages.
- `npm run test:deploy`: passed all 24 offline deployment tests.
- `npm run geometry:stats`: inspected the newly generated production assets. Geometry payloads range from 0.991 MiB
  gzip / 3.763 MiB decoded for DA40 to 2.335 MiB gzip / 10.342 MiB decoded for SR22T. SR22T has 405,013 baked triangles
  at this commit. These figures exclude browser-generated flow tubes, other scene resources, and runtime JavaScript.
- Logs: `/workspace/scratch/architecture-check.log`, `/workspace/scratch/architecture-build.log`, and
  `/workspace/scratch/architecture-deploy-tests.log`.
- Browser suites were not executed during this audit; their discovery and CI assignment were inspected. The normal
  production build was verified; a separate static-export build and live deployment verification were not performed.
- No application source or deployed infrastructure was changed. No remote messages, issues, or PRs were created.
