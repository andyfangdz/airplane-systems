# Aircraft fuel metering: research and model audit

Reviewed October 23, 2026. Scope: the project's spark-ignition piston engines, particularly the O-360-A1D/MA-4-5,
IO-390-C/RSA-type injection, and the existing TSIO-550-K installation. This is a study-model engineering record;
component drawings and fitted transient constants are not installation or maintenance specifications.

## Findings that changed the model

1. **The accelerator pump must distinguish slow and rapid strokes by total fuel delivered.** Previously, the engine
   injected fuel immediately in proportion to throttle displacement. The component independently animated the same
   nominal charge over time. Slow and rapid openings delivered essentially the same total charge. The engine now
   owns a spring-driven plunger with a bypass allowance; slow displacement returns to the bowl. The drawing reads
   that engine state, including its actual discharge.
2. **The RSA idle spring adds force/pressure head, not an independent stream of fuel.** The old kernel added
   1 lb/h at every airflow, while the drawing independently claimed pressure-force balance. The new kernel sums
   equivalent heads before taking the square root, progressively takes up the spring, and shares its head calculation
   with the display. Delivered flow determines displayed fuel force, so limited supply cannot falsely show balance.
3. **An intake leak is not air through the carburetor.** The kernel already excluded downstream leaks from metering;
   the cutaway recomputed the main/idle split using total engine air. It now uses the same `meteredAir` as the kernel.
4. **Operating principle is distinct from installed make.** The component described a Precision unit as fitted to
   the IO-390, but the engine specification correctly listed AVStar. The component now distinguishes the IOM's
   AVStar application from the FAA/Precision diagrams used to teach the RSA principle.

## Evidence and applicability

