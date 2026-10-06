# Adding an airplane

Each airplane lives in `aircraft/<id>/` and exports one `AircraftDef` (see `types.ts`) from its `index.tsx`.
The shell (`components/App.tsx`, `components/scene/Scene.tsx`) knows nothing airplane-specific. `aircraft/sr20/` is the reference implementation.

To add one:

1. Add its id to `AIRCRAFT_IDS` in `lib/systems.ts` (and any new system ids to `SysId`).
2. Create `aircraft/<id>/` with the files below and export its `AircraftDef` from `index.tsx`.
3. List it in `FLEET` in `aircraft/index.ts` (picker order). The fleet picker sizes itself to the number of airplanes.

## Files

| File | Role |
| --- | --- |
| `systems.ts` | `SysDef[]` rail entries in POH/AFM Section 7 order: id, name, page, colour key, camera `[position, target]`, overview blurb, and `ref` when a system is described in another document (e.g. a supplement) |
| `geometry.ts` | Airframe shape: fuselage station table, wing/tail/fin functions, window outlines, painted skin |
| `parts.ts` | `CAT = new Catalogue(id, labelLists?)` plus every part, shell and control surface, and the exported anchor positions |
| `flows.ts` | Pipes, wires, ducts and cables (`FlowSpec[]`) and `flowRates(s, E)` |
| `model.ts` | Sim state type, `initialSim`, the pure solver `solve(s) → E` (buses, powered loads), alerts and annunciation list, breaker table, autopilot configuration (`AFCS_CFG`), and `live` (per-frame values, with their initial values) |
| `store.ts` | `createSimStore(initialSim, solve)` and the scenarios ("Start from" buttons) |
| `tick.ts` | Per-frame step: engine, RPM, flap motor, timers, flight state and autopilot. Writes `live`; discrete changes go through the store. No side effects at import |
| `Airplane.tsx` | The scene: `<Shells>`, `<ControlSurfaces>`, `<Parts>`, moving groups, `<Tanks>`, `<Flows>`, `<Screens>`, `<LightFX>`, `<WindowOutlines>` |
| `ControlRig.tsx` | Optional: the moving flight-control linkage, when it is big enough for its own file (SR20, DA40; the Cessnas keep theirs in `Airplane.tsx`) |
| `displays.ts` | Canvas drawing for the cockpit displays (the G1000 airplanes call `lib/avionics/g1000.ts`) |
| `panels/*.tsx` | Side panel per system: lead paragraph, controls, readouts, facts and notes from the POH |

## Shared code

- `components/scene/` draws what the airplane declares. Parts, shells and control surfaces cache their geometry per spec and
  share materials, so switching airplanes is cheap; everything else a component builds is disposed when the airplane is switched away.
- `lib/avionics/` holds the G1000 display drawing, the flight-state integrator, and the GFC 700 and KAP 140 logic (pure functions;
  every GFC 700 function takes the airplane's config, built from `GFC700_BASE`). `components/avionics/` holds their panel controls.
- `aircraft/cessna/` is the Cessna NAV III base used by the C172S and C182T:

  | File | Role |
  | --- | --- |
  | `airframe.ts` | Station-table airframe builder (`IN`, stations → scene coordinates, wing, strut, painted skin) |
  | `rig.ts` | Figure 7-1 flight-control rig builder; `RigSpec` names the autopilot servos and an optional aft elevator bellcrank |
  | `electrical.ts` | NAV III buses, breaker board model, solver, EIS colour rules, `NAV3_BUSES` |
  | `annunciations.ts` | Annunciation window and EIS gauges (each airplane passes its own `Nav3AnnDef[]` list) |
  | `panels.tsx`, `cessna.css` | MASTER / AVIONICS / STBY BATT switches, bus diagram, breaker board, meters, annunciation table |
  | `anims.ts` | Part animations: glow, push-pull knobs, spark plugs, magnetos, brakes |
  | `tick.ts` | Per-frame models (vacuum pump) |

## Conventions

- **Axes:** x forward, y up, z toward the right wing. Units are metres; `pivotX` is the scene origin offset, and `groundY` is where the grid sits.
- **State:** View state (which system is shown, x-ray, labels, channel focus, camera) is shared in `lib/view.ts`.
  Each airplane's switches, levers, failures and quantities live in its own store, so they survive switching airplanes.
  Values that change every frame (RPM, flap angle, timers) go in a mutable `live` object, not React state.
- **Parts:** A part's `parent` puts it on a moving group that `Airplane.tsx` renders and animates
  (e.g. `"surf:elevR"` is added automatically by `<ControlSurfaces>`). `anim(mesh, t)` runs every frame for live material and position changes.
- **Labels:** The first part with a given name and `pin: true` gets a label pin and a "tap to locate" entry (`CAT.pinned(sys)`).
  `pinIn` limits its label to some views. Where a view would pile labels up, the catalogue's label lists take over by part name:
  `quiet` (listed but not labelled in that view) and `narrow` (on the phone layout, only these are labelled). Names that match no pinned
  part are reported in the development console. A screen's label follows its `sys`, or its `pin` option.
- **Accuracy:** Every number and claim in notes and panels comes from the POH/AFM for the club airplane's serial number.
  Cite figures and pages where helpful, and say so when sources differ or when the model is approximate.
  CAS and annunciation text must match the documents exactly.
- **File names:** no two paths may differ only in letter case (macOS and Windows checkouts would break).
