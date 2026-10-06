"use client";
/**
 * GFC 700 side-panel controls: AFCS status strip, the G1000 bezel AFCS keys, the control-wheel/stick
 * switches (AP DISC, CWS, MET trim) and GA, live readouts and the G1000 knobs that feed the autopilot.
 * Stateless: the airplane keeps `Gfc700State` + `FlightState` and passes `onKey` / `onSet`; re-render the
 * parent at ≥ 5 Hz (e.g. `useTicker(100)`) so the strip follows the sim.
 */
import "./avionics.css";
import { Readouts } from "@/components/ui/controls";
import { navDots, type FlightState, type FlySet } from "@/lib/avionics/flight";
import { gfc700Annunc, type Gfc700Cfg, type Gfc700Key, type Gfc700State } from "@/lib/avionics/gfc700";
import { AfcsStrip, FlyControls, HoldKey, Key, pad3, ToneLine } from "./parts";

/** Bezel key arrangements: Cessna NAV III GDU 1040 (PFD and MFD) and DA40 MFD (no BC; YD slot empty unless installed). */
const LAYOUTS: Record<"cessna" | "da40", (Gfc700Key | null)[][]> = {
  cessna: [["AP", "FD"], ["HDG", "ALT"], ["NAV", "VNV"], ["APR", "BC"], ["VS", "FLC"], ["NOSE_UP", "NOSE_DN"]],
  da40: [["AP", "YD"], ["FD", "HDG"], ["NAV", "APR"], ["ALT", "VNV"], ["VS", "NOSE_UP"], ["FLC", "NOSE_DN"]],
};
const LABEL: Partial<Record<Gfc700Key, [string, string?]>> = { NOSE_UP: ["NOSE", "UP"], NOSE_DN: ["NOSE", "DN"] };

export interface Gfc700ControlsProps {
  st: Gfc700State;
  fs: FlightState;
  /** Apply a key: typically `live.afcs = gfc700Key(live.afcs, k, live.fs, CFG)`. */
  onKey: (k: Gfc700Key) => void;
  /** Change G1000 selections (heading bug, course, selected altitude, CDI source, throttle). Omit to hide the knobs. */
  onSet?: (p: FlySet) => void;
  /** AFCS has power (keys dead otherwise). */
  powered: boolean;
  /** The airplane's GFC 700 configuration (BC key, YD, switch labels). */
  cfg: Gfc700Cfg;
  /** Key layout: "cessna" (C172S, keys on PFD and MFD) or "da40" (MFD only). */
  layout?: "cessna" | "da40";
  /** Caption over the keys, e.g. "PFD / MFD bezel". */
  where?: string;
  /** Caption over the wheel/stick switches, e.g. "Pilot's control wheel" or "Control stick". */
  yoke?: string;
  /** NAV1/NAV2 tuned to a localizer (CDI softkey shows LOC). */
  loc?: [boolean, boolean];
}

export function Gfc700Controls({ st, fs, onKey, onSet, powered, cfg, layout = "cessna", where, yoke, loc }: Gfc700ControlsProps) {
  const a = powered ? gfc700Annunc(st, fs, cfg) : null;
  const dots = navDots(fs);
  const grid = LAYOUTS[layout].flat().map((k, i) => {
    if (!k || (k === "YD" && !cfg.hasYD) || (k === "BC" && !cfg.bcKey)) return <span key={i} className="avx-k blank" aria-hidden />;
    const [l, sub] = LABEL[k] ?? [k];
    return <Key key={k} label={l} sub={sub} onClick={() => onKey(k)} disabled={!powered} />;
  });
  return (
    <div className="avx">
      <div>
        <AfcsStrip a={a} />
        <ToneLine on={!!a?.tone} text={st.apFlash?.kind === "abnormal" ? "Autopilot disconnect tone — continuous until AP DISC" : "Autopilot disconnect tone"} />
      </div>
      <div className="avx-row">
        <div className="avx-hw">
          <div className="avx-cap">{where ?? (layout === "da40" ? "MFD bezel" : "PFD / MFD bezel")}</div>
          <div className="avx-keys">{grid}</div>
        </div>
        <div className="avx-hw">
          <div className="avx-cap">{yoke ?? (layout === "da40" ? "Control stick · throttle" : "Control wheel · panel")}</div>
          <div className="avx-col">
            <Key className="red wide" label={cfg.discLabel} onClick={() => onKey("AP_DISC")} disabled={!powered} title="Disconnects the AP, interrupts trim, acknowledges a disconnect" />
            <HoldKey className="wide" label="CWS" sub="hold" onDown={() => onKey("CWS")} onUp={() => onKey("CWS_UP")} disabled={!powered} title="Control wheel steering: hold to hand-fly, release to resync" />
            <HoldKey label="TRIM DN" sub={cfg.trimLabel} repeat={120} onDown={() => onKey("TRIM_DN")} onRepeat={() => onKey("TRIM_DN_HOLD")} disabled={!powered} title="Manual electric trim, nose down (disconnects the AP)" />
            <HoldKey label="TRIM UP" sub={cfg.trimLabel} repeat={120} onDown={() => onKey("TRIM_UP")} onRepeat={() => onKey("TRIM_UP_HOLD")} disabled={!powered} title="Manual electric trim, nose up (disconnects the AP)" />
            <Key className="wide" label="GA" sub={fs.onGround ? "TO" : "go-around"} onClick={() => onKey("GA")} disabled={!powered} />
          </div>
        </div>
      </div>
      <Readouts items={[
        ["HDG", pad3(fs.hdg) + "°"], ["Bank", `${Math.round(fs.roll)}°`], ["IAS", `${Math.round(fs.ias)} KT`],
        ["ALT", `${Math.round(fs.alt)} FT`], ["VS", `${Math.round(fs.vs / 10) * 10} FPM`],
        ["CDI dots", dots == null ? ["NO D-BAR", "bad"] : `${dots > 0.05 ? "▶" : dots < -0.05 ? "◀" : ""}${Math.abs(dots).toFixed(1)}`],
        ["Trim", st.trim > 0.02 ? `NU ${Math.round(st.trim * 100)}%` : st.trim < -0.02 ? `ND ${Math.round(-st.trim * 100)}%` : "Neutral"],
      ]} />
      {onSet && <FlyControls fs={fs} onSet={onSet} loc={loc} id="gfc" />}
    </div>
  );
}
