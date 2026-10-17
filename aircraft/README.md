# Adding an airplane

Each airplane lives in `aircraft/<id>/` and exports one `AircraftDef` (see `types.ts`) from its `index.tsx`, which
spreads its light `AircraftMeta` from `meta.ts` (id, names, document, systems). The shell (`components/App.tsx`,
`components/scene/Scene.tsx`) knows nothing airplane-specific. `aircraft/sr20/` is the reference implementation.

Each airplane is its own route, `app/(fleet)/<id>/[[...sys]]/page.tsx`: the page imports that airplane's `index.tsx` and
renders the shell with it, so each airplane's code is its own route chunk, and switching airplanes is a navigation that
remounts the shell and its scene. Its static paths (`/<id>` and `/<id>/<system>`) and tab title come from the meta
(`app/(fleet)/airplane-route.ts`). In the shell, `useAircraft()` gives the route's definition and `aircraft(id)` in
`lib/fleet.ts` a registered one. `aircraft/fleet.json` defines membership, order, default aircraft and route features.
`npm run fleet:generate` produces the light metadata registry, picker labels, aircraft ID type, full authoring registry,
route files and CloudFront aircraft IDs. `aircraft/metas.ts` supplies the root page and static paths;
`aircraft/index.ts` imports every full definition for tests and scripts. No route may reach another airplane's code, and
the shell none (`tests/fleet-routes.test.ts` follows the imports).

The shell owns one aircraft route session. Its RAF driver advances the selected runtime before and independently of
canvas loading; the runtime integrates at 120 Hz. Changing systems keeps this session. Leaving the aircraft releases
its camera, registered parts and temporary study walk and stops advancing its retained base runtime. Hidden tabs pause
without accumulating time to replay on return.

To add one:

1. Add its entry to `aircraft/fleet.json` in picker order, with its walk and preload features. Add any new system IDs
   to `SysId` and their rail/part colours to `SYS_COLOR` in `lib/systems.ts`.
2. Create `aircraft/<id>/` with the files below: its meta in `meta.ts`, and its `AircraftDef` exported from `index.tsx`.
3. Run `npm run fleet:generate` and review the generated registries, routes and edge rewrite. Do not edit generated
   files directly. `npm run fleet:check`, included in `npm run check` and geometry compilation, rejects stale output.
   The fleet picker sizes itself to the number of airplanes.

## Files

- `systems.ts`: `SysDef[]` rail entries in POH/AFM Section 7 order: id, name, page, camera `[position, target]`, overview blurb, and `ref` when a system is described in another document (e.g. a supplement). A system's colour comes from `SYS_COLOR` in `lib/systems.ts`, by id.
- `geometry.ts`: Airframe shape: fuselage station table, wing/tail/fin functions, window outlines, painted skin.
- `parts/`: The parts catalogue, one file per system group. `catalogue.ts` creates `CAT = new Catalogue(id, labelLists?)` and the helpers the sections share; each section file (`engine.ts`, `fuel.ts`, …) registers its parts, shells and control surfaces; `index.ts` imports the sections in order and re-exports the anchor positions other files use. Parts and shells require an explicit `id`; repeated declarations also provide an `instance` key (equipment identity, side, station or named port). IDs do not depend on display text or registration counts. Existing numeric suffixes are frozen source tokens: never renumber them after inserting a declaration. Anonymous repeated hardware carries a frozen token beside its authored data row; keep that token with the row on insertion or reordering. Instance keys never use coordinates, dimensions, display text or runtime allocation counters. Generated physical member numbers, such as cylinder or propeller-blade number, remain valid keys. `CAT.assembly()` returns canonical ID order for compiler consumers, and duplicate identities fail at assembly. Registration order still decides which same-named pinned part carries its label, so preserve the import order in `index.ts`.
- `electrical-installation.ts` (SR20; SR22T display slice): Pure equipment, ports, connections and protection data with document/edition/applicability references. Quantities carry units and provenance; conflicting published values retain the alternatives and the model's decision. The SR20 solver, breaker panel, distribution diagram, meshes and power/data flows project this installation. The matched six display/standby feeds share `cirrus/display-feeds.ts` with SR22T, while each installation owns its sources and ratings. This is a validated topology and a few explicit power predicates, not a general circuit solver; the independent POH tests remain separate evidence.
- `rig.ts`: Flight-control linkage geometry and kinematics: stations, pulleys, cable runs, and the pose and surface deflections for given control inputs. The Cessnas build theirs with `cessnaRig()` from `aircraft/cessna/rig.ts`. Drawn by `ControlRig.tsx` (the SR20 and SR22T pass theirs to `cirrus/ControlRig.tsx`) or `Airplane.tsx`.
- `flows.ts`: Pipes, wires, ducts and cables (`FlowSpec[]`) and `flowRates(s, E)`. The SR20 and SR22T split theirs into
  `*-depth-flow.ts` section files, each exporting its `FlowSpec[]` and its rates; `flows.ts` concatenates them in a fixed
  order and merges the rates.
