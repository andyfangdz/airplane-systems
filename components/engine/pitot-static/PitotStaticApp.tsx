"use client";
/**
 * The pitot-static page: the system laid out in 3D, the instruments with what the airplane is really doing over the
 * foot of the view (the six-pack's three, or the G1000 PFD's air data with the standby airspeed indicator and
 * altimeter), and a panel with set-ups to try, the airplane, the cockpit controls, the weather, the installation,
 * failures, the ramp leak test, charts, the pressures inside the system and the documents.
 */
import dynamic from "next/dynamic";
import { useEffect, useRef, type ReactNode } from "react";
import {
  BtnRow,
  Caution,
  Check,
  Facts,
  H3,
  Notes,
  Readouts,
  ScenarioButton,
  Seg,
  Slider,
  Small,
  type Reading,
} from "@/components/ui/controls";
import { f0 } from "@/lib/format";
import { useLiveSnapshot } from "@/lib/useLiveSnapshot";
import {
  HIST_S,
  inHg,
  leakTestReached,
  pohKias,
  type Avionics,
  type Failures,
  type Leak,
  type PSState,
} from "@/engines/components/pitot-static/model";
import { AMT, GPG, IFH, IPC, PHAK, POH, type Flaps } from "@/engines/components/pitot-static/spec";
import { SCENARIOS, scenarioById, type Group } from "@/engines/components/pitot-static/scenarios";
import { ComponentShell } from "../ComponentShell";
import { ViewToggles } from "../chrome";
import { drawAlt, drawAsi, drawPfdTapes, drawVsi, pitchOf, type PfdView } from "./dials";
import { onGround, s, spec, usePs, usePsLoop, usePsView } from "./store";
import "./pitot-static.css";

const Scene = dynamic(() => import("./PitotStaticScene"), { ssr: false, loading: () => <div /> });

/** A whole number with its sign; never "−0". */
const signed = (v: number) => {
  const r = Math.round(v);
  return (r >= 0 ? "+" : "−") + f0(Math.abs(r));
};
/** A whole number, never "−0". */
const n0 = (v: number) => f0(Math.round(v) + 0);
const FLAPS: [Flaps, string][] = [
  ["up", "UP"],
  ["10", "10°"],
  ["full", "FULL"],
];

// ---------------------------------------------------------------- the instruments over the view

/** A canvas drawn by `draw` at its displayed size. */
function Dial({
  label,
  draw,
  className = "ps-dial",
}: {
  label: string;
  draw: (ctx: CanvasRenderingContext2D, W: number, H: number) => void;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(c.clientWidth * dpr) || 120,
      h = Math.round(c.clientHeight * dpr) || 120;
    if (c.width !== w || c.height !== h) [c.width, c.height] = [w, h];
    const ctx = c.getContext("2d");
    if (ctx) draw(ctx, w, h);
  });
  return <canvas ref={ref} className={className} role="img" aria-label={label} />;
}

/** The airspeed indicator, six-pack or standby, against what the airplane flies and the POH says it should read. */
function AsiGauge({ x, standby }: { x: PSState; standby: boolean }) {
  const u = usePs();
  const poh = x.kcas >= 1 ? pohKias(spec, x.kcas, u.controls.flaps, u.cockpit.altStatic) : 0;
  return (
    <div className="ps-gauge">
      <Dial
        label={`${standby ? "Standby airspeed" : "Airspeed"} ${f0(x.ias)} knots`}
        draw={(c, W, H) => drawAsi(c, W, H, x.ias)}
      />
      <span>
        {standby && "stby "}
        <b>{f0(x.ias)}</b> KIAS
      </span>
      <small className={Math.abs(x.ias - poh) > 3 && x.kcas >= 1 ? "bad" : ""}>
        {f0(x.kcas)} KCAS{x.kcas >= 1 ? ` · POH ${f0(poh)}` : ""}
      </small>
    </div>
  );
}

function AltGauge({ x, standby }: { x: PSState; standby: boolean }) {
  const kollsman = usePs((u) => u.cockpit.kollsman);
  const d = x.alt - x.h;
  return (
    <div className="ps-gauge">
      <Dial
        label={`${standby ? "Standby altimeter" : "Altimeter"} ${f0(x.alt)} feet`}
        draw={(c, W, H) => drawAlt(c, W, H, x.alt, kollsman)}
      />
      <span>
        {standby && "stby "}
        <b>{f0(x.alt)}</b> ft
      </span>
      <small className={Math.abs(d) > 100 ? "bad" : ""}>
        true {f0(x.h)} ({signed(d)})
      </small>
    </div>
  );
}

function SixPackMonitor() {
  const x = useLiveSnapshot(s, 50);
  const glass = usePs((u) => u.failures.vsiGlass);
  return (
    <div className="eng-mon ps-mon" aria-live="off">
      <AsiGauge x={x} standby={false} />
      <AltGauge x={x} standby={false} />
      <div className="ps-gauge">
        <Dial
          label={`Vertical speed ${f0(x.vsi)} feet per minute`}
          draw={(c, W, H) => drawVsi(c, W, H, x.vsi, glass)}
        />
        <span>
          <b>{signed(Math.round(x.vsi / 10) * 10)}</b> fpm
        </span>
        <small className={Math.abs(x.vsi - x.vs) > 300 ? "bad" : ""}>actual {signed(Math.round(x.vs / 10) * 10)}</small>
      </div>
    </div>
  );
}

