// Accessory-local coordinates. Foreshortened exploded stations keep each stack aligned with its shaft or bore.
import * as THREE from "three";
import { alternatorBell } from "./accessories";
import { box } from "@/lib/geometry";
import { coil, gear, merge, rod, tube, zrod } from "../kit";
import { bolt, nut, plate, sleeve, stations, type Detail, type Point } from "./shapes";

export type Motion =
  | "shaft"
  | "driven"
  | "armature"
  | "carrier"
  | "planet"
  | "solenoid"
  | "diaphragm"
  | "regulator"
  | "divider"
  | "mixture"
  | "flyweight"
  | "shiftLever"
  | "pumpLever"
  | "pilot";
export type Internal = Detail & { pivot?: Point; motion?: Motion };
export type Accessory = "magneto" | "alternator" | "starter" | "governor" | "servo" | "divider" | "pump" | "filter";
const alongX = (g: THREE.BufferGeometry) => g.rotateY(Math.PI / 2);
const ring = (ri: number, ro: number, a: number, b: number) => alongX(sleeve(ri, ro, a, b));
const helix = (r: number, wire: number, a: number, b: number, turns: number) => alongX(coil(r, wire, a, b, turns));
const axis = (x: number): Point => [x, 0, 0];

function builder(source: string) {
  return (
    name: string,
    material: Detail["material"],
    geometry: THREE.BufferGeometry,
    spread: Point,
    role: string,
    motion?: Motion,
    pivot?: Point,
  ): Internal => ({
    name,
    material,
    geometry,
    spread,
    note: role + " " + source,
    role,
    motion,
    pivot,
  });
}

