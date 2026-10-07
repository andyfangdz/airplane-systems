/**
 * Declarative catalogue of every modelled 1968 M20C component (N6947N, s/n 680194). Notes cite the 1965 Mark 21 (M20C)
 * Owner's Manual ("OM p. n"), the 1974 M20C Ranger Operator's Manual ("Ranger n-n"), the 1963 FAA Approved Flight Manual
 * ("AFM") and TCDS 2A3. Positions are in airplane coordinates (geometry.ts) unless a part has a `parent` moving group.
 *
 * One file per system group; each registers its parts when imported, in the order below:
 * - catalogue.ts: `CAT`, the `part` / `shell` / `surface` / `onSurf` helpers (with the pivoting-tail option) and the M20C's
 *   own per-frame animations (the shared ones are in lib/anims.ts)
 * - airframe.ts: fuselage, spinner, wing and tip shells; the stabilizer and fin shells of the pivoting tail
 * - surfaces.ts: flaps, ailerons, elevator, rudder
 * - structure.ts: firewall, bulkheads, steel-tube cabin frame, spars, hoist points, tail skid, empennage pivot, step, wing walk
 * - gear.ts: Johnson bar and sockets, torque tube, main and nose gear, brakes, gear lights and horn, pedals, reservoir
 * - engine.ts: propeller, O-360 and accessories, exhaust, cowl flaps, engine controls, ignition switch
 * - fuel.ts: fillers, drains, senders, vents, selector, boost pump
 * - electrical.ts: battery, relay, alternator, regulator, switch-breakers, breaker panel, radios, antennas
 * - lights.ts: navigation lights, beacon, landing light, cabin lights, switches
 * - vacuum.ts: vacuum regulator and filter, warning lights, turn coordinator; PC servos, cut-off valve, roll trim
 * - pitot.ts: pitot tube, static ports and drains, alternate static, stall vane and horn
 * - environment.ts: heat and vent junction box, scoops, outlets, controls
 * - cabin.ts: panel, glareshield, compass, seats, baggage, doors, storm window, control wheels, trim wheel, jack screw
 * - controls.ts: bellcranks, horns, rudder lever; flap pump, control, cylinder and torque tube
 * Part ids come from a global counter and the first part of each name gets the label pin, so keep the import order,
 * and let a section import anchors only from sections above it (importing a later one would register it first).
 */
export { CAT, surfacePivot } from "./catalogue";
export { TAIL_SHELLS } from "./airframe";
export { TAIL_SURFACE_KEYS } from "./surfaces";
import "./structure";
export { MG, NG } from "./gear";
export { PROP, CYLS } from "./engine";
export { SEL } from "./fuel";
import "./electrical";
export { LIGHTS } from "./lights";
import "./vacuum";
export { PITOT_Z, pitotBase, STAT_X, STALL_Z } from "./pitot";
import "./environment";
import "./cabin";
import "./controls";

export type { PartSpec, SurfaceSpec } from "@/lib/catalogue";
