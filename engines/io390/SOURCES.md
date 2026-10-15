# IO-390 sources and how the numbers were read

Primary source: **Lycoming IO-390-C Series Installation and Operation Manual (IOM), January 2017**
([PDF](https://www.lycoming.com/sites/default/files/attachments/IOM-IO-390-C%2520Series%2520-%25201-31-17.pdf)).
Page numbers below are the manual's own.

## Taken as printed

| What                                                                                                         | Where                     |
| ------------------------------------------------------------------------------------------------------------ | ------------------------- |
| 215 hp at 2,700 rpm; bore, stroke, displacement, compression ratio, firing order, 20° BTC timing, weight     | Table A-1, p. 51–52       |
| Cruise ratings: 75 % (161 hp, 2,450 rpm, 12.8 gph) and 65 % (140 hp, 2,350 rpm, 9.8 gph)                     | Table A-1, p. 51          |
| Magnetos (Slick 4345 retard left, 4370 right), injector (RSA-10AD1/-10AD2), drive ratios                     | Table A-1, Tables A-3/A-4 |
| CHT, oil temperature and pressure limits, oil quantities                                                     | Table A-2, p. 53          |
| Thermostat closes at 185 °F; cooler 7.5 gpm; heat rejection ≤ 925 Btu/min                                    | Table 2, p. 14            |
| Idle 600–700 rpm; starter 10 s then 30 s to cool; below 50 rpm can prevent a start                           | pp. 26, 30, 36            |
| Magneto check: drop ≤ 175 rpm, within 50 rpm of each other, at 2,100–2,200 rpm (fixed pitch or no MAP gauge) | pp. 31–32, 37             |
| Best power for performance cruise, best economy (peak EGT) for economy cruise; not leaner than 150 °F ROP    | p. 39                     |

The propeller (the load) is the SR20 G6's Hartzell HC-E3YR-1RF/F7392S-1, 74 in, three blades (SR20 POH 11934-005,
pp. 2-8 and 7-40, as already cited in `aircraft/sr20`).

## Digitized from the charts

The Appendix C figures were rendered from the PDF at high resolution and read against their grid lines.

- **Figure C-1, curve 13601 (performance), p. 57.** Each rpm line on the sea-level panel is straight, so it is stored as
  two points (at 20 and 29 inHg) plus its full-throttle manifold pressure. The altitude panel's full-throttle power at
  20,000 ft is stored for each rpm. Reading uncertainty is about ±1 hp and ±0.05 inHg. The model checks itself
  against the chart: 215 hp at 29.26 inHg, 2,700 rpm (tests/io390-engine.test.ts).
- **Figure C-3, curve 13602 (fuel flow), p. 59.** The best-power and best-economy lines are parallel at 0.40 lb/h per
  hp; each rpm's offset was read at 110 and 130 hp. Uncertainty about ±0.2 lb/h.
- **Figure C-2 (fuel flow against nozzle pressure), p. 58.** The nominal curve was read at whole lb/h steps. The figure
  is titled for the RSA-5AD1 injector although Table A-1 lists the RSA-10AD1/-10AD2; the manual prints it in the
  IO-390-C appendix, and the model uses it as printed.

## Not published: chosen to fit

Everything in `calibration`, plus valve timing, rod length, start-retard angle and the propeller's pitch range,
governor range and inertia, is a model constant. Each is chosen so the running engine reproduces the documented points
above (rated power, cruise fuel flows, idle speed, magneto drop, temperatures inside Table A-2 in a climb). They are not
Lycoming data and should not be quoted as such. Per-cylinder differences (`nozzleTrim`, `coolingTrim`) are illustrative.
