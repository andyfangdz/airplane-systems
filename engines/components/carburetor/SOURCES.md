# Carburetor sources and how they were used

The page models the **Marvel-Schebler MA-4-5** float carburetor of the Lycoming O-360-A1D (the engine of the 1968
Mooney M20C, `engines/o360`). The engine it runs on is the O-360's own simulation; see `engines/o360/SOURCES.md` for
the engine's numbers.

## Documents

- **OI**: Marvel-Schebler Aircraft Carburetor Overhaul Instructions for models MA-4-5 and MA-4-5AA, Marvel-Schebler
  Products Division, Borg-Warner Corporation ([PDF](https://www.expaircraft.com/PDF/marvel-schebler-OH.pdf)). The copy
  is an extract (paragraphs 2-17 to 3-5) without page numbers, so it is cited by paragraph and figure.
- **AMT**: FAA-H-8083-32B, Aviation Maintenance Technician Handbook—Powerplant (2023), Chapter 2, Engine Fuel and Fuel
  Metering Systems ([PDF](https://www.faa.gov/sites/faa.gov/files/04_amtp_ch2.pdf)). Page numbers are the handbook's.
- **OM**: Lycoming O-360 series Operator's Manual, P/N 60297-12, as cited in `engines/o360/SOURCES.md`.
- **PHAK**: FAA-H-8083-25B, Pilot's Handbook of Aeronautical Knowledge (2016), Chapter 7, Aircraft Systems
  ([PDF](https://www.faa.gov/sites/faa.gov/files/09_phak_ch7.pdf)), for the primer.

## Taken as printed

| What                                                                                                                                                                                                                                                    | Where                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| MA-4-5 on the -A1D: single-barrel float type, manual mixture control, idle cut-off                                                                                                                                                                      | OM Table 1, pp. 1-2–1-3        |
| Carburetor on its pad under the sump (so the air flows up through it)                                                                                                                                                                                   | OM p. 1-2                      |
| Part names: throttle body, body and bowl, float and lever, float valve and seat, main and primary venturi, nozzle, idle tube and adjusting needle, mixture metering valve and sleeve, pump plunger and leather, check valves, bowl vent, inlet strainer | OI Figures 2-18 to 2-20        |
| Two floats, set 13/64 in at the float toes; never reset to cure flooding                                                                                                                                                                                | OI ¶2-27 y, ¶3-2 e and caution |
| Float valve test: 0.4 psi for 15 min, then 6.0 psi for 5 min                                                                                                                                                                                            | OI ¶3-2                        |
| Accelerating pump test: a solid stream that dies away as the plunger spring reaches its limit; tube A 11/64, B 1/4 in                                                                                                                                   | OI ¶3-3                        |
| Throttle stop bolt set so the valve is cracked to idle when starting                                                                                                                                                                                    | OI ¶2-27 n                     |
| Idle adjustment on a warm engine                                                                                                                                                                                                                        | OI ¶3-1                        |
| Six subsystems of a float carburetor; float chamber, needle valve partly open while running, fuel ~1/8 in below the nozzle holes, vent                                                                                                                  | AMT pp. 2-9–2-10               |
| Venturi functions; nozzle at the throat; main metering jet; 0.5 inHg to raise fuel to the discharge level                                                                                                                                               | AMT pp. 2-10–2-11              |
| Idling system: idling jet at the throttle valve's edge, fed by the low pressure on the engine side                                                                                                                                                      | AMT p. 2-12                    |
| Rotary mixture metering valve in a stationary sleeve                                                                                                                                                                                                    | AMT p. 2-14                    |
| Accelerating pump: piston pump on the throttle linkage; fuel seeps back if pushed slowly                                                                                                                                                                | AMT p. 2-13                    |
| Icing in the venturi and on the throttle valve; throttle ice on its engine side                                                                                                                                                                         | AMT pp. 2-8–2-9                |
| Icing range, mixture cooled up to 70 °F, falling MAP with a constant-speed propeller, heat from an exhaust jacket                                                                                                                                       | OM pp. 3-8–3-9                 |
| Carburetor inlet pressure 0.5–8.0 psi, 3.0 desired                                                                                                                                                                                                      | OM p. 3-10                     |
| Idle mixture check: a momentary rise of about 50 rpm leaning to cut-off                                                                                                                                                                                 | OM pp. 5-4–5-5                 |
| Provision for a primer system on all engines with a carburetor; fuel-injected engines need none                                                                                                                                                         | OM p. 1-3                      |
| Prime with 1 to 3 strokes of the manual priming pump (float carburetor start); overpriming keeps the engine from starting                                                                                                                               | OM p. 3-1, p. 6-1              |
| The primer draws fuel from the tanks and vaporizes it directly into the cylinders; lock it when not in use; in a fuel-pump system it is fed beside the carburetor                                                                                       | PHAK p. 7-25, Figure 7-30      |

## Not published: model and drawing constants

The engine model's carburetor constants (bowl contents, idle circuit flow, accelerating charge, where the main system
takes over from the idle jet, heat rise, how fast ice builds and how much it blocks) are in `engines/o360/spec.ts` and
are model constants, not Marvel-Schebler data. `engines/model/accelerator-pump.ts` now owns the spring-driven pump:
rapid opening gives a decaying discharge; slow displacement bypasses back to the bowl (AMT p. 2-13; OI ¶3-3).
The engine withdraws that discharge from the bowl and adds it to the ports; the cutaway reads the same state.
Its 0.6 s downstroke time constant, 0.15 s return and 0.12 stroke/s bypass capacity are illustrative. `accelLb` is
swept capacity, not guaranteed delivered fuel. The model does not separately track pump-cylinder fuel inventory.
This page adds only display constants: the needle's drawn lift and the primer stroke's timing. The primer's fuel per stroke is the engine model's (`primeLb`),
not published; where its tee, pump, line and nozzle sit is the airframe's, drawn schematically. The 3D shapes, sizes and spacing are schematic, arranged after the OI's exploded views.

The OI lists a power jet and an air metering pin; the documents in hand don't say how they act in this model, so they
are not drawn or modelled.

The circuit readout now uses `meteredAir`, excluding downstream intake leaks, just as the kernel does. Previously
it recomputed the idle/main split using all cylinder air. See [the research and audit](../../FUEL-METERING-RESEARCH.md).