function magneto(retard: boolean): Internal[] {
  const p = builder("Champion L-1363J §§6–7 and 11.2, Slick 4300 series. Contours and spacing approximate.");
  const points = (y: number) =>
    merge([box(0.004, 0.005, 0.026).translate(0, y, 0), rod(0.003, 0.007).translate(0, y, -0.011)]);
  return [
    p(
      "Magnetic rotor",
      "mag",
      merge([rod(0.005, 0.086), rod(0.017, 0.023, 4).translate(0.006, 0, 0)]),
      axis(0.115),
      "The permanent magnet turns with the engine-driven shaft.",
      "shaft",
    ),
    p(
      "Drive-end oil seal",
      "black",
      ring(0.005, 0.012, 0.039, 0.043),
      axis(0.155),
      "Seals the rotating shaft at the drive end.",
    ),
    p("Rotor bearing", "steel", ring(0.005, 0.014, 0.027, 0.034), axis(0.187), "Supports the rotor shaft."),
    p(
      "Coil core and pole shoes",
      "darkSteel",
      merge([
        box(0.025, 0.007, 0.045).translate(0, 0.024, 0),
        ...[-1, 1].map((s) => box(0.025, 0.027, 0.006).translate(0, 0.013, s * 0.021)),
      ]),
      [0.06, 0.065, 0],
      "The magnetic circuit carries rotor flux through the ignition coil.",
    ),
    p(
      "Ignition coil",
      "copper",
      coil(0.011, 0.0014, -0.018, 0.018, 13).translate(0, 0.024, 0),
      [0.06, 0.11, 0],
      "The secondary winding supplies the spark voltage when the primary circuit opens.",
    ),
    p(
      "Breaker cam",
      "steel",
      rod(0.008, 0.006, 4).translate(-0.019, 0, 0),
      axis(-0.14),
      "The cam opens the breaker points as the rotor turns.",
      "shaft",
    ),
    p(
      "Primary breaker points",
      "bearing",
      points(0.009).translate(-0.019, 0, 0),
      [-0.14, 0.045, 0],
      "Interrupt the primary circuit at firing time.",
    ),
    ...(retard
      ? [
          p(
            "Retard breaker points",
            "bearing",
            points(-0.009).translate(-0.019, 0, 0),
            [-0.14, -0.045, 0],
            "The second set provides retarded ignition during starting.",
          ),
        ]
      : []),
    p(
      "Ignition capacitor",
      "steel",
      rod(0.006, 0.025).translate(-0.012, -0.023, 0),
      [-0.083, -0.061, 0],
      "Limits arcing across the contacts.",
    ),
    p(
      "Rotor pinion",
      "gear",
      gear(0.008, 12, 0.006, 0.003).translate(-0.027, 0, 0),
      axis(-0.186),
      "Drives the distributor gear.",
      "shaft",
    ),
    p(
      "Distributor gear",
      "magCap",
      gear(0.016, 24, 0.006, 0.003).translate(-0.027, 0, 0),
      axis(-0.186),
      "One distributor revolution routes four sparks.",
      "driven",
      [0, 0.024, 0],
    ),
    p(
      "Distributor electrode",
      "bearing",
      box(0.002, 0.015, 0.003).translate(-0.037, 0.006, 0),
      axis(-0.225),
      "Carries high voltage from the carbon brush to successive towers.",
      "driven",
      [0, 0.024, 0],
    ),
    p(
      "Distributor carbon brush",
      "black",
      rod(0.0025, 0.009).translate(-0.045, 0.024, 0),
      axis(-0.253),
      "Transfers coil voltage to the rotating electrode.",
    ),
    p(
      "Drive shaft cotter pin",
      "steel",
      tube(
        [
          [0, -0.005, 0],
          [0, 0.006, 0],
          [0.001, 0.007, 0.001],
          [0.002, 0.004, 0.001],
        ],
        0.0008,
        8,
        6,
      ).translate(0.053, 0, 0),
      axis(0.241),
      "M2556 locks the drive nut.",
      "shaft",
    ),
    p(
      "Drive shaft nut",
      "steel",
      alongX(nut(0.004)).translate(0.047, 0, 0),
      axis(0.216),
      "M3019 secures the drive gear.",
      "shaft",
    ),
    p(
      "Drive shaft washer",
      "steel",
      ring(0.004, 0.008, 0.045, 0.047),
      axis(0.197),
      "M3172 seats under the drive nut.",
      "shaft",
    ),
    p(
      "Rotor Woodruff key",
      "steel",
      rod(0.003, 0.002)
        .rotateY(Math.PI / 2)
        .translate(-0.027, 0.004, 0),
      [-0.186, 0.029, 0],
      "M2536 locates the rotor gear.",
      "shaft",
    ),
    p(
      "Bearing cap",
      "acc",
      ring(0.006, 0.017, -0.015, -0.012),
      [-0.065, 0.045, 0],
      retard ? "K3630 retains the bearing." : "K3485 retains the bearing.",
    ),
    ...[-1, 1].flatMap((sign, i) => [
      p(
        `Bearing cap clamp (${i + 1})`,
        "darkSteel",
        box(0.003, 0.01, 0.006).translate(-0.016, sign * 0.015, 0),
        [-0.089, 0.045, 0],
        "M3018 bears on the edge of the bearing cap.",
      ),
      p(
        `Bearing cap screw (${i + 1})`,
        "steel",
        alongX(bolt(0.0018, 0.009)).translate(-0.018, sign * 0.018, 0),
        [-0.112, 0.045, 0],
        "M3221 secures the bearing cap clamp.",
      ),
      p(
        `Coil wedge (${i + 1})`,
        "darkSteel",
        box(0.02, 0.003, 0.005).translate(0, 0.03, sign * 0.018),
        [0.06, 0.145, 0],
        "M3040 retains the coil in the frame.",
      ),
      p(
        `Distributor block spacer (${i + 1})`,
        "steel",
        ring(0.002, 0.004, -0.047, -0.04).translate(0, 0.012, sign * 0.015),
        [-0.206, 0.077, 0],
        "M3826 locates the block.",
      ),
      p(
        `Distributor block screw (${i + 1})`,
        "steel",
        alongX(bolt(0.0019, 0.014)).translate(-0.049, 0.012, sign * 0.015),
        [-0.239, 0.077, 0],
        "M3021 secures the distributor block.",
      ),
    ]),
    p(
      "Coil retaining screw",
      "steel",
      alongX(bolt(0.0019, 0.012)).translate(0, 0.033, 0),
      [0.06, 0.17, 0],
      "M3020 secures the coil assembly.",
    ),
    p(
      "Distributor block",
      "magCap",
      merge([
        ring(0.003, 0.022, -0.049, -0.044),
        ...stations(4, 0.016).map(([y, z]) => rod(0.0036, 0.009).translate(-0.049, y, z)),
      ]).translate(0, 0.011, 0),
      [-0.18, 0.078, 0],
      "K3822 supports the four high-tension outlets.",
    ),
    ...stations(3, 0.034, 0.034, Math.PI / 3).map(([y, z], i) =>
      p(
        `Distributor housing screw (${i + 1})`,
        "steel",
        alongX(bolt(0.0025, 0.016)).translate(-0.042, y, z),
        [-0.091, 0.095, 0],
        "M3015 joins the distributor housing to the magneto frame.",
      ),
    ),
    ...stations(3, 0.034).map(([y, z], i) =>
      p(
        `Harness cap screw (${i + 1})`,
        "steel",
        alongX(bolt(0.0025, 0.013).rotateY(Math.PI)).translate(-0.068, y, z),
        axis(-0.1),
        "M1553 secures the harness cap.",
      ),
    ),
  ];
}
function alternator(length: number): Internal[] {
  const p = builder("Hartzell ES1031 §2.3, Fig. 2.3. Representative brush-type alternator.");
  const x = -0.02 - length / 2;
  const claws = (flip: boolean) =>
    merge([
      ring(0.006, 0.031, -0.002, 0.002),
      ...stations(6, 0.028, 0.028, flip ? Math.PI / 6 : 0).map(([y, z]) =>
        new THREE.ConeGeometry(0.009, 0.027, 4)
          .rotateZ(flip ? Math.PI / 2 : -Math.PI / 2)
          .translate(flip ? -0.013 : 0.013, y, z),
      ),
    ]);
  return [
    p(
      "Slip-ring end housing",
      "alt",
      alternatorBell(length, true),
      [-0.06, 0.042, 0],
      "The rear housing carries the slip-ring end bearing and rectifier.",
    ),
    p(
      "Rotor shaft",
      "steel",
      rod(0.006, length + 0.031).translate(x, 0, 0),
      axis(-0.16),
      "Carries the field rotor, slip rings and pulley.",
      "shaft",
    ),
    p(
      "Front claw pole",
      "darkSteel",
      claws(true).translate(x + 0.015, 0, 0),
      axis(-0.088),
      "Interleaved poles carry the rotor field across the air gap.",
      "shaft",
    ),
    p(
      "Rear claw pole",
      "darkSteel",
      claws(false).translate(x - 0.015, 0, 0),
      axis(-0.207),
      "The second pole piece closes the magnetic circuit.",
      "shaft",
    ),
    p(
      "Rotor field winding",
      "copper",
      helix(0.015, 0.0018, x - 0.012, x + 0.012, 8),
      axis(-0.148),
      "Direct current through the rotating winding creates the field.",
      "shaft",
    ),
    p(
      "Stator laminations",
      "darkSteel",
      ring(0.035, 0.053, -length - 0.014, -0.028),
      [0, 0.108, 0],
      "The stationary laminated core supports the three-phase output windings.",
    ),
    p(
      "Stator windings",
      "copper",
      merge(
        stations(12, 0.037).map(([y, z]) =>
          new THREE.TorusGeometry(0.009, 0.0028, 7, 14).rotateY(Math.atan2(z, y)).translate(x, y, z),
        ),
      ),
      [0, 0.167, 0],
      "The rotating field induces three-phase AC in the stator.",
    ),
    ...[-1, 1].map((s) =>
      p(
        s < 0 ? "Slip-end bearing" : "Drive-end bearing",
        "steel",
        ring(0.006, 0.014, -0.003, 0.003).translate(x + s * (length / 2 - 0.005), 0, 0),
        axis(s < 0 ? -0.245 : 0.048),
        "Supports the rotor at this end of the housing.",
      ),
    ),
    ...[0, 1].map((i) =>
      p(
        `Field slip ring (${i + 1})`,
        "bearing",
        ring(0.006, 0.009, -0.002, 0.002).translate(x - length / 2 + 0.012 + i * 0.006, 0, 0),
        axis(-0.27 - i * 0.021),
        "Carries excitation current between a brush and the rotor winding.",
        "shaft",
      ),
    ),
    ...[0, 1].map((i) =>
      p(
        `Field brush (${i + 1})`,
        "black",
        box(0.004, 0.012, 0.006).translate(x - length / 2 + 0.012 + i * 0.006, 0.014, 0),
        [-0.27 - i * 0.021, 0.035, 0],
        "The spring-loaded carbon brush contacts its slip ring.",
      ),
    ),
    p(
      "Rectifier heat sink",
      "alt",
      alongX(sleeve(0.018, 0.041, -0.002, 0.002, 0.16, 5.9)).translate(x - length / 2 + 0.008, 0, 0),
      [0, -0.108, 0],
      "Carries heat away from the rectifier bridge.",
    ),
    ...stations(6, 0.03).map(([y, z], i) =>
      p(
        `Rectifier diode (${i + 1})`,
        "black",
        rod(0.004, 0.008).translate(x - length / 2 + 0.008, y, z),
        [-0.044, -0.108, 0],
        "One branch of the full-wave bridge converts AC output to DC.",
      ),
    ),
    ...stations(4, 0.054, 0.054, Math.PI / 4).map(([y, z], i) =>
      p(
        `Housing through-bolt (${i + 1})`,
        "steel",
        alongX(bolt(0.003, length + 0.011)).translate(-0.016, y, z),
        axis(0.091),
        "Clamps the alternator end housings.",
      ),
    ),
  ];
}
// Illustrative reduction gear tooth counts; the engine's ring-to-pinion ratio is separate.
export const reduction = { sun: 18, planet: 21, ring: 60, pitch: 0.00045 };
function starterReduction(): Internal[] {
  const p = builder("Hartzell ES1033 §2.3. Representative planetary reduction; tooth counts illustrative.");
  const r = reduction;
  const radius = (teeth: number) => (teeth * r.pitch) / 2;
  const gearX = -0.025;
  const disk = new THREE.Shape().absarc(0, 0, 0.017, 0, 2 * Math.PI, false);
  const bore = Array.from({ length: r.ring * 4 }, (_, i) => {
    const a = (i * Math.PI) / (r.ring * 2),
      rr = radius(r.ring) + (i % 4 < 2 ? -0.00034 : 0.00034);
    return new THREE.Vector2(rr * Math.cos(a), rr * Math.sin(a));
  });
  disk.holes.push(new THREE.Path(bore.reverse()));
  return [
    p(
      "Starter reduction ring gear",
      "darkSteel",
      alongX(plate(disk, -0.0025, 0.0025)).translate(gearX, 0, 0),
      axis(0.072),
      "The internal ring is held stationary.",
    ),
    p(
      "Starter sun gear",
      "gear",
      gear(radius(r.sun), r.sun, 0.004).translate(gearX, 0, 0),
      axis(0.1),
      "The armature drives the central sun gear.",
      "armature",
    ),
    ...stations(3, radius(r.sun + r.planet)).map(([y, z], i) =>
      p(
        `Starter planet gear (${i + 1})`,
        "gear",
        gear(radius(r.planet), r.planet, 0.004, 0.0014).translate(gearX, 0, 0),
        axis(0.1),
        "Each planet rolls around the fixed ring on its carrier pin.",
        "planet",
        [0, y, z],
      ),
    ),
    p(
      "Starter planet carrier",
      "steel",
      merge([
        ring(0.003, 0.012, gearX + 0.003, gearX + 0.006),
        ...stations(3, radius(r.sun + r.planet)).map(([y, z]) => rod(0.0014, 0.008).translate(gearX, y, z)),
      ]),
      axis(0.13),
      "The carrier turns the clutch at reduced speed.",
      "carrier",
    ),
  ];
}
function starter(): Internal[] {
  const p = builder(
    "Sky-Tec Flyweight LS fit guide and Hartzell ES1033 §2. Representative permanent-magnet starter mechanism.",
  );
  return [
    p(
      "Starter armature",
      "darkSteel",
      merge([rod(0.006, 0.058), rod(0.018, 0.023, 16)]).translate(-0.043, 0, 0),
      axis(-0.105),
      "Armature current produces torque in the permanent-magnet field.",
      "armature",
    ),
    p(
      "Starter armature windings",
      "copper",
      merge(stations(8, 0.014).map(([y, z]) => box(0.028, 0.004, 0.004).translate(-0.043, y, z))),
      axis(-0.15),
      "Conductors on the rotating armature carry motor current.",
      "armature",
    ),
    p(
      "Starter commutator",
      "bearing",
      merge(stations(14, 1).map((_, i) => alongX(sleeve(0.006, 0.011, -0.064, -0.057, (i * Math.PI) / 7, 0.39, 4)))),
      axis(-0.193),
      "Brushes supply current through the rotating copper segments.",
      "armature",
    ),
    ...[-1, 1].map((s, i) =>
      p(
        `Starter field magnet (${i + 1})`,
        "mag",
        alongX(sleeve(0.022, 0.032, -0.059, -0.028, s < 0 ? 0.12 : Math.PI + 0.12, 2.88)),
        [-0.066, 0, s * 0.055],
        "A stationary pole establishes the motor field.",
      ),
    ),
    ...[-1, 1].map((s, i) =>
      p(
        `Starter brush (${i + 1})`,
        "black",
        box(0.006, 0.011, 0.006).translate(-0.06, s * 0.015, 0),
        [-0.193, s * 0.027, 0],
        "Supplies motor current at the commutator.",
      ),
    ),
    ...starterReduction(),
    p(
      "Starter overrunning clutch",
      "darkSteel",
      ring(0.006, 0.015, -0.026, -0.009),
      axis(0.16),
      "Transmits starter torque and overruns when the engine accelerates.",
    ),
    p(
      "Starter solenoid winding",
      "copper",
      helix(0.009, 0.0011, -0.057, -0.023, 14).translate(0, 0.045, 0),
      [-0.064, -0.047, -0.069],
      "The energized solenoid draws its plunger into the coil.",
    ),
    p(
      "Starter solenoid plunger",
      "steel",
      rod(0.007, 0.036).translate(-0.042, 0.045, 0),
      [-0.117, -0.047, -0.069],
      "Moves the operating lever when START is engaged.",
      "solenoid",
    ),
    p(
      "Starter shift lever",
      "darkSteel",
      box(0.004, 0.045, 0.006).rotateZ(0.21),
      [0.064, -0.047, -0.069],
      "Links the solenoid to the pinion drive.",
      "shiftLever",
      [-0.019, 0.024, 0],
    ),
    p(
      "Starter contact disc",
      "bearing",
      rod(0.009, 0.003).translate(-0.061, 0.045, 0),
      [-0.154, -0.047, -0.069],
      "Closes the motor current circuit during engagement.",
      "solenoid",
    ),
  ];
}
function governor(): Internal[] {
  const p = builder("FAA-H-8083-32B ch. 7, governor and constant-speed propeller. Internal contours illustrative.");
  const x = 0.048;
  return [
    p(
      "Governor pump drive gear",
      "gear",
      gear(0.008, 12, 0.007, 0.002).translate(0.037, 0, 0),
      axis(0.087),
      "Boosts engine oil pressure together with the idler.",
      "shaft",
    ),
    p(
      "Governor pump idler gear",
      "gear",
      gear(0.008, 12, 0.007, 0.002).translate(0.037, 0, 0),
      axis(0.087),
      "Turns opposite the pump drive gear.",
      "driven",
      [0, 0.016, 0],
    ),
    p(
      "Governor flyweight carrier",
      "darkSteel",
      rod(0.018, 0.005).translate(x, 0, 0),
      axis(0.129),
      "The governor drive rotates the flyweight carrier.",
      "shaft",
    ),
    ...[-1, 1].map((s, i) =>
      p(
        `Governor flyweight (${i + 1})`,
        "steel",
        merge([box(0.019, 0.006, 0.009), box(0.005, 0.012, 0.009).translate(-0.006, -s * 0.003, 0)]).translate(
          0.008,
          0,
          0,
        ),
        axis(0.168),
        "Centrifugal force acts against the speeder spring.",
        "flyweight",
        [x, s * 0.015, 0],
      ),
    ),
    ...[-1, 1].map((s, i) =>
      p(
        `Governor flyweight pivot pin (${i + 1})`,
        "steel",
        zrod(0.002, -0.007, 0.007).translate(x, s * 0.015, 0),
        axis(0.195),
        "The flyweight pivots on this pin.",
        "shaft",
      ),
    ),
    p(
      "Governor pilot valve",
      "steel",
      merge([rod(0.0025, 0.042), ...[-0.009, 0.002].map((v) => rod(0.005, 0.004).translate(v, 0, 0))]).translate(
        x + 0.008,
        0,
        0,
      ),
      axis(0.236),
      "Spool lands meter oil to or from the propeller in response to speed error.",
      "pilot",
    ),
    p(
      "Governor speeder spring",
      "spring",
      helix(0.007, 0.0011, 0.059, 0.083, 8),
      axis(0.276),
      "Opposes the flyweight force. Power-lever linkage sets its loading.",
    ),
  ];
}
const fuelSource =
  "FAA-H-8083-32B ch. 2, Figs. 2-30–2-38; Lycoming IO-390-C IOM, Fig. 7. Representative continuous-flow injection mechanism.";
