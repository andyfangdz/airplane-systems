"use client";
/**
 * An engine monitor over the 3D view: rpm, manifold pressure, fuel flow, power, oil, and EGT/CHT bars per cylinder
 * (the kind of display a modern panel gives; the layout is generic, not any one installation's). Limit flags beside it.
 */
import { egtOffset } from "@/engines/model/mixture";
import { limitFlags } from "@/engines/model/alerts";
import { meanLambda } from "@/engines/model/trim";
import { AVGAS_LB_GAL } from "@/engines/model/atmosphere";
import { useLiveSnapshot } from "@/lib/useLiveSnapshot";
import type { EngineSim } from "./store";

const f0 = (v: number) => Math.round(v).toLocaleString("en-US");

export function Monitor({ sim }: { sim: EngineSim }) {
  const s = useLiveSnapshot(sim.s, 150);
  const spec = sim.spec,
    L = spec.limits;
  const lam = meanLambda(s);
  const peak = Number.isFinite(lam) && s.running ? -egtOffset(lam) : NaN;
  const side = !Number.isFinite(peak) ? "" : lam < 0.99 ? "ROP" : lam > 1.01 ? "LOP" : "peak";
  const egtMax = Math.max(1700, ...s.cyl.map((c) => c.egt));
  const hot = (cht: number) => (cht > L.chtMax.value ? "bad" : cht > L.chtBestAt75.value ? "warnc" : "");
  const big: [string, string, string, string?][] = [
    ["RPM", f0(s.rpm), "", s.rpm > L.rpmMax.value + 25 ? "bad" : ""],
    ["MAP", s.map.toFixed(1), "inHg"],
    ["FF", (s.fuel / AVGAS_LB_GAL).toFixed(1), "gph"],
    ["Power", f0(s.pct), "%"],
  ];
  const small: [string, string, string?][] = [
    ["Oil °F", f0(s.oilT), s.oilT > L.oilTempMax.value ? "bad" : ""],
    [
      "Oil psi",
      f0(s.oilP),
      s.rpm > 100 && s.oilP < L.oilPressMinIdle.value ? "bad" : s.oilP > L.oilPressNormal.max ? "warnc" : "",
    ],
    ["Fuel psi", s.nozzlePsi.toFixed(1)],
    ["hp", f0(s.hp)],
    ["Peak", Number.isFinite(peak) ? (side === "peak" ? "at peak" : `${f0(peak)} ${side}`) : "–"],
  ];
  return (
    <div className="eng-mon" aria-label="Engine monitor">
      <div className="mon-big">
        {big.map(([l, v, u, c]) => (
          <div key={l}>
            <span>{l}</span>
            <b className={c}>{v}</b>
            <i>{u}</i>
          </div>
        ))}
      </div>
      <div className="mon-bars" aria-label="EGT and CHT by cylinder">
        {s.cyl.map((c, i) => (
          <div key={i} className="mon-cyl">
            <div className="bar egt" title={`EGT ${f0(c.egt)} °F`}>
              <div style={{ height: `${Math.max(0, Math.min(100, ((c.egt - 300) / (egtMax - 300)) * 100))}%` }} />
            </div>
            <div className="bar cht" title={`CHT ${f0(c.cht)} °F`}>
              <div
                className={hot(c.cht)}
                style={{ height: `${Math.max(0, Math.min(100, ((c.cht - 50) / (500 - 50)) * 100))}%` }}
              />
            </div>
            <span>{spec.geometry.cylinders[i].n}</span>
            <small>{Math.round(c.egt)}</small>
            <small className={hot(c.cht)}>{Math.round(c.cht)}</small>
          </div>
        ))}
        <div className="mon-key">
          <span>
            <i className="egt" /> EGT
          </span>
          <span>
            <i className="cht" /> CHT
          </span>
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

export function Flags({ sim }: { sim: EngineSim }) {
  const s = useLiveSnapshot(sim.s, 300);
  const env = sim.useUi((x) => x.env);
  const flags = limitFlags(sim.spec, s, env);
  return (
    <ul className="eng-flags" aria-label="Limits exceeded" hidden={!flags.length}>
      {flags.map((f) => (
        <li key={f.src} className={f.level} title={f.src}>
          {f.text}
        </li>
      ))}
    </ul>
  );
}