/** The G1000: the PFD's air data (its airspeed tape, altimeter and VSI), then the standby airspeed and altimeter. */
function G1000Monitor() {
  const x = useLiveSnapshot(s, 50);
  const k = usePs((u) => u.cockpit);
  const scratch = useRef<HTMLCanvasElement | null>(null);
  const p = x.pfd;
  const view: PfdView = { pfd: p, baro: k.baro, oat: x.oat, pitch: pitchOf(x) };
  const off = p.valid && (Math.abs(p.alt - x.h) > 100 || Math.abs(p.vs - x.vs) > 300);
  return (
    <div className="eng-mon ps-mon ps-g1000" aria-live="off">
      <div className="ps-gauge">
        <Dial
          className="ps-pfd"
          label={
            p.valid ? `PFD ${f0(p.ias)} knots, ${f0(p.alt)} feet, ${f0(p.vs)} feet per minute` : "PFD air data red X"
          }
          draw={(c, W, H) => drawPfdTapes(c, W, H, view, (scratch.current ??= document.createElement("canvas")))}
        />
        <span>
          PFD{" "}
          {p.valid ? (
            <>
              <b>{f0(p.ias)}</b> kt <b>{f0(p.alt)}</b> ft
            </>
          ) : (
            <b className="bad">red X</b>
          )}
        </span>
        <small className={!p.valid || off ? "bad" : ""}>
          {p.valid
            ? `VS ${signed(Math.round(p.vs / 10) * 10)} · actual ${signed(Math.round(x.vs / 10) * 10)}`
            : "no air data"}
        </small>
      </div>
      <AsiGauge x={x} standby />
      <AltGauge x={x} standby />
    </div>
  );
}

function Monitor() {
  const avionics = usePs((u) => u.avionics);
  return avionics === "g1000" ? <G1000Monitor /> : <SixPackMonitor />;
}

// ---------------------------------------------------------------- panel

function Try() {
  const start = usePs((x) => x.start),
    current = usePs((x) => x.scenario);
  const groups: Group[] = ["Blockages", "Alternate static", "Errors", "Maintenance"];
  const sc = current ? scenarioById(current) : undefined;
  return (
    <>
      <H3>Try</H3>
      {groups.map((g) => (
        <div key={g} className="ps-try">
          <span>{g}</span>
          <BtnRow>
            {SCENARIOS.filter((x) => x.group === g).map((x) => (
              <ScenarioButton key={x.id} onClick={() => start(x.id)}>
                {x.label}
              </ScenarioButton>
            ))}
          </BtnRow>
        </div>
      ))}
      {sc && (
        <p className="ps-note" role="status">
          <b>{sc.label}.</b> {sc.note}
        </p>
      )}
    </>
  );
}

function Flight() {
  const mode = usePs((x) => x.mode),
    setMode = usePs((x) => x.setMode);
  const c = usePs((x) => x.controls),
    set = usePs((x) => x.setControls);
  const avionics = usePs((x) => x.avionics),
    setAvionics = usePs((x) => x.setAvionics);
  const panels: [Avionics, string][] = [
    ["six-pack", "Six-pack"],
    ["g1000", "G1000 (NAV III)"],
  ];
  return (
    <>
      <H3>The airplane</H3>
      <Seg id="ps-avionics" label="Panel" options={panels} value={avionics} onChange={setAvionics} />
      <Small>
        {avionics === "g1000"
          ? `The NAV III: the GDC 74A air data computer reads the pitot and static lines and the OAT probe and gives the PFD airspeed, true airspeed, altitude and vertical speed (${GPG} p. 2; ${POH} p. 7-70). The standby airspeed indicator and altimeter share its pitot head and static port (p. 7-12), so a blockage fools them all alike: comparing them won't find it. No mechanical VSI.`
          : `Conventional instruments: airspeed indicator, altimeter and vertical speed indicator, with a blind encoder for the transponder, all on the one pitot head and static port (${IPC} 34-11-00 Figure 01).`}
      </Small>
      <Seg
        id="ps-mode"
        label="Where"
        options={[
          ["flight", "Flying"],
          ["test", "On the ramp, test set"],
        ]}
        value={mode}
        onChange={setMode}
      />
      {mode === "flight" && (
        <>
          <Slider
            id="ps-kcas"
            label="Airspeed (calibrated)"
            min={0}
            max={170}
            step={1}
            value={c.kcas}
            onChange={(v) => set({ kcas: v })}
            fmt={(v) => `${v} KCAS`}
          />
          <Slider
            id="ps-alt"
            label="Altitude to fly (true)"
            min={0}
            max={12000}
            step={100}
            value={c.alt}
            onChange={(v) => set({ alt: v })}
            fmt={(v) => `${f0(v)} ft`}
          />
          <Slider
            id="ps-rate"
            label="Climb or descent rate"
            min={100}
            max={2000}
            step={100}
            value={c.rate}
            onChange={(v) => set({ rate: v })}
            fmt={(v) => `${f0(v)} fpm`}
          />
          <Seg
            id="ps-flaps"
            label="Flaps (Figure 5-1's settings)"
            options={FLAPS}
            value={c.flaps}
            onChange={(v) => set({ flaps: v })}
          />
          <Slider
            id="ps-slip"
            label="Sideslip"
            min={-15}
            max={15}
            step={1}
            value={c.slip}
            onChange={(v) => set({ slip: v })}
            fmt={(v) => (v === 0 ? "none" : `${Math.abs(v)}°, wind from the ${v > 0 ? "left" : "right"}`)}
          />
          <Small>
            The airplane flies what you set: it is a pressure source, not a flight model. It leaves the ground at{" "}
            {spec.model.airplane.liftOffKcas} KCAS (a model choice).
          </Small>
        </>
      )}
    </>
  );
}

