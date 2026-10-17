# TSIO-550-K sources and how the numbers were read

The engine is the Continental TSIO-550-K as installed in the Cirrus SR22T. Where documents disagree, the airplane's
documents win over the engine maker's: the POH first, then the maintenance manual, then Continental (engine items
only, where Cirrus is silent). The lower value is kept below as a note.

- **POH**: Cirrus SR22T Pilot's Operating Handbook and FAA Approved Airplane Flight Manual, P/N 13772-007, Reissue A.
  Page numbers are the handbook's own.
- **AMM**: Cirrus Airplane Maintenance Manual, Models SR22 and SR22T, P/N 13773-002, Revision 7. Cited by chapter and
  PDF page.
- **M-18**: Continental Motors, TSIO-550 Permold Series Engine Maintenance and Overhaul Manual, 21 September 2017.
  Page numbers are the manual's own.
- **OI-18**: Teledyne Continental Motors, TSIO-550 Permold Series Engine Installation and Operation Manual,
  29 November 2006. It covers the -B, -C, -E and -G only; no value here is taken from it.

## Taken as printed

| What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Where                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| TSIO-550-K, six cylinders, turbocharged, horizontally opposed, direct drive, fuel injected, air cooled; 315 bhp at 2,500 rpm; 2,000-hour TBO                                                                                                                                                                                                                                                                                                                                                                                                       | POH 1-7, 2-6, 7-31                                                                  |
| Bore 5.25 in, stroke 4.25 in, 552 cu in (the POH's "550" is the model name), compression ratio 7.5, firing order 1-6-3-2-5-4, timing 24° BTC ± 1°                                                                                                                                                                                                                                                                                                                                                                                                  | M-18 Table 2-1, p. 2-24                                                             |
| Cylinder numbering: viewed from the rear, right side 1-3-5 and left side 2-4-6, No. 1 and No. 2 rearmost; left-case pads farther forward                                                                                                                                                                                                                                                                                                                                                                                                           | M-18 2-1.2 Figure 2-3, p. 2-3; 2-2.1, p. 2-4                                        |
| Cylinder stations: #1 5.42 in and #2 7.89 in forward of the accessory face, 7.31 in pitch on both banks (left bank 2.47 in forward)                                                                                                                                                                                                                                                                                                                                                                                                                | M-18 Figure 5-34 (installation drawing 657645 sheet 2), p. 5-54                     |
| Rated 315 bhp −0 % +5 % at 2,500 rpm and 37.5 in.Hg; critical altitude 18,000 ft (printed without a manifold-pressure or rpm condition); maximum recommended cruise 262 bhp at 2,500 rpm and 30.5 in.Hg; minimum idle 600 rpm; minimum cruise 2,300 rpm                                                                                                                                                                                                                                                                                            | M-18 Table 2-2, p. 2-25                                                             |
| Table 2-2 reference conditions: sea level, standard day (29.92 in.Hg, 59 °F), zero water vapour, at the throttle inlet and exhaust exit, no accessory load; about 1 % power per 6 °F of compressor inlet air temperature; exhaust back pressure and accessory losses are not corrected for                                                                                                                                                                                                                                                         | M-18 Table 2-2 note 1                                                               |
| Full-throttle manifold pressure 36.0 in.Hg for every takeoff, mixture full rich; 36.0–37.0 on the first flight with cold oil, fuel flow rising in proportion; reduce power if above 37.0; about 2,500 rpm static                                                                                                                                                                                                                                                                                                                                   | POH 4-14, 4-17                                                                      |
| Full-power fuel flow in the dynamic green arc; above 30.5 in.Hg the green arc is the full-rich range                                                                                                                                                                                                                                                                                                                                                                                                                                               | POH 4-17, 4-22; 2-10                                                                |
| Cruise fuel flows 18.3 / 17.4 / 16.4 / 14.6 / 12.7 GPH for 85 / 80 / 75 / 65 / 55 % of 315 hp, lean of peak at the target fuel flow, 2,000–25,000 ft (80 % only at 20,000–25,000 ft); largest table TAS 220 KTAS                                                                                                                                                                                                                                                                                                                                   | POH 5-32 to 5-34                                                                    |
| Leaning only at 30.5 in.Hg or less; target fuel flow ≈ best economy, or 50–75 °F below peak TIT; lean-of-peak power follows fuel flow; 0.5 GPH ≈ 15 °F CHT                                                                                                                                                                                                                                                                                                                                                                                         | POH 4-22                                                                            |
| After start, lean until rpm rises to a maximum and leave it there for taxi until run-up                                                                                                                                                                                                                                                                                                                                                                                                                                                            | POH 4-12 (step 13)                                                                  |
| Instrument markings and CAS names (verbatim in `markings`): CHT 100–500, green 240–420, yellow 420–460 CHT, red > 460 CHT; rpm 0–3000, green 500–2550, red > 2550 RPM; EGT 1000–1800 green; MAP 10–40, green 15.0–36.5, yellow 36.5–37.5, red 37.5–40.0; oil pressure 0–100, red 0–10 OIL PRESS, yellow 10–30 OIL PRESS, green 30–60, yellow 60–100, red > 100 OIL PRESS; oil temperature 75–250, green 100–240, red > 240 OIL TEMP; % power 0–100 green; TIT 1000–1800, green 1000–1750, red 1750–1800 TIT; fuel flow 0–45 GPH, green arc dynamic | POH 2-9, 2-10                                                                       |
| The 2-9 MAP row prints no CAS name; the message MAN PRESSURE (warning and caution) and "reduce to less than 36.5" are on the procedure pages, which print no trigger, so the 2-9 band edges are used                                                                                                                                                                                                                                                                                                                                               | POH 3-29, 3A-9                                                                      |
| Oil 10 psi minimum, 100 psi maximum, 240 °F maximum, 75 °F minimum for takeoff; above 18,000 ft MSL do not reduce manifold pressure below 15 in.Hg; maximum rpm 2,500                                                                                                                                                                                                                                                                                                                                                                              | POH 2-6                                                                             |
| Maximum operating altitude 25,000 ft MSL                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | POH 2-19                                                                            |
| CHT: do not continuously exceed 420 °F; maximum remains 460 °F; descent CHT 240 °F or greater, MAP 18–20 in.Hg                                                                                                                                                                                                                                                                                                                                                                                                                                     | POH 4-19, 4-22, 4-23                                                                |
| OIL PRESS caution is 10–30 psi at or above 1,000 rpm                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | POH 3A-8                                                                            |
| START ENGAGED caution after 15 s, warning after 30 s of starter engagement (starter limit 10 s)                                                                                                                                                                                                                                                                                                                                                                                                                                                    | POH 3A-10, 3-49                                                                     |
| TIT maximum continuous 1750 °F, 1850 °F not to exceed 30 s; turbine speed limit against TIT; exhaust back pressure ≤ 2.5 in.Hg; CHT 420 °F maximum cruise, 460 °F maximum, 240 °F minimum for takeoff                                                                                                                                                                                                                                                                                                                                              | M-18 Table 2-1                                                                      |
| Idle 600–750 rpm; run-up at 1,700 rpm, magneto drop ≤ 150 rpm, differential ≤ 75 rpm; cranking ≤ 10 s with 20 s cooling                                                                                                                                                                                                                                                                                                                                                                                                                            | POH 4-15, 4-12                                                                      |
| Oil sump 8 qt; do not operate below 6 qt, 7 recommended; cooler bypass below about 180 °F; oil temperature control about 180 °F                                                                                                                                                                                                                                                                                                                                                                                                                    | POH 1-8, 4-8, 7-36; AMM 79-00 PDF 2764                                              |
| Oil 30–60 psi normal, 100 psi cold, 10 psi at 600 rpm, measured at the oil cooler adapter; usable 5.0 qt (16° nose up) and 4.5 qt (10° nose down) of 8                                                                                                                                                                                                                                                                                                                                                                                             | M-18 Table 2-3, p. 2-26                                                             |
| Governor fixed at 2,500 rpm, no propeller control; Hartzell PHC-J3Y1F-1N/N7605(B) or PHC-J3Y1F-1N/N7605C(B), 78.0 in, three composite blades                                                                                                                                                                                                                                                                                                                                                                                                       | POH 1-7, 2-8, 7-32, 7-39; AMM 61-20 PDF 2450                                        |
| START energizes the starter and both magnetos; the right magneto fires the lower right and upper left plugs                                                                                                                                                                                                                                                                                                                                                                                                                                        | POH 7-37                                                                            |
| An impulse coupling on each magneto holds the spark to top centre for starting                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | AMM 74-00 PDF 2604                                                                  |
| Twin turbochargers and intercoolers; one oil-actuated wastegate on the left tailpipe; a controller that senses the difference across the throttle plate (upper deck − manifold) and meters the wastegate's oil return; overboost valve on the left intercooler outlet "at overly high manifold pressures"                                                                                                                                                                                                                                          | POH 7-38, 7-39; AMM 81-20 PDF 2812, 71-60 PDF 2542, 79-00 PDF 2764; M-18 2-1 p. 2-1 |
| Alternate air: a door held by magnets, opened by engine suction when the filters block, upstream of the compressors, ALT AIR OPEN caution; 3–5 % power loss; lower critical altitude; MAP loss where the wastegate is closed; reducing to cruise power will likely close the door                                                                                                                                                                                                                                                                  | POH 7-37, 7-38, 3A-11; AMM 71-60 PDF 2542                                           |
| Fuel metering as a function of rpm, throttle angle, mixture and compressor discharge (deck) pressure; unmetered pressure 7.0–9.0 psi at 600 rpm and 21.0–24.5 psi at 2,500 rpm; metered nozzle pressure 14.2–14.8 psid, deck referenced; idle set to 700 ± 25 rpm                                                                                                                                                                                                                                                                                  | M-18 2-1 p. 2-1, Table 2-4 pp. 2-27 to 2-28; AMM 73-20 PDF 2589; POH 7-38           |
| HIGH BOOST/PRIME available at MAP ≥ 24 in.Hg and (later software) pressure altitude ≥ 10,000 ft, or below 500 rpm; BOOST 4–6 psi                                                                                                                                                                                                                                                                                                                                                                                                                   | POH 7-41                                                                            |
| Accessory drive ratios: starter 48:1, magneto 1.5:1, gear-driven alternator 3:1, governor 1:1, fuel pump 1:1, tachometer 0.5:1; dry weight 522.8 lb; envelope 39.2 × 42.4 × 34.0 in (length, width, height)                                                                                                                                                                                                                                                                                                                                        | M-18 Tables 2-8, 2-9, p. 2-30                                                       |
| Crankshaft counterweights: two sixth-order on the No. 2 cheek hangers, one fifth- and one fourth-order on No. 5                                                                                                                                                                                                                                                                                                                                                                                                                                    | M-18 2-2.2.1, p. 2-6                                                                |
| Six crankcase oil squirt nozzles (modelled as `pistonCoolingJets`), not field replaceable                                                                                                                                                                                                                                                                                                                                                                                                                                                          | M-18 Table D-19 (K, N), p. D-30; 13-9.2, p. 13-24                                   |
| Minimum propeller moment of inertia 16 in·lb·s² for a 700 rpm idle (1.81 kg·m²), 15 for 800                                                                                                                                                                                                                                                                                                                                                                                                                                                        | M-18 Table 2-7, p. 2-29                                                             |

## Read from charts

Charts were rendered from the PDFs at 300 dpi and read against their own grid lines (the grid was located
programmatically, so a reading is a pixel position converted with the chart's scale).

### M-18 Figure 2-37, TSIO-550-K & N Sea Level Performance, p. 2-45

Corrected brake hp against absolute dry manifold pressure for 2,300, 2,400 and 2,500 rpm, 20–36.5 in.Hg. The lines
are curved, so they are stored as points (`performance.lines`, `kind: "continental"`). Uncertainty ±1 hp on 2,300 and
2,500. The 2,400 line is gray under the hatching above 29 in.Hg and under the chart's text at 24 in.Hg: the starred
values are midline estimates, ±3 hp, and it has no reading at 30.5, 31, 33 and 35 in.Hg. Above 30.5 in.Hg the chart is
hatched "Full Rich Operation Only": the model reads the chart as full-rich power there and as best power at or below.

| MAP in.Hg | 20    | 21    | 22    | 23    | 24      | 25    | 26    | 27    | 28    | 29    | 30      | 30.5  | 31    | 32      | 33    | 34      | 35    | 36      | 36.5  |
| --------- | ----- | ----- | ----- | ----- | ------- | ----- | ----- | ----- | ----- | ----- | ------- | ----- | ----- | ------- | ----- | ------- | ----- | ------- | ----- |
| 2500 rpm  | 156.2 | 167.9 | 179.3 | 190.4 | 201.3   | 211.9 | 222.3 | 232.4 | 242.2 | 251.7 | 261.0   | 265.7 | 270.4 | 279.1   | 287.6 | 295.8   | 303.9 | 311.7   | 315.1 |
| 2400 rpm  | 146.6 | 157.2 | 167.8 | 178.3 | 188.2\* | 198.2 | 208.1 | 217.7 | 226.8 | 236.1 | 245.0\* | —     | —     | 261.5\* | —     | 277.3\* | —     | 292.1\* | 297.9 |
| 2300 rpm  | 136.0 | 146.3 | 156.5 | 166.4 | 176.1   | 185.5 | 194.7 | 203.7 | 212.3 | 220.7 | 229.0   | 232.7 | 236.3 | 244.0   | 251.0 | 258.8   | 266.1 | 272.5   | 275.5 |

Cross-checks: M-18 Table 2-2 gives 262 bhp at 2,500 rpm and 30.5 in.Hg (chart 265.7, +1.4 %) and rates 315 bhp at
37.5 in.Hg (the chart reaches 315.1 at 36.5, where it ends). No altitude chart is published for the K and N (M-18
2-3.3.5 has Figures 2-36 and 2-37 only).

### M-18 Figure 2-36, TSIO-550-K & N Fuel Flow vs. Sea Level Standard Brake Horsepower, p. 2-44

Rich Full Rich, Lean Full Rich, Best Power and Best Economy, read at 5–10 hp steps (±0.5 lb/h), stored as
`fuelFlow` (`kind: "continental"`). Lean Full Rich is Rich Full Rich less 10 lb/h throughout (three readings differ
from that by 0.1–0.2 lb/h and are kept as read). Best Power and Best Economy are drawn only from 173 to 262 bhp; the
hatched area from 236 to 262 bhp is limited to 100/100LL fuels. The flows include return flow (M-18 Table 2-4), so
the chart is an upper reference for the model's full-rich flow. Rich Full Rich equals Continental's type-certification
maxima, M-18 Table 2-5: 220 / 143 / 128 / 110 lb/h at 315 / 262 / 236 / 205 bhp.

| bhp                 | 173  | 180  | 190   | 200   | 205  | 220   | 230   | 236 | 250   | 262 | 270   | 280   | 290   | 300   | 310   | 315 |
| ------------------- | ---- | ---- | ----- | ----- | ---- | ----- | ----- | --- | ----- | --- | ----- | ----- | ----- | ----- | ----- | --- |
| Rich Full Rich lb/h | 93.4 | 96.3 | 101.6 | 107.3 | 110  | 118.8 | 124.3 | 128 | 135.4 | 143 | 149.3 | 158.6 | 170.7 | 186.5 | 207.4 | 220 |
| Lean Full Rich lb/h | 83.4 | 86.3 | 91.6  | 97.3  | 100  | 108.8 | 114.2 | 118 | 125.6 | 133 | 139.3 | 148.6 | 160.7 | 176.5 | 197.5 | 210 |
| Best Power lb/h     | 78.8 | 81   | 84.5  | 88.1  | 90.2 | 96    | 100   | 103 | ≈ 108 | 114 | —     | —     | —     | —     | —     | —   |
| Best Economy lb/h   | 67.4 | 69.9 | 73.4  | 77    | 79   | 83.5  | 86.7  | 89  | 92.4  | 96  | —     | —     | —     | —     | —     | —   |

### Other charts and tables

- **AMM Figure 73-20-2, Manifold Pressure and Fuel Flow Range at 2,500 rpm, PDF p. 2592.** The full-power fuel-flow
  band: 36.7–39.8 GPH at 36.0 in.Hg, 37.35–40.45 at 36.5 (±0.05 GPH), straight edges between. This, not Figure 2-36,
  sets the installed full-power fuel flow.
- **POH Time, Fuel & Distance to Climb: Full Power, 5-28 to 5-29.** Fuel ÷ time between table rows gives the average
  full-rich fuel flow in the climb (full throttle, 120 KIAS, ISA): 36.0 GPH to 10,000 ft, 36.2 to 18,000, 34.3 from
  18,000 to 20,000, 33.5 from 20,000 to 25,000 ft. The division is not printed in the POH.
- **M-18 Figure 2-38, Oil Cooler Performance, p. 2-46.** Heat rejection ≈ 650 Btu/min on the 7 GPM curve at the
  chart's 2,000 cfm end (±15).
- **M-18 Figure 2-39, p. 2-47.** Aftercooler hot-side effectiveness 0.5–0.6 at the -K's air flows (a range, not a
  point).
- **M-18 Figure 2-41, Turbine Speed vs. Turbine Inlet Temperature, p. 2-49.** 132,000 rpm from 1200 to 1440 °F TIT,
  falling linearly to 122,000 rpm at 1750 °F (TA3606 turbocharger; read ±500 rpm).

The model treats Figure 2-36's "observed" and Figure 2-37's "corrected" brake horsepower alike, reads absolute dry
manifold pressure as the indicated value (no humidity), and uses the chart's 2,300–2,500 rpm range with the governor
holding 2,500.

## Where the documents disagree

| #   | What                                      | Used                                                                                                                                                                                                                                                                 | Not used                                                                                                                                                   |
| --- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Magneto-to-plug wiring                    | POH 7-37: the right magneto fires the lower right and upper left plugs                                                                                                                                                                                               | AMM 74-00 PDF 2604 and M-18 Figure 2-19 p. 2-20: the reverse                                                                                               |
| C2  | Installed full-throttle manifold pressure | POH 4-14, 4-17: 36.0 in.Hg (36.0–37.0 with cold oil)                                                                                                                                                                                                                 | M-18 Table 2-2: rated at 37.5 (Figure 2-37 reaches 315 hp at 36.5)                                                                                         |
| C3  | Overboost valve setting                   | POH 7-39: "at overly high manifold pressures" (no number). The model's deck setting is a fit at about 39.5 in.Hg, lifting at a manifold pressure of about 38.5–39 (inside the MAN PRESSURE warning band), never in normal operation, the cold-oil 37.0 case included | AMM 81-20 PDF 2812: "at 35 inHg", below the normal 36.0. AMM 81-20's 35 inHg is not used                                                                   |
| C4  | Magneto drop differential                 | POH 4-15: 75 rpm                                                                                                                                                                                                                                                     | M-18 7-3.3 p. 7-8: 50 rpm                                                                                                                                  |
| C5  | Minimum oil temperature for takeoff       | POH 2-6: 75 °F                                                                                                                                                                                                                                                       | M-18 Table 2-3: 100 °F (POH 4-14 still says warm-up is reached "in most cases" at 100 °F)                                                                  |
| C6  | Oil-pressure gauge scale                  | POH 2-9: 0–100 psi                                                                                                                                                                                                                                                   | POH 7-36: 0–90 psi                                                                                                                                         |
| C7  | Induction air at rated power              | not a target                                                                                                                                                                                                                                                         | M-18 Table 2-6: 41.5 lb/min. With the AMM fuel flow and the displacement it would need a volumetric efficiency of about 1.2; the model's is a fit of 0.863 |
| C8  | Idle                                      | POH 4-15: 600–750 rpm, with AMM 73-20 PDF 2589's 700 ± 25 as the fit point                                                                                                                                                                                           | M-18 Table 2-2: minimum 600                                                                                                                                |
| C9  | Full-power fuel flow                      | AMM Figure 73-20-2 PDF 2592 band                                                                                                                                                                                                                                     | M-18 Figure 2-36 Rich / Lean Full Rich at 315 bhp: 220 / 210 lb/h, including return flow (Table 2-4)                                                       |
| C10 | 85 % cruise at 30.5 in.Hg                 | POH 5-32 to 5-34: 85 % (267.75 bhp) at 18.3 GPH and 30.5 in.Hg or less, flown at the table's fuel flow wherever λ lands (near peak), ± 4 %                                                                                                                           | M-18 Table 2-2: maximum recommended cruise 262 bhp at 30.5 in.Hg; Figure 2-37: 265.7 bhp best power there. Lean of peak at 30.5 cannot exceed either       |
| C11 | Power against charge temperature          | POH 4-22, 5-32 to 5-34: lean of peak the power follows the fuel flow at every altitude. The running engine's chart power scales with the intercooled charge's density (`performance.chargeRefC`)                                                                     | M-18 Table 2-2 note 1 and 2-3.3.5: MAP and the 1 %/6 °F compressor-inlet law alone set the power (kept for the chart function `chartHp`)                   |

Also not used: M-18's figures for operation on ASTM D7592 (UL94) fuel (Table 2-1 K 420 °F CHT, Table 2-2 K 232 bhp at
27 in.Hg, Table 2-6 manifold temperature 130 / 115 °F); the model assumes 100 or 100LL. The POH 2-9 rpm red line
(above 2,550) and the POH 2-6 maximum (2,500) are both printed and are both kept: `markings` holds the first,
`limits.rpmMax` the second.