- `model.ts`: Sim state type, `initialSim`, the pure solver `solve(s, memory?) → E` (buses, powered loads), explicit
  electrical latch-memory type, alerts, breaker table, autopilot configuration (`AFCS_CFG`), and `initialLive`.
  The exported `live` root is the active UI facade; headless simulations receive their own live values.
- `simulation.ts`: `create<Aircraft>Simulation()` creates an independent runtime with its own state, live values, latch
  memory and clock. It defines typed scenario commands ("Start from" buttons), including their live-state changes.
  Commands, checkpoints, serialization, forks and disposal do not require the UI.
- `step.ts`: Simulation integration with an injected `{store, live}` context: engine, RPM, flap motor, timers, flight
  state and autopilot. Writes this runtime's live values; discrete changes go through its store. It must not read the
  module's presentation store or global live facade.
- `store.ts`: Binds the base runtime to the airplane's React store hook and stable live facade through
  `lib/simulationBinding.ts`; exports command adapters used by controls.
- `tick.ts`: Presentation adapter to the currently bound runtime for existing callers. Route definitions expose
  `advance` from the runtime binding, so all route-driven integration uses its fixed-step clock.
- `Airplane.tsx`: The scene: `<Shells>`, `<ControlSurfaces>`, `<Parts>`, moving groups, `<Tanks>`, `<Flows>`, `<Screens>`, `<LightFX>`, `<WindowOutlines>`.
- `ControlRig.tsx`: Optional: draws the moving flight-control linkage from `rig.ts`, when it is big enough for its own file (DA40, M20C; the SR20 and SR22T render `cirrus/ControlRig.tsx` with their catalogue, rig and store; the Cessnas draw their `rig.ts` linkage in `Airplane.tsx`).
- `Parachute.tsx` (SR20, SR22T): The airplane's optional `Overlay`: a scene-level effect that gets the model groups (CAPS deployment). Each binds `cirrus/Parachute.tsx` to its own harness geometry, store and `live` timeline.
- `displays.ts`: Canvas drawing for the cockpit displays. The G1000 airplanes call `lib/avionics/g1000/`; the SR20 and SR22T call it with `style: "perspective"` and draw their MD302 standby with `lib/avionics/md302.ts`.
- `walkaround.ts`, `walk.ts`, `walk-store.ts`: The preflight study walk. `walkaround.ts` holds the data (`FleetWalkData`:
  stations, items and wording from the POH/AFM, and the panel copy where the airplane's walk differs from the default);
  `walk.ts` builds its logic with `createFleetWalk` (ramp state, moving-group transforms) and `walk-store.ts` its session
  with `createFleetWalkStore` (runtime binding, and how a fork's live values reset and follow the steps). Opening the
  walk activates a fork; closing saves progress, restores the original runtime and disposes the fork. `index.tsx` gets the panel and scene marker
  from `fleetWalkUi(walkController)` (`components/FleetWalkaround.tsx`).
- `panels/*.tsx`: Side panel per system: lead paragraph, controls, readouts, facts and notes from the POH.
- `panels/distribution.tsx` (DA40): The electrical panel's live single-line power distribution diagram, drawn from the solution `E` with the symbols in `components/ui/wiring.tsx` (the Cirrus airplanes share theirs, `PowerDiagram` in `cirrus/distribution.tsx`; the Cessnas theirs, `Nav3Diagram` in `cessna/panels.tsx`).

## Shared code

- `components/scene/` draws what the airplane declares. Parts, shells and control surfaces cache their geometry per spec and
  share materials, so switching airplanes is cheap; everything else a component builds is disposed when the airplane is switched away.
- `lib/anims.ts` holds the part animations every airplane uses (spark plugs, magnetos, brakes, glow, push-pull knobs); each takes
  getters into the airplane's own store or `live` values. `Part` applies the live animation, then enforces focus, dimming and
  ghost materials so an animation cannot override the selected view's presentation.
- `lib/trimTab.ts` builds matching elevator cutouts and trailing-edge trim tabs. Its shared hinge also places moving tab
  horns and rod attachment points; span/chord and visual clearances remain approximate unless documented for the airplane.
- `components/ui/wiring.tsx` holds the symbols for the live electrical diagrams (breaker, switch or relay contact, diode, fuse, bus box, key),
  drawn on a vertical or horizontal wire, dead or live.
- `lib/avionics/` holds the G1000 / Perspective+ display drawing (`g1000/`), the MD302 standby (`md302.ts`), the flight-state integrator, and the GFC 700 and KAP 140 logic (pure functions;
  every GFC 700 function takes the airplane's config, built from `GFC700_BASE`). `components/avionics/` holds their panel controls.
- `aircraft/cessna/` is the Cessna NAV III base used by the C172S and C182T:

  | File                       | Role                                                                                                                                                |
  | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `airframe.ts`              | Station-table airframe builder (`IN`, stations → scene coordinates, wing, strut, painted skin)                                                      |
  | `rig.ts`                   | Figure 7-1 flight-control rig builder; `RigSpec` names the autopilot servos and an optional aft elevator bellcrank                                  |
  | `yoke.ts`                  | NAV III control wheel ("ram's horn") geometry and the anchors for the switches on the pilot's left horn                                             |
  | `electrical.ts`            | NAV III buses, breaker board model, solver, EIS colour rules, `NAV3_BUSES`                                                                          |
  | `annunciations.ts`         | Annunciation window and EIS gauges (each airplane passes its own `Nav3AnnDef[]` list)                                                               |
  | `panels.tsx`, `cessna.css` | MASTER / AVIONICS / STBY BATT switches, bus diagram, breaker board, meters, annunciation table                                                      |
  | `electrical-panel.tsx`     | Electrical and Lighting panel parts: ground power and 12 V outlet, battery readouts, failures and scenarios, trip buttons, LIGHTS switches, dimmers |
  | `engine.ts`                | Mixture model (`lambda`, `mixPower`) under each airplane's power and fuel-flow models                                                               |
  | `tick.ts`                  | Per-frame models (vacuum pump)                                                                                                                      |

- `aircraft/cirrus/` is the Cirrus G6 base used by the SR20 and SR22T. Each airplane keeps its own numbers, text and
  citations (from its own POH/AFM) and passes them, with its store and `live` values, as props or arguments:

  | File               | Role                                                                                                          |
  | ------------------ | ------------------------------------------------------------------------------------------------------------- |
  | `ControlRig.tsx`   | Moving flight-control linkage drawn from the airplane's `rig.ts` (Figures 7-1 – 7-3)                          |
  | `Parachute.tsx`    | CAPS deployment overlay and the HUD phases                                                                    |
  | `displays.ts`      | Perspective+ plumbing: fixed-cruise flight data, UTC clock, reversionary mode, PFD / MFD screens              |
  | `distribution.tsx` | Live Figure 7-10 power distribution diagram                                                                   |
  | `display-feeds.ts` | Matched redundant display/standby circuits; each installation supplies source references and rating overrides |
  | `panels.tsx`       | Bolster master switches with failures, scenarios and readouts; circuit-breaker bus card                       |
  | `flight-panel.tsx` | Yoke and pedal inputs, cable-run steps, FLAPS switch                                                          |

- `lib/engine-groups.ts` and `lib/engine-group-store.ts` hold the Engine-view study groups and the factory for each
  airplane's toggle store; `lib/surface-angles.ts` the cached control-surface angles for airplanes whose `live.eff` and
  `deflections` drive them (DA40, M20C); `lib/avionics/g1000/gauges.ts` the EIS band, alert and format helpers.

## Conventions

- **Axes:** x forward, y up, z toward the right wing. Units are metres; `pivotX` is the scene origin offset, and `groundY` is where the grid sits.
- **State:** `lib/view.ts` separates `selectedSys` (URL, rail and panel) from `sys` (scene filter), and tracks the current
  route owner. Study steps change the scene without navigating; selecting a system closes the walk. Pointer hover uses
  a separate store. Camera and part registrations capture the route owner and remove only that owner's registrations.
  Each runtime owns its switches, failures, live values, latch memory and clock; simulation steps and scenario commands
  use injected state. Mutable RPM, flap angles and timers stay outside React state. The base runtime survives switching
  airplanes; a walk modifies only its temporary fork. Each aircraft has one active React presentation binding: multiple
  headless runtimes are independent, but two independent React viewports of the same aircraft need separate bindings.
  Panels use `useLiveSnapshot(live, ms)` or `useLiveSelector` and pass sampled values to render calculations. One
  publisher per source coordinates their rates and retains unchanged snapshots. Direct live edits in event handlers
  call `refreshLiveSnapshot` when they need immediate feedback.
- **Parts:** A part's `parent` puts it on a moving group that `Airplane.tsx` renders and animates
  (e.g. `"surf:elevR"` is added automatically by `<ControlSurfaces>`). `anim(mesh, t)` runs every frame for live material and position changes.
- **SR22T engine groups:** An engine part or flow carries its Engine-view toggle groups as a `groups` option (`["oil"]`,
  `["induction", "exhaust"]`; `[]` is core). Only `ENGINE_GROUPS` ids type-check, and an unknown tag throws at registration.
  Untagged items fall back to the defaults in `engine-groups.ts`; the coverage test in `tests/sr22t-engine-groups.test.ts`
  fails on any engine item that resolves to neither.
- **Labels:** The first part with a given name and `pin: true` gets a label pin and a "tap to locate" entry (`CAT.pinned(sys)`).
  `pinIn` limits its label to some views. Where a view would pile labels up, the catalogue's label lists accept authored IDs or legacy display names:
  `quiet` (listed but not labelled in that view) and `narrow` (on the phone layout, only these are labelled). References that match no pinned
  part are reported in the development console. A screen's label follows its `sys`, or its `pin` option.
- **Accuracy:** Every number and claim in notes and panels comes from the POH/AFM for the club airplane's serial number.
  Cite figures and pages where helpful, and say so when sources differ or when the model is approximate.
  CAS and annunciation text must match the documents exactly.
- **File names:** no two paths may differ only in letter case (macOS and Windows checkouts would break).
