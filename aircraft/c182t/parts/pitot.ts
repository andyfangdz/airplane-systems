/** C182T catalogue: pitot-static, stall warning and vacuum systems (POH 7-62 – 7-65, Figure 7-9). */
import { V, type Vec3 } from "@/lib/math";
import { glowAnim as glow, pushPull, sysNow } from "@/lib/anims";
import { X, Y, Z, box, cyl, onSkin, sph, tubeGeo, wingP } from "../geometry";
import { live } from "../model";
import { EL, P3, PV, S, part, top, wp } from "./catalogue";
import { KNOB } from "./engine";

/* ---------- pitot-static and stall warning (POH 7-62, 7-65) ---------- */
const PIT = "#3A9448";
/** Pitot mast under the left wing, inboard of the strut: BL ≈ 65 scaled from both Figure 1-1 front views (the text gives no station); heated head centred near arm 28.0. */
export const PITOT: Vec3 = wp(-65, 0.12, -1, -0.12);
part(() => tubeGeo([wp(-65, 0.18, -1, 0.01), [PITOT[0] - 0.05, PITOT[1], PITOT[2]]], 0.012), ["pitot"], {
  color: "#AEB6BC",
  name: "Pitot mast",
  note: "Under the left wing, inboard of the strut (POH 7-62; station scaled from Figure 1-1).",
  ext: true,
});
part(() => cyl(0.012, 0.26, "x"), ["pitot"], {
  pos: [PITOT[0] + 0.08, PITOT[1], PITOT[2]],
  color: "#AEB6BC",
  anim: glow("#AEB6BC", () => EL().pitotHeating, ["pitot"], "#FF6A2A"),
  name: "Heated pitot head",
  note: "“Heated total pressure (pitot) head mounted on the lower surface of the left wing”, arm 28.0. PITOT HEAT switch and 10 A breaker (ELECTRICAL BUS 2) also heat the stall vane. No annunciation: check it's warm within 30 s on preflight (POH 7-62, 4-8).",
  ext: true,
  pin: true,
});
/** External static ports on both sides of the forward fuselage (POH 7-62); station not in the POH. */
export const STATIC_PORTS: Vec3[] = [1, -1].map((s) => PV(onSkin(X(15), Y(44), s, 1.01)));
STATIC_PORTS.forEach((p, i) =>
  part(() => cyl(0.014, 0.006, "z"), ["pitot"], {
    pos: p,
    color: PIT,
    name: "Static port",
    note: "“External static ports mounted on both sides of the forward fuselage” — check each opening on preflight (POH 7-62, 4-10, 4-11). The two sides average out yaw errors.",
    ext: true,
    pin: i === 1,
  }),
);
part(() => cyl(0.012, 0.03, "x"), ["pitot"], {
  pos: P3(18.4, -4.6, KNOB.h),
  color: PIT,
  anim: pushPull(X(18.4), () => (S().pitot.altStatic ? 0 : 1), 0.03),
  name: "ALT STATIC AIR valve",
  note: "Next to the throttle (Fig. 7-2 item 32), arm 15.5: pull ON for cabin static pressure if the external source blocks. Maximum variation 5 kt and 80 ft with the windows closed; use Fig. 5-1 Sheet 2 and Fig. 5-2 (POH 7-62, 3-30).",
  pin: true,
});
part(() => cyl(0.006, 0.05), ["pitot", "avionics"], {
  pos: [X(41.5), top(41.5, -4) + 0.022, Z(-4)],
  color: PIT,
  name: "OAT probe (GTP 59)",
  note: "On top of the cabin, arm 41.5, connected to the air data computer (POH 7-67, 6-22).",
  ext: true,
  pin: true,
});
/** Electric stall warning vane in the left wing leading edge (wing unit S1672-9, arm 25.6). */
export const STALL_VANE: Vec3 = wp(-92, 0.015, -1, 0);
const vaneGlow = glow(PIT, () => live.horn, ["pitot"], "#FF5050");
part(() => box(0.03, 0.006, 0.03), ["pitot"], {
  pos: STALL_VANE,
  color: PIT,
  anim: (m, t) => {
    vaneGlow(m, t);
    m.rotation.z = live.horn ? 0.4 : 0;
  },
  name: "Stall warning vane",
  note: "Vane-type sensor in the left wing leading edge, arm 25.6: near the stall the airflow lifts the vane and closes a switch to the horn, 5–10 kt above the stall in all configurations. Heated by PITOT HEAT. Preflight: MASTER on, push the vane up — the horn must sound (POH 7-65, 4-8).",
  ext: true,
  pin: true,
});
part(() => cyl(0.025, 0.05, "x"), ["pitot", "cabin"], {
  pos: P3(40, -19, 78),
  color: PIT,
  anim: glow(PIT, () => live.horn, ["pitot", "cabin"], "#FF5050"),
  name: "Stall warning horn",
  note: "Electric horn in the headliner above the left cabin door, arm 40.0; powered through the WARN breaker on the CROSSFEED BUS (Fig. 7-7; the text calls it a 5 A STALL WARN breaker) (POH 7-65, 6-22).",
  pin: true,
});
part(() => sph(0.035), ["pitot"], {
  pos: wp(-92, 0.1, 1),
  color: "#E0263B",
  ext: true,
  name: "Stagnation point",
  anim: (m) => {
    const v = sysNow();
    m.visible = v === "pitot" && !S().ground;
    const slow = Math.max(0, Math.min(1, (live.fs.ias - 40) / 50));
    m.position.copy(wingP(Z(-92), 0.06 * slow, -1).add(V(0, -0.02 * (1 - slow), 0)));
  },
  note: "Moves down and aft under the leading edge as the angle of attack rises; near the stall the airflow around the vane lifts it.",
});

