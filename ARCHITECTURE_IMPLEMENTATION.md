# Architecture implementation

This implements the audit of `bcdece1aba69597cbd79239c9835d5edd5ee15b1`. The original findings and priorities remain in
[ARCHITECTURE_AUDIT.md](ARCHITECTURE_AUDIT.md); this document describes the resulting contracts and deliberate limits.

## Runtime ownership and time

All six aircraft have independently constructible, headless simulation instances. Each owns its discrete controls,
continuous state, explicit electrical memory, fixed-step clock, and subscriptions. Commands, checkpoints, restore,
serialization, forks, and disposal share one contract. A transaction publishes its final discrete solution once;
substeps can still read intermediate solutions. JSON serialization preserves unbounded timer values.

The presentation binding selects one runtime per mounted aircraft presentation. Existing animation functions read a
stable `live` root; activation transfers its nested values to that root and detaches the previous runtime. Headless
instances are independent, but two simultaneous React presentations of the same aircraft are not supported by this
binding. That would require passing bindings through every scene callback.

A preflight walk runs in a fork. Closing it releases and disposes that fork, without recursively restoring the user's
original state. A route session owns the walk, camera, part registry, hover, and focus timer. Owner tokens prevent late
cleanup from a previous route affecting the next one. Navigation selection and temporary walk highlighting are
separate; choosing a system closes the walk and selects the corresponding URL.
Geometry-dependent walk markers, minimap projections, and item framing wait for the exact mounted scene to become
ready. Begin, Resume, and checklist navigation remain usable while assets load. Deferred framing yields to camera
gestures or newer requests, and stale scene completions cannot unlock a replacement session.

Simulation advancement belongs to the route rather than the Canvas. Fleet and component runtimes use fixed-step
clocks with explicit bounded catch-up. Hidden documents pause the RAF driver and resume from a new wall-time origin.
Standalone engines have the same ownership operations, and shared workers route requests and cancellation by owner.
The C182 propeller exercise is now a simulation timer, so checkpoints and forks preserve it.

Mixture boundaries explicitly distinguish fuel equivalence ratio, φ (rich > 1), from excess-air ratio, λ (lean > 1).
Conversions preserve the existing calibrated curves. Installed aircraft engine approximations retain their cited
control schedules and failure behavior: replacing them with standalone-engine defaults would change the model, and
requires installation-specific calibration evidence. Shared timing and composition do not imply identical physics.

## Authoring, identity, and production assets

Catalogue parts and shells require authored IDs. Repeated declarations supply explicit instance keys; display wording
and global registration order no longer generate asset identity. Existing surface and flow keys remain explicit.
Duplicate identities fail during catalogue construction. Equipment IDs and connection IDs link the migrated electrical
installation to parts, flows, diagrams, and instructional references.

The SR20 electrical installation describes typed sources, buses, breakers, loads, directed connections, applicability,
and source references. Solver availability, breaker rows, redundant display feeds, and diagram groups consume this
definition. The shared Cirrus feed family retains installation-specific values and behavior. It is a constrained
electrical topology, not a generic physical-network solver; unrelated systems retain their existing source-backed
algorithms.

The geometry compiler resolves Catalogue calls through TypeScript symbols, replaces static construction factories in
production inputs, and retains genuinely dynamic geometry. It emits lossless mesh assets and a scene manifest containing
identity, bounds, transforms, labels, and runtime binding identifiers. Runtime binding validates the full manifest before
applying metadata. Heavy procedural construction is bundled separately into an on-demand recovery worker. A production
build checks its actual emitted module graph for forbidden authoring/triangulation dependencies.

Compilation is cached by transitive source inputs, compiler/encoder inputs, and toolchain. Production builds reject
missing or stale compiler output. Recovery and normal loading preserve the original geometry; inability to load both
paths produces a route error with Retry. The source factories remain available for development and authoring tests.
Normal worker loading, main-thread downloads/stream reads/decoder loading, and scene-manifest downloads have bounded
deadlines. Stalled requests are aborted; recovery has its own deadline, and failed recovery clears the pending entry
so Retry can make a fresh attempt. These deadlines cannot preempt synchronous main-thread Wasm execution.

One lightweight `aircraft/fleet.json` registration generates the ID tuple, metadata registry, authoring registry,
picker labels, individual route imports, and edge routing IDs. Picker labels are compiled from aircraft metadata;
browser routes continue importing only their own aircraft. `npm run fleet:check` rejects drift, and
`npm run fleet:generate` refreshes generated outputs. CloudFront behavior is authored once in its template and generated
into both the standalone function and the infrastructure template.

## Rendering and observations

Static parts update appearance on policy changes. One animation scope advances actual animated parts and temporary
build glow, replacing a frame subscription per mesh. Hover uses a separate store. Flow resources persist through
filtering; particles share one batch with per-vertex colors and sizes, and conservative whole-curve bounds prevent stale
frustum culling. Particle streams sort by camera depth within an explicit overlay layer below X-ray skins. Individually
pickable tube meshes remain separate.

Screens skip redraw work when hidden or facing away. Label layout invalidates on relevant camera, view, and DOM
changes. Low-rate React observations share one scheduler per source, structurally reuse unchanged branches, and notify
only on changes. Due channels publish atomically before any listener runs. Selectors can subscribe to a stable branch;
animation reads the live runtime directly.

Static mesh merging, shader-driven particle motion, a persistent fleet Canvas, demand rendering, and assembly streaming
remain conditional optimizations. Their additional picking, transparency, wake-up, and residency contracts are not
justified by subscription counts alone. Geometry caches currently preserve warm revisits; no new automatic eviction
policy or claim of bounded fleet memory is introduced.

