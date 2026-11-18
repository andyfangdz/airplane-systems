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

## SR20 G6 parts and exploded view

The study uses the C3B6 with the front governor and dual belt-driven alternators. The cylinder banks, rocker boxes, pistons, valve gear, counterweights, accessory housing, oil pump, induction and attaching hardware follow the applicable figures in the [Lycoming illustrated parts catalog, Revision 1 (June 2025)](https://www.lycoming.com/sites/default/files/file/2025-06/PC-IO-390-C%20Series%20Rev%201%20%281%29.pdf). The [maintenance manual](https://www.lycoming.com/sites/default/files/attachments/MM-IO-390-C%2520Series%2520-%25201-31-2017.pdf) shows the counterweight installation and timing gears in 72-20, Figs. 22 and 93.

In **Exploded assemblies**, **Blow up group** separates parts along their assembly axes. Both views use the same meshes, crank angle and part notes. Search **Inspect a part** by name or by a part number in its note. Each modeled bolt, screw, nut, stud, clamp and washer has an individual pick target. Numbered positions distinguish repeated hardware on the same mounting face. Exploded spacing, case and port contours, housing dimensions and the positions of holes, hoses and fittings are illustrative. The catalog lists alternative accessories and select-fit hardware. A serial-specific bill of materials would require the build record and vendor drawings.

The solid view distinguishes the engine enamel from exposed machined surfaces and separately finished accessories. The gray shade, metal grain, hose weave and exhaust discoloration are illustrative. [Lycoming maintenance manual, 72-10 pp. 105–107](https://www.lycoming.com/sites/default/files/attachments/MM-IO-390-C%2520Series%2520-%25201-31-2017.pdf)

The Cirrus installation follows POH 11934-005 pp. 7-33–7-40 and 7-49 and the AMM sections listed in [the SR20 source notes](../../aircraft/sr20/SOURCES.md). The model uses the standard remote oil cooler and the right-hand muffler location in AMM 78-10. POH 7-39 describes the muffler on the left. The optional air-conditioning compressor is omitted.

The oil cooler bracket attaches to the engine-mount weldment. The cooler bolts through the diffuser and bracket with washers and spacers. Its two elbow fittings carry the feed and return hoses, and a clamped duct feeds the diffuser. The airframe and standalone views use the same bracket-to-tube construction. Both place it aft on the left diagonal. The lateral position, clocking, dimensions and routing are schematic. [Cirrus AMM 12137-002, 79-20 pp. 2–7, Fig. 79-20-1](https://www.scribd.com/document/600081303/AMM-RA1)

### Photographic references and routing

- AOPA’s overhead photograph of the 2017 SR20 shows the forward baffle arch, red perimeter seals, screened filter ramp and the separation between the induction plumbing and the accessory belt. Its cylinder close-up shows a formed side baffle around the rocker covers, silver shielded leads and the embossed numerals and plug-reach marking. [Installed engine, overhead](https://www.aopa.org/-/media/Images/AOPA-Main/News-and-Media/2017/January/Cirrus/16_SR20_0007.jpg) · [Rocker cover and harness, close-up](https://www.aopa.org/-/media/Images/AOPA-Main/News-and-Media/2017/January/Cirrus/16_SR20_0006.jpg) · [AOPA photo feature](https://aopa.org/news-and-media/all-news/2017/january/04/cirrus-melds-new-panel-upgrades-into-2017-models)
- The nozzle tubes leave separate flow-divider outlets and follow the clamp arrangement in Fig. 26B. The broader 390-series photograph also shows the formed intake pipes and rocker drains. The G6 accessory positions follow the C3B6 references above. The individual bends, baffle contours and clearances are fitted to the study model. [Lycoming C-series parts catalog, Fig. 26B](https://www.lycoming.com/sites/default/files/file/2025-08/PC-IO-390-C%20Series%20Rev%201.pdf#page=82) · [Lycoming 390-series photograph](https://www.lycoming.com/sites/default/files/image/2021-12/series-engine-390_0.png)

### Accessory internals

- The left Slick 4345 carries the second set of breaker points. The right 4370 has a single set. The rotor and geared distributor use the magneto drive angle. The bearing cap, clamps, gear key, wedges and attaching screws follow the 4300-series service parts list. [Champion L-1363J, §§6–7 and 11.2](https://www.championaerospace.com/pdfs/techdocs/F1100/L-1363J_corrected%2020210420.pdf)
- Each belt-driven alternator has a field rotor, stator, bearings, slip rings, brushes and rectifier. The cutaway represents the brush-type mechanism fitted to each modeled envelope. [Hartzell ES1031, Fig. 2.3](https://hartzell.aero/wp-content/uploads/2014/12/ES1031-Alt-Owners-Man-Rev-New.pdf)
- The starter represents the LS permanent-magnet family. The motor, solenoid, clutch and reduction components follow Hartzell’s comparable permanent-magnet cutaway. Internal tooth counts, clocking and dimensions are illustrative. [Sky-Tec Flyweight fit guide](https://hartzellaviation.com/wp-content/uploads/SkyTec-Aircraft-Starter-Fit-Guide.pdf) · [Hartzell ES1033, §2.3](https://hartzellaviation.com/wp-content/uploads/ES1033-Rev.-1.pdf)
- The injector and flow divider use the same diaphragm, valve and mixture positions as the fuel-injection study. The engine-driven pump shows the actuating lever, diaphragm, spring and check valves. The governor contains the oil pump gears, flyweights, pilot valve and speeder spring. The spin-on filter exposes the pleated medium, support tube, base plate and sealing ring. These are representative internal arrangements. [Fuel injection sources](../components/fuel-injector/SOURCES.md) · [Governor sources](../components/governor/SOURCES.md) · [FAA Powerplant Handbook](https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/amt_powerplant_handbook.pdf)

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