/* ---------- vacuum system and standby attitude (POH 7-63, Figure 7-9) ---------- */
const VAC = "#4FA8A0";
part(() => cyl(0.04, 0.08, "x"), ["vacuum", "engine"], {
  pos: P3(-5, 5.5, 47),
  color: VAC,
  anim: glow(VAC, () => S().vac.fail, ["vacuum", "engine"], "#E0263B"),
  name: "Engine-driven vacuum pump",
  note: "AA3215CC dry pump on the accessory case, arm −5.0, with a cooling shroud (−5.6); discharges overboard (POH 7-63, 6-24).",
  pin: true,
});
part(() => box(0.06, 0.05, 0.05), ["vacuum"], {
  pos: P3(2.1, 8, 56),
  color: VAC,
  name: "Vacuum regulator",
  note: "AA2H3-2, arm 2.1: holds vacuum in the 4.5–5.5 in.Hg green band (POH 6-24, 2-7).",
  pin: true,
});
part(() => cyl(0.04, 0.05), ["vacuum"], {
  pos: P3(11.5, 3, 58.5),
  color: "#C9D6D4",
  name: "Vacuum system air filter",
  note: "Arm 11.5, behind the panel: cabin air is drawn through it to the attitude indicator's rotor (Fig. 7-9).",
  pin: true,
});
part(() => box(0.03, 0.03, 0.03), ["vacuum"], {
  pos: P3(8.5, 6, 54),
  color: VAC,
  name: "Vacuum transducer",
  note: "P165-5786, arm 8.5 → GEA 71 → VAC on the EIS SYSTEM page; LOW VACUUM (amber) below 3.5 in.Hg (POH 7-63, 6-24).",
  pin: true,
});
part(() => tubeGeo([P3(-5, 5.5, 44.5), P3(-6, 6, 32), P3(-6, 7, 23.2)], 0.008), ["vacuum"], {
  color: VAC,
  name: "Vacuum pump overboard vent line",
  note: "Pump discharge air goes overboard (Fig. 7-9).",
  ext: true,
});
