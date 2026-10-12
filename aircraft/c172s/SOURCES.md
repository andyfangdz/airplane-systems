# C172S NAV III / GFC 700 source record

The reference model remains the normally aspirated IO-360-L2A, fixed-pitch propeller,
G1000 NAV III/GFC 700 installation represented by N6189Q, serial 172S10738. The depth
expansion was researched against the documents below, actually inspected on 12 October 2026.
No dimensions were inferred from an illustrated parts catalogue as certified installation
coordinates. Butt lines, heights, passage shapes, cable paths, connector packing and all
small-part dimensions remain schematic.

## Inspected primary sources

| Document and exact public source                                                                                                                                                                                                                         | Inspected printed references                                                                                                                                                                                                                                                                                                                                                                                                                                    | Used for                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cessna 172S NAV III/GFC 700 POH, compiled Revision 4 Section 7, [Section 7 Airplane and System Description](https://www.scribd.com/document/1070031279/Section-7-Airplane-and-System-Description)                                                        | 7-5–7-7/Fig 7-1; 7-13–7-15/Fig 7-2; 7-23/Fig 7-3; 7-24–7-28; 7-29–7-38; 7-39–7-45/Fig 7-6; 7-46; 7-47–7-58/Fig 7-7Sheets 1–3; 7-62–7-63/Fig 7-8; 7-64–7-67/Fig 7-9; 7-68–7-74/Fig 7-10; 7-79–7-80                                                                                                                                                                                                                                                               | Configuration, crew controls, seats/restraints/doors, oil and injection topology, all-cylinder CHT/EGT, pressure-source independence, vacuum/standby attitude, power feeds, four separate cooling fans, CO/ELT boundaries. Compiled pages legitimately retain earlier issue suffixes where unchanged.                                                                                                                                                           |
| Cessna 172S NAV III/GFC 700 Information Manual172SIMBUS-00, original 20December 2007, [complete PDF](https://aerocadet.com/cbts/pdf/172S-POH.pdf)                                                                                                        | Section 4,4-4–4-10; Section 7 cross-checks above; printed cover/applicability                                                                                                                                                                                                                                                                                                                                                                                   | Complete original POH text cross-check and guided preflight. This information-manual copy duplicates172SPHBUS-00 for applicable GFC 700 serials; it is not a claim to have inspected a complete currentRevision 4 POH. Preflight implementation records this original issue explicitly.                                                                                                                                                                         |
| Cessna Model172R/172S Illustrated Parts Catalog172RPC24, Revision 24,1 July 2016, [complete PDF](https://mxdocs.thrustinstitute.com/wp-content/uploads/2025/06/172RPC-compressed-1.pdf)                                                                  | 21-20-00 Fig 01; 21-21-00Figs 01/02; 21-40-00 Fig 01; 23-30-00 Fig 01; 23-50-00NAV III audio figures; 24-34-00 Fig 02; 24-50-00power module; 25-10-00crew/rear seat figures; 25-60ELT; 26-20extinguisher; 27-10/27-30control installations; 27-50-00Figs 01/02; 28-21-00 Fig 01; 28-40quantity; 32-30-00 Fig 01; 32-32-00Figs 01/02; 37-10-00 Fig 07; 52-10/52-10-02door/latch; 77-20sensor installations; 79-20breather; 79-30-00oil instruments; 80-10starter | Actual mechanisms: actuator coupling/screw/switch bar/two microswitches, seat controls/tracks, door latch/hinge, master-cylinder parking lock, wheel bearings/caliper piston/lining/bleeder, ventilation valve arms/springs, separate vacuum regulator filter, sensor wiring/support hardware. Apply NAV III/S serial branches; analog/R installations are not transplanted. IPC is parts evidence, not a replacement for maintenance procedures or tolerances. |
| Lycoming IO-360-L2A Illustrated Parts CatalogPC-IO-360-L2A, June 2025, [manufacturer PDF](https://www.lycoming.com/sites/default/files/file/2025-06/PC-IO-360-L2A_0.pdf)                                                                                 | Fig 4pp8–9; Fig 10pp20–21; Fig 11pp22–23; Fig 12pp24–25; Fig 15pp30–31; Fig 17pp34–35; Fig 20pp40–41; Fig 21pp42–43; Fig 22pp44–45; Fig 24magnetos/harnesses; Fig 25starter/ring gear                                                                                                                                                                                                                                                                           | Wet-sump pickup/screen, accessory oil pump, pressure relief, filter/cooler bypass, galleries/return, pushrods/rockers/valve springs, head drain tubes, RSA injection hardware, ignition harness and starter gear. The inverted manifold option is not the study configuration.                                                                                                                                                                                  |
| Lycoming Operator's Manual60297-12, O/HO/IO/AIO/HIO/TIO-360 Series, [manufacturer PDF](https://www.lycoming.com/sites/default/files/file/2025-11/60297-12%20-%20O-360%2C%20HO-360%2C%20IO-360%2C%20AIO-360%2C%20HIO-360%2C%20and%20TIO-360%20Series.pdf) | Section 1 pp. 1-2–1-3; applicable engine model tables; Sections3/7 system descriptions                                                                                                                                                                                                                                                                                                                                                                          | RSA air/fuel-pressure relationship, engine-driven impeller oil pump/wet-sump lubrication, fuel-system priming and independent magneto ignition. Other engine variants' dry-sump/turbo arrangements are excluded.                                                                                                                                                                                                                                                |
| Garmin G1000 NAV III Line Maintenance Manual190-00352-00, Rev K, July2007, [complete PDF](https://www.aeroelectric.com/Reference_Docs/Cessna/cessna-maintenance-manuals/G1000-CessnaNavIII-LineMaintenanceManual-CessnaNavIII-2.pdf)                     | 1-1–1-7, Figs 1-1/1-2, LRU descriptions and navigation/control interfaces                                                                                                                                                                                                                                                                                                                                                                                       | Display/IAU HSDB Ethernet, GRS/GDC ARINC 429, GEA-to-both-GIAs RS-485, GMU powered from GRS with RS-485, GTX/GMA serial links, GSA 81/GSM 85 mount/servo and GFC 700 RS-485. Explicitly separate older KAP 140 analog outputs from GFC 700 paths.                                                                                                                                                                                                               |
| Garmin G1000 Pilot's Guide for Cessna NAV III 190-00498-07, Rev A, October 2011, [manufacturer PDF](https://static.garmin.com/pumac/190-00498-07_0A_Web.pdf)                                                                                             | Section 1.1pp1–7: system overview and LRU interconnect; GFC 700 applicability/revision history                                                                                                                                                                                                                                                                                                                                                                  | Corroborates two GIAs paired to their corresponding displays rather than directly Ethernet-paired; instrumentation and redundant data paths. Optional receiver/traffic equipment in this fleet-wide guide is not evidence of equipment fitted to N6189Q.                                                                                                                                                                                                        |

## Context and configuration limits

- The POH defines separate oil-pressure switch/transducer functions and all-cylinder
  CHT/EGT sensors. A GEA 71 fault now blanks engine data without stopping the mechanical
  engine, oil pump or magnetos. Digital delivery and aircraft power are distinct routes.
- The fuel model keeps BOTH/LEFT/RIGHT, gravity tank feeds, reservoir, auxiliary pump,
  shutoff, strainer, mechanical pump, RSA servo, metered flow transducer/manifold, nozzles
  and the return/check path. Powered cranking turns the mechanical pump even before
  `running`; START without starter power does not. Particle motion depicts availability,
  not quantitative fuel flow, pressure or pump capacity.
- GFC 700 servo receiver power follows the AUTO PILOT breaker; each GIA has its own
  RS-485 connection (Garmin line maintenance 1-4/1-7). A healthy GIA's data cue can remain
  available after the other GIA loses power, while the autopilot still disconnects.
  Connection availability and overall AFCS availability are separate teaching states.
- Vacuum remains applicable to this serial's mechanical standby attitude indicator.
  Revision 4's GI275/no-vacuum configuration from 172S12701 is excluded. A severe inlet
  restriction is an illustrative complete-loss teaching fault, not a maintenance diagnosis
  or a modeled restriction/suction curve. The separate regulator filter is shown but has
  no invented automatic failure timer.
- POH 7-73 specifies **four** cooling fans: forward ventilation, aft avionics rack, PFD
  heat sink and MFD heat sink. The new fan failure controls affect the named forward/aft
  motors independently from display power. No thermal-shutdown temperature/time is inferred.
- A mechanical flap jam holds actual position with an energized motor; the existing
  illustrative load and transit rate remain explicitly assumptions. No automatic breaker
  trip delay or certified microswitch rigging adjustment is claimed.
- Parking brake is a mechanical locking arrangement at the applied master cylinders;
  there is no invented hydraulic parking shutoff valve. Gear-mounted wheel hardware and
  attached brake lines are legitimately exterior. Internal balances, cables, wiring and
  duct bodies are checked against the complete fuselage/wing/stabilizer/fin envelopes.
- ELT selection retains the ME406 reference but its actual installation/operating details
  require the aircraft-specific Section 9 supplement. No uninspected ELT supplement, ELT
  battery endurance or bus dependency is introduced. The standard ECS is exhaust-shroud
  heat and ram ventilation; no air-conditioning installation is assumed.
- [Cessna Owner Organization: unbalanced fuel draw with BOTH](https://cessnaowner.org/unbalanced-fuel-draw-in-182-with-selector-set-to-both/)
  (27 October 2022; inspected by the research coordinator) mixes older182 accounts and
  a172-owner observation about cap/vent behavior. It is context for keeping cap/vent/gauge
  roles distinct, not authority for172S serial 10738 routing, dimensions or operating instructions.
- Baseline breaker ratings absent from the POH remain marked unverified/photo-derived;
  the expansion does not assign extra ratings to individual J-box feeder breakers.
  Source drawings/part catalogues do not establish the aircraft's present equipment list.

## Verification boundary

`tests/c172s-depth-containment.test.ts` checks every internal part vertex in its actual
neutral parent transform and all complete curved tube walls against the real curved
skin union; only narrowly named genuine port/probe connections have aperture envelopes.
The fleet guard independently repeats centerline and tube-wall checks. Tests also cover
cold cranking, boost priming, idle cutoff, unpowered START, GEA/fan isolation, jammed flap,
restricted vacuum, matching pressure-port endpoints and presentation-only engine filters.
These are consistency tests of an approximate educational model, not certified clearance,
maintenance, AFM performance or airworthiness checks.

The ignition harness uses the POH 7-36 cross-fire assignment and the exact visible plug
ports: left magneto fires upper-left/lower-right; right fires lower-left/upper-right.
Lycoming IPC Fig 24 p. 49 specifies two impulse Slick 4371 magnetos. This reference model
retains both enabled during START; an unverified right-mag grounding jumper is not inferred.
Oil/ignition availability follows powered cranking or shaft rotation as well as running.
CO detection remains integrated with G1000 as described in POH 7-80; no new wire asserts
an unverified engine-airframe-unit termination.
