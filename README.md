# Airplane Systems

Interactive 3D study models of six airplanes' systems, built from **POH/AFM Section 7 – Airplane and Systems** (or, for the Mooney, the Owner's Manual's Part I): the Cirrus SR20 G6, the Cirrus SR22T G6 (turbocharged TSIO-550-K, TKS ice protection, built-in oxygen, guided preflight walk-around), the Cessna 172S NAV III (G1000 + GFC 700), the Cessna 182T NAV III (G1000 + KAP 140), the Diamond DA40 XLS (G1000 + GFC 700) and a 1968 Mooney M20C Ranger (N6947N: Johnson-bar gear, hand-pumped flaps, Brittain PC, steam gauges). Pick an airplane and a system to fly the camera to it, hover parts for notes, and operate switches, levers and failures. The systems are linked: pull an alternator and the buses, displays and alert window respond. Each airplane keeps its own switch positions when you switch to another, and the URL path (`/c172s/electrical`) names the view shown: each airplane is its own route, so a page ships only the airplane it shows.

Built with **Next.js 16 (App Router)**, **React Three Fiber**, **drei** and **zustand**.

> Unofficial study aid. Always use the POH/AFM and supplements for your serial number.

## Getting started

Use Node **24.22.1** (`.node-version`) and npm **11.19.1** (`packageManager` and `engines` in `package.json`).

```bash
npm ci
npm run dev        # http://localhost:3000
npm run build      # production build
npm run geometry:build # compile geometry without rebuilding the site
npm run build:site # build the site and verify its runtime dependency boundary, using compiled geometry
npm run fleet:generate # regenerate fleet registries/routes after changing aircraft/fleet.json or metadata
npm run test:ui:fleet # airplane picker: desktop, phone, keyboard and switching (after build)
npm run test:ui:m20c # desktop and phone browser regressions (after build; also run in CI)
UI_BASE_URL=http://localhost:3000 npm run test:ui:sr20 # SR20 guided preflight, against a running server
npm run test:ui:depth # C172S, C182T, DA40 and M20C preflight browser checks (after build; also run in CI)
npm run test:ui:geometry # production asset loading, animation compatibility and procedural fallback for every airplane
npm run test:ui:doors # door/window controls move the rendered assemblies and return to their initial poses
npm run geometry:stats # triangle counts and download/buffer sizes from the current production assets
npm run check      # formatting, typecheck and tests (what CI runs, plus the build)
npm run test:deploy # offline artifact/deployment regressions; no AWS credentials needed
npx playwright test scripts/test-aircraft-session-ui.mjs # route, walk resume and camera ownership (after build)
npm run format     # format everything with Prettier
npm run shot -- c172s/electrical   # screenshot a view (or an airplane, or "all") into .shots/
```

`npm ci` also sets up a pre-commit hook that formats staged files. `npm run shot` needs Chromium for Playwright
(`npx playwright install chromium`); with `--compare <dir>` it reports which views changed against an earlier set.
`npm run test:ui:fleet` needs Chromium and WebKit (`npx playwright install chromium webkit`); it tests desktop input
and touch taps with Android and iPhone device profiles.

Browser regressions use **Playwright Test**. `npm run test:ui` runs all suites; the existing `test:ui:*` commands select
one suite. The runner starts and stops the production server after `npm run build`. Set `UI_BASE_URL` to test an
already-running server. With `STATIC_EXPORT=1` (after `STATIC_EXPORT=1 npm run build`) it serves the static export in
`out/` instead, through the CloudFront view rewrite (`scripts/serve-export.mjs`); `scripts/test-static-export-ui.mjs`
switches airplanes there. Use standard runner options such as `-- --project=phone` or `-- --grep=c172s` to narrow a run.
The projects retain the fleet picker's Chromium/WebKit, viewport, theme and touch combinations; each worker runs one
test at a time because software WebGL and camera timing need an uncontended renderer. Failures retain traces and
screenshots under `test-results/` (`npx playwright show-trace <trace.zip>`). Camera timing suites disable tracing.

CI runs the complete check suite and offline deployment tests: four unit-test shards run alongside the other checks,
and the aggregate `check` job requires all of them to pass. Geometry is compiled once and each site target is built once.
The static build runs alongside twenty browser jobs as soon as the server artifact is ready. Geometry and each site's
build cache persist across runs; the geometry compiler still validates inputs before reusing cached assets.
Discovered browser cases are assigned by measured duration, including independent loading and camera regressions,
with one renderer per runner. New `test-*-ui.mjs` files join CI automatically with a conservative duration estimate;
`playwright.config.mjs` selects the suites that also run on phones. Each shard installs only its required browsers and
reuses cached browser binaries. Deployment promotes the tested static artifact with an independently recorded manifest
checksum; it does not rebuild application source.
See [CloudFront deployment](infra/cloudfront/README.md) for `--artifact` and `--manifest-sha256`.

