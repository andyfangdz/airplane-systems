# Piston cylinder

This is a kinematic four-stroke teaching cutaway, using the existing IO-390 specification and shared
`engines/model/cycle.ts` slider-crank, volume and valve-lift functions.

- Bore, stroke, compression ratio and 20° BTC ignition timing: Lycoming IO-390-C Series Installation and
  Operation Manual, January 2017, Table A-1, pp. 51–52; see [IO-390 sources](../../io390/SOURCES.md).
- Rod length and valve events are the existing model's illustrative assumptions, **not published Lycoming data**.
  Valve lift is a normalized sin² animation, not a measured cam profile.
- The upright orientation, cutaway, piston thickness, valve sizes, crank webs, colours and spark duration are
  illustrative. Colours identify strokes, not measured gas temperature or pressure.
- Playback speed is a teaching control, not operating engine RPM. No combustion, pressure, load, friction,
  heat transfer or engine performance is solved. Chamber volume is geometric, including clearance volume.

Phase zero is firing top dead centre: power 0–180°, exhaust 180–360°, intake 360–540°, compression 540–720°.
Valve events intentionally overlap these nominal stroke boundaries.
