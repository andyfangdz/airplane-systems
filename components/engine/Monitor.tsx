"use client";
/**
 * An engine monitor over the 3D view: rpm, manifold pressure, fuel flow, power, oil, and EGT/CHT bars per cylinder
 * (the kind of display a modern panel gives; the layout is generic, not any one installation's), with a TIT bar per
 * turbocharger on a turbocharged engine. Colours follow the spec's instrument markings where it has them. Limit flags
 * beside it.
 */
import { egtOffset } from "@/engines/model/mixture";
import { limitFlags, markingBand, type LimitFlag } from "@/engines/model/alerts";
import { titFromPeak } from "@/engines/model/tit";
import { meanLambda } from "@/engines/model/trim";
import { AVGAS_LB_GAL } from "@/engines/model/atmosphere";
import type { EngineSpec, Marking } from "@/engines/types";
import { f0 } from "@/lib/format";
import { useLiveSnapshot } from "@/lib/useLiveSnapshot";
import type { EngineSim } from "./store";

const SEVERITY = { green: 0, yellow: 1, red: 2 } as const;
const TONES = ["", "warnc", "bad"] as const;
export type Tone = (typeof TONES)[number];

/**
 * A value's colour on one of the spec's instrument markings: "" in a green band, "warnc" in a yellow one, "bad" in a
 * red one; undefined when the spec has no marking for that gauge (the caller keeps its own derivation). A band holds
 * `from < v ≤ to`; the band starting at the scale's bottom also holds its `from`, and a red band reaching the scale's
 * top is open-ended (the manual prints it "> x"; the zero-width band at the top of a scale stands for that). Where
 * bands overlap the more severe one wins. A value in no band is "".
 */
export function bandTone(spec: EngineSpec, gauge: Marking["gauge"], v: number): Tone | undefined {
  const m = spec.markings?.find((x) => x.gauge === gauge);
  if (!m) return undefined;
  // the band the limit flags read too (alerts.ts), so a gauge's colour and its flag never disagree
  const b = markingBand(m, v);
  return b ? TONES[SEVERITY[b.color]] : "";
}

const scaleOf = (spec: EngineSpec, gauge: Marking["gauge"]) => spec.markings?.find((m) => m.gauge === gauge)?.scale;
const fill = (v: number, [lo, hi]: [number, number]) => `${Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100))}%`;
const peakText = (off: number, side: string) => (side === "peak" ? "at peak" : `${f0(off)} ${side}`);

/**
 * A TIT bar per turbocharger, the digits above it as the airplane's display has them (SR22T POH 7-35), and a failed
 * probe's field crossed out in red (POH 7-32). Its own component, so the monitor around it stays compiled: reading the
 * failures from the page's store is the only store read the monitor would otherwise make.
 */
function TitBars({ sim, tit, scale }: { sim: EngineSim; tit: readonly number[] | undefined; scale: [number, number] }) {
  const titProbe = sim.useUi((x) => x.failures.titProbe);
  return (["L", "R"] as const).map((sd, i) => {
    const t = tit?.[i] ?? scale[0],
      failed = !!titProbe?.[i],
      tone = bandTone(sim.spec, "tit", t);
    // the bar is a digit row shorter than a cylinder's so it ends level with theirs
    return (
      <div key={sd} className="mon-cyl mon-tit">
        <small className={failed ? "bad" : tone}>{failed ? "X" : Math.round(t)}</small>
        <div className="bar tit" title={failed ? `TIT ${sd}: no valid data` : `TIT ${sd} ${f0(t)} °F`}>
          {failed ? (
            <i className="x" role="img" aria-label={`TIT ${sd} invalid`} />
          ) : (
            <div className={tone} style={{ height: fill(t, scale) }} />
          )}
        </div>
        <span>{sd}</span>
        {/* two empty rows for the cylinders' EGT and CHT digits, so the labels and bar feet line up */}
        <small aria-hidden="true">&nbsp;</small>
        <small aria-hidden="true">&nbsp;</small>
      </div>
    );
  });
}

