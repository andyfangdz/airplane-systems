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
    fuel.ts       Servo metering, flow divider and nozzles, per-cylinder distribution
    mixture.ts    Power, EGT and head heat against excess-air ratio λ
    propeller.ts  Constant-speed propeller and governor
    cycle.ts      Crank kinematics, valve events, firing order, the cylinder-pressure trace
    trim.ts       settle(): hold a manifold pressure, rpm or λ while the engine runs (pages and tests)
    scenarios.ts  "Start from" setups for the page
    alerts.ts     Limit flags from the spec's limits
  io390/          Lycoming IO-390-C: spec.ts and SOURCES.md (what was read from where, and what is assumed)
components/engine/  The page: store (zustand UI + per-frame loop), 3D scene (scene/: dims, materials and builders in kit.ts, one file per part group), monitor, panel, pressure chart
app/engines/[engine]/page.tsx  One static page per engine id
```

## Adding an engine

1. Make `engines/<id>/spec.ts` exporting an `EngineSpec`, and a `SOURCES.md` beside it. Published numbers cite the
   document and page; chart values say how they were read. Put anything the documents don't give in `calibration` (or
   the marked propeller fields) and say so.
2. Add it to `ENGINES` in `engines/index.ts` and to `ENGINE_IDS` in `infra/cloudfront/view-rewrite.js` (a test checks
   the copy).
3. Calibrate against the manufacturer's numbers, then write tests named after them in `tests/` (see
   `tests/io390-engine.test.ts`): rated power at full throttle, cruise fuel flows, idle, magneto drop, limits in a climb.
4. Check the page with a browser at desktop and phone widths.

The model reads the spec only, so a new engine of the same kind (air-cooled, injected, constant-speed propeller) needs
no model changes. A carbureted, turbocharged or fixed-pitch engine needs those pieces added to `model/` behind a spec
field, keeping the existing engines' behaviour (their tests guard it).

## Conventions

- The page reads per-frame values through `useLiveSnapshot(sim.s, ms)`; the scene reads `sim.s` in `useFrame`.
- The zustand hook on `EngineSim` is `useUi`. Don't name a hook property plain `use`: React Compiler treats
  `x.use(...)` as React's conditional `use()` and memoizes around it, which breaks the hook order.
- Temperatures can run faster than real time (`thermal`); the shaft, governor and fuel always run at real time.
