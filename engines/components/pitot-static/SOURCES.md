# Pitot-static study model

This is a generic, unpressurized aircraft with conventional pneumatic instruments, not a certified installation.

## References

- FAA Pilot’s Handbook of Aeronautical Knowledge, FAA-H-8083-25C, chapter 8, [Flight Instruments](https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/phak/10_phak_ch8.pdf): pp. 8-1–8-3 (pressure distribution and alternate static), section “Vertical Speed Indicator” (calibrated leak), pp. 8-10–8-12, “Blockage of the Pitot-Static System,” Figures 8-9–8-11 (inlet/drain/static blockage and indication directions). Downloaded and inspected for this implementation.
- C172S NAV III POH, pp. 7-64 and 3-15/3-32, as already cited in `aircraft/c172s/parts/pitot.ts`: cabin alternate static and electrically heated pitot. Its aircraft-specific corrections are deliberately not applied to this generic component.
- Shared `engines/model/atmosphere.ts`: ISA troposphere pressure and density, constants and unit conversions.

## Deliberate approximations

Altitude is ISA pressure altitude, 0–18,000 ft, with standard sea-level weather pressure. TAS is 0–200 kt.
Dynamic pressure is incompressible ½ρV²; displayed IAS is ideal equivalent airspeed with no installation,
compressibility, or instrument calibration errors. Altimeter setting changes the pressure reference only.
Cabin pressure is ambient minus a user-selected constant 0–250 Pa (default 100 Pa), not a POH correction or
prediction of any window/vent configuration. Alternate selects cabin pressure instead of the external source.

The pitot and static lines use illustrative 0.15 s and 0.2 s response constants; the open drain vents in 0.7 s.
Leaks relax toward cabin pressure with a 0.3 s constant alongside any healthy supply, producing a qualitative
pressure-divider effect rather than a measured orifice flow. The VSI case equalizes through a 6 s first-order
lag; its pressure difference is converted to an altitude-rate approximation. It is not an instantaneous VSI.
Both closed pitot openings trap absolute pressure; no gas-temperature or elastic-volume effect is modeled.
A blocked external source traps static pressure unless alternate or a downstream leak supplies it.

Ice accumulation (0.08/s), melting with working heat (0.12/s), and sealing both pitot holes at 80% are teaching
choices, not icing/thermal predictions. Existing ice persists when icing exposure is removed. Manual blockages
represent non-ice obstructions and heat never clears them. Static icing is represented by the independent static
blockage control; pitot heat does not heat that port. No electrical bus, automatic failure detection, ADC faults,
water-column oscillations, instrument mechanical failures, or pressurized-cabin behavior is simulated.

Scenario selection injects failures at the current pressures and altitude; it resets other controls and ice but
preserves TAS, climb rate, barometric setting and cabin offset. Reset restores 5,000 ft / 120 KTAS, level flight.
Use the applicable AFM/POH and checklists for actual aircraft procedures and alternate-static corrections.
