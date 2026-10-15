# O-360 sources and how the numbers were read

Primary source: **Lycoming O-360, HO-360, IO-360, AIO-360, HIO-360 & TIO-360 Series Operator's Manual (OM), P/N
60297-12** ([PDF](https://www.lycoming.com/sites/default/files/file/2025-11/60297-12%20-%20O-360%2C%20HO-360%2C%20IO-360%2C%20AIO-360%2C%20HIO-360%2C%20and%20TIO-360%20Series.pdf)).
Page numbers below are the manual's own. The model is the O-360-A1D, the engine of the 1968 Mooney M20C
(`aircraft/m20c`); where the OM tabulates by series, the O-360-A column is used.

## Taken as printed

| What                                                                                                                            | Where                 |
| ------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Four-cylinder, direct-drive, air-cooled; cylinder numbering, rotation; part descriptions used in the 3D notes                   | pp. 1-1–1-3           |
| Magnetos (Bendix S4LN-200 left, retard breaker; S4LN-204 right) and carburetor (Marvel-Schebler MA-4-5) for -A1D                | Table 1, pp. 1-3, 1-5 |
| MA-4-5: single-barrel float type, manual mixture control, idle cut-off; primer on carbureted engines                            | pp. 1-2–1-3           |
| 180 hp at 2,700 rpm; bore, stroke, displacement, compression ratio, firing order, 25° BTC timing                                | p. 2-1                |
| Accessory drive ratios (starter, alternator, magneto, tachometer, front governor)                                               | p. 2-7                |
| Dry weight 289 lb, envelope 29.81 × 33.37 × 24.59 in (-A1D)                                                                     | pp. 2-8–2-9           |
| Starting a float-carburetor engine: carb heat off, rich, boost pump on, throttle ¼ open, prime 1 to 3 strokes                   | pp. 3-1–3-2           |
| Magneto check: drop ≤ 175 rpm, within 50 rpm of each other, at 1,800–2,000 rpm                                                  | pp. 3-4–3-5           |
| Best power for performance cruise, best economy for economy cruise; not leaner than 150 °F ROP at maximum power                 | p. 3-6                |
| Carburetor ice: 20–90 °F, humidity ≥ 50 %, mixture chamber up to 70 °F below the incoming air, MAP falls (C/S prop)             | p. 3-8                |
| Carburetor heat from a jacket around the exhaust; on some installations unfiltered                                              | p. 3-9                |
| Carburetor inlet pressure 0.5–8.0 psi (3.0 desired); oil, CHT and temperature limits; oil 8 qt, 2 qt minimum                    | pp. 3-10–3-12         |
| Cruise ratings: 75 % (135 hp, 2,450 rpm, 10.5 gph) and 65 % (117 hp, 2,350 rpm, 9.5 gph)                                        | p. 3-12               |
| Idle mixture check: a momentary pick-up of about 50 rpm leaning to cut-off (more is too rich); idle rpm is the airframe maker's | pp. 5-4–5-5           |

The propeller (the load) is the M20C's Hartzell HC-C2YK-1B/7666A-2, 74 in, two blades, 13° to 29° at the 30 in
station, as already cited in `aircraft/m20c`.

## Digitized from the charts

The figures were rendered from the PDF at high resolution and read against their grid lines.

- **Figure 3-42, curve 13358 (sea-level and altitude performance; its title lists the -A1D), p. 3-56.** Each rpm line on the
  sea-level panel is straight, so it is stored as two points (at 20 and 29 inHg) plus its full-throttle manifold
  pressure; the altitude panel's full-throttle power at 20,000 ft is stored for each rpm. Reading uncertainty is about
  ±1 hp and ±0.05 inHg. The model checks itself against the chart: about 180 hp at 2,700 rpm and full throttle
  (`tests/o360-engine.test.ts`).
- **Figure 3-39, curve 13357 (fuel flow against percent rated power, O-360-A series), p. 3-53.** Read at the points listed in
  `fuelFlow.minimum`, about ±0.1 gph. The figure is the leanest allowed flow; the model's full-rich flow stays above it,
  and its flow at peak EGT lands on it.

## Where the manual and the model differ

- The OM has no part-throttle fuel chart for the O-360-A, so best-power flow is the performance-cruise point's specific
  consumption (10.5 gph for 135 hp, p. 3-12) applied at every power.
- The economy-cruise row (117 hp, 9.5 gph) is richer than Figure 3-39's minimum for 65 % (8.26 gph) and the model's flow
  at peak EGT (about 8.4 gph). The model follows the figure and the test says so.

## Not published: chosen to fit

Everything in `calibration`, plus valve timing, rod length, start-retard angle, the minimum starting rpm, idle rpm
(600–700 assumed, since the OM leaves it to the airframe), the oil thermostat (180 °F assumed; the OM doesn't give
one), which governor drive the A1D uses (front assumed), the carburetor's internals (bowl size, idle and accelerator-pump
flows, primer stroke, heat rise, how fast ice builds and blocks the bore), and the propeller's power coefficient scale,
induced inflow and inertia, is a model constant. Each is chosen so the running engine reproduces the documented points
above (rated power, cruise fuel flow, idle mixture pick-up, magneto check at 1,800–2,000 rpm, a climb inside the
limits, a fall in manifold pressure as ice builds). They are not Lycoming data and should not be quoted as such.
Per-cylinder differences (`fuelTrim`, `coolingTrim`) are illustrative.