## Not published: chosen to fit

Everything in `calibration` and every constant of the turbocharger, wastegate, controller, intercooler and relief
valve; the induction constants; valve timing and rod length; the propeller's pitch range, power-coefficient scale and
inertia (kept above M-18 Table 2-7's minimum); the starter torque; the oil pickup; the nozzle curve; the start-cranking
speed. Each is fitted on the running engine so that it reproduces the documented points above, and
`tests/tsio550k-engine.test.ts` holds those points. In particular:

- **Fuel metering of the turbocharged engine**: on rpm, throttle angle and deck (compressor-discharge) pressure, not on
  the charge's density (POH 7-38 "in proportion to engine RPM, mixture setting, and throttle angle"; M-18 2-1). The
  pressure ratio across the throttle stands in for its angle: the metering is set for the air a standard-day
  sea-level engine takes at the MAP the throttle would give from the rated deck, and scaled by the deck pressure. Full
  throttle therefore meters the rated mixture at every altitude, and above the critical altitude fuel flow follows the
  deck (engines/model/turbo.ts `turboMetering`). The full-rich schedule reads that throttle-angle stand-in at rated
  rpm, and the flow then scales with the engine's own rpm: a change of rpm moves the flow in proportion, not along the
  schedule. Read at the actual rpm, the schedule's steep end near rated air (fuel about a⁵·⁹ between air fractions
  0.946 and 1.0) leaned the engine as rpm dipped, and the fixed governor limit-cycled: 2,362–2,666 rpm lean of peak at
  10,000 ft, 2,121–2,973 rpm leaned past peak at full power. A schedule reshaped inside Figure 2-36's band does not
  remove it. At 2,500 rpm the two readings are the same.
