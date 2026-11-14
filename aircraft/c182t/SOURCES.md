# C182T Skylane NAV III / KAP 140 sources

This model represents the naturally aspirated **Cessna 182T with Lycoming IO-540-AB1A5, McCauley B3D36C431/80VSA-1 three-blade nonfeathering propeller, early G1000 NAV III and Bendix/King KAP 140**. The existing Paramus club-aircraft geometry references N8050J (18281633) and N21200 (18281732). A later GFC 700, GIA 63W/WAAS upgrade, T182T turbo installation or replacement ELT must be treated as a different installation.

The primary documents below were downloaded and their listed pages actually inspected. Printed page numbers and ATA figure identifiers are preferred over PDF offsets. Maintenance drawings establish component roles and connections; almost all butt lines, heights, case shapes, cable bends and internal cutaway dimensions remain schematic. The whole rendered internal geometry is checked against this model's skins, which are themselves approximate.

## Selected airplane POH and approved supplements

**Cessna 182TPHAUS-04, Revision 4, 22 December 2005**:

- [Sections 1–8 scan, issued for N780CP / 18281780](https://www.dentoncap.org/uploads/182T-POH-Section-1-8.pdf).
- [Full scan including approved supplements](https://petit-cessna-voyageur.com/wp-content/uploads/2012/12/pilot-handbook.pdf).
- The scanned full copy's Supplement 3 cover is **182TPHAUS-S3-01, Revision 1, 24 June 2004**. The pre-existing model also documents Supplement 3 Revision 2 for the club serials; that later supplement remains the authority for existing autopilot behavior where explicitly identified in the UI. No GFC 700 servo or flight-director architecture was added.

Inspected locators used by this expansion:

| Locator                                 | Evidence and modeled consequence                                                                                                                                                                                                                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-5; 2-6                                | Exact engine and propeller models; 230 hp at 2,400 RPM; blade pitch 14.9°–31.7° at the 30-inch station. Existing propeller cycle and governor behavior retained.                                                                                                                                   |
| 4-6–4-11                                | Preflight sequence, each wing sump, external static openings, stall warning and pitot heating, fan checks and narrow physical inspection regions. The wing overlays identify the tip and leading edge; no undocumented stall strips are invented.                                                  |
| 4-12–4-14, 4-27–4-28; 7-43              | Boost-pump priming, warm/flooded start and starter duty limit. A powered starter mechanically turns the engine-driven fuel pump before the engine-running flag; upstream and metered feed gates remain consistent.                                                                                 |
| Figure 7-1 Sheets 1–2; 7-5–7-7          | Cable/pulley/bellcrank control paths, elevator downspring and rudder-trim bungee. Pulley geometry and internal doorpost bends remain approximate. Exposed control horns are distinguished from internal balance weights.                                                                           |
| 7-19–7-21; 7-46; 8-21                   | Nose steering bungees, fixed gear, hydraulic wheel brakes, parking handle and servicing. Actual integral-reservoir master-cylinder construction is supplemented by the maintenance manual below.                                                                                                   |
| 7-28–7-33                               | GEA 71 and separate MAP, RPM, oil pressure/temperature, fuel flow, six CHT and six EGT channels. Electronic indication power is separate from mechanical oil and magneto operation.                                                                                                                |
| 7-34–7-37                               | Oil pickup/filter/relief/cooler/gallery/governor circuit; crossed-bank magneto assignments; alternate induction air; individual exhaust risers, mufflers and cowl-flap cooling.                                                                                                                    |
| Figure 7-6; 7-38–7-45                   | Integral tanks, aft-only outlet pickup, two aft-doorpost manifolds, dual-stack selector supply and selected-tank return, ten wing sump drains, two overboard vents, cross-vent and vacuum-vented filler caps. Electrical float signals are separate from fuel plumbing.                            |
| Figure 7-7 Sheets 1–3; 7-46–7-57        | Battery/alternator/starter/external-power contactors, main-current shunt, separate feeder A/B protection, essential/crossfeed diodes, independent essential/AV1 inputs and AV2-only loads. The standby output fuse is explicitly 25 A; primary feeder ratings are not printed and are not guessed. |
| 6-20; 7-46–7-47                         | Selected edition's main battery is 24 V / 12.75 Ah. The later 2007 edition's 8 Ah and other equipment variants are not silently substituted.                                                                                                                                                       |
| Figure 7-8; 7-60–7-62                   | Heated shroud air, fresh-air blend, cabin manifold, two defrost outlets and independent unheated wing-root ventilation. Cabin air controls are mechanical and work without electrical buses.                                                                                                       |
| Figure 7-9; 7-62–7-65                   | Pitot/static input to electronic and mechanical instruments; single engine-driven vacuum pump for the standby attitude gyro, regulator and pressure transducer. Vacuum loss does not remove GRS 77 attitude or the KAP 140's turn-coordinator input.                                               |
| 7-66–7-70                               | Separate GRS 77/GDC 74A, two GIA 63 units, GMA 1347, GEA 71, GTX 33, GDL 69A option, antenna roles and four cooling fans. Standby essential power supports the selected essential LRUs but **none of the four cooling fans**.                                                                      |
| 7-75                                    | Optional CO detector and 50 PPM annunciation threshold. CO concentration remains a teaching approximation.                                                                                                                                                                                         |
| Supplement 1, S1-3–S1-5                 | Pointer 3000-11/4000-11 ELT: five alkaline C cells, inertial switch, independent transmitter battery and panel remote control. No aircraft-bus power dependency or modern 406 MHz upgrade is inferred.                                                                                             |
| Supplement 3, S3-3–S3-8 and S3-10–S3-24 | KAP 140, separate DC turn coordinator, computer/servo power through AUTO PILOT and separate WARN annunciation/disconnect functions. Existing self-test, mode, failure and trim interactions preserved.                                                                                             |

## Cessna aircraft maintenance manual

**182SMM14, Model 182/T182 Series (1997 and On), Revision 14, 1 July 2007**, manufacturer-authored hosted scans:

- [AeroElectric scan](https://www.aeroelectric.com/Reference_Docs/Cessna/cessna-maintenance-manuals/Cessna_182S_1997on_MM_182SMM.pdf).
- [Independent scan used for powerplant sections](https://petit-cessna-voyageur.com/wp-content/uploads/2016/01/c2b0c2b0c2b0-cessna_182s_1997on_mm_182smm.pdf).

This is a family manual with mixed chapter revision dates. Only passages applicable to 182T/Garmin G1000 were used; older 182S conventional-panel and T182T turbo paragraphs were separated explicitly.

| ATA / printed locator                                      | Inspected evidence                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12-12-00 p. 301; 32-20-00 pp. 208–211                      | Hydraulic shimmy damper has a compensating piston; Lord rubber damper is a different variant. The modeled hydraulic type is illustrative, not a claim about the club airplane's installed damper.                                                                                                                                                                           |
| 21-21-00 pp. 201–205                                       | Four G1000 fans: PFD, MFD, deckskin/windshield and remote tailcone/rack. Conventional-panel firewall cooling fan is not substituted for this topology.                                                                                                                                                                                                                      |
| 21-40-00 p. 201                                            | Cable-controlled heat/fresh-air valve and distribution. Family text describes series left-to-right shroud flow; see the POH/manual disagreement below.                                                                                                                                                                                                                      |
| 24-00-00 p. 1                                              | Main battery and interlocking MASTER; production-specific 30 A fuse / 30 or 40 A feeder breaker differences. Unknown selected-airframe feeder rating remains unassigned.                                                                                                                                                                                                    |
| 24-30-10 p. 201, Figures 201–202                           | Standby battery behind the PFD; **one** controller PCB behind the switch panel. Added controller, test load and fuse replace the former coarse controller box rather than depicting two controllers.                                                                                                                                                                        |
| 24-61-01 Figure 201 Sheet 2, p. 203                        | Essential/crossfeed diode installation, one-way primary-bus feeds.                                                                                                                                                                                                                                                                                                          |
| 28-20-00 Figure 1 Sheet 2; Figure 204; p. 206 / Figure 205 | 182T supply/return system, float sender, two vent check valves, bypass bleed for positive thermal pressure, crossover line and access panels 510KB/610KB. Tank breathing and thermal pressure relief are distinct functions.                                                                                                                                                |
| 32-42-00 p. 201, Figures 201–203                           | **Two** pilot master cylinders with integral individual reservoirs, copilot mechanical linkage, rigid/flexible wheel lines and mechanical parking cable/ratchet holding both piston rods. No separate common reservoir or hydraulic parking shutoff valve is transplanted.                                                                                                  |
| 34-11-00 p. 201, Figure 201 Sheet 2 / p. 203               | G1000 pitot/static branches to GDC and standby ASI/altimeter; one condensation sump at each static port and cockpit alternate source. The G1000-specific schematic includes a **direct static branch to the autopilot**. KAP 140 pressure sensing remains independent of ADC electrical failure; blocked static freezes pressure-derived altitude/VS in the teaching model. |
| 34-23-00 p. 201                                            | GRS 77 calibrated tailcone mounting tray.                                                                                                                                                                                                                                                                                                                                   |
| 34-50-10 p. 201                                            | GIA 63 remote tailcone rack; GIA 63W/WAAS is a separate equipment variant.                                                                                                                                                                                                                                                                                                  |
| 37-10-00 pp. 201, 207                                      | G1000 installation's single vacuum pump, gyro inlet filter, separate regulator filter and pressure-transducer tee. Older twin-pump conventional-panel manifold is excluded.                                                                                                                                                                                                 |
| 71-00-01 pp. 1–7; 74-10-00 p. 201                          | IO-540-AB1A5, RSA-5AD1 and **two Slick 6351 impulse-coupled magnetos**, 23° BTDC. No SlickSTART or battery ignition booster is transferred.                                                                                                                                                                                                                                 |
| 71-10-00 pp. 201, 208                                      | Two bottom cowl flaps with separate mechanical control cable/clevis connections.                                                                                                                                                                                                                                                                                            |
| 71-60-00 pp. 201–203; 71-70-00 p. 201                      | Induction filter/elbow/servo/runners and left forward firewall fluid/vapor drain cluster. Drain passages have no invented continuous flow.                                                                                                                                                                                                                                  |
| 77-20-00 pp. 1, 201; 77-30-00 p. 201                       | Six CHT and six clamped EGT probes; distinct manifold-pressure pneumatic and electrical connections.                                                                                                                                                                                                                                                                        |
| 78-10-00 p. 201                                            | Exhaust slip joints/springs and family muffler/heater layout. Selected POH topology governs the model where it disagrees.                                                                                                                                                                                                                                                   |
| 79-20-00 pp. 201–202; 79-20-10 p. 201; 30-20-00 p. 201     | Remote cooler inlet/outlet hoses, bracket/baffle/seal; **air/oil separator is turbo-only**. Naturally aspirated 182T has direct crankcase breather and winterization insulation provision.                                                                                                                                                                                  |

## Garmin G1000 NAV III

- **190-00498-00, Revision A**, [G1000 Cessna NAV III Pilot's Guide](https://static.garmincdn.com/pumac/G1000%3ACessnaNavIII_PilotsGuide.pdf). Printed pp. 1-1–1-3 and 1-12–1-13 were inspected for early NAV III system overview, LRU roles and reversionary display operation. This guide supports the early GIA 63 / GDU 1040 architecture; later GFC 700 guidance is not applied.
- **190-00352-00, Revision K, July 2007**, [G1000 Cessna NAV III Line Maintenance Manual](https://www.aeroelectric.com/Reference_Docs/Cessna/cessna-maintenance-manuals/G1000-CessnaNavIII-LineMaintenanceManual-CessnaNavIII-2.pdf). Printed pp. 1-1–1-7 were inspected, including Figures 1-1 and 1-2. Revision K contains both KAP 140 and GFC 700 paths and identifies them separately.

| Printed locator | Implemented distinction                                                                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-2             | GIA-to-display HSDB Ethernet; separate display-to-display HSDB; GMA RS-232 configuration/control.                                                                                                               |
| 1-3, 1-6        | GRS 77 ARINC 429 attitude/heading to displays and both GIAs; GPS aiding from both GIAs; ADC airspeed aiding; GMU 44 RS-485 data and power from GRS. GDC 74A is a separate ADC, not an integrated second ADAHRS. |
| 1-3             | GEA 71 RS-485 engine/airframe data to both GIAs; RS-232 configuration is distinct from normal sensor telemetry.                                                                                                 |
| 1-4, 1-7        | GTX 33 RS-232 to both GIAs; GDL 69A Ethernet weather/control to MFD and separate entertainment audio to GMA.                                                                                                    |
| 1-7             | **GIA #2 analog HSI signals to KAP 140**. GFC 700 GSA 81/GSM 85/RS-485 servo paths are excluded.                                                                                                                |

Radio/antenna coax is shown separately from digital data. Coax routes terminate just inside the actual modeled antenna mounting region; the exterior antenna elements are correctly marked exterior. No RF reception/performance or wire gauge is simulated.

## Lycoming engine construction and exact parts

- **PC-IO-540-AB1A5**, January 2016, superseding PC-615-10B: [official illustrated parts catalog](https://www.lycoming.com/sites/default/files/attachments/IO-540-AB1A5%2520Parts%2520Catalog%2520PC-IO-540-AB1A5.pdf).
- **60297-10 / 60297-10-3**, O-540/IO-540 Operator's Manual: [official publication page](https://www.lycoming.com/content/operator%27s-manual-O-540-IO-540-60297-10-3), [official PDF](https://www.lycoming.com/sites/default/files/attachments/O%2520%2526%2520IO-540%2520Oper%2520Manual%252060297-10.pdf).

Inspected IPC pages:

| Figure / printed pages         | Hardware                                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Fig. 4, 6–7; Figs. 5–6, 8–11   | Oil relief ball/spring/adjustment, hydraulic tappets, crankshaft, idler/cam/tach drives.                                |
| Fig. 8, 14–15; Fig. 10, 18–20  | Six rods/pistons/pins, twelve pushrods/shrouds and rockers, six rocker covers/gaskets.                                  |
| Fig. 11, 22–23                 | Six head-oil drain tubes and **four** intercylinder baffles: three LW-15839 and one LW-16838 between cylinders 1 and 3. |
| Fig. 12, 24–25; Fig. 14, 28–29 | Six induction sleeves, twelve clamps, suction screen 70484 and sump/induction housing.                                  |
| Fig. 16, 32–33; Fig. 18, 36–37 | Driving/driven pump impellers, oil-filter base and separate cooler temperature-control valve 53E22144.                  |
| Fig. 22, 46–47                 | Two impulse Slick 6351s, two shielded ignition harnesses and twelve plugs.                                              |

Operator manual §1 pp. 1-1–1-2, §2 p. 2-5 and §5 p. 5-1 confirm six-cylinder direct drive, odd/right and even/left numbering, tappet/pushrod/rocker chain, accessory oil pump, AB-series rating, firing order **1-4-5-2-3-6**, 23° BTDC and harness attachment. Ignition lead assignments retain the selected POH's exact crossed-bank upper/lower mapping.

## Installed McCauley propeller

- **MPC26-06, Revision 6, 17 June 2022**: [official maintenance manual](https://mccauley.txtav.com/-/media/mccauley/files/manuals/mpc26.pdf). Applicability lists B3D36C431. Inspected 61-00-04 p. 1 and Figure 3 pp. 4–5: C400 three-blade constant-speed **nonfeathering** bearing/actuating-link/piston/yoke/spring construction.
- [Official McCauley Propeller Systems technical guide](https://mccauley.txtav.com/-/media/mccauley/files/mccauleytechguide.ashx?hash=FCF71880DA80672E0A29939FCF2DE86897F5C3D7&la=en), printed pp. 5–7: governor pump, flyweights, speeder spring and pilot-valve overspeed/underspeed direction.

Engine/governor oil pressure produces high pitch; internal spring and blade centrifugal moment produce low pitch. The sealed red-dyed bearing lubricant is **isolated from governor/engine oil**. No feathering counterweights, accumulator or reversing system is added. The internal cutaway explains the existing runtime governor and prop-cycle behavior; it does not replace them.

## Source disagreements and limits

- **Heating and exhaust:** the selected POH Figure 7-8 depicts separate left/right heat streams and 7-36 describes singular tailpipe wording. The family MM 21-40-00/78-10-00 describes serial heater shrouds and two tailpipes. The model retains the selected POH topology; maintenance joint hardware is illustrative. These family descriptions are not silently combined into a new topology.
- **Alternate-static checklist conflict:** selected POH 4-8 prints ALT STATIC AIR OFF with “pull full out,” while emergency 3-13 and system description 7-62 identify pulling ON as the alternate cabin source. The existing valve/panel simulation follows Sections 3/7; the guided preflight asks for NORMAL/OFF and flags the textual disagreement for the actual placard/current POH.
- **MAP transducer location:** the POH equipment-list arm and maintenance access prose differ. Existing schematic source-arm placement is retained; pressure and electrical signal paths are distinguished.
- **Battery, alternator, feeder, lighting and damper variants:** selected 12.75 Ah main battery, optional 60/95 A alternator, unknown primary feeder ratings and installed damper uncertainty remain explicit. Club serials below 18281742 use the earlier single front flood-light arrangement; the selected scan also documents later two-light serials.
- **AHRS/AP disagreement:** POH 3-26 and the applicable Supplement 3 describe different surviving lateral modes after AHRS loss. The existing supplement-based model and its UI note are preserved; new wiring does not claim to resolve the disagreement.
- **No failure physiology invented:** vent thermal bleed and filter/cooler bypass passages are explained, but no tank-pressure, differential-filter-pressure or thermostatic valve solver was invented. Such bypass paths remain explanatory without active flow particles.
- **Static pressure:** independent KAP 140 plumbing is source-supported; blockage/alternate-static effects use the same simplified pressure indication model as the standby instruments. No detailed pressure transducer or tubing time constant is asserted.
- **Presentation:** engine filters select ignition, induction, exhaust, fuel, oil and sensor geometry for study. They change visibility only. Internal full meshes, neutral moving-group transforms, 600-point flow centerlines and rendered tube walls are checked; narrowly named pitot/static/vent/external-power stubs are the only bounded exterior-port exceptions.

Type-club context inspected by the parent research review:

- [Cessna Flyer, Inspection Tips for the Cessna 182](https://www.cessnaflyer.org/cessna-models/cessna-singles/cessna-182/inspection-tips-for-the-cessna-182) concerns Continental-powered 1962–86 airplanes. Its bladder/carburetor/AD advice is not transferred to the restart IO-540/integral-tank 182T.
- [Cessna Owner, Unbalanced Fuel Draw in 182 With Selector Set to Both](https://cessnaowner.org/unbalanced-fuel-draw-in-182-with-selector-set-to-both/), 27 October 2022, discusses 1975P/1973P/182E vent/cap/rigging hypotheses. It is context rather than proof of this 182T installation; the 182T maintenance manual controls the two-vent design.
- The CPA Restart 182 manual endpoint and the Bendix/King official KAP 140 pilot-guide endpoint were attempted but did not return a usable document (404 and HTML respectively). Neither is represented as a downloaded/read source. The approved Cessna Supplement 3 and Garmin's explicit KAP 140 interconnect remain the inspected authorities.

## Cabin routing verification

Long avionics/audio connections use underfloor and sidewall lanes; roof and wing connections reach a headliner rail before descending. These schematic bends preserve the documented connections and clear the modeled seat and display volumes. Complete tube vertices, triangle centers and edge midpoints are checked against occupied cabin space and actual seat meshes, alongside the existing skin-containment checks.

## Shared component and geometry pipeline

`parts/hardware-detail.ts` explicitly selects existing source-cited equipment for more legible
cases, covers, actuator housings and filter media. Their installation envelopes, system roles
and optional-equipment rules remain those of the cited parts. Surface seams, internal finish,
pleat spacing and displayed mechanism travel are illustrative, not manufacturer measurements.
No connector counts, terminal layouts or new equipment ratings are inferred.

Mechanical throttle/mixture/governor sheath routes retain this aircraft's control architecture
and cite the applicable POH/AFM in their part notes. Bend radii, ferrules and attachment offsets
are schematic. The control details respond to the existing simulation state; no new dynamics
or electrical dependencies are introduced. Geometry is built through the same source catalogue
and lossless meshoptimizer pipeline as the SR22T. Tests check envelope containment, independent
control operation, route clearance and byte-exact encoded/decoded geometry.

## Working openings and mechanisms

POH 7-25–26 describes the cabin doors and top-hinged opening door windows; 7-21 describes baggage access. Existing outlines now cut real apertures. Glazing, outside handles and window hardware move with the appropriate cabin/window group; the left baggage panel opens separately. Internal latch construction remains schematic rather than borrowing unverified C172S hardware.

The shared curved-skin triangulation, panel parenting and strut helpers use the same source catalogue and
lossless prebuilt pipeline as the SR22T. Opening angles, hinge/anchor offsets, clearances, hardware shapes and
mechanism travel are illustrative, not manufacturer rigging dimensions. Existing station profiles and traced
outlines are retained. Functional/surface checks and remaining fleet gaps are listed in [MODELING.md](../../MODELING.md).

### Cabin finishes and open-door clearance

The same cabin/door sources above support the fixed cabin enclosure; floor height, lining inset and jamb thickness
are illustrative drawing offsets. Solid mode covers systems behind the floor and trim; X-ray retains their visibility.
Roof wiring uses fixed structure around the entrance rather than descending through the door aperture. Endpoint and
connection topology are retained; approximate mounting positions are adjusted where necessary to stay on fixed trim.
See `MODELING.md` and the doorway-clearance regression tests for the limits of this spatial check.

Opening-clearance follow-up uses the same door sources above. Hinge stand-off, seal inset and jamb subdivision
are illustrative model corrections verified against the unchanged exterior loft; see `MODELING.md`.

Forward-post trim encloses the Figure 7-1 control runs; its section is illustrative.
The lining ends at the traced wraparound roof glazing and cuts both rear side-window regions.

## Optional BRS-182 parachute (STC, not in the POH)

The BRS view models a user-selectable option, **off by default**: the Ballistic Recovery Systems BRS-182 whole-airplane
parachute. It is an STC installation with its own AFM supplement, not part of POH 182TPHAUS-04, and whether any
particular airplane has it is in that airplane's equipment list. Facts were checked on 2026-11-13.

Primary sources:

| Source                                                                                                                                                                                                                                                 | Locator                    | Used for                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [BRS-182 System Description](https://www.brsaerospace.com/pdf/BRS_Cessna_182_White_paper.pdf): excerpt of the BRS-182 Installation Manual, Doc. 9005-IM Rev C, 12/2/2004                                                                               | p. 1-1                     | Aluminum canister in the baggage compartment; deployment bag, rocket lanyards and rear attachment harness inside it; vacuum-formed ABS cover that breaks away; solid-propellant rocket mounted aft of the canister under a fiberglass shield                                                                                                                                                                                            |
| same                                                                                                                                                                                                                                                   | p. 1-2, Figs. 2–3          | Four-point woven Kevlar harness: two front straps through a slot in the rear window and across the top skin to the front wing attachment points, under a fiberglass fairing; two rear straps stowed in the baggage area, attached to a custom rear attachment assembly on the aft cabin primary structure                                                                                                                               |
| same                                                                                                                                                                                                                                                   | p. 1-3, Fig. 4             | “the rocket motor will penetrate the rear window and extract the parachute away from the airplane, peeling the two forward attachment harness straps away from the aircraft top skin and extracting the rear harness straps from inside the aircraft”; the rear strap length is limited to control pitch until the deployment cycle is complete                                                                                         |
| same                                                                                                                                                                                                                                                   | pp. 1-3 – 1-4, Figs. 5–6   | Rear harness of two lengths; the shorter held by a ring-and-link release (more than 100 to 1) and a nylon cord cut by a pyrotechnic line cutter; “The eight second fuse on the line cutter is initiated when the line cutter release pin is pulled as the parachute is extracted”; the longer section is folded and stitched to absorb shock; then “the airplane assumes its touchdown attitude of approximately ten degrees nose down” |
| same                                                                                                                                                                                                                                                   | p. 1-5, Fig. 7             | Activation handle in a protective fiberglass box “on the floor between and slightly forward of the pilot/copilot”; cover, then a pull of “at least 40 lbs”; first few inches take up cable slack; stainless-steel cable in a Teflon-lined housing under the carpet; mechanical igniter, no electrical source, unarmed normally; ≈ 25 to 30 lb to fire the igniter directly                                                              |
| same                                                                                                                                                                                                                                                   | pp. 1-6 – 1-7, Figs. 8–9   | BRS-900 rocket motor; dual-firing-train percussion igniter (½ in. plunger travel, two firing pins and shotgun primers, black powder/magnesium boosters)                                                                                                                                                                                                                                                                                 |
| same                                                                                                                                                                                                                                                   | pp. 1-8, 1-10              | Warning: “The BRS-182 Parachute Canister must not be opened by anyone other than authorized factory personnel.”; 2,400 sq. ft. round parachute with an annular slider; Kevlar or nylon textiles                                                                                                                                                                                                                                         |
| [FAA AD 2008-02-18](https://ad.easa.europa.eu/blob/20080218.pdf/AD_US-2008-02-18_1) (Amdt 39-15348, 73 FR 4051, effective 28 Feb 2008); [CASA AD/CESSNA 180/91](https://services.casa.gov.au/airworth/airwd/ADfiles/under/cessna180/CESSNA180-091.pdf) | Applicability; requirement | STC SA01999CH, BRS-182 Parachute System, on the 182G – 182T, T182 and **T182T**: the 182T is listed. Replace the pick-up collar support and two retaining screws per BRS SB 07-02 (8 June 2007) within 25 hours time in service                                                                                                                                                                                                         |

Secondary sources, shown in the panel only as such:

- [AOPA, 4 Oct 2017](https://www.aopa.org/news-and-media/all-news/2017/october/04/brs-announces-cessna-parachute-installation-network): “The maximum deployment speed is 133 knots, but there are no additional flight envelope restrictions”; 85 pounds added for a Cessna 182; “10-year repack cycle”; line cutters replaced every five years; installed in the baggage area.
- [Tennessee Aircraft Services, 2019](https://www.tennesseeaircraft.net/2019/12/11/182-ballistic-recovery-system/) (installer): the pack sits almost all the way to the right side and takes about a third of the baggage area; holes are cut in the cabin-top skin near the forward wing attach points; about seventy pounds added. The weight differs from AOPA's figure.
- [Aircraft Spruce](https://www.aircraftspruce.com/catalog/pspages/brs-parachutes-ga.php): a six-year repack schedule for BRS canisters generally, which differs from AOPA's ten years for this system.
- G1000 applicability: the AD's model list names no avionics; sale listings of 2007 G1000 182Ts include the BRS-182 (e.g. [aircraftdealer.com](https://aircraftdealer.com/aircraft-for-sale-detail/Cessna-182-/2007-CESSNA-182T-SKYLANE/81477.htm)).

**Not found, so not modelled:** the BRS-182 AFM/POH supplement (document number, limitations, minimum deployment
altitude or altitude loss, emergency procedure including any engine, fuel, electrical, seat-belt or door steps, placard
wording, preflight items such as a safety pin), a BRS-182 descent rate, and an authoritative repack or rocket-motor
interval. The STC certificate itself was not retrieved from FAA DRS; an STC listing mirroring FAA data gives 08/08/2002
with later revisions, while AOPA puts the 182 kit's approval in 2004.

**Layout:** the manual's Figures 1–4 are undimensioned drawings. Fig. 1 draws the canister as an upright column standing
in the baggage compartment, about three times as tall as it is wide and leaning slightly; Fig. 2 draws the two front
straps leaving at the top of the rear window on the centreline and running forward under a fairing; Fig. 3 draws the
rear attachment assembly as a crossbar between a plate on each side wall; Fig. 4 draws a rear strap from each side of the
aft cabin. The Tennessee Aircraft Services photographs agree: a tall canister with its top just under the rear window,
the rocket standing upright on a bracket just aft of it, a Kevlar strap bolted to a lug on a riveted side plate just
below the window sill, the crossbar, and a slot cut in the rear window near its top edge.

**Approximate in the model:** nothing is dimensioned, so the canister's size and place in the baggage area (right side,
after the installer; drawn vertical), the rocket's position, the crossbar and side-plate station, the rear-window slot
station, the strap, fairing and cable routes, how the two rear harness sections join the two side legs, and the handle
box's size are illustrative; the fiberglass strap fairing is not drawn. In the deployment,
only the order of events, the eight-second fuse (shown starting at line stretch) and the ≈ 10° nose-down touchdown
attitude come from the manual. Rocket and line-stretch times, the inflation rate, the nose-low angle on the short rear
section and the canopy's drawn size (the shared 2,400 ft² CAPS canopy) are illustrative.