function CockpitPanel() {
  const k = usePs((x) => x.cockpit),
    set = usePs((x) => x.setCockpit);
  const g1000 = usePs((x) => x.avionics) === "g1000";
  const [lo, hi] = spec.handbook.kollsman;
  return (
    <>
      <H3>Cockpit</H3>
      <div className="ps-checks">
        <Check
          id="ps-heat"
          label="PITOT HEAT switch ON"
          checked={k.pitotHeat}
          onChange={(v) => set({ pitotHeat: v })}
        />
        <Check
          id="ps-alts"
          label="ALT STATIC AIR pulled ON"
          checked={k.altStatic}
          onChange={(v) => set({ altStatic: v })}
        />
        <Check
          id="ps-vents"
          label="Cabin vents or a window open"
          checked={k.ventsOpen}
          onChange={(v) => set({ ventsOpen: v })}
        />
        <Check
          id="ps-heatair"
          label="CABIN HT and CABIN AIR pulled ON"
          checked={k.heatAir}
          onChange={(v) => set({ heatAir: v })}
        />
      </div>
      {g1000 && (
        <Slider
          id="ps-baro"
          label="PFD BARO"
          min={lo}
          max={hi}
          step={0.01}
          value={k.baro}
          onChange={(v) => set({ baro: v })}
          fmt={(v) => `${v.toFixed(2)} inHg`}
        />
      )}
      <Slider
        id="ps-kollsman"
        label={g1000 ? "Standby altimeter setting" : "Altimeter setting (barometric scale)"}
        min={lo}
        max={hi}
        step={0.01}
        value={k.kollsman}
        onChange={(v) => set({ kollsman: v })}
        fmt={(v) => `${v.toFixed(2)} inHg`}
      />
      {g1000 && <Small>Before take-off: altimeters, PFD (BARO) SET and standby altimeter SET ({POH} p. 4-15).</Small>}
      <Caution title={`Static source blockage (${POH} p. 3-15)`}>
        ALT STATIC AIR valve ON (pull full out) · cabin vents CLOSED · CABIN HT and CABIN AIR control knobs ON (pull
        full out) · airspeed: refer to Figure 5-1 Sheet 2, alternate static source.
      </Caution>
      <Small>
        With ALT STATIC AIR on, the maximum airspeed variation from the normal source is {spec.poh.altVariation.kt} kt
        and the altimeter&apos;s {spec.poh.altVariation.ft} ft, with all windows closed ({POH} p. 3-32). Sheet 2 holds
        with windows and ventilators closed and the heat, cabin air and defroster on maximum; outside those conditions
        this model&apos;s cabin pressure is illustrative. The 172S has no pitot-heat annunciation: check the tube warm
        to the touch within {spec.poh.heatCheckS} seconds before flight ({POH} p. 4-6).
      </Small>
    </>
  );
}

function WeatherPanel() {
  const w = usePs((x) => x.weather),
    set = usePs((x) => x.setWeather);
  const x = useLiveSnapshot(s, 250);
  return (
    <>
      <H3>Weather</H3>
      <Slider
        id="ps-qnh"
        label="Sea-level pressure (the right altimeter setting)"
        min={28.5}
        max={31}
        step={0.01}
        value={w.qnh}
        onChange={(v) => set({ qnh: v })}
        fmt={(v) => `${v.toFixed(2)} inHg`}
      />
      <Slider
        id="ps-isa"
        label="Temperature against standard"
        min={-30}
        max={30}
        step={1}
        value={w.isaDev}
        onChange={(v) => set({ isaDev: v })}
        fmt={(v) => `ISA ${v >= 0 ? "+" : "−"}${Math.abs(v)} °C`}
      />
      <Check
        id="ps-moist"
        label="In cloud or rain (visible moisture)"
        checked={w.moisture}
        onChange={(v) => set({ moisture: v })}
      />
      <Readouts
        items={[
          ["Outside air", [`${x.oat.toFixed(0)} °C`, x.oat <= 0 && w.moisture ? "warnc" : ""]],
          ["Pressure altitude", `${f0(x.pa)} ft`],
          ["True airspeed", `${f0(x.ktas)} KTAS`],
        ]}
      />
      <Small>
        Ice needs visible moisture and 0 °C or colder, and small objects like a pitot tube collect it fastest ({IFH} pp.
        10-23, 4-13).
      </Small>
    </>
  );
}