Set `UI_SHOTS=<directory>` for walk-around screenshot output, `DOOR_SHOTS=1` for door screenshots, and
`UPDATE_LOAD_BASELINE=1` only when intentionally updating the reviewed load/geometry baseline. The load suite keeps its
existing camera and scene comparisons. `npm run test:ui:tour` checks tour positioning, keyboard navigation and persistence.
`npm run shot` keeps its view/options interface and now uses Playwright's server lifecycle and perceptual image matcher;
`--tolerance` still specifies the allowed percentage of differing pixels. Comparisons never overwrite reference images.
Keep captures and references outside `.shots/test-results/`, which the runner clears for its own artifacts.

### Production geometry

`npm run build` first runs `npm run geometry:build`. It compiles the six source catalogues into exact mesh buffers and
versioned scene manifests containing identities, transforms, bounds, notes, picking metadata and runtime binding IDs.
**meshoptimizer's WebAssembly codec** losslessly indexes and encodes the buffers; it does not simplify meshes or
quantize coordinates. Hashed `.bin.gz`, `.scene.json` and recovery-worker assets are written to `public/geometry/`.
The compiler caches each aircraft by its transitive source inputs, encoder/compiler version, lockfile and Node version,
so an unchanged definition skips construction and encoding. No Rust toolchain is required.

The browser downloads only the selected aircraft's buffers and scene manifest. A short-lived worker decodes the buffers;
when workers are unavailable, a demand-loaded decoder can run on the main thread. The runtime validates the complete
manifest and binds authored animation, equipment and material callbacks without serializing executable code.
Production compilation uses TypeScript's resolved Catalogue signatures to remove static geometry factories from route
code. Generated specializations in `.geometry-runtime/` are tied to exact source digests; stale compiler output fails
the site build. Before publishing assets, the compiler executes each specialized catalogue and checks its presentation,
runtime bindings and dynamic geometry bytes against the source. Expensive triangulation and polygon clipping belong to an independent authoring recovery bundle,
loaded in a worker only if the primary asset fails. If neither path can load, the route offers Retry.

Development and source tests retain the original factories. Geometry mutated by animations (`dynamicGeo`, including
CAPS tear-out straps), analytic placement helpers, materials and kinematic bindings remain live. The normal production
build also checks Turbopack's emitted module graph to ensure authoring dependencies do not enter client chunks.
The compiler prunes obsolete generated assets after publishing a complete graph; deployment retains old immutable
assets at the CDN for pages opened before a release. `build:site` verifies every source and compiler input against the
bake, including helpers eliminated from the runtime graph, and fails with a rebuild instruction when any input changes.

`tests/fleet-prebuilt-geometry.test.ts` checks every encoded attribute and index byte against the source and exercises
part animations on decoded meshes. The source factories and each aircraft's cited installation data remain the modeling
pipeline. Shared hardware detail in `lib/hardware.ts` adds enclosure seams, filter frames, actuators and mechanical
cable sheaths within explicitly selected aircraft-specific envelopes; it does not infer certified component dimensions.

Curved fuselage panels use a shared constrained triangulator (`cdt2d`, MIT) with interior seeds, loft-station splits,
analytic normals and adaptive curvature sampling. Its in-circle test comes from `vendor/robust-in-sphere`, an npm
override that answers with `robust-predicates`' adaptive test: the same exact signs, so the same triangles, about twice
as fast to bake. The SR22T's former dense triangle fans are replaced at the source,
so both production assets and procedural fallback benefit. Doors have actual skin apertures, moving glazing and
attached hardware. See [MODELING.md](MODELING.md) for measured costs, coverage, sources and remaining limitations.

## What's modelled

The SR20 is described below. The SR22T covers its own POH Section 7 the same way, adding the twin-turbocharged, intercooled TSIO-550-K, FIKI TKS ice protection (optional: clear it on the Overview panel to see the airplane without it), the built-in oxygen system, and a guided preflight walk-around (the toolbar's Preflight button). The Cessnas and the DA40 cover their own POH/AFM Section 7 the same way (see each airplane's rail), with a NAV III / DA40 electrical solver and its live power distribution diagram, live G1000 PFD/MFD textures and a working autopilot (GFC 700 or KAP 140) driving a simple flight-state model. The M20C has no glass: its panel is one live canvas of round mph gauges, and its systems are the manual Johnson-bar gear with its horn and lights, the hydraulic hand-pump flaps (stroke by stroke), the whole-tail pitch trim, the vacuum-powered Brittain Positive Control wing leveler (with cut-off button and roll trim), a carbureted O-360 with throttle-pump priming and carburetor ice, a single-bus 12 V alternator system with switch-breakers, and the vacuum system that feeds the gyros and PC.

