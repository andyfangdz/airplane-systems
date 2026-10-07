/**
 * Per-frame part animations shared by every airplane (`PartAnim`s for the parts catalogue). Each takes getters into the
 * airplane's own store or `live` values, so the same kind of part behaves the same way in every airplane.
 */
import type { PartAnim } from "./catalogue";
import { mats } from "./materials";
import type { SysId } from "./systems";
import { useView } from "./view";

export const sysNow = () => useView.getState().sys;
const inView = (views: readonly SysId[]) => views.includes(sysNow());

/** Views where engine parts are shown live (spark plugs flashing, magnetos lit): the same in every airplane. */
const ENGINE_VIEWS: readonly SysId[] = ["overview", "engine", "propeller"];

/** Lit (`hot`) when `on()` in the given systems' views (and the Overview), otherwise the normal colour, dimmed elsewhere. */
export const glowAnim =
  (color: string, on: () => boolean, sys: SysId[], hot = "#FFD34D"): PartAnim =>
  (m) => {
    const v = sysNow(),
      show = v === "overview" || sys.includes(v);
    m.material = !show ? mats(color).dim : on() ? mats(hot).hi : mats(color).on;
  };

/**
 * Push-pull knob on the panel (x forward): `inFrac()` 1 = pushed full in, at `x0`; 0 = pulled full out, `travel` m aft.
 * E.g. FUEL SHUTOFF in = ON, CABIN HT out = heat, throttle in = open.
 */
export const pushPull =
  (x0: number, inFrac: () => number, travel = 0.05): PartAnim =>
  (m) => {
    m.position.x = x0 - (1 - inFrac()) * travel;
  };

/** A stable phase (0–10) per plug id, so the spark plugs don't all flash together. */
export const sparkPhase = (id: string) => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return (h % 100) / 10;
};

/** Spark plug: flashes while `firing()` (engine turning and its magneto on and working) in the engine views; dimmed elsewhere. */
export const plugAnim =
  (firing: () => boolean, phase: number): PartAnim =>
  (m, t) => {
    const live = inView(ENGINE_VIEWS),
      flash = live && firing() && Math.sin(t * 18 + phase) > 0.3;
    m.material = flash ? mats("#6FD8FF").hi : live ? mats("#DADFE2").on : mats("#DADFE2").dim;
  };

/** Magneto: lit while `firing()`, in the engine views; dimmed elsewhere. */
export const magAnim =
  (firing: () => boolean): PartAnim =>
  (m) => {
    m.material = inView(ENGINE_VIEWS) ? (firing() ? mats("#6FD8FF").on : mats("#3E4A52").on) : mats("#3E4A52").dim;
  };

/** Brake disc: glows while `amount()` (0..1, toe brake or parking brake) is applied. */
export const brakeAnim =
  (amount: () => number): PartAnim =>
  (m) => {
    m.material = amount() > 0.05 ? mats("#FF6A2A").hi : mats("#9AA3AA").on;
  };

/** Toe-brake amount for one side from differential braking (`diff` −1 left … +1 right) and the parking brake. */
export const brakeAmount = (gear: { park: boolean; diff: number }, side: "R" | "L") =>
  gear.park ? 0.6 : side === "R" ? Math.max(0, gear.diff) : Math.max(0, -gear.diff);