function Installation() {
  const ports = usePs((x) => x.ports),
    setPorts = usePs((x) => x.setPorts);
  return (
    <>
      <H3>Installation</H3>
      <Seg
        id="ps-ports"
        label="Static ports"
        options={[
          ["single", "One, left side (172S)"],
          ["paired", "A pair, cross-connected"],
        ]}
        value={ports}
        onChange={setPorts}
      />
      <Small>
        {ports === "single"
          ? `The 172S has one static port, on the left side of the forward fuselage (${POH} p. 7-64): a sideslip changes the pressure it reads.`
          : `Ports "paired, one on either side of the aircraft. This dual location prevents lateral movement of the aircraft from giving erroneous static pressure indications" (${IFH} p. 5-2), joined with Y tubing (${AMT} p. 10-13). Not the 172S's installation.`}
      </Small>
    </>
  );
}

function FailuresPanel() {
  const f = usePs((x) => x.failures),
    set = usePs((x) => x.setFailures);
  const ports = usePs((x) => x.ports),
    drain = usePs((x) => x.drainSump);
  const mode = usePs((x) => x.mode);
  const g1000 = usePs((x) => x.avionics) === "g1000";
  const ground = useLiveSnapshot(s, 250).h <= 0 && onGround({ mode });
  const items: [keyof Failures, string][] = [
    ["ram", "Pitot ram inlet blocked (insects, debris)"],
    ["drain", "Pitot drain hole blocked"],
    ["portL", ports === "paired" ? "Left static port blocked" : "Static port blocked (tape, ice, insects)"],
    ...(ports === "paired" ? ([["portR", "Right static port blocked"]] as [keyof Failures, string][]) : []),
    ["water", "Water in the static line"],
    ["heater", "Pitot heater element open"],
    ["pitotLeak", "Pitot line leaking behind the panel"],
    g1000 ? ["adc", "Air data computer failed (or its breaker open)"] : ["vsiGlass", "VSI glass broken"],
  ];
  const leaks: [Leak, string][] = [
    ["none", "None"],
    ["seep", "Seep"],
    ["cracked", "Cracked fitting"],
    ["disconnected", "Line off"],
  ];
  return (
    <>
      <H3>Failures</H3>
      <div className="ps-checks">
        {items.map(([k, t]) => (
          <Check
            key={k}
            id={`ps-f-${k}`}
            label={t}
            checked={f[k] as boolean}
            onChange={(v) => set({ [k]: v } as Partial<Failures>)}
          />
        ))}
      </div>
      <Seg id="ps-leak" label="Static system leak" options={leaks} value={f.leak} onChange={(v) => set({ leak: v })} />
      <BtnRow>
        <button type="button" className="btn" disabled={!f.water || !ground} onClick={drain}>
          Drain the static sump
        </button>
      </BtnRow>
      <Small>
        Water collects at the static line&apos;s low point, where the sump is ({IPC} 34-11-00 Figure 01). Drain it on
        the ground: &ldquo;systems with drains can be drained without requiring a leak check&rdquo; ({AMT} p. 10-81).
        Leak sizes, ice and water behaviour are illustrations of the mechanism, not maintenance data.
      </Small>
    </>
  );
}