export function Monitor({ sim, className = "" }: { sim: EngineSim; className?: string }) {
  const s = useLiveSnapshot(sim.s, 150);
  const spec = sim.spec,
    L = spec.limits,
    turbo = !!spec.turbo,
    rich = spec.calibration.richMisfireLambda;
  const lam = meanLambda(s);
  const peak = Number.isFinite(lam) && s.running ? -egtOffset(lam, rich) : NaN;
  const side = !Number.isFinite(peak) ? "" : lam < 0.99 ? "ROP" : lam > 1.01 ? "LOP" : "peak";
  // the TIT bars' own path (engines/model/tit.ts): the °F they rise to their peak as the mixture is leaned
  const titPeak = turbo && s.running ? titFromPeak(spec, s.cyl, s.leanCap) : null;
  const egtScale = scaleOf(spec, "egt") ?? [300, Math.max(1700, ...s.cyl.map((c) => c.egt))];
  const chtScale = scaleOf(spec, "cht") ?? [50, 500];
  const titScale = scaleOf(spec, "tit") ?? [1000, 1800];
  const hot = (cht: number) =>
    bandTone(spec, "cht", cht) ?? (cht > L.chtMax.value ? "bad" : cht > L.chtBestAt75.value ? "warnc" : "");
  // oil pressure is not coloured with the crankshaft stopped
  const oilPTone = scaleOf(spec, "oilP") ? (s.rpm > 100 ? bandTone(spec, "oilP", s.oilP) : "") : undefined;
  // the spec's own note on how its percent power is worked out, where it has one
  const powerNote = spec.modelNotes.find((n) => n.startsWith("Percent power"));
  const big: [string, string, string, Tone?, string?][] = [
    ["RPM", f0(s.rpm), "", bandTone(spec, "rpm", s.rpm) ?? (s.rpm > L.rpmMax.value + 25 ? "bad" : "")],
    ["MAP", s.map.toFixed(1), "inHg", bandTone(spec, "map", s.map)],
    ["FF", (s.fuel / AVGAS_LB_GAL).toFixed(1), "gph"],
    ["Power", f0(s.pct), "%", undefined, powerNote],
  ];
  const small: [string, string, string?][] = [
    ["Oil °F", f0(s.oilT), bandTone(spec, "oilT", s.oilT) ?? (s.oilT > L.oilTempMax.value ? "bad" : "")],
    [
      "Oil psi",
      f0(s.oilP),
      oilPTone ??
        (s.rpm > 100 && s.oilP < L.oilPressMinIdle.value ? "bad" : s.oilP > L.oilPressNormal.max ? "warnc" : ""),
    ],
    ["Fuel psi", (spec.fuelSystem.kind === "carburetor" ? s.fuelPsi : s.nozzlePsi).toFixed(1)],
    ...(spec.fuelSystem.kind === "carburetor"
      ? ([["Carb °F", f0((s.carbC * 9) / 5 + 32), s.carbC < 0 ? "warnc" : ""]] as [string, string, string][])
      : []),
    // the carburetor's temperature takes the place of brake hp (the panel shows it) to keep the row on one line; a
    // turbocharged engine's deck pressure and TIT peak take it too
    ...(spec.fuelSystem.kind === "carburetor" || turbo ? [] : ([["hp", f0(s.hp)]] as [string, string][])),
    ["Peak", Number.isFinite(peak) ? peakText(peak, side) : "–"],
    ...(turbo
      ? ([
          ["Deck", (s.deckInHg ?? s.inletInHg).toFixed(1)],
          ["TIT pk", titPeak ? peakText(titPeak.off, titPeak.side) : "–"],
        ] as [string, string][])
      : []),
  ];
  return (
    <div className={`eng-mon${turbo ? " turbo" : ""}${className ? ` ${className}` : ""}`} aria-label="Engine monitor">
      <div className="mon-big">
        {big.map(([l, v, u, c, title]) => (
          <div key={l}>
            <span>{l}</span>
            <b className={c} title={title}>
              {v}
            </b>
            <i>{u}</i>
          </div>
        ))}
      </div>
      <div
        className="mon-bars"
        aria-label={turbo ? "EGT and CHT by cylinder, TIT by turbocharger" : "EGT and CHT by cylinder"}
      >
        {s.cyl.map((c, i) => (
          <div key={i} className="mon-cyl">
            <div className="bar egt" title={`EGT ${f0(c.egt)} °F`}>
              <div style={{ height: fill(c.egt, egtScale) }} />
            </div>
            <div className="bar cht" title={`CHT ${f0(c.cht)} °F`}>
              <div className={hot(c.cht)} style={{ height: fill(c.cht, chtScale) }} />
            </div>
            <span>{spec.geometry.cylinders[i].n}</span>
            <small>{Math.round(c.egt)}</small>
            <small className={hot(c.cht)}>{Math.round(c.cht)}</small>
          </div>
        ))}
        {turbo && <TitBars sim={sim} tit={s.tit} scale={titScale} />}
        <div className="mon-key">
          <span>
            <i className="egt" /> EGT
          </span>
          <span>
            <i className="cht" /> CHT
          </span>
          {turbo && (
            <span>
              <i className="tit" /> TIT
            </span>
          )}
        </div>
      </div>
      <div className="mon-small">
        {small.map(([l, v, c]) => (
          <div key={l}>
            <span>{l}</span>
            <b className={c}>{v}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A flag's row. With the POH's instrument markings: an annunciation's name comes first, in bold, and a study limit the
 * POH gives no annunciation for shows as an advisory (white, as the airplane's advisories are) unless it is a hard
 * engine limit (a warning). Without markings: the text alone, coloured by its level.
 */
function flagRow(f: LimitFlag, marked: boolean) {
  const tier = marked && !f.cas && f.level === "caut" ? "adv" : f.level;
  return (
    <li key={f.src} className={tier} title={f.src}>
      {f.cas ? (
        <>
          <b>{f.cas}</b>
          {f.text.slice(f.cas.length)}
        </>
      ) : (
        f.text
      )}
    </li>
  );
}

export function Flags({ sim }: { sim: EngineSim }) {
  const s = useLiveSnapshot(sim.s, 300);
  const env = sim.useUi((x) => x.env),
    failures = sim.useUi((x) => x.failures),
    controls = sim.useUi((x) => x.controls);
  // the failures (a failed TIT probe reads nothing) and the controls (leaning) are part of what is flagged
  const flags = limitFlags(sim.spec, s, env, { failures, controls });
  if (!sim.spec.markings)
    return (
      <ul className="eng-flags" aria-label="Limits exceeded" hidden={!flags.length}>
        {flags.map((f) => flagRow(f, false))}
      </ul>
    );
  // flags named after the POH's annunciations, so the box says what they are: study flags, not the airplane's CAS
  return (
    <div className="eng-flags" role="group" aria-label="Limits exceeded" hidden={!flags.length}>
      <p className="hd">Study flags, not the airplane&apos;s CAS</p>
      <ul>{flags.map((f) => flagRow(f, true))}</ul>
    </div>
  );
}