## Tests and delivery

New unit suites are isolated by default. A reviewed, explicit allowlist shares immutable geometry fixtures; test
source text no longer decides isolation. Existing POH/AFM assertions remain independent of installation-derived output.
New regressions cover runtime independence, replay, clock cadence, resets, worker cancellation, route/session ownership,
resource lifetime, snapshots, installation validation, compiler specialization, and asset recovery.

CI discovers all browser suites and shards them across six jobs with one software renderer per job. It compiles
geometry once, builds each host mode once, and shares those artifacts with browser jobs. Offline deployment tests run
in normal CI. Static releases record source commit/tree, lock digest, toolchain, complete file checksums, and delivery
policies. Promotion verifies an independently supplied manifest checksum and uploads the tested bytes without rebuilding.
Immutable release prefixes and a conditional CloudFront origin switch provide an activation boundary and rollback;
hashed JS, geometry, scene manifests, and recovery chunks use immutable caching. Old releases are retained rather than
deleted by an unproven garbage collector.

Node and npm are pinned. Fonts are vendored with licenses and a source/checksum inventory; builds no longer fetch them
from Google. The original and local font CSS produced identical pixels in a fixture covering the used weights and
supported script subsets.

Next remains the route and static-export compiler. Its replacement was conditional in the audit; a second framework
would add a new migration without resolving further demonstrated model-ownership defects. Both Next-server and static
host behavior remain tested, and the static artifact is the AWS promotion contract.

## Validation and measurements

The starting revision is `bcdece1aba69597cbd79239c9835d5edd5ee15b1`. Validation uses pinned Node 22.23.3 and npm 10.9.9.

`npm run check` passes: formatting, generated fleet freshness, TypeScript, 387 compiled React functions, 4,496 unit
tests across 251 files, 34 compiled React tests, and 99 trusted-preview tests. The mesh-clearance suite retains its
geometric assertions with a 30-second budget for its 66 BVH comparisons, replacing a five-second timeout hit under
concurrent validation load.

- An independent source comparison found identical attribute/index bytes, groups, transforms, hierarchy, pivots, and
  animation metadata for all 4,341 geometries. All 5,872 numerical scene expectations were preserved during ID migration.
- Fleet identity maps match exactly across Node 22.23.3 and Node 24.19.0. Scene snapshots pass on the pinned runtime.
- Compilation validates all six specialized catalogues against their authored registrations and compares all 35 dynamic
  geometries byte for byte. The production build passes; its 12 emitted route graphs contain no forbidden authoring,
  triangulation, polygon clipping, or encoder modules.
- A separate runtime stress harness passed 1,200 switch transitions, each checking fork state, replay determinism, and
  checkpoint serialization. Offline deployment tests pass all 29 cases.

The browser's SR22T baseline had missed PR101's already-merged wastegate controller, hose, and flow changes. Its two
SR22T entries are refreshed from an independent browser capture of unchanged starting main `bcdece1`. The refactored
normal and worker-refusal paths match that capture. Comparing the seven affected objects accounts for every numerical
delta within the existing tolerances; reversing their six changed geometry keys reconstructs the old multiset hash
exactly. Camera, skin, object-count, and animation-count expectations remain unchanged. Scene and camera comparisons
now run as soon as their captures complete, before the longer interaction checks.

Production measurements at a 1440×900 viewport, using `scripts/measure-rendering.mjs`:

| View            | Frame subscribers, before → after | Draw calls, before → after | Particle objects, before → after |
| --------------- | --------------------------------: | -------------------------: | -------------------------------: |
| SR22T engine    |                        1,295 → 81 |              1,151 → 1,115 |                          145 → 1 |
| C172S engine    |                          602 → 34 |                  704 → 648 |                          174 → 1 |
| SR20 electrical |                          838 → 39 |                1,005 → 984 |                          227 → 1 |

Triangle, particle, and mesh counts match in all three views, with no browser runtime errors. Subscriber counts fall
by 93.7–95.3%; draw reductions match the previously active particle streams combining into one draw.

The page-observed compressed transfer grows from 936,768 to 1,034,383 bytes for SR22T, 889,871 to 922,464 for C172S,
and 886,699 to 947,177 for SR20. The new validated scene manifests add 116,169, 51,104, and 74,720 bytes respectively;
this iteration establishes the authoring boundary and reduces render dispatch, but does not claim lower total transfer.
Page resource timings exclude geometry downloaded inside workers. Further size work should remove duplication between
registration metadata and scene manifests before introducing assembly streaming.

Software-renderer timings are diagnostic: these runs shared the host with validation work and are not comparable
device-performance measurements.

Six before/after screenshots were inspected: SR22T electrical and engine, C172S engine and overview, SR20 electrical,
and SR22T solid overview. Static geometry, labels, controls, transparency, and painted exterior remain consistent.
Four comparisons pass the 0.5% pixel threshold. The two running-engine views exceed it (50,893 and 11,031 pixels),
with differences dominated by propeller phase and smaller ignition/particle changes. No screenshot baseline was replaced
to hide those differences, and no application runtime errors occurred.

All six desktop/phone route-session regressions pass against the production server. The static export passes nine
browser cases: all six aircraft load both baked and recovery geometry (including delayed SR22T decoding), navigation
switches and returns correctly, stalled scene-manifest downloads reach recovery, and immutable asset policies match
the sealed release. Its 697 files verify against an independently retained manifest digest. These local checks exercise
a working-tree artifact; CI seals a clean commit
for promotion.

WebKit fleet interaction tests also pass at 390×844 in light mode and 320×640 in dark mode, covering touch, keyboard,
picker dismissal, walk persistence, camera preservation, and compact layout; both screenshots were inspected.
