# Engines

Standalone engine simulations, separate from the airplanes: `/engines/<id>` (for example `/engines/io390`).

```
engines/
  types.ts        EngineSpec: everything one engine needs, with the document and page for each published number
  index.ts        ENGINES registry (picker order), ENGINE_IDS, engineById
  model/          The physics, shared by every engine (pure functions of a spec and a mutable EngineState)
    engine.ts     step(): controls, environment and failures in, the engine state advanced by dt
    atmosphere.ts ISA and unit constants
    performance.ts  The manufacturer's power chart (the reference the model is calibrated to), friction, pumping
    induction.ts  Throttle as a compressible orifice, manifold pressure, volumetric efficiency from the chart
    fuel.ts       Servo and Continental continuous-flow metering, nozzles, per-cylinder distribution (injected engines)
    carburetor.ts Float carburetor: venturi and idle metering, mixture-chamber cooling, carburetor ice
    accelerator-pump.ts Spring-driven pump discharge and slow-stroke bypass, shared with the carburetor cutaway
    mixture.ts    Power, EGT and head heat against excess-air ratio λ
    propeller.ts  Fixed-pitch load, constant-speed propeller and governor
    turbo.ts      Turbochargers, wastegate and controller, intercoolers, relief valve, TIT, turbo-system failures
    cycle.ts      Crank kinematics, valve events, firing order, the cylinder-pressure trace
    trim.ts       settle(): hold a manifold pressure, rpm or λ while the engine runs (pages and tests)
    scenarios.ts  "Start from" setups for the page
    alerts.ts     Limit flags from the spec's limits, or from its POH markings with the POH's CAS names
    tit.ts        Turbocharged engine TIT peak from the model's cylinder work and probe laws
  io390/          Lycoming IO-390-C: spec.ts and SOURCES.md (what was read from where, and what is assumed)
  io360/          Shared IO-360 geometry, calibration and part descriptions
  io360-l2a/      C172S NAV III, fixed-pitch McCauley, automatic alternate air
  io360-m1a/      DA40 XLS, constant-speed MT, rotary alternate air and Power Flow exhaust
  o360/           Lycoming O-360-A1D (float carburetor): spec.ts and SOURCES.md
  tsio550k/       Continental TSIO-550-K (turbocharged, the Cirrus SR22T's): spec.ts, its own Start-from setups
                  (scenarios.ts) and SOURCES.md
components/engine/  The page: store (zustand UI + per-frame loop, sim.ts), ComponentStage (canvas), 3D scene (scene/: dims, materials and builders in kit.ts, one file per part group), monitor, panel, pressure chart
app/engines/[engine]/page.tsx  One static page per engine id
```

## Component simulations

On the SR20 G6’s IO-390 and both IO-360 pages, **Blow up** moves the intact part groups apart. Tap a mesh to inspect its part. Double-tap or double-click to focus its group from the installed engine or the overview. Group labels and **Focus a part group** also open a group. **Blow up group** separates its parts, and **Assemble group** brings them back together. In **Accessory drives** or **Ignition**, double-tap a device or choose **Focus a component** to isolate it. **Blow up component** separates its internals. The back button restores the parent group to its previous state. In the ignition group, the camera orbits the two magnetos. Zoom out to follow the full spark-plug harness. **Part groups** returns to the overview, where **Assemble engine** closes the view. These transitions also work while the simulation is paused and respect reduced motion. Select individual mounting screws, nuts, washers and accessory internals in the scene or in **Inspect a part**. The index accepts part names and catalog part numbers. Each engine documents its installed hardware and geometric assumptions. [IO-390](io390/SOURCES.md) · [C172S IO-360-L2A](io360-l2a/SOURCES.md) · [DA40 XLS IO-360-M1A](io360-m1a/SOURCES.md)

From a cylinder, **Show with crankshaft** puts the cylinder and shafts in their installed positions. From **Crankshaft and camshaft**, **Pair with cylinder…** lets you choose the cylinder. The cutaway follows engine motion. Use **Turn crank** to move through the four strokes by hand, including when paused or stopped. **Follow engine** resumes the live pose.

On a narrow screen, **Controls** opens the study, view and playback settings. The active assembly action or crank slider stays beside the model. Tap **Engine monitor** to fold or reopen the instruments. The engine pages remember this choice, and limit flags stay visible.

The piston-cylinder cutaway (`/components/piston-cylinder`) follows one IO-390 cylinder through all four strokes.
It shares the engine's slider-crank and valve-lift functions, with slow playback, pause, angle scrubbing and stroke
selection, dual spark plugs, CHT/EGT response, mixture and ignition controls, and plug-fouling, stuck-valve, detonation, pre-ignition and intake-backfire scenarios.
The driven cylinder bench shares the engine mixture and thermal relationships; its sources and illustrative assumptions are in
`engines/components/piston-cylinder/SOURCES.md`.