Standalone **engine simulations** sit beside the airplanes at `/engines/<id>`: the Lycoming IO-390-C (215 hp, as in the SR20 G6), the carbureted O-360-A1D (180 hp, as in the 1968 Mooney M20C), and the twin-turbocharged Continental TSIO-550-K (315 hp, as in the SR22T). The models are calibrated to the manufacturers' performance and fuel-flow charts and the applicable airplane's cruise figures: throttle, propeller, mixture, carburetor heat and icing, magnetos with a held START position, altitude, temperature and airspeed, failures (magnetos, fouled plugs, blocked nozzles, intake leaks, fuel pump, air filter, starter), an engine monitor with per-cylinder EGT and CHT, limit flags from the engine manual, and a cylinder-pressure chart. The 3D engine is drawn part by part (crankshaft and counterweights, rods and pistons, camshaft and valve train, cylinders, magnetos and harness, fuel injection or the carburetor, induction and exhaust, lubrication, starter, alternator and governor); every part names itself on hover and each group can be hidden. See [engines/README.md](engines/README.md).

Standalone **component simulations** sit at `/components/<id>`: the Marvel-Schebler MA-4-5 float carburetor, cut away and fed by the running O-360 (float chamber and float valve, venturi and nozzle, idle system, accelerating pump, mixture valve, carburetor heat and ice); and the **propeller governor**: flyweights, speeder spring, pilot valve, gear pump and relief valve cut away on the IO-390, driving the SR20's Hartzell hub or a counterweighted one, after the FAA powerplant handbook's chapter 7 (see [engines/components/governor/SOURCES.md](engines/components/governor/SOURCES.md)).

| SR20 system          | Interactive                                                                                                                                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Flight controls      | Cable runs from POH Figs 7-1/7-2/7-3: torque tube, sectors, pulleys, push-pull tubes and bellcranks move with the yokes and pedals; per-channel focus (elevator / aileron / rudder); horn balances, trim tabs, static wicks |
| Wing flaps           | UP / 50% / 100% with position lights and VFE; needs the FLAPS breaker and NON ESS bus                                                                                                                                       |
| Gear & brakes        | Differential braking castering the nose wheel, parking brake                                                                                                                                                                |
| Engine & propeller   | Ignition key (magneto → plug mapping), power lever (governor schedule), mixture, alternate air                                                                                                                              |
| Fuel                 | Selector, boost pump, tank quantities (clipped fuel level), starvation                                                                                                                                                      |
| Electrical           | Master switches, failures, battery endurance, live power distribution diagram, **pullable circuit breakers**, G6 CAS names                                                                                                  |
| Lighting             | NAV / STROBE / LAND / ICE switches: wingtip nav, strobe, aft position and landing lights (no tail light, no cowl light), ice inspection lights; cabin and convenience lights                                                |
| Environmental        | OFF–0–1–2–3 fan knob, temperature blend, vent modes, A/C, recirculation                                                                                                                                                     |
| Pitot-static & stall | Pitot heat logic and annunciations, stall-warning suction peak and horn                                                                                                                                                     |
| Avionics             | Live Perspective+ PFD / MFD (shared Garmin renderer) and MD302 standby that go dark with their buses; DISPLAY BACKUP reversion                                                                                              |
| CAPS                 | Scrubbable deployment: rocket extraction, slider, snubbed riser, line cut, descent                                                                                                                                          |

## Project structure