- **Full-rich schedule** (`fuelSystem.fullRichLambda`): λ 0.80 / 0.78 / 0.768 / 0.76 at air fractions 0.64 / 0.74 /
  0.855 / 0.946, putting sea-level full rich at 173, 205, 236 and 262 bhp inside Figure 2-36's full-rich band; 0.582
  at rated (printed 0.58), the margin that keeps every cylinder burning at sea-level static full power (mean λ at least
  0.55), 36.9 GPH at full power. It does not richen with altitude below the critical altitude, as the POH's constant
  climb fuel flow shows.
- **Turbocharger** (`turbo`): a quasi-steady power balance: efficiencies 0.75, turbine nozzle 0.65 × 10⁻³ m² per side,
  spool lag 1.5 s, shaft speed 105,000 rpm at pressure ratio 2.45 (illustrative; it keeps normal operation under Figure
  2-41's limit). With a constant compressor efficiency the gate-closed balance has no stable point between idling and
  running away, so no fit gives a critical altitude; the compressor's efficiency therefore falls toward the map's edge
  (`compressorEta`, a fraction of `etaCompressor`: 1.0 to pressure ratio 2.0, 0.85 at 2.3, 0.62 at 2.6, 0.52 at 3.2,
  0.1 at 5.0). It holds 36.0 in.Hg to about 21,000 ft (M-18 Table 2-2's critical altitude is 18,000 ft) and gives 30.9
  in.Hg at 25,000 ft. The turbines are sized for a reserve, the gate about half open at sea-level full power: the POH
  holds 36.0 in.Hg "for all takeoffs" (4-14) and prints full-throttle takeoffs to 50 °C at 10,000 ft (5-20/5-21) and
  positive full-throttle climb rates at 40–50 °C to 20,000 ft (5-26/5-27). At ISA +30 °C the model holds 35.9–36.0
  in.Hg for a takeoff at sea level, 5,000 and 10,000 ft (77 KIAS, oil warmed as for taxi) and 35.86 in.Hg in the 120
  KIAS climb at 18,000 ft. A static run at ISA +30 °C long enough to take the oil above 240 °F thins the actuator's oil
  and the gate cannot shut (the POH 4-14 "prolonged ground engine operation" case, not a target). None of it is map
  data.
- **Wastegate controller**: modelled as the documents describe it, a differential ("sloped") controller with no
  absolute reference. The set point falls as deck pressure rises (slope −0.3), so at full throttle the deck settles
  near 36.5 in.Hg (MAP 36.0) wherever the gate has to be; with an actuator band of 14–30 psi and a gain of 2.8 per
  in.Hg, warm oil keeps MAP within 36.0 ± 0.2 (36.05 at 150 °F, 35.95 at 180 °F at sea-level full power) and 100 °F
  oil raises it to 36.09, inside the POH's 36.0–37.0. The wide band and a gate area scaled to the turbines (1.5 ×
  10⁻³ m²) keep the regulating gate from hunting at full throttle: a narrower band made MAP swing 0.1–0.3 in.Hg in the
  climb once the gate had a reserve to regulate with. At part throttle the proportional controller still hunts a few
  tenths of an in.Hg (0.3–0.8 at 10,000–25,000 ft and 30.5 in.Hg, a 2–6 s cycle): a gain low enough to stop it lets
  warm oil move MAP by more than 0.2 in.Hg. Readings at part throttle are therefore window means, as a pilot reads a
  gauge. A misadjusted controller (`controller.misadjustInHg` 0.35 in.Hg, multiplied about threefold at full throttle)
  holds sea-level full power at about 37.0 in.Hg with warm oil, relief valve shut (POH 3-29, 3A-9 "maintenance
  adjustment").
- **Spring-open wastegate**: with no oil pressure the wastegate's spring holds it open (engine stopped, or oil lost to
  the actuator), so the engine reverts to roughly normally aspirated manifold pressure (POH 3-27, 3-28).
- **Relief valve** (`turbo.overboost`): see C3. Crack 39.5 in.Hg of deck, area 4 × 10⁻³ m²: a seized-closed gate surges
  with MAP between about 38.0 and 39.1 in.Hg, the valve open about half the time at sea level and about three quarters
  on an ISA −30 °C day leaned to λ ≈ 0.8. Reducing power to 30.5 in.Hg lowers the relief duty and may not end the
  surge, as POH 3-30 allows ("If noticeable surging is present: Land as soon as practicable"); at 24 in.Hg the valve
  reseats (fit).
- **Leaning above 30.5 in.Hg** (`calibration.leanGainMax`, an optional field): outside the POH's envelope (4-22): the
  chart there is full rich, and the model's power when leaned there is not meaningful, so no target reads it. The
  full-rich basis there is taken at the actual λ, which on a hot day is very rich (0.46–0.50), and leaning from it
  would gain about 30 % over full rich: at 25,000 ft ISA +30 °C that read about 400 hp and drove the propeller past its
  coarse stop to 2,780 rpm. `leanGainMax` caps a cylinder's work leaned there at 1.16 × its full-rich work, phased in
  with the full-rich basis between 29.5 and 31.5 in.Hg. That is just above a standard day's own gain (1 / 0.867, full
  rich at rated), so a standard day is untouched; leaned at full throttle on an ISA +30 °C day the propeller stays
  under the 2,550 rpm red line (about 2,530 at 25,000 ft, 2,515 at 18,000 ft) and MAP holds near 34.9 in.Hg at 25,000
  ft. Tested: the red line and that the engine keeps running, not the power.
