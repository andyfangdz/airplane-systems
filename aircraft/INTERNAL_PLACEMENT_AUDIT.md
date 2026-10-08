# Internal placement and clearance audit

Reviewed all five aircraft against the current catalogue geometry, moving assemblies, and existing POH/AFM citations. This follows the [exterior geometry audit](GEOMETRY_AUDIT.md).

## Method and scope

- Transform registered parts into aircraft coordinates, then screen their vertices against the fuselage and, where appropriate, the wing envelope.
- Screen neighboring rigid parts for intersecting bounds. Inspect rotated parts in their own coordinate systems; a bounding-box overlap alone is not proof of interference.
- Check moving assemblies over their travel, including the M20C landing gear and the Cessna/DA40 elevator trim tabs and linkages.
- Keep sourced equipment stations, capacities, gear track, wheelbase, and control limits. Adjust unsourced mounting coordinates or schematic housings only where needed; identify those approximations in the catalogue notes.
- Update shared anchors when moving equipment so hoses, wires, labels, and linkage endpoints follow it.

Intentional attachment and enclosure relationships are excluded from collision findings: cylinder barrels entering the crankcase, plugs entering cylinder heads, instruments mounted in panels, J-box components inside their case, and carry-through spars entering the wings. The DA40 pitot/static filters sit inside the stub wing; testing only the fuselage would incorrectly classify them as outside the aircraft.

## Corrections

| Aircraft | Corrected geometry                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C172S    | Main battery clears the rounded cowl, upper engine-mount tube, and J-box without reducing its case size or changing its documented arm. The alternator clears the crankcase/sump and drives through coplanar pulleys. The ACU and shunt fit inside the J-box; standby controller clears its battery. Sump/filter, cooler/crankcase, and baffle/flow-divider overlaps are removed. Cabin manifolds, overhead hardware, baggage floor, and control-lock pins clear neighboring controls and displays.                                                                                 |
| C182T    | Oil cooler and stall horn fit inside the skin. Sump, starter, filter, injector bodies, and adjacent engine parts have distinct occupied space. The fuel-manifold route stays inside the wing/fuselage envelope. J-box internals, cabin/overhead hardware, avionics cooling fan, sampler, and control-lock pins clear adjacent equipment. The rudder-trim assembly clears the fuel selector.                                                                                                                                                                                         |
| DA40     | Starter and engine accessories clear their neighbors and the cowl. Avionics cases fit inside their baggage-area enclosure, clear the baggage floor and swept elevator linkage, and remain separate from the pitch servo. Parking-brake valve clears the gascolator; center console clears the seat cushions.                                                                                                                                                                                                                                                                        |
| SR20     | Fire extinguisher and forward CAPS harness straps fit inside the skin. Muffler/exhaust and oil-filter placement clear the sump, magneto, and battery. Separate front-seat bolster halves leave room for the center-console keyboard.                                                                                                                                                                                                                                                                                                                                                |
| M20C     | Revised main-gear trunnion/folding geometry puts the retracted tires in wing wells outside the seats and cabin floor, with a separate recess for each folded leg; nose gear has its own raised well between the footwells. Johnson bar and lock sockets agree with the animated travel. Front seats use the documented adjustment range; radio depth extends behind the panel. Starter, airbox/filter, and carb-heat valve fit under the cowl and clear the sump and heater muff. The fuel display uses an explicitly approximate envelope representing the stated usable capacity. |

The C172S, C182T, and DA40 elevators now have actual trim-tab apertures. Tab geometry, hinge axes, horns, and rod endpoints share their definitions, including compounded elevator/trim motion. The M20C elevator uses one straight hinge axis; its fixed-wing/aileron seam and stabilizer winding are corrected. Its nose-gear doors follow the curved belly and the actual well opening; closed coverage and clearance during their swing are checked against the surrounding geometry.

The M20C overhead follow-up places both spotlights, the dome light (OM p. 3), the stall-warning horn (Ranger 2-7),
and the four ceiling outlets (OM p. 11) just inside the curved roof, accounting for its lateral curvature. The former
lamp and horn coordinates were above the skin; the vents hung below the headliner and their ducts began outside it.
Shared anchors now join the ducts and horn circuit to their relocated equipment, including the lamp glow positions.
The headliner glow sprites fit the lamp housings so they cannot spill through the solid roof when switched on.
The retractable roof scoop stays attached at its aft edge throughout its travel instead of lifting the whole box
clear of the roof. Housing depths, hinge placement and travel remain schematic. `tests/m20c-overhead.test.ts`
checks containment, proximity to the rendered roof, flow endpoints and the full scoop animation. Windshield and
door outline corners also follow the roof instead of projecting above it; the painted glass and seams share those
coordinates. Their contours remain a visual approximation. Inspect cabin,
lighting, pitot/electrical and ventilation views in solid and x-ray modes, with the scoop closed and fully open.

## Reuse and verification

`aircraft/cessna/accessories.ts` shares the alternator body/shaft/pulley/belt construction. `lib/trimTab.ts` shares trim-tab geometry and matching cutouts. Aircraft-specific placement constants are reused by geometry and connected flows; M20C gear kinematics live in `placement.ts`. Geometry tests use `tests/placement-helpers.ts` for the same part transforms as the scene.

Focused placement suites cover Cessna electrical, engine, and cabin equipment; DA40/SR20 equipment; and M20C internal and moving assemblies. Trim tests check apertures and attachment points at control stops. Existing exterior-contour and fleet tests cover skin consistency and catalogue completeness. Run `npm run check` and `npm run build`, then inspect the affected engine, electrical, cabin, fuel, gear, and controls views with `npm run shot`.

## Accuracy limits

The source material identifies equipment locations and system relationships, but does not dimension every case, mounting bracket, wheel well, cable route, or airframe cross-section. These corrections establish consistency within the study models. They do not independently verify an exact installation against maintenance drawings or measured aircraft. Case sizes and approximate mounting coordinates remain labeled as schematic; physical aircraft clearances must not be inferred from them. The M20C's existing notes also distinguish the manual editions used where the exact aircraft-year source is unavailable.