function servo(): Internal[] {
  const p = builder(fuelSource);
  const throat = new THREE.LatheGeometry(
    [
      [0.032, -0.036],
      [0.024, -0.016],
      [0.023, -0.01],
      [0.032, 0.025],
    ].map(([r, z]) => new THREE.Vector2(r, z)),
    32,
  ).rotateZ(-Math.PI / 2);
  return [
    p(
      "Injector venturi",
      "intake",
      throat,
      axis(-0.094),
      "The narrowing throat lowers static pressure as airflow increases.",
    ),
    p(
      "Injector impact tubes",
      "bearing",
      merge(
        stations(4, 0.023).map(([y, z]) =>
          tube(
            [
              [-0.034, y, z],
              [-0.023, y, z],
              [-0.022, y * 1.34, z * 1.34],
            ],
            0.0017,
            8,
            8,
          ),
        ),
      ),
      axis(-0.155),
      "The forward-facing openings sense impact pressure.",
    ),
    p(
      "Injector air diaphragm",
      "black",
      zrod(0.025, 0.031, 0.0325, 32),
      [0, -0.047, 0.114],
      "Impact and venturi pressures act on opposite faces.",
      "regulator",
    ),
    p(
      "Injector fuel diaphragm",
      "black",
      zrod(0.02, 0.047, 0.0485, 32),
      [0, -0.047, 0.179],
      "Metered and unmetered fuel pressures oppose the air diaphragm.",
      "regulator",
    ),
    p(
      "Injector regulator stem and ball",
      "steel",
      merge([zrod(0.0025, 0.028, 0.055), new THREE.SphereGeometry(0.004, 12, 8).translate(0, 0, 0.055)]),
      [0, -0.047, 0.213],
      "The common stem positions the ball valve to balance the two forces.",
      "regulator",
    ),
    p(
      "Injector idle spring",
      "spring",
      coil(0.006, 0.0008, 0.035, 0.046, 6),
      [0, -0.047, 0.146],
      "Provides regulator head at low airflow.",
    ),
    p(
      "Injector inlet strainer",
      "steel",
      merge(stations(18, 0.005).map(([x, y]) => zrod(0.00065, -0.012, 0.012, 6).translate(x, y, 0))),
      [-0.052, -0.06, -0.09],
      "Screens incoming fuel.",
    ),
    p(
      "Main metering jet",
      "bearing",
      sleeve(0.0018, 0.006, -0.005, 0.001).translate(0, -0.035, 0),
      [0, -0.1, -0.064],
      "The regulator controls the fuel pressure difference across this restriction.",
    ),
    p(
      "Mixture metering plate",
      "bearing",
      sleeve(0.003, 0.011, -0.003, 0.001, 0.26, 5.87),
      [0, -0.11, -0.102],
      "Rotating the plate changes the effective metering area.",
      "mixture",
      [0, -0.035, 0.009],
    ),
    ...stations(6, 0.027).map(([x, y], i) =>
      p(
        `Injector regulator cover screw (${i + 1})`,
        "steel",
        bolt(0.0019, 0.011).translate(x, y, 0.056),
        [0, 0, 0.058],
        "Secures the regulator cover. Screw pattern schematic.",
      ),
    ),
  ];
}
function divider(): Internal[] {
  const p = builder(fuelSource);
  return [
    p(
      "Flow divider diaphragm",
      "black",
      rod(0.019, 0.0016).rotateZ(Math.PI / 2),
      [0, 0.067, 0],
      "Metered fuel pressure lifts the diaphragm against its spring.",
      "divider",
    ),
    p(
      "Flow divider valve",
      "steel",
      merge([rod(0.0026, 0.023), rod(0.006, 0.006).translate(-0.007, 0, 0)]).rotateZ(Math.PI / 2),
      [0, -0.059, 0],
      "Opens the outlet passages and shuts off flow at idle cut-off.",
      "divider",
    ),
    p(
      "Flow divider valve seat",
      "bearing",
      ring(0.004, 0.011, -0.014, -0.011).rotateZ(Math.PI / 2),
      [0, -0.105, 0],
      "The spring-loaded valve closes against this seat.",
    ),
    p(
      "Flow divider spring",
      "spring",
      coil(0.007, 0.0008, 0.002, 0.014, 6).rotateX(-Math.PI / 2),
      [0, 0.109, 0],
      "Returns the diaphragm and valve when fuel pressure falls.",
    ),
  ];
}
function pump(): Internal[] {
  const p = builder(
    "Lycoming IO-390-C IOM p. 4, Fig. 7 and FAA-H-8083-32B ch. 2, diaphragm fuel pump. Internal layout schematic.",
  );
  return [
    p(
      "Fuel pump diaphragm",
      "black",
      rod(0.029, 0.002, 32).translate(-0.013, 0, 0),
      axis(-0.095),
      "Diaphragm movement changes the volume of the pump chamber.",
      "diaphragm",
    ),
    p(
      "Fuel pump diaphragm stem",
      "steel",
      rod(0.003, 0.029).translate(0.001, 0, 0),
      axis(-0.133),
      "Connects the rocker to the diaphragm.",
      "diaphragm",
    ),
    p(
      "Fuel pump operating lever",
      "darkSteel",
      box(0.044, 0.006, 0.008).rotateZ(0.32).translate(0.014, 0, 0),
      axis(0.091),
      "The accessory-case plunger acts on the pump lever.",
      "pumpLever",
      [0.005, 0.008, 0],
    ),
    p(
      "Fuel pump diaphragm spring",
      "spring",
      helix(0.012, 0.0013, -0.011, 0.014, 6),
      axis(-0.18),
      "Spring force drives the delivery stroke.",
    ),
    ...[-1, 1].map((s, i) =>
      p(
        i ? "Fuel pump outlet check valve" : "Fuel pump inlet check valve",
        "bearing",
        merge([ring(0.003, 0.008, -0.029, -0.026), rod(0.005, 0.0015).translate(-0.027, 0, 0)]).translate(
          0,
          s * 0.014,
          0,
        ),
        [-0.222, s * 0.019, 0],
        i ? "Opens toward the fuel servo on delivery." : "Opens into the pump chamber on the inlet stroke.",
      ),
    ),
    ...stations(8, 0.032).map(([y, z], i) =>
      p(
        `Fuel pump casing screw (${i + 1})`,
        "steel",
        alongX(bolt(0.002, 0.012)).translate(-0.008, y, z),
        axis(0.056),
        "Clamps the diaphragm between the casing halves. Screw pattern schematic.",
      ),
    ),
  ];
}
function filter(): Internal[] {
  const p = builder(
    "Lycoming PC-IO-390-C Fig. 24 and FAA-H-8083-32B ch. 6, full-flow oil filtration. Representative spin-on element.",
  );
  const paper = stations(80, 1).map((_, i) => {
    const a = (i * Math.PI) / 40;
    const r = i % 2 ? 0.034 : 0.023;
    return new THREE.Vector2(r * Math.cos(a), r * Math.sin(a));
  });
  // Open both the centre bore and the pleat valleys.
  const shape = new THREE.Shape(paper);
  shape.holes.push(new THREE.Path(paper.map((p) => p.clone().multiplyScalar(0.96)).reverse()));
  const core = merge([
    ...stations(18, 0.016).map(([y, z]) => rod(0.001, 0.072, 6).translate(0, y, z)),
    ...Array.from({ length: 10 }, (_, i) => ring(0.015, 0.017, -0.036 + i * 0.0078, -0.034 + i * 0.0078)),
  ]);
  return [
    p(
      "Oil filter pleated element",
      "paper",
      alongX(new THREE.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: false })).translate(-0.035, 0, 0),
      axis(-0.171),
      "Oil passes from the canister through the pleated media toward the centre.",
    ),
    p(
      "Oil filter centre tube",
      "darkSteel",
      core,
      axis(-0.278),
      "The open support tube carries filtered oil to the threaded outlet.",
    ),
    p(
      "Oil filter base plate",
      "steel",
      ring(0.009, 0.042, 0.042, 0.045),
      axis(0.092),
      "Supports the spin-on filter at the oil filter base.",
    ),
    p(
      "Oil filter sealing ring",
      "black",
      ring(0.033, 0.038, 0.045, 0.047),
      axis(0.135),
      "Seals the canister against the mounting pad.",
    ),
  ];
}

export function accessoryInternals(kind: Accessory, retard: boolean, length: number): Internal[] {
  switch (kind) {
    case "magneto":
      return magneto(retard);
    case "alternator":
      return alternator(length);
    case "starter":
      return starter();
    case "governor":
      return governor();
    case "servo":
      return servo();
    case "divider":
      return divider();
    case "pump":
      return pump();
    case "filter":
      return filter();
  }
}
