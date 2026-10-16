import { D2R } from "./math";

/** Normalised control inputs, −1 … 1 (pitch + = pull). */
export interface ControlInputs {
  pitch: number;
  roll: number;
  yaw: number;
}
/** Surface deflections in degrees: elevator and ailerons trailing edge up (+), rudder trailing edge right (+). */
export interface Deflections {
  elev: number;
  ailR: number;
  ailL: number;
  rud: number;
}

/**
 * Control-surface deflections (radians about each hinge axis, by surface key) from the effective controls and the flap
 * angle, for `<ControlSurface(s) angle={…}>`. `live.eff` is replaced every tick, so the angles are recomputed only when the
 * tick has produced new control positions or the flaps have moved. Call once per airplane: each call keeps its own cache.
 */
export function surfaceAngles(
  live: { readonly eff: ControlInputs; readonly flapAng: number },
  deflections: (pitch: number, roll: number, yaw: number) => Deflections,
) {
  const ang: Record<string, number> = {};
  let angFor: { eff: ControlInputs | null; flap: number } = { eff: null, flap: NaN };
  return (key: string) => {
    if (angFor.eff !== live.eff || angFor.flap !== live.flapAng) {
      const c = live.eff,
        d = deflections(c.pitch, c.roll, c.yaw),
        fl = live.flapAng * D2R;
      ang.flapR = fl;
      ang.flapL = -fl;
      ang.ailR = -d.ailR * D2R;
      ang.ailL = d.ailL * D2R;
      ang.elev = -d.elev * D2R;
      ang.rudder = d.rud * D2R;
      angFor = { eff: live.eff, flap: live.flapAng };
    }
    return ang[key] ?? 0;
  };
}