```
app/                  Next.js App Router: layout, icon, global CSS; page.tsx (/) opens the last-viewed airplane
  (fleet)/<id>/       One route per airplane, [[...sys]]/page.tsx: /<id> and /<id>/<system>, importing only that
                      airplane (airplane-route.ts: static paths, title, 404s); layout.tsx keeps the tour across switches;
                      error.tsx says an airplane didn't load and offers Retry (the Loader does on a failed first load)
components/
  App.tsx             Shell for one airplane (its route passes the definition): fleet picker, system rail, toolbar,
                      alert window, HUD, tooltip, panel; owns its route session and simulation driver
  Loader.tsx          Loading overlay over the 3D view (build stage, part count; LoadFailed.tsx: didn't load + Retry)
  Tour.tsx            Welcome tour shown on a first visit (skipping or finishing it is remembered; the toolbar's ? replays it)
  FleetWalkaround.tsx Preflight study walk panel and scene markers shared by every airplane (walkaround.css)
  scene/              Shared React Three Fiber scene: Scene (canvas and owned camera flights), Part / Shells,
                      ControlSurface, Flows, Links, Tanks, Screens, LightFX, WindowOutlines, PinDeclutter
  avionics/           GFC 700 and KAP 140 panel controls (keys, AFCS status strip, G1000 knobs)
  ui/controls.tsx     Seg, Slider, Check, Rocker, Readouts, Facts, HoldButton, …
  ui/wiring.tsx       Symbols for the live single-line electrical diagrams (breaker, switch, diode, bus box, key)
aircraft/             One folder per airplane, plus cessna/ and cirrus/ shared models; fleet.json generates registries,
                      routes and CloudFront aircraft IDs from aircraft metadata — see aircraft/README.md
engines/              Standalone engine simulations: EngineSpec per engine, shared model/ — see engines/README.md
components/engine/    The /engines/<id> page: 3D engine (scene/: one file per part group), engine monitor, controls, pressure chart
lib/
  view.ts             Mounted route identity, navigation and scene selection, toggles, theme, camera; separate hover store
  aircraft-session.ts Route lifetime: clock lease, walk release and owned camera/part cleanup
  fleet.ts            The shown airplane (route context and registry), system selection, remembered view, URL path
  systems.ts          Airplane ids, system ids, palette
  catalogue.ts        Declarative part catalogue: parts, shells, lofted control surfaces and the parts riding on them, label lists
  anims.ts            Part animations shared by every airplane (spark plugs, magnetos, brakes, glow, push-pull knobs)
  simulation.ts       Independent runtimes: discrete state, live values, latch memory, commands, checkpoints and forks
  simulationClock.ts  Fixed-step clock owned by each runtime; useSimulationLoop.ts drives the mounted route
  simulationBinding.ts One active presentation facade per airplane, binding its store and live root to a runtime
  live-observation.ts Shared snapshot publisher per live source; useLiveSnapshot.ts supplies React hooks and selectors
  simStore.ts         Shared discrete store contract (state + derived solution)
  fleet-walk.ts       Preflight study walk: data types and pure logic (steps, part locations, camera framing, progress)
  fleet-walk-store.ts Preflight study walk: temporary runtime fork, view projection, saved progress, ?walk=N deep links
  avionics/           G1000 / Perspective+ display drawing, flight-state integrator, GFC 700 and KAP 140 logic (pure functions)
  geometry.ts, materials.ts, math.ts, registry.ts, canvas.ts
tests/                Vitest: fleet-wide invariants, electrical solvers, scenarios, GFC 700 and KAP 140 logic
vendor/               robust-in-sphere: package.json overrides cdt2d's exact in-circle test with an adaptive one
scripts/shot.mjs      Screenshots of any view (npm run shot), with a comparison mode
AGENTS.md             Working notes for coding agents (CLAUDE.md points to it)
```

### State model

- **Route session.** A mounted aircraft owns the simulation driver and its camera, registered scene parts, focus and
  temporary walk. Selecting a system keeps that session; leaving for another aircraft, engine or component releases
  it. Base runtimes retain their switch positions and pause while their routes are absent. Hidden tabs also pause.
  Simulation advances independently of WebGL loading and rendering.
- **Navigation and presentation.** `lib/view.ts` keeps the selected system used by the URL, rail and panel separately
  from the scene filter used by study steps. Walk highlighting cannot navigate. Hover has its own store so pointer
  movement does not publish scene-policy changes. Camera registrations and delayed framing belong to the route owner.
- **Simulation runtime.** Each `aircraft/<id>/simulation.ts` factory creates independent state, mutable live values,
  explicit latch memory and a fixed 120 Hz clock. Discrete updates clone `Sim`, recompute the derived solution `E` and
  batch notifications for a simulation transaction. Steps mutate live values without cloning the whole runtime.
  Commands, checkpoint/restore, serialization, forks and disposal work without mounting React or a canvas.
- **Study walk.** Opening a walk activates a fork of the aircraft runtime. Its ramp state, commands, timers and animated
  values belong to the fork; the original runtime stays untouched. Closing or leaving the route saves progress,
  releases and disposes the fork, and restores the original runtime and owned view. Returning offers to resume.
- **React presentation.** `lib/simulationBinding.ts` supplies one active store and stable mutable `live` facade per
  aircraft to existing controls and animation callbacks. Independent headless runtimes can run together; simultaneous
  independent React views of the same aircraft would need separate presentation bindings. Panels render detached
  snapshots with `useLiveSnapshot(live, ms)` or selections with `useLiveSelector`. One publisher per source serves all
  sampling rates, preserves unchanged branches and stops its timer when no subscribers remain. Event handlers call
  `refreshLiveSnapshot(live)` when a direct live edit needs immediate feedback.