function LeakTest() {
  const mode = usePs((x) => x.mode);
  const t = usePs((x) => x.test),
    set = usePs((x) => x.setTest);
  const x = useLiveSnapshot(s, 100);
  if (mode !== "test") return null;
  const lt = x.leakTest;
  const lim = spec.handbook.leakTest;
  const elapsed = lt.t0 === null ? 0 : Math.min(x.t - lt.t0, lim.s);
  const there = Math.abs(x.testAlt - t.alt) < 1 && Math.abs(x.testKt - t.kt) < 0.5;
  // the instruments have to indicate the test altitude, not just the test set hold it
  const reached = leakTestReached(spec, lt);
  const result: Reading =
    lt.t0 === null
      ? "—"
      : !reached
        ? ["No test", "bad"]
        : !lt.done
          ? `timing: ${elapsed.toFixed(0)} of ${lim.s} s, ${f0(lt.altLoss)} ft lost so far`
          : lt.testFt < lim.ft
            ? `${f0(Math.max(0, lt.altLoss))} ft lost in a minute`
            : lt.altLoss > lim.maxLossFt
              ? [`FAIL: ${f0(lt.altLoss)} ft lost in a minute`, "bad"]
              : `Pass: ${f0(Math.max(0, lt.altLoss))} ft lost in a minute`;
  const why =
    lt.t0 === null
      ? null
      : !reached
        ? `Sealed with the static side at ${f0(lt.staticFt)} ft and the test set at ${f0(lt.testFt)}: the instruments never indicated the test altitude, so the minute tests nothing. Look for a blocked port, ALT STATIC AIR on or a large leak.`
        : lt.done && lt.testFt < lim.ft
          ? `Pass or fail is judged at the handbook's ${f0(lim.ft)} ft.`
          : null;
  return (
    <>
      <H3>Static system leak test</H3>
      <Slider
        id="ps-test-alt"
        label="Test set: static side above the field"
        min={0}
        max={2000}
        step={100}
        value={t.alt}
        onChange={(v) => set({ alt: v, sealed: false })}
        fmt={(v) => `${f0(v)} ft`}
      />
      <Slider
        id="ps-test-kt"
        label="Test set: airspeed on the pitot side"
        min={0}
        max={160}
        step={5}
        value={t.kt}
        onChange={(v) => set({ kt: v, sealed: false })}
        fmt={(v) => `${v} kt`}
      />
      <BtnRow>
        <button
          type="button"
          className="btn primary"
          disabled={t.sealed || !there}
          onClick={() => set({ sealed: true })}
        >
          Seal and time 1 minute
        </button>
        <button type="button" className="btn" disabled={!t.sealed} onClick={() => set({ sealed: false })}>
          Open the test set
        </button>
      </BtnRow>
      <Readouts
        items={[
          [
            "Test set",
            there
              ? `holding ${f0(x.testAlt)} ft, ${f0(x.testKt)} kt`
              : `moving: ${f0(x.testAlt)} ft, ${f0(x.testKt)} kt`,
          ],
          ["Altimeter", `${f0(x.alt)} ft`],
          ["Result", result],
        ]}
      />
      {why && <Small>{why}</Small>}
      <Small>
        &ldquo;…pressure is reduced in the system by the amount required to indicate 1,000 feet on the altimeter. Then,
        the system is sealed and observed for 1 minute. A loss of altitude of more than 100 feet is not
        permissible.&rdquo; Pressure and suction must be applied and released slowly, and every plug, adaptor and piece
        of tape removed after ({AMT} p. 10-81). The test set here changes pressure at {f0(spec.model.testSet.ftPerMin)}{" "}
        ft/min. To fly IFR, the static system and altimeter must have been tested within the previous 24 months (14 CFR
        91.411; {AMT} p. 10-80).
      </Small>
    </>
  );
}

