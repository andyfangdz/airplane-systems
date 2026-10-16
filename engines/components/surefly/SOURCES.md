# SureFly SIM sources and how the numbers were read

The page models the **SureFly SIM4P**, the four-cylinder impulse-coupled magneto replacement.

- **SF1001**: SureFly SIM4P Installation Instructions, Document No. SF1001, Revision B (07/26/2018)
  ([PDF](https://www.aircraftspruce.com/catalog/pdf/08-17074install.pdf)). Page numbers are the document's own. The
  SIM4N (SF1002) and SIM6C (SF1003) manuals carry the same operation, dip switch, timing and LED sections.
- **Tech page**: SureFly's [technical specifications](https://www.surefly.net/tech).

## Taken as printed

| What                                                                                                                 | Where              |
| -------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Magneto replacement; uses existing plugs at OEM gap, a "Slick" style harness and the existing drive gear             | SF1001 §1.1 p. 3   |
| Two modes: advance (timing advances with RPM and MAP) or fixed (data-plate timing throughout)                        | SF1001 §1.1 p. 3   |
| Timed to #1 compression TDC (0°), advancing within the unit per its dip switch                                       | SF1001 §1.1 p. 3   |
| Needs a constant external 8.5–30 VDC supply                                                                          | SF1001 §1.1 p. 3   |
| Operates like a magneto; advances beyond data-plate timing only under specific RPM and MAP conditions; up to 38°     | SF1001 §1.2 p. 4   |
| Advance mode only when normally aspirated, with CHT monitoring and on 100LL; otherwise fixed mode                    | SF1001 §1.2 p. 4   |
| Start on the SIM: a more accurately retarded spark than an impulse coupling at low rpm                               | SF1001 §1.2 p. 4   |
| Terminals and ports: power, MAP port, LED, timing, p-lead, p-lead shield, dip switch port                            | SF1001 §2.3 p. 6   |
| Impulse spacer re-used; sealed by an o-ring, no gasket                                                               | SF1001 §2.4 p. 6   |
| Drive gear on the shaft, castellated nut 120–180 in-lb (not over 250), cotter pin                                    | SF1001 §2.6 p. 7   |
| Dip switch table: eight data-plate timings (30° to 18°) × advance or fixed, and each setting's LED code              | SF1001 §2.7 p. 8   |
| ON is up toward the shaft; dip port plug 20 ± 2 in-lb with thread locker                                             | SF1001 §2.7 p. 8   |
| Internal timing on the TIMING terminal: LED green, goes out at internal TDC over a ½° window; off if p-lead grounded | SF1001 §2.9 p. 9   |
| Mounting: clock the SIM in the ear slots to keep the LED out; nuts 150–160 in-lb                                     | SF1001 §2.10 p. 10 |
| Timing check: LED must go out within 2° of #1 TDC                                                                    | SF1001 §2.11 p. 10 |
| Power wire: 14 AWG minimum, 10 A circuit protection; SIM grounds through the engine                                  | SF1001 §2.12 p. 10 |
| MAP hose only for advance mode; port capped in fixed mode                                                            | SF1001 §2.14 p. 11 |
| Pre-operational check: switch on, LED blinks the code 4 cycles then goes inactive; 12 blinks/s means contact SureFly | SF1001 §3.3 p. 12  |
| Spark retarded to TDC with full spark energy for starting                                                            | Tech page          |
| MAP sensor 5–45 inHg; 0–3,500 rpm; Hall-effect sensors; -35 to 250 °F                                                | Tech page          |
| 45 mJ spark; wasted spark; plugs gapped .022–.035; 600 mA average at 2,700 rpm (4-cylinder)                          | Tech page          |
| Weight 4.4 lb (SIM4P); 2,400 hours, no interval inspections; shaft, two sealed bearings and an oil seal              | Tech page          |

The LED code column writes a short blink as "-" and a long one as "—": reading the table, each blink is one switch,
short for ON and long for OFF (30° advance is OFF ON ON ON, "—---").

Data-plate timings used as examples: O-360-A1D 25° BTC (Lycoming O-360 Operator's Manual p. 2-1) and IO-390-C 20°
BTC (IO-390 IOM Table A-1), as cited in `engines/`. The magneto drive turns at crank speed (1.000:1, O-360 OM p. 2-7).

## Where sources differ

- MAP sensor range: 5–45 inHg on SureFly's tech page, 6–74 inHg on a retailer's product page. The model uses SureFly's.
- A forum post reports SureFly saying the MAP port should not be capped; SF1001 §2.14 says to cap it in fixed mode.
  The page follows SF1001.

## Not published, so assumed

- **The advance map.** SureFly sets it at the factory and doesn't publish it. `ADVANCE_SHAPE` is an illustrative
  shape between the documented limits: no extra advance at 25 inHg and above, full extra advance (to 38°) at 17 inHg
  and 2,000 rpm, none below 1,200 rpm. A forum report that advance starts only below about 25 inHg is the only hint.
- The speed below which the spark sits at TDC for starting (400 rpm) and the cranking speed (150 rpm).
- Blink lengths of the LED code (the manual gives the pattern only).
- Behaviour below 8.5 V: the model stops sparking, since the SIM needs 8.5–30 V to operate; SureFly doesn't say.
- Which cylinders share a spark: from the 1-3-2-4 firing order, a cylinder on compression pairs with the one 360°
  later (1 with 2, 3 with 4).
- What the SIM does with an open MAP port: it reads ambient pressure, so the illustrative map gives little or no
  extra advance.
- The 3D unit's shapes and dimensions, the clocking range of the ear slots (±8°) and the internal layout (two coils, a
  trigger wheel and Hall-effect sensors, a circuit board): SureFly publishes the parts list only.