- **TIT** (`calibration.titGain`, `titCrossover`, `titTauS`): the mean EGT of the cylinders feeding each turbocharger,
  a fifth of the other bank's mixed in through the crossover, its rise above outside air × 1.135 (`titGain`, an
  optional field; `titOffsetF` 0): about 200 °F over the bank mean near peak, so leaned toward peak at sea-level full
  throttle the TIT warning is reachable (POH 3-30, 4-14: about 1,780 °F) while 85 % at 10,000 ft stays under 1750 °F
  (about 1,715) and a stopped engine reads outside air (an additive offset would show a cold engine 200 °F warm). The
  75 % target fuel flow at 10,000 ft sits 50–75 °F lean of peak TIT (POH 4-22).
- **Volumetric efficiency** (`calibration.ve`): 0.863, flat (no chart to derive it from), fitted to the AMM full-power
  fuel flow (36.9 GPH at 35.8 in.Hg, inside the AMM band). Figure 2-36's 236 bhp best-power and peak-EGT flows then
  read 107.9 and 96.9 lb/h against 103 ± 8 and 89 ± 8: the AMM figure governs this loose Continental target, so the
  test's upper tolerances are the measured flows.
- **Calibration targets read with a stated interpretation**:
  - Climb fuel flow, 18,000–20,000 ft: the POH table prints fuel to 0.1 gal and time to 0.1 min, so (11.3 − 10.1) gal
    in (18.9 − 16.8) min spans 1.1/2.2 … 1.3/2.0 × 60 = 30.0–39.0 GPH; the test uses that band. 20,000–25,000 ft (3.8
    gal in 6.8 min, 32.2–34.9 at the same resolution) and sea level to 17,000 ft (36.08) keep ±1.5 GPH.
  - Exhaust back pressure, 2.5 in.Hg maximum (M-18 Table 2-1): read at the turbine discharge (tailpipe), the "exhaust
    exit" of Table 2-2 note 1. The turbine inlet runs about 35 in.Hg at rated, and far more above the critical
    altitude, as any turbine must.
  - Induction manifold temperature, 130 °F maximum at rated takeoff (M-18 Table 2-6): printed "ASTM D7592 only"; used
    as the bound for every fuel. The model reads 76 °F.
  - Full-power nozzle pressure: the nozzle curve is anchored at the model's settled full-power flow, 37.23 GPH, not the
    AMM band's mid 38.2 GPH: the POH climb fuel flow (36.08 GPH) caps the full-power flow below the mid, and at the
    mid's anchor full power read 13.8 psid, under M-18 Table 2-4's 14.2–14.8.
  - Failure depths at the 10,000 ft cruise point (the induction, intercooler, failed-turbocharger and oil-leak cases):
    measured from that settled point against an unfailed control run for the same seconds, never against the starting
    reading.
  - Leaning limit, 30.5 in.Hg (POH 4-22, the "Leaned at" study flag): POH 4-22 approves cruise leaning "with manifold
    pressure settings of 30.5 in.Hg or less", a limit on the power setting, not an instantaneous trip. The flag is
    raised once the gauge (0.1 in.Hg) has read above 30.5 for a net 3 s with the mixture off full rich (time at or
    below counts back down) and stays until that net time is back to zero (`LEAN_DWELL_S`, engines/model/alerts.ts).
    3 s is a choice: the part-throttle controller's hunting puts single readings above 30.5 for at most 0.47 s in the
    leaned cruise setups, aimed at 30.4 (30.06–30.91 in.Hg at 25,000 ft), so they raise no flag; leaned at full
    throttle on an ISA +30 °C day the flag is up 3 s after the gauge passes 30.5.
  - Alternate-air power loss: measured from a settled 75 % point (best power, the lever trimmed between looks,
    readings averaged).
  - 75 % at 25,000 ft (POH 5-34, 16.4 GPH): the POH's table flows are lean-of-peak settings (5-32), but at 30.4 in.Hg
    the model's 25,000 ft charge is 37.6 °C against 13.3 °C at 10,000 ft and the engine takes 1,489 lb/h of air
    against 1,627, so 16.4 GPH burns at λ 1.01, about 1 °F from peak EGT (10,000 ft: λ 1.10, 43 °F lean of peak). No
    mixture holds 16.4 ± 0.1 GPH there and sits clearly lean of peak, and leaning above 30.5 in.Hg is not approved, so
    that cell reads at about peak. Its power, 77 % against 75 ± 4 %, is inside the cruise target.