/** A chart of an actual and an indicated trace over the last minute. */
function Trace({
  title,
  actual,
  shown,
  unit,
  floor,
  label,
}: {
  title: string;
  actual: number[];
  shown: number[];
  unit: string;
  /** Smallest span on the axis. */
  floor: number;
  label: string;
}) {
  const x = useLiveSnapshot(s, 200);
  const t = x.hist.t;
  const W = 330,
    H = 110,
    P = { l: 46, r: 8, t: 8, b: 16 };
  const t1 = t.length ? t[t.length - 1] : 0;
  const all = [...actual, ...shown].filter(Number.isFinite);
  let lo = Math.min(...all),
    hi = Math.max(...all);
  if (!all.length) [lo, hi] = [0, 1];
  if (hi - lo < floor) {
    const mid = (hi + lo) / 2;
    [lo, hi] = [mid - floor / 2, mid + floor / 2];
  }
  const px = (v: number) => P.l + (1 - (t1 - v) / HIST_S) * (W - P.l - P.r);
  const py = (v: number) => H - P.b - ((v - lo) / (hi - lo)) * (H - P.t - P.b);
  // no reading (a red X) breaks the line
  const path = (ys: number[]) => {
    let d = "",
      pen = false;
    ys.forEach((v, i) => {
      if (!Number.isFinite(v)) return void (pen = false);
      d += `${pen ? "L" : "M"}${px(t[i]).toFixed(1)},${py(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  return (
    <figure className="ps-fig">
      <figcaption>{title}</figcaption>
      <svg className="eng-chart ps-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {[lo, (lo + hi) / 2, hi].map((v) => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={py(v)} y2={py(v)} className="grid" />
            <text x={P.l - 4} y={py(v) + 4} textAnchor="end">
              {n0(v)}
            </text>
          </g>
        ))}
        <path d={path(actual)} className="ps-actual" />
        <path d={path(shown)} className="trace" />
        <text x={P.l} y={H - 3}>
          −{HIST_S} s
        </text>
        <text x={W - P.r} y={H - 3} textAnchor="end">
          {unit}
        </text>
      </svg>
    </figure>
  );
}

function Charts() {
  const h = useLiveSnapshot(s, 200).hist;
  const shown = usePs((x) => x.avionics) === "g1000" ? "PFD" : "indicated";
  return (
    <>
      <H3>Last minute: actual and indicated</H3>
      <div className="ps-key">
        <span>
          <i className="k-actual" /> actual
        </span>
        <span>
          <i className="k-shown" /> {shown}
        </span>
      </div>
      <Trace
        title="Airspeed"
        actual={h.kcas}
        shown={h.ias}
        unit="kt (KCAS, KIAS)"
        floor={20}
        label="Airspeed, actual and indicated"
      />
      <Trace title="Altitude" actual={h.h} shown={h.alt} unit="ft" floor={200} label="Altitude, actual and indicated" />
      <Trace
        title="Vertical speed"
        actual={h.vs}
        shown={h.vsi}
        unit="fpm"
        floor={400}
        label="Vertical speed, actual and indicated"
      />
    </>
  );
}

function Inside() {
  const x = useLiveSnapshot(s, 150);
  const u = usePs();
  const g1000 = u.avionics === "g1000";
  const hg = (pa: number) => `${inHg(pa).toFixed(3)} inHg`;
  const items: [string, Reading][] = [
    ["Outside, free stream", hg(x.pInf)],
    ["Total (ram) pressure", hg(x.pt)],
    [u.ports === "paired" ? "At the left port" : "At the static port", hg(x.portL)],
    ...(u.ports === "paired" ? ([["At the right port", hg(x.portR)]] as [string, Reading][]) : []),
    ["Cabin", hg(x.cabin)],
    ...((g1000
      ? [
          ["Pitot side (ADC, standby ASI)", hg(x.pitot)],
          ["Static side (ADC, standby cases)", hg(x.stat)],
        ]
      : [
          ["Pitot side (ASI diaphragm)", hg(x.pitot)],
          ["Static side (cases, encoder)", hg(x.stat)],
          ["VSI case", hg(x.vsiCase)],
        ]) as [string, Reading][]),
    [
      "Static source",
      u.cockpit.altStatic ? ["CABIN (alternate)", "warnc"] : u.ports === "paired" ? "Both ports" : "Port",
    ],
    g1000
      ? ["ADC pressure altitude", x.pfd.valid ? `${n0(x.pfd.pa)} ft` : ["no data", "bad"]]
      : ["Encoder (Mode C)", `${n0(x.modeC)} ft`],
    [
      "Pitot head",
      `${x.headC.toFixed(0)} °C${u.cockpit.pitotHeat ? (u.failures.heater ? ", heater open" : ", heated") : ""}`,
    ],
    [
      "Ice: inlet, drain",
      x.iceRam + x.iceDrain < 0.005
        ? "none"
        : [`${Math.round(x.iceRam * 100)} % closed, ${Math.round(x.iceDrain * 100)} % closed`, "warnc"],
    ],
    ...(u.failures.water
      ? ([
          [
            "Water in the static line",
            x.waterIce > 0.99 ? ["FROZEN", "bad"] : x.waterIce > 0 ? ["freezing", "warnc"] : "liquid",
          ],
        ] as [string, Reading][])
      : []),
  ];
  return (
    <>
      <H3>Inside the system</H3>
      <Readouts items={items} />
      <Small>
        0.001 inHg is about one foot of altitude near sea level. The airspeed indicator reads the pitot side against the
        static side; the altimeter the static side; the VSI the static side against its own case, which follows through
        the calibrated leak ({PHAK} pp. 8-3 to 8-8). The G1000&apos;s air data computer reads the same two sides.
      </Small>
    </>
  );
}

function PohTable() {
  const flaps = usePs((x) => x.controls.flaps);
  const n = spec.poh.normal[flaps],
    a = spec.poh.alternate[flaps];
  const name = FLAPS.find((f) => f[0] === flaps)![1];
  return (
    <>
      <H3>Airspeed calibration, flaps {name} (Figure 5-1)</H3>
      <table className="ps-cal">
        <thead>
          <tr>
            <th>KIAS</th>
            <th>KCAS, normal</th>
            <th>KCAS, alternate</th>
          </tr>
        </thead>
        <tbody>
          {n.map(([kias, kcas], k) => (
            <tr key={kias}>
              <th>{kias}</th>
              <td>{kcas}</td>
              <td>{a[k][1]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Small>
        KCAS for each KIAS, &ldquo;power required for level flight or maximum power descent&rdquo; ({POH} pp. 5-10,
        5-11). The alternate source&apos;s row assumes windows and ventilators closed and cabin heat, cabin air and
        defroster on maximum.
      </Small>
    </>
  );
}

function Docs() {
  const m = spec.poh.markings,
    g = spec.g1000;
  const facts: [ReactNode, ReactNode][] = [
    ["Pitot head", `Heated, on the lower surface of the left wing (${POH} p. 7-64)`],
    ["Static port", `Left side of the forward fuselage; check the opening clear on preflight (${POH} pp. 7-64, 4-9)`],
    [
      "ALT STATIC AIR",
      `Selector valve (${IPC}) adjacent to the throttle; OFF, pushed in, before flight (${POH} pp. 7-12, 4-6)`,
    ],
    [
      "Lines",
      `Pitot ${spec.poh.pitotLineIn} in, static ${spec.poh.staticLineIn} in, sump at the low point (${IPC} 34-11-00 Figure 01)`,
    ],
    [
      "ASI markings",
      `White ${m.white.join("–")}, green ${m.green.join("–")}, yellow ${m.yellow.join("–")}, red line ${m.redLine} KIAS (${POH} Figure 2-2)`,
    ],
    ["VFE", `${spec.poh.vfe.ten} KIAS flaps 10°, ${spec.poh.vfe.full} KIAS 10° to FULL (${POH} Figure 2-1)`],
    ["VSI lag", `Needle stabilizes after ${spec.handbook.vsiLagS.join("–")} seconds (${PHAK} p. 8-8)`],
    ["Altimeter check", `Within ${spec.handbook.altimeterCheckFt} ft of the field elevation (${PHAK} p. 8-7)`],
    [
      "Barometric scale",
      `${spec.handbook.kollsman[0].toFixed(2)}–${spec.handbook.kollsman[1].toFixed(2)} inHg; 1 inHg ≈ 1,000 ft (${IFH} p. 5-4)`,
    ],
    [
      "G1000 airspeed tape",
      `Starts at ${g.tapeMinKt} kt; red arc ${g.redArc.join("–")} KIAS on the G1000 only; TAS below the tape (${GPG} p. 50; ${POH} Figure 2-2, p. 7-18)`,
    ],
    ["G1000 trend vectors", `Airspeed and altitude about ${g.trendS} seconds ahead (${GPG} pp. 50, 53)`],
    [
      "G1000 VSI",
      `Digits above ${g.vsiDigitsFpm} fpm; at the edge of the scale beyond ${f0(g.vsiScaleFpm)} fpm (${GPG} p. 55; ${POH} p. 7-20)`,
    ],
  ];
  return (
    <>
      <H3>Documented numbers</H3>
      <Facts rows={facts} />
      <H3>Procedures</H3>
      <Notes
        items={[
          `Preflight: pitot tube cover REMOVE (check for pitot blockage); PITOT HEAT ON, tube warm to the touch within 30 seconds, then OFF; ALT STATIC AIR OFF (push full in); static source opening CHECK clear (${POH} pp. 4-5, 4-6, 4-9).`,
          `Inadvertent icing: PITOT HEAT ON, turn back or change altitude (${POH} p. 3-14).`,
          `Static source blockage: ALT STATIC AIR ON, cabin vents CLOSED, CABIN HT and CABIN AIR ON, airspeed from Figure 5-1 Sheet 2 (${POH} p. 3-15). With no alternate source, break the VSI's glass (${PHAK} p. 8-3).`,
          `Before take-off the airspeed reads zero; on the roll, make sure it increases at an appropriate rate (${PHAK} p. 8-10).`,
          `G1000, red X on the PFD's airspeed or altitude: ADC/AHRS circuit breakers CHECK IN (ESS BUS and AVN BUS 1; reset once), then use the standby airspeed indicator, and the standby altimeter set to the current pressure (${POH} p. 3-21).`,
        ]}
      />
      <H3>How the model works</H3>
      <Notes
        items={[
          "Three volumes of air (the pitot side, the static side and the VSI's case) each move toward the pressures they are open to, as fast as their openings let air through. Block an opening and the volume keeps what it had.",
          "The instruments are ideal: the ASI turns the pitot-side minus static-side pressure into airspeed with the standard sea-level calibration, the altimeter the static side into altitude from the barometric scale, the VSI its diaphragm against its lagging case into feet per minute.",
          "The G1000's air data computer reads the same two volumes: airspeed and altitude as the instruments do, vertical speed from the rate its pressure altitude changes, true airspeed with the OAT probe. Its filters aren't published; the ones here are chosen. The PFD's attitude and heading are not simulated: wings level, nose on the flight path.",
          "The static port and the cabin read the POH's Figure 5-1 calibration: the whole KIAS–KCAS difference is put on the static source, so a healthy system reads the POH's KIAS exactly, and the altimeter error that follows is this model's, not the POH's.",
          `Not published, so chosen to behave as the handbooks describe: every time constant, the leak sizes, the icing and melting rates, the water's sloshing, the sideslip effect, the cabin pressure outside Sheet 2's conditions and the test set's rates. The 3D view is schematic, after ${PHAK} Figure 8-1.`,
        ]}
      />
      <H3>Sources</H3>
      <ul className="notes">
        <li>
          <a
            href="https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/faa-h-8083-25c.pdf"
            target="_blank"
            rel="noreferrer"
          >
            {PHAK}, Pilot&apos;s Handbook of Aeronautical Knowledge
          </a>
          , chapter 8: the system, its instruments and blockages (pp. 8-1 to 8-12).
        </li>
        <li>
          <a
            href="https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/FAA-H-8083-15B.pdf"
            target="_blank"
            rel="noreferrer"
          >
            {IFH}, Instrument Flying Handbook
          </a>
          : paired ports, position error, the sensitive altimeter, encoding, the VSI (pp. 5-2 to 5-9); icing (pp. 4-13,
          10-23); breaking the VSI glass (p. 11-8).
        </li>
        <li>
          <a
            href="https://www.faa.gov/sites/faa.gov/files/FAA-H-8083-31B_Aviation_Maintenance_Technician_Handbook.pdf"
            target="_blank"
            rel="noreferrer"
          >
            {AMT}, Aviation Maintenance Technician Handbook – Airframe
          </a>
          , chapter 10: pitot tubes and static vents (pp. 10-11 to 10-13), position error (p. 10-20), maintenance and
          leak tests (p. 10-81).
        </li>
        <li>
          Cessna 172S NAV III Pilot&apos;s Operating Handbook (172SPHBUS-00): Figures 2-1, 2-2 and 5-1; pp. 2-16, 3-14,
          3-15, 3-21, 3-32, 4-4 to 4-9, 4-15, 7-12, 7-18, 7-20, 7-64, 7-70. Cessna Model 172 Illustrated Parts Catalog (
          {IPC}), 34-11-00 Figures 01 and 02.
        </li>
        <li>
          <a href="https://static.garmin.com/pumac/190-00498-07_0A_Web.pdf" target="_blank" rel="noreferrer">
            {GPG}, G1000 Pilot&apos;s Guide for Cessna NAV III
          </a>
          : the air data computer (p. 2), the airspeed tape, altimeter, VSI and trend vectors (pp. 50 to 55), and the
          red X failures (p. 565).
        </li>
      </ul>
    </>
  );
}