| Reference inspected                                                                                                                                                                                                               | What it establishes                                                      | How it is used                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| [FAA-H-8083-32B, Chapter 2](https://www.faa.gov/sites/faa.gov/files/04_amtp_ch2.pdf), pp. 2-9–2-14, 2-21–2-27                                                                                                                     | Generic float-carburetor, RSA and Continental operating principles       | Topology, flow direction, qualitative behavior; not installation-specific dimensions                    |
| [Precision Form 15-812B](https://precisionairmotive.com/wp-content/uploads/2019/06/15-812_b.pdf), printed pp. 5, 7–8, 13, 17                                                                                                      | RSA regulator, idle spring, divider and nozzle air-bleed behavior        | Cross-check of the RSA model; scanned pages were OCR'd and the spring page visually inspected           |
| [Lycoming IO-390-C IOM, January 2017](https://www.lycoming.com/sites/default/files/attachments/IOM-IO-390-C%2520Series%2520-%25201-31-17.pdf), Tables A-1/A-2 and Figure C-2                                                      | Installed injector application, inlet-pressure limits, nozzle-flow chart | Keeps engine-specific numbers and the existing chart calibration                                        |
| [Lycoming O-360 series OM, P/N 60297-12](https://www.lycoming.com/sites/default/files/file/2025-11/60297-12%20-%20O-360%2C%20HO-360%2C%20IO-360%2C%20AIO-360%2C%20HIO-360%2C%20and%20TIO-360%20Series.pdf), pp. 1-2–1-3, 3-8–3-12 | MA-4-5 application, carburetor heat/icing and inlet-pressure envelope    | Engine-specific constraints and performance regression references                                       |
| [Marvel-Schebler MA-4-5/MA-4-5AA overhaul instructions](https://www.expaircraft.com/PDF/marvel-schebler-OH.pdf), ¶2-27, ¶3-2–3-3                                                                                                  | Float and accelerator-pump hardware and functional checks                | Manufacturer-authored primary document hosted by a third party; not evidence of current revision status |
| [FAA Aviation Weather Handbook, FAA-H-8083-28A](https://www.faa.gov/sites/faa.gov/files/FAA-H-8083-28A_FAA_Web.pdf), §20.4.1                                                                                                      | Wider weather context for carburetor icing                               | Identifies a remaining limitation in the model's temperature gate                                       |

The original Continental M-18 and Cirrus manuals were not supplied as local documents for this review. Their
installation-specific values below are the project's existing transcriptions, not newly verified primary-source
readings; see [TSIO-550-K provenance](tsio550k/SOURCES.md). They were not recalibrated from a generic handbook.
For future aircraft changes, the applicable POH/AFM and supplements govern installed operation, engine manuals
govern applicable engine data, and generic teaching references supply principles. Exact model, serial applicability,
document revision and measurement reference must travel with a numerical value.

## Three metering architectures

### Float carburetor

A float/needle system maintains a local fuel reservoir. Venturi depression draws fuel from the main nozzle, while
the near-closed throttle's pressure field supports idle metering. Mixture control restricts fuel. A separate
accelerating pump enriches a rapid opening; a slow stroke can bypass fuel back to the chamber. Fuel evaporation
and local pressure changes cool the charge. These are distinct subsystems, so inlet pressure, bowl inventory,
metered fuel and transient pump fuel should remain distinct quantities.
([FAA Chapter 2](https://www.faa.gov/sites/faa.gov/files/04_amtp_ch2.pdf), pp. 2-9–2-14.)

The O-360 OM identifies the A1D's MA-4-5 as a single-barrel float unit with manual mixture and idle cut-off.
Its carburetor inlet pressure range is 0.5–8.0 psi, with 3.0 psi desired. It describes a possible mixture-chamber
temperature reduction of 70 °F, and falling manifold pressure as an icing indication with a constant-speed
propeller. Heat comes from an exhaust jacket; installation details remain airframe-specific.
([O-360 OM](https://www.lycoming.com/sites/default/files/file/2025-11/60297-12%20-%20O-360%2C%20HO-360%2C%20IO-360%2C%20AIO-360%2C%20HIO-360%2C%20and%20TIO-360%20Series.pdf), pp. 1-2–1-3, 3-8–3-10.)

The MA-4-5 overhaul extract specifies a 13/64 in float-to-gasket setting and describes pump discharge continuing
as a stream that decays with spring travel after the throttle is opened and held. These establish geometry and
qualitative timing, not a measured fuel charge or time constant. The extract also identifies a power jet and air
metering pin; their presence does not justify inventing an enrichment schedule.
([Overhaul instructions](https://www.expaircraft.com/PDF/marvel-schebler-OH.pdf), ¶2-27, ¶3-2–3-3.)

### RSA-type servo injection

The regulator uses opposing air and fuel diaphragm forces. Its servo valve regulates the metering-jet pressure
difference; the metering restrictions set flow. Near idle the spring supplements the air force, then is taken up
as airflow increases. A spring-loaded divider supports low-flow distribution and clean shutdown. The nozzles
deliver into intake ports continuously; their delivery is not timed to an individual intake stroke.
([Precision training manual](https://precisionairmotive.com/wp-content/uploads/2019/06/15-812_b.pdf), pp. 5, 7–8, 13;
[FAA Chapter 2](https://www.faa.gov/sites/faa.gov/files/04_amtp_ch2.pdf), pp. 2-21–2-24.)

The IO-390 IOM identifies AVStar RSA-10AD1/-10AD2, yet its Figure C-2 is titled for RSA-5AD1. The existing model
uses that printed curve and retains the discrepancy. Table A-2's 14–45 psi parallel-boost and 14–35 psi series-boost
limits refer to the injector inlet; these are not the nozzle pressure used on Figure C-2. Confusing the two would
make the pressure display appear plausible while representing the wrong location.
([IO-390-C IOM](https://www.lycoming.com/sites/default/files/attachments/IOM-IO-390-C%2520Series%2520-%25201-31-17.pdf),
Table A-1, Table A-2 p. 53, Figure C-2 p. 58.)

### Continental continuous-flow injection

The generic Continental layout uses an engine-driven rotary-vane pump, air/fuel control, manifold valve and
port nozzles. Its metering architecture should not inherit an RSA diaphragm/idle-spring model merely because
both systems deliver continuously. ([FAA Chapter 2](https://www.faa.gov/sites/faa.gov/files/04_amtp_ch2.pdf),
pp. 2-24–2-27.)

In this repository, the TSIO-550-K already has its own rpm/throttle/deck-pressure approximation, pump-pressure
points, upper-deck-referenced nozzle differential and HIGH BOOST logic. Those remain installation-specific.
The existing `fullRichLambda` schedule is a fit, not a manufacturer's metering map. The former shared constant
named `IDLE_SPRING_LBH` is now documented as the Continental additive low-flow allowance; it is separate from
the new RSA spring head. These are findings from the source-code audit, not fresh validation of the Cirrus setup
data. See [the existing source record](tsio550k/SOURCES.md).

## Implemented equations and assumptions

For the RSA approximation, let `A` be the air-derived full-rich fuel-flow equivalent and `H` the supplemental
spring head, expressed in squared lb/h:

```text
A = airLbH / (AFRstoich × lambdaFullRich) × sqrt(rho0 / inletRho)
H = 3.5² × max(0, 1 − (A / 20)²)
fuelLbH = mixtureArea × sqrt(A² + H) × supply
```

This is our reduced-order implementation inferred from force balance and an orifice law. The spring strength,
release point and quadratic take-up are illustrative; no manufacturer curve supplies them. Full-rich high-flow
metering now has no additive spring stream. The inverse used by mixture trimming calls the same head function.
The cutaway infers actual normalized fuel force from `(deliveredFuel / mixtureArea)²`, rather than assigning it
the desired balancing force even when the pump/nozzles cannot pass the requested flow.

For the accelerator pump:

```text
plungerNext = plunger + (throttle − plunger) × (1 − exp(−dt / tau))
dischargeStroke = max(0, plungerNext − plunger − bypassRate × dt)
pumpFuelLb = min(sweptFuelLb × dischargeStroke, availableBowlLb)
```

Chosen constants are `tau = 0.6 s` moving down, `0.15 s` returning, and bypass capacity `0.12 stroke/s`.
They reproduce the documented direction of behavior without claiming measured MA-4-5 response. A rapid full
opening delivers about 74% of the illustrative swept capacity; an eight-second opening delivers much less.
Only fuel actually discharged is removed from the bowl. That mass enters the cylinder-port film; the cutaway's
plunger and fuel particles read this same state. The pump memory is included in engine checkpoints/forks, with
a fallback for checkpoints predating it. Pump-cylinder inventory and check-valve dynamics are still lumped.

## Diagnostic distinctions and next improvements

| Condition                    | What the current model represents                                                      | Remaining work                                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Restricted injector fuel jet | Reduced outlet area, cylinder imbalance, increased common pressure when supply permits | Add a separate air-bleed fault instead of reusing this control                                                                   |
| Blocked nozzle air bleed     | Not simulated                                                                          | At low power it can enrich the affected cylinder and lower pressure-based indicated flow; cutoff behavior needs a separate model |
| Engine-driven pump loss      | Injection loses supply; a carburetor consumes its bowl reserve                         | No vapor-pressure, fuel-temperature or hot-soak vapor-lock model                                                                 |
| Carburetor intake leak       | Air bypasses metering, leans the affected cylinder; readout now agrees                 | Actual installed leak geometry remains illustrative                                                                              |
| Carburetor icing             | Charge cooling, humidity, restriction, heat and melt roughness                         | No surface-temperature/latent-heat balance; current low-OAT suppression is too categorical                                       |
| Divider near idle            | Schematic valve lift, nozzle-area distribution at all flows                            | Model the divider's individual restrictions before claiming accurate low-flow imbalance                                          |

The air-bleed distinction above follows [Precision's nozzle discussion](https://precisionairmotive.com/wp-content/uploads/2019/06/15-812_b.pdf),
p. 17. Jet blockage and air-bleed blockage must not share the same sign of mixture response.

The current icing kernel suppresses accretion below roughly −7 °C OAT. A typical caution range in an engine
manual does not establish an absolute physical boundary. The [FAA weather handbook](https://www.faa.gov/sites/faa.gov/files/FAA-H-8083-28A_FAA_Web.pdf),
§20.4.1, describes broader temperature/humidity dependence. A future replacement should solve moisture supply,
local wall temperature, impingement and melting energy, then validate against a specified installation. This review
does not turn the existing illustrative ice fraction into a weather-risk predictor.

Prioritize air-bleed versus fuel-jet faults and divider idle restrictions next; then improve icing and hot-soak fuel
vapor behavior once suitable installation data are available. Geometry work should follow measured port locations,
section drawings or explicitly marked schematic envelopes. No unsupported dimensions were added in this change.

## Validation contract

Behavioral regressions cover slow versus rapid **total** pump delivery, decaying discharge, closing/empty-bowl
behavior, bowl-to-port mass conservation, intake-leak circuit accounting, RSA spring take-up, pressure-head
addition, mixture-inverse consistency over density, and the loss of force balance under restricted delivery.
Existing manufacturer-reference tests retain their rated-power, cruise-flow, starting, idle and failure expectations.
The complete repository check and desktop/phone component-page inspection are recorded with the change's results.

### Verification results

Verified using Node 22.23.4 and npm 10.9.9:

| Check                                                   | Result                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------ |
| Formatting, generated fleet, TypeScript, React Compiler | Passed; 394 functions compiled, no compiler failures                     |
| Full Vitest unit suite                                  | 266 files, 4,873 tests passed                                            |
| Compiled React tests                                    | 7 files, 100 tests passed                                                |
| Trusted-preview controller tests                        | 99 passed                                                                |
| Desktop and phone browser flows                         | Both component pages passed; no runtime errors or horizontal overflow    |
| Visual review                                           | Carburetor/injector screenshots at both sizes, plus the M20C engine view |

`npm run check` was run first. Its initial failures were the intentionally changed engine reference traces/scene
states and three slow tests exceeding the default five-second timeout. The traces were refreshed after reviewing
the changes: cold scene poses, geometry fingerprints and part identities are identical; running temperatures and
governor poses follow the corrected simulation. The final run executed every check in that command, with
`npm test -- --testTimeout=30000` for the unit suite; assertions and performance tolerances were retained.

Browser checks exercised warm idle, performance cruise, mixture cut-off/divider closure, and accelerator-pump
discharge. Final component verification used `next dev --webpack` after Turbopack emitted a missing preload-chunk 404. Screenshots and machine-readable readouts are in `.shots/fuel-metering/` in the working checkout.
