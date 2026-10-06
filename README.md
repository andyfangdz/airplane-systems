# Airplane Systems

Interactive 3D study models of four airplanes' systems, built from **POH/AFM Section 7 – Airplane and Systems**: the Cirrus SR20 G6, the Cessna 172S NAV III (G1000 + GFC 700), the Cessna 182T NAV III (G1000 + KAP 140) and the Diamond DA40 XLS (G1000 + GFC 700). Pick an airplane and a system to fly the camera to it, hover parts for notes, and operate switches, levers and failures. The systems are linked: pull an alternator and the buses, displays and alert window respond. Each airplane keeps its own switch positions when you switch to another, and the URL hash (`#c172s/electrical`) names the view shown.

Built with **Next.js 16 (App Router)**, **React Three Fiber**, **drei** and **zustand**.

> Unofficial study aid. Always use the POH/AFM and supplements for your serial number.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run typecheck
```

## What's modelled

The SR20 is described below. The Cessnas and the DA40 cover their own POH/AFM Section 7 the same way (see each airplane's rail), with a NAV III / DA40 electrical solver, live G1000 PFD/MFD textures and a working autopilot (GFC 700 or KAP 140) driving a simple flight-state model.

| SR20 system | Interactive |
| --- | --- |
| Flight controls | Cable runs from POH Figs 7-1/7-2/7-3: torque tube, sectors, pulleys, push-pull tubes and bellcranks move with the yokes and pedals; per-channel focus (elevator / aileron / rudder); horn balances, trim tabs, static wicks |
| Wing flaps | UP / 50% / 100% with position lights and VFE; needs the FLAPS breaker and NON ESS bus |
| Gear & brakes | Differential braking castering the nose wheel, parking brake |
| Engine & propeller | Ignition key (magneto → plug mapping), power lever (governor schedule), mixture, alternate air |
| Fuel | Selector, boost pump, tank quantities (clipped fuel level), starvation |
| Electrical | Master switches, failures, battery endurance, **pullable circuit breakers**, G6 CAS names |
| Lighting | NAV / STROBE / LAND / ICE switches: wingtip nav, strobe, aft position and landing lights (no tail light, no cowl light), ice inspection lights; cabin and convenience lights |
| Environmental | OFF–0–1–2–3 fan knob, temperature blend, vent modes, A/C, recirculation |
| Pitot-static & stall | Pitot heat logic and annunciations, stall-warning suction peak and horn |
| Avionics | Live PFD / MFD / standby textures that go dark with their buses; display backup |
| CAPS | Scrubbable deployment: rocket extraction, slider, snubbed riser, line cut, descent |

## Project structure

```
app/                  Next.js App Router entry (layout, page, icon, global CSS)
components/
  App.tsx             Shell: fleet picker, system rail, toolbar, alert window, HUD, tooltip, panel; URL hash and tab title
  scene/              Shared React Three Fiber scene: Scene (canvas, camera flights, sim clock), Part / Shells,
                      ControlSurface, Flows, Links, Tanks, Screens, LightFX, WindowOutlines, PinDeclutter
  avionics/           GFC 700 and KAP 140 panel controls (keys, AFCS status strip, G1000 knobs)
  ui/controls.tsx     Seg, Slider, Check, Rocker, Readouts, Facts, HoldButton, …
aircraft/             One folder per airplane, plus cessna/ (shared Cessna NAV III base) — see aircraft/README.md
lib/
  view.ts             View state shared by every airplane (airplane, system, toggles, theme, camera); phone breakpoint
  fleet.ts            Airplane / system selection, remembered view, URL hash
  systems.ts          Airplane ids, system ids, palette
  catalogue.ts        Declarative part catalogue with label lists
  simStore.ts         createSimStore: one zustand store per airplane (discrete state + derived solution)
  avionics/           G1000 display drawing, flight-state integrator, GFC 700 and KAP 140 logic (pure functions)
  geometry.ts, materials.ts, math.ts, registry.ts, canvas.ts
```

### State model

- **View state** (which airplane and system, x-ray, labels, theme, camera requests, hover) is shared in `lib/view.ts`.
- **Discrete state** (switches, levers, selections) lives in each airplane's zustand store as an immutable `Sim` object. Every update recomputes that airplane's solution `E` (buses, powered loads, …) with a pure `solve` function that is easy to test.
- **Continuous values** (RPM, flap angle, flight state, autopilot state, CAPS time) live in each airplane's mutable `live` object advanced in `useFrame`, so animation doesn't re-render React. Panels that show them use a small `useTicker` hook.

How to add an airplane, and where each kind of code goes: [aircraft/README.md](aircraft/README.md).

## Sources

SR20 (each other airplane cites its POH/AFM, supplements and CRG in its files and panels):

- Cirrus SR20 POH, P/N 11934-005 Reissue A — Section 7 (systems), Section 1 Figure 1-1 (three view, used for the fuselage profile), and a few Section 2 limits.
- Side photos of SR20 G6 OO-CBB (s/n 2347), Wikimedia Commons — tailcone, fin and window outlines.
- Costanzo Air Flight School, *Cirrus SR20 Systems* deck — G6 CAS names, electrical readouts, battery-endurance rule of thumb, and photo detail (horn balances, static wicks, OAT probes, ECS knob). Where it differs from the POH, the POH wins and the page says so.

Geometry is approximate. CAS text is illustrative except where Section 7 names it.