function Readings() {
  const x = useLiveSnapshot(s, 150);
  const u = usePs();
  const g1000 = u.avionics === "g1000";
  const flying = x.kcas >= 1;
  const poh = (alt: boolean) => pohKias(spec, x.kcas, u.controls.flaps, alt);
  const want = poh(u.cockpit.altStatic);
  const bad = (on: boolean) => (on ? "bad" : "");
  const p = x.pfd;
  const pfd = (v: string) => (p.valid ? v : "red X");
  return (
    <>
      <H3>Flying and reading</H3>
      <table className="ps-read">
        <thead>
          <tr>
            <th />
            <th>Actual</th>
            {g1000 && <th>PFD</th>}
            <th>{g1000 ? "Standby" : "Indicated"}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>Airspeed</th>
            <td>
              {n0(x.kcas)} KCAS <small>{n0(x.ktas)} KTAS</small>
            </td>
            {g1000 && (
              <td className={bad(!p.valid || (flying && Math.abs(p.ias - want) > 3))}>
                {pfd(`${n0(p.ias)} KIAS`)} {p.valid && <small>TAS {n0(p.tas)}</small>}
              </td>
            )}
            <td className={bad(flying && Math.abs(x.ias - want) > 3)}>{n0(x.ias)} KIAS</td>
          </tr>
          <tr>
            <th>Figure 5-1</th>
            <td colSpan={g1000 ? 3 : 2}>
              {flying ? `normal source ${n0(poh(false))}, alternate ${n0(poh(true))} KIAS` : "—"}
            </td>
          </tr>
          <tr>
            <th>Altitude</th>
            <td>{n0(x.h)} ft</td>
            {g1000 && <td className={bad(!p.valid || Math.abs(p.alt - x.h) > 100)}>{pfd(`${n0(p.alt)} ft`)}</td>}
            <td className={bad(Math.abs(x.alt - x.h) > 100)}>{n0(x.alt)} ft</td>
          </tr>
          <tr>
            <th>Vertical speed</th>
            <td>{signed(x.vs)} fpm</td>
            {g1000 && <td className={bad(!p.valid || Math.abs(p.vs - x.vs) > 300)}>{pfd(`${signed(p.vs)} fpm`)}</td>}
            {g1000 ? (
              <td>none</td>
            ) : (
              <td className={bad(Math.abs(x.vsi - x.vs) > 300)}>
                {signed(x.vsi)} fpm{x.vsiPegged ? " (pegged)" : ""}
              </td>
            )}
          </tr>
        </tbody>
      </table>
    </>
  );
}

function Panel() {
  return (
    <div className="panel-inner">
      <div className="ref">Component simulation · {PHAK} ch. 8 · Cessna 172S POH</div>
      <p className="lead">{spec.lead}</p>
      <Try />
      <Flight />
      <LeakTest />
      <CockpitPanel />
      <Readings />
      <Charts />
      <FailuresPanel />
      <WeatherPanel />
      <Installation />
      <Inside />
      <PohTable />
      <Docs />
    </div>
  );
}

const TOGGLES = [
  ["xray", "X-ray", "See into the pitot head, the instrument cases and the panel"],
  ["labels", "Labels", "Name the main parts"],
  ["flow", "Air flow", "Show air moving through the openings and lines"],
  ["paused", "Pause", "Freeze the simulation"],
] as const;

export default function PitotStaticApp() {
  usePsLoop();
  const view = usePsView();
  return (
    <ComponentShell
      id={spec.id}
      scene={<Scene />}
      toolbar={<ViewToggles items={TOGGLES} view={view} set={view.set} />}
      foot={<Monitor />}
      panel={<Panel />}
    />
  );
}
