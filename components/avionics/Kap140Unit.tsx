"use client";
/**
 * On-screen Bendix/King KAP 140 (C182T NAV III): LCD (drawn by `drawKap140`), mode buttons, UP/DN, ARM, BARO and
 * the concentric altitude-select knobs, plus the yoke's A/P DISC/TRIM INT and MET switches and the G1000 knobs
 * the autopilot follows (HDG bug, CRS, CDI). Stateless: the airplane keeps `Kap140State` + `FlightState`;
 * re-render the parent at ≥ 5 Hz so the LCD and readouts follow the sim.
 */
import "./avionics.css";
import { useEffect, useRef } from "react";
import { Readouts } from "@/components/ui/controls";
import { navDots, type FlightState, type FlySet } from "@/lib/avionics/flight";
import { drawKap140, kap140Phase, type Kap140Key, type Kap140State } from "@/lib/avionics/kap140";
import { FlyControls, HoldKey, Key, pad3, ToneLine } from "./parts";

export interface Kap140UnitProps {
  st: Kap140State;
  fs: FlightState;
  /** Apply a button: typically `live.ap = kap140Key(live.ap, k, live.fs)`. */
  onKey: (k: Kap140Key) => void;
  /** Change G1000 selections (heading bug, course, ALT SEL, CDI source, throttle). Omit to hide the knobs. */
  onSet?: (p: FlySet) => void;
  /** NAV1/NAV2 tuned to a localizer (CDI softkey shows LOC). */
  loc?: [boolean, boolean];
}

const TONE = {
  disc: "Autopilot disconnect tone (2 s)",
  alert: "Altitude alert — 5 short tones",
  pft: "Self-test complete — disconnect tone",
} as const;

export function Kap140Unit({ st, fs, onKey, onSet, loc }: Kap140UnitProps) {
  const lcd = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = lcd.current,
      ctx = c?.getContext("2d");
    if (c && ctx) drawKap140(ctx, c.width, c.height, st, fs.t);
  });
  const ph = kap140Phase(st, fs.t).ph,
    live = st.powered;
  const dots = navDots(fs);
  const summary = !live
    ? "KAP 140 off"
    : ph !== "ready"
      ? "KAP 140 self-test"
      : `KAP 140: ${st.ap ? `AP ${st.lat} ${st.vert}${st.vert === "VS" ? ` ${st.vsRef} FPM` : ""}` : "AP off"}${st.latArm ? `, ${st.latArm} ARM` : ""}${st.gsArm ? ", GS ARM" : ""}${st.altArm ? ", ALT ARM" : ""}, ${st.selAlt} FT selected`;
  return (
    <div className="avx">
      <div className="avx-kap">
        <div className="avx-kap-top">
          <span>BENDIX/KING</span>
          <em>KAP 140 · ALTITUDE PRESELECT</em>
        </div>
        <canvas ref={lcd} width={800} height={200} className="avx-lcd" role="img" aria-label={summary} />
        <div className="avx-kap-keys">
          {(["AP", "HDG", "NAV", "APR", "REV", "ALT"] as const).map((k) => (
            <Key key={k} label={k} onClick={() => onKey(k)} disabled={!live} />
          ))}
          <div className="avx-stack">
            <HoldKey
              label="UP"
              disabled={!live}
              onDown={() => onKey("UP")}
              onHold={() => onKey("UP_HOLD")}
              onUp={(h) => h && onKey("RELEASE")}
              title="VS +100 FPM (hold: 300 FPM/s) · ALT +20 FT (hold: climb 500 FPM)"
            />
            <HoldKey
              label="DN"
              disabled={!live}
              onDown={() => onKey("DN")}
              onHold={() => onKey("DN_HOLD")}
              onUp={(h) => h && onKey("RELEASE")}
              title="VS −100 FPM (hold: 300 FPM/s) · ALT −20 FT (hold: descend 500 FPM)"
            />
          </div>
          <div className="avx-stack">
            <Key label="ARM" onClick={() => onKey("ARM")} disabled={!live} title="Altitude arm on/off" />
            <HoldKey
              label="BARO"
              disabled={!live}
              holdMs={2000}
              onHold={() => onKey("BARO_HOLD")}
              onUp={(h) => !h && onKey("BARO")}
              title="Show baro 3 s (hold 2 s: IN HG ↔ HPA)"
            />
          </div>
          <div className="avx-dial" role="group" aria-label="Altitude select knobs (outer 1000 ft, inner 100 ft)">
            <button
              type="button"
              className="o1"
              aria-label="Outer knob counter-clockwise"
              onClick={() => onKey("OUTER_DEC")}
              disabled={!live}
            >
              ‹
            </button>
            <button
              type="button"
              className="o2"
              aria-label="Outer knob clockwise"
              onClick={() => onKey("OUTER_INC")}
              disabled={!live}
            >
              ›
            </button>
            <button
              type="button"
              className="i1"
              aria-label="Inner knob counter-clockwise"
              onClick={() => onKey("INNER_DEC")}
              disabled={!live}
            >
              ‹
            </button>
            <button
              type="button"
              className="i2"
              aria-label="Inner knob clockwise"
              onClick={() => onKey("INNER_INC")}
              disabled={!live}
            >
              ›
            </button>
          </div>
        </div>
      </div>
      <ToneLine on={st.tone > fs.t && !!st.toneKind} text={st.toneKind ? TONE[st.toneKind] : ""} />
      <div className="avx-hw">
        <div className="avx-cap">Pilot&apos;s control wheel</div>
        <div className="avx-yoke">
          <Key className="red" label="A/P DISC" sub="TRIM INT" onClick={() => onKey("DISC")} disabled={!live} />
          <HoldKey
            label="MET DN"
            sub="both halves"
            repeat={120}
            onDown={() => onKey("MET_DN")}
            disabled={!live}
            title="Manual electric trim nose down (disengages the AP)"
          />
          <HoldKey
            label="MET UP"
            sub="both halves"
            repeat={120}
            onDown={() => onKey("MET_UP")}
            disabled={!live}
            title="Manual electric trim nose up (disengages the AP)"
          />
        </div>
      </div>
      <Readouts
        items={[
          ["HDG", pad3(fs.hdg) + "°"],
          ["Bank", `${Math.round(fs.roll)}°`],
          ["IAS", `${Math.round(fs.ias)} KT`],
          ["ALT", `${Math.round(fs.alt)} FT`],
          ["VS", `${Math.round(fs.vs / 10) * 10} FPM`],
          [
            "CDI dots",
            dots == null
              ? ["NO D-BAR", "bad"]
              : `${dots > 0.05 ? "▶" : dots < -0.05 ? "◀" : ""}${Math.abs(dots).toFixed(1)}`,
          ],
        ]}
      />
      {onSet && <FlyControls fs={fs} onSet={onSet} loc={loc} id="kap" altLabel="G1000 ALT SEL (not coupled)" />}
    </div>
  );
}
