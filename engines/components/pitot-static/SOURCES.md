# Pitot-static system sources and how the numbers were read

The component is the pitot-static system of a Cessna 172S with conventional instruments. Its behaviour follows the
FAA handbooks; its installation, calibration, markings and procedures follow the 172S documents. Where the two
differ in kind (the handbooks describe a generic system, the POH one airplane), the POH governs the numbers and the
handbooks the mechanism.

## Documents

| Document                                                                                                                                                                                | What was read                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Pilot's Handbook of Aeronautical Knowledge, FAA-H-8083-25C](https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/faa-h-8083-25c.pdf), chapter 8                         | pp. 8-1 to 8-12: the system (Figure 8-1), pitot tube and drain hole, static chamber, alternate static, altimeter, VSI, ASI, blockages (Figures 8-9 to 8-11), nonstandard pressure and temperature |
| [Instrument Flying Handbook, FAA-H-8083-15B](https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/FAA-H-8083-15B.pdf), chapters 4, 5, 10, 11         | pp. 5-2 to 5-9: paired static ports, port heaters, blockages, position error, sensitive altimeter, encoding, VSI; p. 4-13 and 10-23: icing; p. 11-8: pitot/static failure and the VSI glass       |
| [Aviation Maintenance Technician Handbook – Airframe, FAA-H-8083-31B](https://www.faa.gov/sites/faa.gov/files/FAA-H-8083-31B_Aviation_Maintenance_Technician_Handbook.pdf), chapter 10  | pp. 10-11 to 10-13: pitot tube, baffle and drain, heater, alternate static from the cabin, Y-connected ports; p. 10-20: position error; p. 10-81: water, drains, leak test                        |
| [Cessna 172S NAV III POH, 172SPHBUS-00](https://aerocadet.com/cbts/pdf/172S-POH.pdf) (the Information Manual copy cited in `aircraft/c172s/SOURCES.md`)                                 | Figures 2-1, 2-2, 5-1 Sheets 1 and 2; pp. 3-14, 3-15, 3-31, 3-32, 4-4 to 4-9, 7-12, 7-64                                                                                                          |
| [Cessna Model 172 Illustrated Parts Catalog, 172RPC24](https://mxdocs.thrustinstitute.com/wp-content/uploads/2025/06/172RPC-compressed-1.pdf) (as cited in `aircraft/c172s/SOURCES.md`) | 34-11-00 Figure 01, Pitot and Static System (conventional instruments), and Figure 02 (NAV III)                                                                                                   |

## Taken as printed

| What                                                                                                                                                                                              | Where                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Pitot tube: ram opening, small drain hole at the back of the chamber; both checked before flight; covers keep insects out                                                                         | PHAK p. 8-2; AMT p. 10-12 (baffle plate)     |
| Alternate static source in the flight deck; cabin pressure lower than outside by the venturi effect                                                                                               | PHAK pp. 8-2, 8-3; IFH p. 5-3; AMT p. 10-13  |
| With alternate static: altimeter slightly higher, ASI greater, VSI a momentary climb then stable                                                                                                  | PHAK p. 8-3; IFH p. 5-3                      |
| No alternate source: break the VSI glass; it "most likely renders the VSI inoperative" and "could cause additional instrument errors"                                                             | PHAK p. 8-3; IFH p. 11-8                     |
| Altimeter: sealed aneroid wafers in a case open to static pressure; Kollsman window; 28.00–31.00 inHg; 1 inHg ≈ 1,000 ft                                                                          | PHAK pp. 8-3, 8-5; IFH p. 5-4                |
| High to low and hot to cold, look out below                                                                                                                                                       | PHAK pp. 8-4, 8-5; IFH p. 5-7                |
| Altimeter more than 75 ft off the field elevation goes for recalibration                                                                                                                          | PHAK p. 8-7; IFH p. 5-5                      |
| VSI: diaphragm open to static, case through a calibrated leak; trend and rate; stabilizes after 6–9 seconds                                                                                       | PHAK pp. 8-7, 8-8; IFH p. 5-8                |
| ASI: diaphragm fed pitot pressure in a case at static pressure                                                                                                                                    | PHAK p. 8-8; IFH p. 5-8                      |
| Ram inlet blocked, drain open: ASI decreases to zero, "not usually instantaneous but happens very quickly"                                                                                        | PHAK p. 8-10, Figure 8-9                     |
| Ram inlet and drain blocked: pressure trapped; ASI changes with altitude only, "like an altimeter"                                                                                                | PHAK pp. 8-10, 8-11, Figure 8-10; IFH p. 5-3 |
| Static blocked: ASI low above the blockage altitude and high below; altimeter frozen; VSI a constant zero                                                                                         | PHAK p. 8-11, Figure 8-11; IFH p. 5-3        |
| Paired ports on either side keep sideslip from giving false static pressure; Y tubing                                                                                                             | IFH p. 5-2; AMT p. 10-13                     |
| Position error is greatest at low speed and with flaps; the POH tabulates it                                                                                                                      | IFH p. 5-3; AMT p. 10-20; PHAK p. 8-9        |
| Mode C: pressure altitude from 29.92 inHg in 100-ft increments                                                                                                                                    | IFH p. 5-7                                   |
| Small objects collect ice fastest; ice needs visible moisture and 0 °C or colder                                                                                                                  | IFH pp. 4-13, 10-23                          |
| Water in the lines gives "inaccurate or intermittent indications", worse if it freezes; drains at low points; leak test 1,000 ft, 1 minute, no more than 100 ft                                   | AMT p. 10-81                                 |
| Remove all blanking plugs, adaptors and adhesive tape after a test                                                                                                                                | AMT p. 10-81                                 |
| Heated pitot head under the left wing; static port on the left side of the forward fuselage; ALT STATIC AIR by the throttle; cabin pressure varies with open heaters, vents and windows           | POH p. 7-64                                  |
| Airspeed calibration, normal and alternate static source (both sheets, every row); Sheet 2's conditions                                                                                           | POH Figure 5-1, pp. 5-10, 5-11               |
| Static source blockage checklist: ALT STATIC AIR ON, cabin vents closed, CABIN HT and CABIN AIR ON, use Sheet 2                                                                                   | POH p. 3-15                                  |
| ALT STATIC AIR ON: maximum variation 11 kt and 50 ft with all windows closed                                                                                                                      | POH p. 3-32                                  |
| PITOT HEAT on in icing; check the tube warm to the touch within 30 seconds; pitot cover off; ALT STATIC AIR off (in); static opening clear                                                        | POH pp. 3-14, 3-31, 4-4 to 4-6, 4-9          |
| ASI markings white 40–85, green 48–129, yellow 129–163, red line 163 KIAS (the red arc is G1000 only); VFE 110 / 85 KIAS                                                                          | POH Figures 2-1, 2-2, pp. 2-4, 2-5           |
| Parts: heated pitot tube (body, tube, nose fitting, heater), pitot line 55.0 in, static line 16.0 in, static port button, sump, selector valve and knob, altimeter, VSI, ASI, blind encoder, tees | IPC 34-11-00 Figure 01                       |

The 172S NAV III's pitot head and static port feed the air data computer and the standby airspeed indicator and
altimeter (POH pp. 7-12, 7-64; IPC Figure 02). The component draws the conventional instruments of the parts
catalogue's Figure 01 (172 series 1996 and on), with its VSI and encoder, so that the handbooks' VSI cases can be
shown. The airspeed calibration is the NAV III POH's: both installations use the one pitot head and static port.

## How the POH's calibration is used

Figure 5-1 gives KIAS against KCAS for the normal (Sheet 1) and the alternate source (Sheet 2), flaps up, 10° and
full. The model puts the whole difference on the static source: at each row it solves for the pressure the source
must present for a perfect ASI to read the printed KIAS, and interpolates that (as a fraction of impact pressure) in
KCAS between rows, holding the end rows' fractions beyond them. A healthy system therefore reads each sheet's KIAS
exactly. The POH does not split its calibration into pitot, static and instrument errors, so the altimeter error that
follows from this (about 40 ft high at cruise, normal source) is a consequence of the assumption, not a published
number. The flap settings are the table's three; 20° has no row.

Sheet 2 holds only in its conditions (windows and ventilators closed; cabin heat, cabin air and defroster on
maximum). Outside them the POH gives the maximum variation (p. 3-32) and says the cabin pressure varies (p. 7-64). The
model adds 8 % to the table's cabin suction with the heat and air off, which keeps the variation within 3-32's 50 ft,
and doubles it with a vent or window open, which reaches about 10 kt; both are illustrative.

## Not published: chosen to fit

Everything in `PITOT_STATIC.model` (spec.ts):

- **Pneumatics.** The time constants of the pitot side through the ram inlet (0.03 s) and the drain (3 s, so a
  blocked inlet empties "very quickly"), of the static side through the port (0.15 s) and the alternate valve, the
  VSI case's calibrated leak (2.2 s, so the needle settles in 6–9 s with the airplane's own response) and its volume,
  the broken glass, the leaks (a seep that passes the leak test, a cracked fitting that fails it, a line off its
  fitting) and the pitot line leak. Flows are linear in pressure difference (laminar), and the time constants do not
  change with altitude; real calibrated leaks are compensated for that.
- **Pitot icing.** Accretion rate, the drain icing after the inlet, the head's temperature rise with the heater
  (warm to the touch well within the POH's 30 seconds) and the melting rate. The POH gives no heater power.
- **Water in the static line.** Its conductance sloshing between two values (intermittent), freezing at or below
  0 °C and thawing above.
- **Sideslip.** One per cent of impact pressure per degree on the windward side; a pair of ports cancels it. The 172S
  has one port; the pair is the handbooks' arrangement, not this airplane's.
- **The bench airplane.** Acceleration, vertical-speed response, level-off and the airspeed at which it leaves the
  ground. It is a pressure source, not a flight model; the rates and altitudes are whatever the controls ask.
- **The test set.** Its rates (it changes pressure slowly, as AMT p. 10-81 asks) and its adapters. The test is the
  handbook's 1,000-ft, one-minute check; 14 CFR part 43 Appendix E now asks only for a proof test "acceptable to the
  Administrator" for these airplanes, so follow the test equipment's and the airplane's maintenance instructions.
- **Instruments.** Ideal mechanisms with small pointer lags, calibrated to the standard atmosphere: no scale,
  hysteresis or friction error. The VSI is calibrated to standard density at the pressure it senses and stops at
  ±2,000 fpm. Dial faces are schematic, with the POH's markings.

The ICAO cold-temperature table (PHAK Figure 8-4) is not reproduced: the model's temperature error comes from a
constant deviation from standard temperature at every height, which gives errors of the same sign and order.

The 3D view is schematic, arranged like PHAK Figure 8-1 rather than the airplane: the pitot head, the port and the
instruments are drawn close together and larger than they are, and the lines are shortened.
