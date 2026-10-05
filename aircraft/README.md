# Adding an airplane

Each airplane lives in `aircraft/<id>/` and exports one `AircraftDef` (see `types.ts`) from its `index.tsx`.
`aircraft/index.ts` lists the fleet in picker order. The shell (`components/App.tsx`, `components/scene/Scene.tsx`)
knows nothing airplane-specific. `aircraft/sr20/` is the reference implementation.

## Files

| File | Role |
| --- | --- |
| `systems.ts` | `SysDef[]` rail entries: id, name, POH page, colour key, camera `[position, target]`, overview blurb |
| `geometry.ts` | Airframe shape: fuselage station table, wing/tail/fin functions, window outlines, painted skin |
| `parts.ts` | `CAT = new Catalogue(id)` plus every part, shell and control surface, and the exported anchor positions |
| `flows.ts` | Pipes, wires, ducts and cables (`FlowSpec[]`) and `flowRates(s, E)` |
| `model.ts` | Sim state type, `initialSim`, the pure solver `solve(s) → E` (buses, powered loads), alerts, breaker table, and `live` (per-frame values) |
| `store.ts` | `createSimStore(initialSim, solve)` |
| `tick.ts` | Per-frame step: engine, RPM, flap motor, timers. Writes `live`; discrete changes go through the store |
| `Model.tsx` | The scene: `<Shells>`, `<ControlSurfaces>`, `<Parts>`, moving groups, `<Tanks>`, `<Flows>`, `<Screens>`, `<LightFX>`, `<WindowOutlines>` |
| `panels/*.tsx` | Side panel per system: lead paragraph, controls, readouts, facts and notes from the POH |

## Conventions

- **Axes:** x forward, y up, z toward the right wing. Units are metres; `pivotX` is the scene origin offset, and `groundY` is where the grid sits.
- **State:** View state (which system is shown, x-ray, labels, channel focus, camera) is shared in `lib/view.ts`.
  Each airplane's switches, levers, failures and quantities live in its own store, so they survive switching airplanes.
  Values that change every frame (RPM, flap angle, timers) go in a mutable `live` object, not React state.
- **Parts:** The first part with a given name and `pin: true` gets a label pin and a "tap to locate" entry (`CAT.pinned(sys)`).
  A part's `parent` puts it on a moving group that `Model.tsx` renders and animates
  (e.g. `"surf:elevR"` is added automatically by `<ControlSurfaces>`). `anim(mesh, t)` runs every frame for live material and position changes.
- **Accuracy:** Every number and claim in notes and panels comes from the POH/AFM for the club airplane's serial number.
  Cite figures and pages where helpful, and say so when sources differ or when the model is approximate.
  CAS and annunciation text must match the documents exactly.
- **Shared avionics:** `lib/avionics/` holds the G1000 display drawing, the flight-state integrator, and GFC 700 and KAP 140 logic;
  `components/avionics/` holds their panel controls.
