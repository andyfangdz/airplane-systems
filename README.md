# Airplane Systems

Interactive 3D study models of six airplanes' systems, built from **POH/AFM Section 7 – Airplane and Systems** (or, for the Mooney, the Owner's Manual's Part I): the Cirrus SR20 G6, the Cirrus SR22T G6 (turbocharged TSIO-550-K, TKS ice protection, built-in oxygen, guided preflight walk-around), the Cessna 172S NAV III (G1000 + GFC 700), the Cessna 182T NAV III (G1000 + KAP 140), the Diamond DA40 XLS (G1000 + GFC 700) and a 1968 Mooney M20C Ranger (N6947N: Johnson-bar gear, hand-pumped flaps, Brittain PC, steam gauges). Pick an airplane and a system to fly the camera to it, hover parts for notes, and operate switches, levers and failures. The systems are linked: pull an alternator and the buses, displays and alert window respond. Each airplane keeps its own switch positions when you switch to another, and the URL path (`/c172s/electrical`) names the view shown.

Built with **Next.js 16 (App Router)**, **React Three Fiber**, **drei** and **zustand**.

> Unofficial study aid. Always use the POH/AFM and supplements for your serial number.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run test:ui:fleet # airplane picker: desktop, phone, keyboard and switching (after build)
npm run test:ui:m20c # desktop and phone browser regressions (after build; also run in CI)
UI_BASE_URL=http://localhost:3000 npm run test:ui:sr20 # SR20 guided preflight, against a running server
npm run test:ui:depth # C172S, C182T, DA40 and M20C preflight browser checks (after build; also run in CI)
npm run test:ui:geometry # production asset loading, animation compatibility and procedural fallback for every airplane
npm run test:ui:doors # door/window controls move the rendered assemblies and return to their initial poses
npm run geometry:stats # triangle counts and download/buffer sizes from the current production assets
npm run check      # formatting, typecheck and tests (what CI runs, plus the build)
npm run format     # format everything with Prettier
npm run shot -- c172s/electrical   # screenshot a view (or an airplane, or "all") into .shots/
```

`npm install` also sets up a pre-commit hook that formats staged files. `npm run shot` needs Chromium for Playwright
(`npx playwright install chromium`); with `--compare <dir>` it reports which views changed against an earlier set.
`npm run test:ui:fleet` needs Chromium and WebKit (`npx playwright install chromium webkit`); it tests desktop input
and touch taps with Android and iPhone device profiles.

Browser regressions use **Playwright Test**. `npm run test:ui` runs all suites; the existing `test:ui:*` commands select
one suite. The runner starts and stops the production server after `npm run build`. Set `UI_BASE_URL` to test an
already-running server. Use standard runner options such as `-- --project=phone` or `-- --grep=c172s` to narrow a run.
The projects retain the fleet picker's Chromium/WebKit, viewport, theme and touch combinations; tests run one at a time
because software WebGL and camera timing need an uncontended renderer. Failures retain traces and screenshots under
`test-results/` (`npx playwright show-trace <trace.zip>`). The load and SR22T walk-around suites disable tracing to preserve their camera timing measurements.

Set `UI_SHOTS=<directory>` for walk-around screenshot output, `DOOR_SHOTS=1` for door screenshots, and
`UPDATE_LOAD_BASELINE=1` only when intentionally updating the reviewed load/geometry baseline. The load suite keeps its
existing camera and scene comparisons. `npm run test:ui:tour` checks tour positioning, keyboard navigation and persistence.
`npm run shot` keeps its view/options interface and now uses Playwright's server lifecycle and perceptual image matcher;
`--tolerance` still specifies the allowed percentage of differing pixels. Comparisons never overwrite reference images.
Keep captures and references outside `.shots/test-results/`, which the runner clears for its own artifacts.

### Production geometry

`npm run build` first runs `npm run geometry:build`. It evaluates all six source catalogues, losslessly indexes large
triangle meshes and encodes their attributes with **meshoptimizer's WebAssembly codec**. Hashed `.bin.gz` assets and
a manifest are generated in `public/geometry/` (ignored by git), then included in the Next.js build or static export.
No Rust toolchain is required. The codec does not simplify meshes or quantize coordinates; it preserves the source
geometry exactly and does not change simulation logic.

The browser downloads only the selected aircraft's asset. A short-lived worker decompresses and decodes it, transfers
the buffers, and primes the normal geometry cache. Missing, corrupt or unavailable assets fall back to the source
factories; development always uses those factories so geometry edits are immediate. Geometry mutated by animations
(`dynamicGeo`, including CAPS tear-out straps) stays procedural. Positions, materials and control animations remain live.
The encoder is build-only; the decoder runs in the worker. Old hashed assets are retained for open pages; clean
`public/geometry/` before a build when a deployment should include only its current assets.

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

Standalone **engine simulations** sit beside the airplanes at `/engines/<id>`, the Lycoming IO-390-C (215 hp, as in the SR20 G6) and the carbureted O-360-A1D (180 hp, as in the 1968 Mooney M20C). The model is calibrated to Lycoming's own performance and fuel-flow charts and cruise figures: throttle, propeller, mixture, carburetor heat and icing, magnetos with a held START position, altitude, temperature and airspeed, failures (magnetos, fouled plugs, blocked nozzles, intake leaks, fuel pump, air filter, starter), an engine monitor with per-cylinder EGT and CHT, limit flags from the engine manual, and a cylinder-pressure chart. The 3D engine is drawn part by part (crankshaft and counterweights, rods and pistons, camshaft and valve train, cylinders, magnetos and harness, fuel injection or the carburetor, induction and exhaust, lubrication, starter, alternator and governor); every part names itself on hover and each group can be hidden. See [engines/README.md](engines/README.md).

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
app/                  Next.js App Router entry (layout, page, icon, global CSS)
components/
  App.tsx             Shell: fleet picker, system rail, toolbar, alert window, HUD, tooltip, panel; URL and tab title
  Tour.tsx            Welcome tour shown on a first visit (skipping or finishing it is remembered; the toolbar's ? replays it)
  scene/              Shared React Three Fiber scene: Scene (canvas, camera flights, sim clock), Part / Shells,
                      ControlSurface, Flows, Links, Tanks, Screens, LightFX, WindowOutlines, PinDeclutter
  avionics/           GFC 700 and KAP 140 panel controls (keys, AFCS status strip, G1000 knobs)
  ui/controls.tsx     Seg, Slider, Check, Rocker, Readouts, Facts, HoldButton, …
  ui/wiring.tsx       Symbols for the live single-line electrical diagrams (breaker, switch, diode, bus box, key)
aircraft/             One folder per airplane, plus cessna/ (shared Cessna NAV III base) — see aircraft/README.md
engines/              Standalone engine simulations: EngineSpec per engine, shared model/ — see engines/README.md
components/engine/    The /engines/<id> page: 3D engine (scene/: one file per part group), engine monitor, controls, pressure chart
lib/
  view.ts             View state shared by every airplane (airplane, system, toggles, theme, camera); phone breakpoint
  fleet.ts            Airplane / system selection, remembered view, URL path
  systems.ts          Airplane ids, system ids, palette
  catalogue.ts        Declarative part catalogue: parts, shells, lofted control surfaces and the parts riding on them, label lists
  anims.ts            Part animations shared by every airplane (spark plugs, magnetos, brakes, glow, push-pull knobs)
  simStore.ts         createSimStore: one zustand store per airplane (discrete state + derived solution)
  avionics/           G1000 / Perspective+ display drawing, flight-state integrator, GFC 700 and KAP 140 logic (pure functions)
  geometry.ts, materials.ts, math.ts, registry.ts, canvas.ts
tests/                Vitest: fleet-wide invariants, electrical solvers, scenarios, GFC 700 and KAP 140 logic
vendor/               robust-in-sphere: package.json overrides cdt2d's exact in-circle test with an adaptive one
scripts/shot.mjs      Screenshots of any view (npm run shot), with a comparison mode
AGENTS.md             Working notes for coding agents (CLAUDE.md points to it)
```

### State model

- **View state** (which airplane and system, x-ray, labels, theme, camera requests, hover) is shared in `lib/view.ts`.
- **Discrete state** (switches, levers, selections) lives in each airplane's zustand store as an immutable `Sim` object. Every update recomputes that airplane's solution `E` (buses, powered loads, …) with a pure `solve` function that is easy to test.
- **Continuous values** (RPM, flap angle, flight state, autopilot state, CAPS time) live in each airplane's mutable `live` object advanced in `useFrame`, so animation doesn't re-render React. Panels read detached snapshots with `useLiveSnapshot(live, ms)`. Subscribers at the same rate share a timer, which stops when the last subscriber unmounts. Event handlers that need immediate feedback call `refreshLiveSnapshot(live)` after writing the source.

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