### React Compiler

React Compiler is enabled for the whole app. Render calculations must take their changing inputs explicitly: use a
sampled snapshot for live simulation values, and pass that snapshot to helpers instead of relying on hidden reads of
`live`. Event handlers and frame callbacks continue to read and write the original simulation. Aircraft alert windows
are components with static hook bindings; catalogue visibility and progressive part batches publish immutable snapshots.
When adding an optional part or study filter, register its state selector with `CAT.trackVisibility`.

`npm run check:compiler` rejects compiler failures and opt-outs across the app. `npm run test:react` runs DOM regressions
against compiler-transformed components, including live readouts, alerts, optional equipment, and progressive loading.
Both run in `npm run check`.

How to add an airplane, and where each kind of code goes: [aircraft/README.md](aircraft/README.md).

## Sources

SR20 (each other airplane cites its POH/AFM, supplements and CRG in its files and panels):

The SR20 G6 component expansion, optional ADAHRS interactions and 86-item guided preflight are documented in
[SR20 sources and applicability](aircraft/sr20/SOURCES.md). It records the inspected POH Revision A1 pages, SR20 AMM
12137-002, Lycoming installation/maintenance/parts manuals, Garmin guide and COPA discussions, with exact source
locations, configuration boundaries and document disagreements. The early G6 Lycoming model does not reuse older
Continental SR20 or SR22T engine systems.

The other fleet expansions have separate applicability and source records:

- [C172S](aircraft/c172s/SOURCES.md): NAV III with IO-360-L2A and GFC 700, including fuel return, standby-battery distribution, pneumatic stall warning and vacuum standby attitude.
- [C182T](aircraft/c182t/SOURCES.md): naturally aspirated NAV III with IO-540, McCauley constant-speed propeller and KAP 140; its autopilot connections and propeller oil behavior differ from the C172S.
- [DA40 XLS](aircraft/da40/SOURCES.md): avgas IO-360, G1000 and GFC 700; aluminum fuel chambers, rotary alternate air, control rods and pressure-line traps follow the applicable installation.
- [M20C Ranger](aircraft/m20c/SOURCES.md): the 1968 manual-gear configuration, hydraulic flaps, whole-tail trim and Brittain Positive Control. The selected alternator installation is distinguished from the generator variant; the geometry reference does not establish the aircraft's current equipment records.

Each includes a source-specific guided preflight study walk with separate saved progress and restoration of the prior
model state. Component shapes and routing are schematic; the source records identify the inspected editions and
configuration disagreements. Internal meshes and curved tube walls are checked against the modeled airframe skins;
named exterior-port transitions are checked separately.

- Cirrus SR20 POH, P/N 11934-005 Reissue A — Section 7 (systems), Section 1 Figure 1-1 (three view, used for the fuselage profile), Section 2 limits and markings, Sections 3 and 3A (CAS message names, best glide), the Section 4 speeds used on the PFD, and the Section 5 cruise table (percent power).
- Garmin Cirrus Perspective+ Pilot's Guide 190-02183-03 and the Cirrus Perspective+ brochure — display layout and bezels.
- Mid-Continent MD302 Standby Attitude Module Pilot's Guide and Installation Manual — the standby instrument.
- Side photos of SR20 G6 OO-CBB (s/n 2347), Wikimedia Commons — tailcone, fin and window outlines.
- M20C: the 1965 Mark 21 (M20C) Owner's Manual with its 1962–64 supplement, the M20C Ranger Operator's Manual (Dec 1974), the 1963 FAA Approved Flight Manual for s/n 2394, FAA TCDS 2A3 (limits, control travels, stations, equipment), the 1968 Ranger manual's dimensioned three-view, Lycoming and Hartzell manuals and ADs, Mooney's serial chronology and type-club material (marked where used). N6947N is registered as a 1968 M20C, s/n 680194.
- Costanzo Air Flight School, _Cirrus SR20 Systems_ deck — electrical readouts, battery-endurance rule of thumb, and photo detail (horn balances, static wicks, OAT probes, ECS knob). Where it differs from the POH, the POH wins and the page says so.

Geometry is approximate. CAS and annunciation text follow the documents; the conditions that trigger them are simplified.

## License

The code is under the [MIT License](LICENSE). It doesn't cover the POH/AFM documents, Garmin pilot's guides or photos listed under Sources; those belong to their owners.