- **Alternate air** (`induction`): 23 °C warmer than outside air; with the door open at 10,000 ft and 75 % it costs 3.4
  % with MAP 0.27 in.Hg higher (POH 3A-11: 3–5 %). The intercoolers take most of the warmer air's heat out before the
  charge whose density sets the power (C11). The "filter blocked" failure is a partial obstruction (0.85 of the
  throttle body's area) that opens the door at full power and lets it close at cruise power (POH 3A-11).
- **Propeller**: power coefficient × 2.0 (`cpScale`, three blades), so the governor holds 2,500 rpm in the 120 KIAS
  climb to 25,000 ft and at full throttle at POH 5-34's 220 KTAS there (ISA); the unscaled coefficient ran out of pitch
  above about 8,000 ft. Fine stop 5°, below the ≈ 7° static full-power blade angle, so the governor holds 2,500 at a
  static run-up; coarse 50°, above the ≈ 47° the 220 KTAS point needs; inertia 3.8 kg·m² (engine and propeller).
- **HIGH BOOST/PRIME**: below 500 rpm the pump primes about 30 lb/h (5 GPH) at full rich, so the POH 4-12 note's 2 s
  prime leaves about 8 g in the ports (engine.ts `HIGH_BOOST_PRIME_LBH`).
- **Nozzle curve**: a square-root law through 14.5 psid (M-18 Table 2-4's 14.2–14.8) at 223.4 lb/h (37.23 GPH at 6.0
  lb/gal, inside the AMM band); full power settles at 36.9 GPH and 14.3 psid. Not Continental data.
- **Starter**: 300 N·m at the crankshaft, falling to nothing at 380 rpm, for the POH 4-12 start (running within 10 s).
- **Oil**: pump pressure 24 psi at 1,000 rpm and 180 °F before the relief valve, relief 60 psi; the pickup uncovers
  between 3.5 and 2.5 qt, inside the 3.0–3.5 qt left of 8 at the usable 4.5–5.0 (M-18 Table 2-3). `oilRise` 170 °F at
  rated power: 180 °F or more in the 120 KIAS climb at 15,000 ft, 180 ± 15 in cruise. The oil cooler keeps 55 kt of
  slipstream (`oilSlipKt`, an optional field) while the cylinders get 15 kt (`slipKt`): the cooler's ram and the
  warm-up oil the wastegate actuator runs on stay as fitted.
- **Cruise lean of peak** (`calibration.lambdaTarget` 1.12, `peakEgtPower` 0.955, `performance.chargeRefC` 24.1 °C):
  the target fuel flow is λ 1.12 at the air the engine takes (POH 4-22). Power at peak EGT is 0.955 of best power, so
  lean of peak the engine makes 13.3–14.9 hp/GPH, every white standard-day cell of POH 5-32 to 5-34 within 3.4 % (85 %
  at 30.5 in.Hg lands near peak, C10; so does 75 % at 25,000 ft, see the interpretations). The chart's power scales
  with the intercooled charge's density against 24.1 °C, the model's own manifold-air temperature at the rated
  sea-level point (so that point is unchanged), in place of the 1 %/6 °F compressor-inlet law (C11; at a fixed
  pressure ratio both cost about 9 % at ISA +30 °C). Read off MAP alone, the 7–32 °C spread of cruise charge
  temperatures between 10,000 and 25,000 ft put the cells 9 % low to 8 % high.
- **Cylinder heads** (`calibration.chtRise` 420, `slipKt` 15): the 120 KIAS climb under 262 °F at 5,000 ft, 85 % at
  10,000 ft 384 °F on a standard day and 442 °F at ISA +30 °C (the POH's gray cell), a static full-power run past 460
  °F. Lean of peak the model's head heat falls about twice as fast as POH 4-22's 0.5 GPH ≈ 15 °F (about 30 °F at λ
  1.1, 22 °F just lean of peak); the test reads it at the hottest cruise, 85 % at 18,000 ft, where the POH's rule is
  used.
- **Rich misfire edge** (`calibration.richMisfireLambda` 0.45, an optional field, absent 0.55; mixture.ts
  `stability`): not a published value. The model's λ runs about a quarter richer than the engine's (VE 0.863 against
  the air M-18 Table 2-6 prints, C7), so its full rich at rated (λ 0.55) and on an ISA +30 °C day (about 0.46–0.50)
  sits where the textbook 0.55 edge would misfire, cooling the exhaust 250–400 °F and starving the turbines. With the
  edge at 0.45 a hot day's full rich burns, full throttle at 18.3 GPH at 25,000 ft ISA +30 °C reaches about 34.9 in.Hg
  (POH 5-34: the turbochargers can supply the gray cell above 30.5 in.Hg) and leaning at full throttle on a hot day
  stays running. The compressor edge was refitted with it (the critical altitude would otherwise rise to 22,000 ft).
- **Idle** (`calibration.idleArea` 0.013): 720 rpm at idle with the mixture as leaned for taxi (AMM 73-20 PDF 2589
  (ab) 700 ± 25), 700 at full rich; leaning at idle raises it about 20 rpm (AMM PDF 2591 sets 25–50: not reached).
- **Turbo-system failure constants** (`turbo.leaks`, `turbo.oil.leakQtPerMin`): `inductionArea` 3 × 10⁻³ m², about
  one induction duct's section, so a split coupling at 10,000 ft cruise brings MAP to within 1 in.Hg of normally
  aspirated (POH 3-27 cause 1). `intercoolerArea` 1.4 × 10⁻³ m² per leaking side, sized to exceed the controller's
  reserve at the 10,000 ft cruise point: MAP falls about 4 in.Hg, 4.3 in.Hg less than with a split coupling (POH 3-27
  cause 1). `deadCompressorArea` 8.41287 × 10⁻⁴ m² (an optional `turbo.leaks` member): the two compressor and intercooler
  paths join only at the throttle body (AMM 71-60 PDF 2542, 81-20 PDF 2812) and no check valve is described, so a
  failed turbocharger's stopped compressor leaves its path open from the deck back to its air box; the working
  compressor and its intercooler pass that recirculating air as well and cannot hold the cruise deck. This is an
  effective return-path area, including the failed side's intercooler and duct losses, rather than a measured aperture;
  a second return-intercooler pressure drop would count those losses twice. Including recirculation in the forward
  intercooler drop first required a refit from 2 × 10⁻³ to 1.418 × 10⁻³ m². Correcting the reference flow for the
  surviving path then required 1.418 × 10⁻³ → 8.41287 × 10⁻⁴ m²: the one working intercooler carries the full engine,
  relief, leak and return flow against one path's rated reference (`mRef / turbo.count`), rather than the total rated
  flow. Bisect only this effective area over 0–2 × 10⁻³ m² from the same saved 10,000 ft / 30.5 in.Hg cruise setup,
  fail the left turbocharger and integrate exactly 100 steps of 0.05 s. This retains the prior exact-five-second MAP
  target, 23.6624272 in.Hg, at 23.6624269 in.Hg; the earlier 23.659 in.Hg fit used 101 steps (5.05 s).
  No other failure constants or test tolerances changed. At the 10,000 ft cruise point MAP
  falls about 7 in.Hg within 5 s (POH 3-28 cause 4, "a sudden loss of manifold pressure"); without the path the
  controller's reserve held it within 0.2 in.Hg. A per-compressor flow limit was not used: a failed side at cruise asks
  no more corrected flow of its partner than full power at 25,000 ft asks of each. `leakQtPerMin` 0.5 qt/min for an
  oil leak or a failed turbocharger's bearing: from the POH 4-8 minimum of six quarts, oil pressure falls about 5–7 min
  after a turbocharger fails, the MAP loss first (POH 3-28 cause 4). `exhaustArea` (8 × 10⁻⁴ m²) is illustrative.

`calibration.lambdaFullRich` (0.58) records the rated end of the full-rich schedule; this engine does not read it.

Per-cylinder differences (`fuelTrim`, `coolingTrim`) are illustrative. None of the fitted values is Continental or
Cirrus data and none should be quoted as such. Percent power is brake horsepower ÷ 315; the airplane's display uses its
own algorithm (POH 7-36), and the POH cruise table is the target within a few percent.

## Not located

- Crankshaft rotation direction. M-18 Table 2-9 gives each accessory drive's direction "viewed facing the drive",
  which does not settle it on its own.
- Which of M-18 Table 2-1's three -K magneto pairs Cirrus fits (the model needs only "an impulse coupling on each").
- The propeller-flange station and the rocker-cover width on M-18 Figures 5-33 and 5-34.
- The M-18 page for the spring-open wastegate. The open-spring fail-safe rests on a Teledyne Continental
  overhaul-manual excerpt for the TSIO-520 series and is consistent with POH 3-27 and 3-28.
