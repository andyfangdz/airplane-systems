/** C172S catalogue: exterior and interior lighting (POH 7-59). */
import type { Vec3 } from "@/lib/math";
import type { SysId } from "@/lib/systems";
import { AF, Y, box, cyl, sph } from "../geometry";
import { P3, part, onSurf, wp } from "./catalogue";

/* ---------- lighting (POH 7-59) ---------- */
const tipAt = (s: number): Vec3 => wp(s * 215.5, 0.32, 0, 0);
export const LIGHTS = {
  tipL: tipAt(-1),
  tipR: tipAt(1),
  /** White position light at the lower trailing edge of the rudder (POH 7-59: "on the wing tips and the tip of the rudder"). */
  tail: [AF.fLE(Y(52)) - AF.fC(Y(52)) - 0.012, Y(52), 0] as Vec3,
  beacon: P3(258.5, 0, 105.6),
  /** Twin lamps in the left leading edge just outboard of the strut: BL ≈ 102–116 in the Figure 1-1 front view (KAP edition). */
  land: wp(-105, 0.0, 0, -0.005),
  taxi: wp(-112, 0.0, 0, -0.005),
  courtesyL: wp(-24, 0.55, -1, -0.01),
  courtesyR: wp(24, 0.55, -1, -0.01),
  flood: [P3(50, -5, 76.5), P3(50, 5, 76.5)],
  dome: P3(72, 0, 76.5),
  map: P3(26, -13.5, 52.5),
};
const ext = (s: SysId[] = ["lighting"]) => s;
(
  [
    ["tipL", "Left wing tip: red position light + strobe"],
    ["tipR", "Right wing tip: green position light + strobe"],
  ] as const
).forEach(([k, name]) =>
  part(() => sph(0.035), ext(), {
    pos: LIGHTS[k],
    color: "#D9D9D9",
    name,
    note: "Position light and strobe in each wing tip; NAV LTS and STROBE LTS breakers on ELECTRICAL BUS 2. Strobes required for all operations (KOEL). Don't use the strobes, beacon or recognition lights when flying through cloud or overcast (POH 7-60).",
    ext: true,
    pin: true,
  }),
);
onSurf("rudder", LIGHTS.tail, () => sph(0.022), {
  sys: ["lighting"],
  color: "#F2F2F2",
  name: "Tail position light (white)",
  note: "At the tip of the rudder (POH 7-59). NAV switch.",
  ext: true,
  pin: true,
});
part(() => cyl(0.03, 0.06), ["lighting"], {
  pos: LIGHTS.beacon,
  color: "#C8313B",
  name: "Flashing beacon",
  note: "Top of the vertical stabilizer; BCN LT breaker, ELECTRICAL BUS 1 (POH 7-59). The equipment list gives arm 240.7 (KAP 140 edition 204.7); the Figure 1-1 side view puts it on the fin top, as modelled.",
  ext: true,
  pin: true,
});
part(() => box(0.02, 0.06, 0.1), ["lighting"], {
  pos: LIGHTS.land,
  color: "#F5F2E4",
  name: "Landing light",
  note: "Left wing leading edge just outboard of the strut (arm 26.6; checked after the tie-down on the preflight, POH 4-10); LAND switch, LAND LT breaker on ELECTRICAL BUS 1. Optional LED landing/taxi/recognition lights sit in both leading edges (POH 7-59).",
  ext: true,
  pin: true,
});
part(() => box(0.02, 0.06, 0.1), ["lighting"], {
  pos: LIGHTS.taxi,
  color: "#F5F2E4",
  name: "Taxi light",
  note: "Beside the landing light; TAXI switch, TAXI LT breaker on ELECTRICAL BUS 2. Use it in the pattern to extend the landing light's life (POH 4-31).",
  ext: true,
  pin: true,
});
[LIGHTS.courtesyL, LIGHTS.courtesyR].forEach((p, i) =>
  part(() => sph(0.018), ["lighting", "cabin"], {
    pos: p,
    color: "#E8C46A",
    name: "Courtesy light (under wing)",
    note: "Recessed in the lower surface of each wing to light the door area; on the overhead push button with the rear dome light (POH 7-59).",
    ext: true,
    pin: i === 0,
  }),
);
part(() => box(0.5, 0.03, 0.16), ["lighting", "cabin"], {
  pos: P3(58, 0, 77),
  color: "#39424A",
  name: "Overhead console",
  note: "Two front FLOOD LIGHT knobs (rotatable lights), the rear dome light and its push button (with the courtesy lights), and the overhead speaker (POH 7-60, 7-75). CABIN LTS/PWR breaker.",
  pin: true,
});
LIGHTS.flood.forEach((p, i) =>
  part(() => cyl(0.02, 0.02), ["lighting"], {
    pos: p,
    color: "#E8C46A",
    name: "Flood light",
    note: "Front crew flood lights, dimmable and rotatable (POH 7-60).",
    pin: i === 0,
  }),
);
part(() => cyl(0.03, 0.012), ["lighting"], {
  pos: LIGHTS.dome,
  color: "#E8C46A",
  name: "Rear dome light",
  note: "Push button on the overhead console; shares it with the courtesy lights (POH 7-60).",
  pin: true,
});
part(() => box(0.012, 0.06, 0.06), ["lighting"], {
  pos: P3(17.8, -17.8, 53.4),
  color: "#2F3A42",
  name: "DIMMING panel",
  note: "Below the MASTER and AVIONICS switches: SW/CB PANELS, PEDESTAL, AVIONICS (full counter-clockwise = photocell) and STBY IND (POH 7-60, 7-61).",
  pin: true,
});
