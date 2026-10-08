# Exterior paint references

Solid mode uses locally drawn, photo-referenced paint textures. X-ray mode retains the study model's ghost skins and system highlights. Photos are references, not bundled image assets; their copyrights remain with their photographers.

| Model            | Registration | Primary reference                                                                                                                                                                                          | Reproduced details                                                                                                                                  |
| ---------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cirrus SR20 G6   | N800KP       | [Costanzo Air fleet](https://costanzoair.com/fleet), the photo headed “Cirrus SR20 G6 - N800KP” (`IMG_1454.jpg`)                                                                                           | White airframe, black crossing fuselage stripes, thin gray accent, black aft-fuselage registration, white wheel pants                               |
| Cessna 172S      | N6189Q       | [Paramus Flying Club](https://flyingclub.org/), [`89q-a.jpeg`](https://flyingclub.org/images/89q-a.jpeg); [Dariusz Jezewski side photo, August 4, 2013](https://airport-data.com/aircraft/photo/001325799) | Burgundy and gold sweeping graphics on white, burgundy aft-fuselage registration and matching tail graphics                                         |
| Cessna 182T      | N8050J       | User-supplied photo of the **new red paint scheme**, October 7, 2026; [Paramus Flying Club](https://flyingclub.org/), [`50j-b.jpeg`](https://flyingclub.org/images/50j-b.jpeg)                             | Deep red upper cowling and tapered fuselage/tail stripes, red registration and wingtip accents, polished spinner, exposed wheels                    |
| Diamond DA40 XLS | N949KC       | [Paramus Flying Club](https://flyingclub.org/), [`9kc-a.jpeg`](https://flyingclub.org/images/9kc-a.jpeg); [Florida Metal side photo, July 26, 2018](https://airport-data.com/aircraft/photo/001529275)     | White composite skin, dark gray and warm gray sweeping graphics, gray registration across the lower fin/rudder, polished spinner and white fairings |

N8050J's older navy/silver Airport-Data photos are **not** the paint reference. Its optional wheel fairings remain available in the Gear panel, but start removed to match the supplied photo. The photographic configuration does not establish a different engine, propeller, avionics fit or performance specification.

Paint boundaries, fonts, small logos and colors are approximate reconstructions from available photographs, not factory paint masks or calibrated color measurements. Hidden surfaces use the observed opposite-side pattern. The underlying geometry remains a POH/AFM-based study model, not a scan or engineering model. Windows retain the model's opaque tinted treatment in solid mode.

## Implementation and audit

- `aircraft/liveries.ts` holds the registration-specific paint paths and lettering; individual geometry modules retain their window/door painters.
- `lib/livery.ts` gives port and starboard separate UV atlas halves. Paint is mirrored, while lettering is drawn independently to remain readable on both sides.
- Fin and rudder share a painter and projection. Rudder UVs are assigned in airframe coordinates **before** translation to the hinge, so markings remain attached during deflection.
- Closed lofts now use opposing cap winding, separate flat cap normals and outward face winding. DA40 open fuselage arcs also have outward winding and retain smooth normals when combined.
- Rounded SR20/C172 spinner profiles close at their tips. The SR20 cowl inlets sit outside the closed nose skin instead of being buried by it.
- N8050J's exposed tires have rounded sidewalls and visible wheel hubs. Exterior antenna finishes and wheel fairings use physical colors in solid mode; system colors remain available in x-ray.
- The SR20 overview camera backs off enough to include both wingtips.

The regression tests cover loft face orientation, cap normals, atlas direction/seams, finite exterior geometry and paint support on moving rudders. Browser verification covers both sides of all four aircraft, solid/x-ray switching, controls, gear and the DA40 cabin.
