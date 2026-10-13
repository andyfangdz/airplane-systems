# Modeling quality and geometry cost

This audit starts at main `7e0e63d` (the shared geometry/component pipeline). Triangle count measures rendering cost,
not mechanical completeness. The SR22T has additional turbocharging, TKS, oxygen and CAPS detail, but those systems
cannot explain its former 462,451-triangle fuselage. Conversely, a painted door seam on a closed hull did not meet
its standard for a working door, regardless of the number of internal components.

## Geometry changes

`lib/skin-patch.ts` shares constrained triangulation across the SR22T, SR20, C172S, C182T and M20C. `cdt2d` preserves
aperture boundaries; interior seeds and boundary subdivision prevent long skinny triangle fans. Refinement splits
at loft stations and samples three edge midpoints and each face center against the curved parameterization, using
an illustrative **0.4 mm sampled chord tolerance**. This is not a continuous error guarantee or a measurement of the
real aircraft. Positions retain the existing station profiles; smooth analytic normals and paint projection are
independent of triangle density. The shared arc lookup uses micrometre keys to avoid discontinuities during refinement.

The SR22T's short nose transition formerly consumed 148,399 triangles, about 32% of its hull, on approximately 1.1%
of its hull area. The new triangulation concentrates refinement on curvature instead of propagating that density
around the fuselage. Exhaust openings now clip triangles to the aperture envelope: discarding whole intersecting
triangles had made the opening's shape depend on tessellation. Some small rim differences are intentional corrections.

The source geometry still passes through the same lossless meshoptimizer WebAssembly encoder/worker decoder.
There is no extra Rust implementation, new runtime geometry service, coordinate quantization or simulation rewrite.
Missing assets still invoke the complete source factories. `npm run geometry:stats` audits the exact served assets.

| Aircraft | Hull triangles before | Hull triangles after | Total triangles before | Total triangles after | Gzip MiB before | Gzip MiB after |
| -------- | --------------------: | -------------------: | ---------------------: | --------------------: | --------------: | -------------: |
| SR22T    |               462,451 |               73,385 |                802,090 |               402,569 |           6.829 |          2.330 |
| SR20     |                12,416 |               61,072 |                161,528 |               216,636 |           1.432 |          1.530 |
| C172S    |                18,128 |               90,512 |                124,658 |               207,276 |           1.439 |          1.656 |
| C182T    |                18,938 |               89,219 |                140,992 |               222,149 |           1.678 |          1.847 |
| DA40     |                11,672 |               11,672 |                 92,020 |                92,660 |           0.990 |          0.991 |
| M20C     |                11,674 |               51,334 |                 83,528 |               130,150 |           1.029 |          1.070 |

The other four hulls gain triangles because they now wrap the doors, preserve loft stations and resolve curved jambs.
They are bounded by regression budgets; increasing density is not the target. The DA40 already had moving openings,
so its additions are mechanisms rather than another hull replacement. Buffer/index duplication is removed losslessly
where the clipping/paint pipeline emits a triangle stream with an identity index.

## Functional coverage

The previous main revision already added selected component cases, filters, control sheath routes and mechanical
poses across all five aircraft. This change closes the largest remaining functional gap: movable openings with
hardware that stays attached. All details use the ordinary aircraft catalogue and the shared build/worker pipeline.

| Area                                           | Current coverage and changes                                                                                                                                                                                                                                                                                                                                                                                                        | Remaining limitation                                                                                                                                                                                 |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Airframe and doors                             | SR20: two cabin doors and baggage panel, real apertures, moving glazing, seals, handles, latch hardware, cables and telescoping gas struts. C172S/C182T: two cabin doors, baggage panel and independently hinged windows nested in their doors. M20C: right cabin and top-hinged baggage panels, strap, latch and paired baggage lock pins. DA40: existing canopy/rear door plus connected telescoping rear strut and moving locks. | Hinge axes, gaps, strut dimensions and latch travel are illustrative. C182T latch internals and most door trim fasteners remain schematic. These are not certified installation or rigging drawings. |
| Flight controls and flaps                      | Existing cables, pushrods, sectors, horns, tabs and moving surfaces; selected actuator/control details and sheath routes use shared helpers. Mooney hydraulic flaps and whole-tail trim keep their own architecture.                                                                                                                                                                                                                | Not every pulley bearing, attachment bracket or internal actuator stage is modeled. Routes show system relationships rather than exact service routing.                                              |
| Gear and brakes                                | Existing struts, brakes, hoses and steering; Mooney retractable gear and well/door motion. DA40 now shows four master-cylinder piston rods and toe-pedal motion, with parking pressure retained independently of released pedals.                                                                                                                                                                                                   | No load/deflection or hydraulic fluid dynamics simulation; dimensions and strokes of schematic internals remain illustrative.                                                                        |
| Engine, propeller and fuel                     | Existing aircraft-specific induction, exhaust, cooling, pumps, injectors/carburetor, governors and selector/feed/return routes; selected housings, filters and throttle/mixture/propeller cable details from the prior shared pass. SR22T exhaust apertures are now independent of triangle size.                                                                                                                                   | Detailed castings, all fittings and internal flow passages do not have SR22T-level coverage everywhere. Component envelopes and routes remain approximations.                                        |
| Electrical, lighting and avionics              | Existing aircraft-specific buses, breakers, generators/alternators, batteries, LRUs, connectors/routes and live instruments; selected shared enclosure details. Either SR20 cabin door now triggers its existing convenience-light logic.                                                                                                                                                                                           | Wiring is a system diagram in 3D, not a pin-to-pin harness drawing; connectors do not imply surveyed terminal counts.                                                                                |
| Environmental, pitot/static, vacuum and safety | Existing aircraft-specific ducts, valves, filters, pressure lines, sources and safety equipment; applicable component detail retained through the same pipeline.                                                                                                                                                                                                                                                                    | Coverage differs by aircraft equipment. SR22T-only TKS/oxygen and aircraft-specific CAPS, vacuum or Positive Control are not copied into incompatible aircraft.                                      |

This establishes shared construction and verification standards, not a claim that every component now has equal
visual or mechanical depth. Remaining work should be chosen from the cited aircraft sources and the concrete gaps
above, not from a target mesh count.

## Evidence and limits

- `tests/skin-patch-quality.test.ts`: outward finite curved faces, hole clearance, sampled chord error; exact aperture
  area and paint UV interpolation on coarse and dense source meshes.
- `tests/fleet-door-mechanisms.test.ts`: registered hulls have real openings, closed panels fill them, opened panels
  clear them; every panel/glass vertex, edge midpoint and triangle center stays within 0.75 mm of the analytic skin.
  Strut ends remain connected with a rigid barrel and a physically available rod stroke throughout sampled travel.
- Existing SR22T door, cowl, inlet, exhaust and worker tests protect the detailed openings and downstream behavior.
  Hull budgets catch a return to excessive density without treating a low count as proof of quality.
- Existing fleet tests cover containment, occupied-space route clearance, controls, faults, catalogue integrity and
  lossless encode/decode equivalence. The complete project check and production build are required.
- `test:ui:doors` checks actual rendered transforms after operating panel controls, independent nested windows and
  repeatable open/close/reopen poses. `test:ui:geometry` exercises both prebuilt and failed-download fallback paths.
- Closed SR22T comparison screenshots changed 0.33% of overview pixels and 0.05% of door-view pixels at the captured
  desktop framing. These are visual review aids, not universal image or geometric error bounds.

Aircraft-specific sources and approximation notes are recorded in each `aircraft/<id>/SOURCES.md` and part note.
