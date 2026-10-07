/** C182T catalogue: exterior and interior lighting (POH 7-57 – 7-60). */
import type { Vec3 } from "@/lib/math";
import { Y, box, cyl, fLE, sph } from "../geometry";
import { P3, cAt, part, wp } from "./catalogue";

/* ---------- lighting (POH 7-57 – 7-60) ---------- */
const tipAt = (s: number): Vec3 => wp(s * 214, 0.2, 0, 0);
export const LIGHTS = {
  tipL: tipAt(-1),
  tipR: tipAt(1),
  /** White position light at the tip of the tailcone stinger (2005 POH 7-57; the 2007 edition says “tip of the rudder”). */
  tail: P3(259.2, 0, 45.6),
  /** Fin tip (Figure 1-1 side view); the equipment list gives arm 253.1. */
  beacon: [fLE(Y(109.4)) - 0.07, Y(110.9), 0] as Vec3,
  land: wp(-140.5, 0.0, 0, -0.01),
  taxi: wp(-135.5, 0.0, 0, -0.01),
  courtesyL: wp(-26, cAt(61.7, 26), -1, -0.01),
  courtesyR: wp(26, cAt(61.7, 26), -1, -0.01),
  flood: P3(48, 0, 77.6),
  dome: P3(70, 0, 77.6),
  map: P3(26, -14, 52.6),
};
(
  [
    ["tipL", "Left wing tip: red position light + strobe"],
    ["tipR", "Right wing tip: green position light + strobe"],
  ] as const
).forEach(([k, name]) =>
  part(() => sph(0.035), ["lighting"], {
    pos: LIGHTS[k],
    color: "#D9D9D9",
    name,
    note: "Navigation light and strobe anticollision light (arm 40.4) in each wing tip; NAV LTS and STROBE LTS breakers on ELECTRICAL BUS 2. Strobes required for all operations (KOEL). Don't use the strobes or beacon flying through cloud or overcast — vertigo (POH 7-57, 2-12).",
    ext: true,
    pin: true,
  }),
);
part(() => sph(0.02), ["lighting"], {
  pos: LIGHTS.tail,
  color: "#F2F2F2",
  name: "Tail position light (white)",
  note: "At the tip of the stinger (POH 7-57). NAV switch, NAV LTS breaker.",
  ext: true,
  pin: true,
});
part(() => cyl(0.03, 0.06), ["lighting"], {
  pos: LIGHTS.beacon,
  color: "#C8313B",
  name: "Flashing beacon",
  note: "On top of the vertical fin (equipment item 33-04-S, arm 253.1); BCN LT breaker, ELECTRICAL BUS 1. To save the battery in cold weather it can stay off until the engine is started (POH 7-57, 4-50).",
  ext: true,
  pin: true,
});
part(() => box(0.02, 0.06, 0.1), ["lighting"], {
  pos: LIGHTS.land,
  color: "#F5F2E4",
  name: "Landing light",
  note: "In the left wing leading edge (landing and taxi light assembly, arm 26.8); LAND switch, LAND LT breaker on ELECTRICAL BUS 1. Use only the taxi light in the pattern or en route to extend the landing light's life (POH 7-57; the taxi-light advice is on 4-32).",
  ext: true,
  pin: true,
});
part(() => box(0.02, 0.06, 0.1), ["lighting"], {
  pos: LIGHTS.taxi,
  color: "#F5F2E4",
  name: "Taxi light",
  note: "Beside the landing light; TAXI switch, TAXI LT breaker on ELECTRICAL BUS 2 (POH 7-57).",
  ext: true,
  pin: true,
});
[LIGHTS.courtesyL, LIGHTS.courtesyR].forEach((p, i) =>
  part(() => sph(0.018), ["lighting", "cabin"], {
    pos: p,
    color: "#E8C46A",
    name: "Courtesy light (under wing)",
    note: "Recessed in the lower surface of each wing to light the door area, arm 61.7; on the overhead push button shared with the rear dome light (POH 7-57, 7-58).",
    ext: true,
    pin: i === 0,
  }),
);
part(() => box(0.5, 0.03, 0.16), ["lighting", "cabin"], {
  pos: P3(58, 0, 78.3),
  color: "#39424A",
  name: "Overhead console",
  note: "One dimmable, rotatable front flood light with its dimmer (serials 18280945 – 18281741 — both club airplanes), the rear dome light with its push button (also the courtesy lights) and the overhead speaker (POH 7-58, 7-70).",
  pin: true,
});
part(() => cyl(0.022, 0.022), ["lighting"], {
  pos: LIGHTS.flood,
  color: "#E8C46A",
  name: "Flood light",
  note: "Front crew flood light: dimmable and rotatable for the pilot or front passenger. Placard “Flood Light” near its control (POH 7-58, 2-21).",
  pin: true,
});
part(() => cyl(0.03, 0.012), ["lighting"], {
  pos: LIGHTS.dome,
  color: "#E8C46A",
  name: "Rear dome light",
  note: "Fixed light for the rear cabin; on/off push button on the overhead console, shared with the courtesy lights (POH 7-58).",
  pin: true,
});
part(() => box(0.012, 0.06, 0.06), ["lighting"], {
  pos: P3(17.9, -17.8, 53.8),
  color: "#2F3A42",
  name: "DIMMING panel",
  note: "Below the MASTER and AVIONICS switches: SW/CB PANELS, PEDESTAL, AVIONICS (full counter-clockwise = photocell) and STDBY IND (POH 7-58, 7-59).",
  pin: true,
});