The pitot-static system (`/components/pitot-static`) is an airframe system rather than an engine accessory: the
Cessna 172S's pitot head, static port, sump, ALT STATIC AIR selector and instruments (the six-pack, or the G1000's air
data computer, PFD and standby instruments) as lumped air volumes (the pitot side, the static side and the six-pack
VSI's case) joined by restrictions to the pressures around the airplane. The static
port and the cabin read the POH's Figure 5-1 airspeed calibration for the normal and alternate sources; blockages, ice,
water, leaks, a broken VSI glass, sideslip, altimeter setting and temperature errors and the ramp leak test follow the
FAA handbooks. Its "Try" set-ups are pure data (`scenarios.ts`) so tests check each shows what its note says; its
sources and assumptions are in `engines/components/pitot-static/SOURCES.md`.

Single engine accessories on their own, at `/components/<id>`: the registry is `engines/components/index.ts` (picker
order), each component's model and `SOURCES.md` sit in `engines/components/<id>/`, and its page in
`components/engine/<id>/`, listed in `components/engine/ComponentPage.tsx`. A page wraps its scene and panel in
`ComponentShell` (picker, toolbar with the theme switch, the engine page's layout) and builds on what the engine page
uses too: `ComponentStage` (canvas, lights, orbit controls and hover tip; the page gives the camera and target),
`useSimLoop` and `createViewStore` (`components/engine/sim.ts`), `ViewToggles` (`chrome.tsx`) and `f0`
(`lib/format.ts`). Adding one: an entry in `COMPONENTS`, one in `ComponentPage`'s `PAGES` (typed by `ComponentId`, so
the two can't drift), then run `npm run fleet:generate` to write `infra/cloudfront/view-rewrite.js` and its
CloudFormation copy in `infra/aws/site.json`. `npm run fleet:check` catches stale copies.

## Adding an engine

1. Make `engines/<id>/spec.ts` exporting an `EngineSpec`, and a `SOURCES.md` beside it. Published numbers cite the
   document and page; chart values say how they were read. Put anything the documents don't give in `calibration` (or
   the marked propeller fields) and say so.
2. Add it to `ENGINES` in `engines/index.ts`, then run `npm run fleet:generate` to write
   `infra/cloudfront/view-rewrite.js` and its CloudFormation copy in `infra/aws/site.json`.
   `npm run fleet:check` catches stale copies.
3. Calibrate against the manufacturer's numbers, then write tests named after them in `tests/` (see
   `tests/io390-engine.test.ts`, `tests/o360-engine.test.ts`): rated power at full throttle, cruise fuel flows, idle,
   magneto drop, limits in a climb.
4. Check the page with a browser at desktop and phone widths.

The model reads the spec only, so a new engine of a kind already modelled (air-cooled, injected or float-carbureted,
constant-speed propeller) needs no model changes: `fuelSystem.kind` picks the injector or the carburetor, and
`fuelFlow.kind` takes either a fuel-flow chart or, when the manual has none, a specific consumption from a cruise point.
Turbocharged engines use the spec's `turbo` fields for the compressors, intercoolers, wastegate and TIT probes. A new
engine kind needs its pieces added to `model/` behind a spec field, keeping the existing engines' behaviour (their tests
guard it).

The 3D scene is shared and its part notes cite the IO-390's manual; an engine's `parts` replaces a part's name and note
with its own manual's words (keyed by the default name, numbers written `#`), and `modelNotes` is its "How the model
works" text.

## Conventions

- The page reads per-frame values through `useLiveSnapshot(sim.s, ms)`; the scene reads `sim.s` in `useFrame`.
- The zustand hook on `EngineSim` is `useUi`. Don't name a hook property plain `use`: React Compiler treats
  `x.use(...)` as React's conditional `use()` and memoizes around it, which breaks the hook order.
- Temperatures can run faster than real time (`thermal`); the shaft, governor and fuel always run at real time.

## Runtime ownership and composition

`createEngineSimulation(spec)` in `components/engine/store.ts` creates an independent engine session. It owns the
mutable engine state, controls, failures, animation angle and a fixed 120 Hz clock. `simFor(spec, key)` retains those
sessions for routes; it is a cache, not the physics API. `advance(elapsed)` consumes elapsed time on the owned clock,
with at most half a second of catch-up per frame. Pausing preserves the remainder. `checkpoint()` / `restore()` and
`fork()` copy at explicit boundaries; `serialize()` / `restoreSerialized()` also preserve infinite mixture ratios.
`dispose()` cancels this session's scenario job, removes its cache entry and clears its step listeners. Disposed
sessions reject further simulation work.

Scenario worker replies belong to a request and its session. Starting or canceling one engine's setup leaves other
sessions alone; worker failure falls back for every pending owner. Transport errors also clear the loading state.

Accessories compose at `subscribeSteps(listener)`: the carburetor primer runs after each engine step using
that step's exact duration, and unmounting unregisters the listener. The accelerator pump belongs to the engine state,
so its fuel delivery and cutaway survive checkpoints together. The governor and SureFly bench own separate
120 Hz clocks. Route frame loops drive these clocks independently of canvas rendering. Low-level model functions
remain directly step-able for source-based tests.

Mixture units are explicit: the Cessna illustrative curves use fuel equivalence ratio **φ** (rich above 1), while the
detailed engine kernel uses excess-air ratio **λ** (lean above 1). `model/mixture-units.ts` defines the reciprocal
conversion and the mass-flow boundary. These unit conversions do not change either model's source calibration.
The fleet keeps its installed-aircraft teaching models; sharing a clock or an engine type does not make distinct
installation, governor and failure assumptions interchangeable.

[Fuel metering research and model audit](FUEL-METERING-RESEARCH.md) compares the float carburetor, RSA servo and
Continental systems, records the source hierarchy and explains the implemented corrections and remaining limits.
