"use client";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { FLEET, aircraft, hasSys, resetCam, selectAircraft, selectSys, sysOf, useAircraft } from "@/aircraft";
import { isAircraftId, sysColor, type AircraftId, type SysId, type Theme } from "@/lib/systems";
import { useView } from "@/lib/view";

// WebGL scene is client-only
const Scene = dynamic(() => import("./scene/Scene"), { ssr: false, loading: () => <div className="loading">Loading 3D model…</div> });

function Fleet() {
  const ac = useView((x) => x.ac);
  return (
    <div className="fleet" role="group" aria-label="Airplane">
      {FLEET.map((a) => (
        <button key={a.id} type="button" aria-pressed={a.id === ac} title={a.name} onClick={() => selectAircraft(a.id)}>{a.short}</button>
      ))}
    </div>
  );
}

function Rail() {
  const def = useAircraft();
  const sys = useView((x) => x.sys), theme = useView((x) => x.theme);
  return (
    <nav className="rail" aria-label="Systems">
      <div className="brand">
        <div className="eyebrow">{def.doc} · Airplane &amp; Systems</div>
        <Fleet />
        <h1>{def.name}</h1>
        <p>{def.sub}</p>
      </div>
      <ul className="syslist">
        {def.systems.map((s) => (
          <li key={s.id}>
            <button type="button" aria-current={s.id === sys} style={{ "--c": sysColor(s.id, theme) } as React.CSSProperties} onClick={() => selectSys(s.id)}>
              <span className="sw" /><span className="nm">{s.name}</span><span className="pg">{s.pg}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="foot">Drag to orbit · scroll or pinch to zoom · right-drag to pan. Hover a part for its note.</div>
    </nav>
  );
}

function Panel() {
  const def = useAircraft();
  const sys = useView((x) => x.sys), theme = useView((x) => x.theme);
  const s = sysOf(def, sys), Body = def.panels[s.id];
  useEffect(() => { if (matchMedia("(max-width:860px)").matches) document.querySelector(".panel")?.scrollTo(0, 0); }, [sys, def]);
  return (
    <aside className="panel">
      <div className="panel-inner" style={{ "--c": sysColor(s.id, theme) } as React.CSSProperties}>
        <div className="ref"><i />{def.doc} · p. {s.pg}</div>
        <h2>{s.id === "overview" ? "Airplane & Systems" : s.name}</h2>
        {Body ? <Body /> : <p className="lead">This system isn&apos;t modelled yet for the {def.name}.</p>}
      </div>
    </aside>
  );
}

const SUN = <><circle cx="8" cy="8" r="3" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" /></>;
const MOON = <path d="M13.5 10.2A5.8 5.8 0 0 1 5.8 2.5a5.8 5.8 0 1 0 7.7 7.7z" />;

function Toolbar() {
  const xray = useView((x) => x.xray), labels = useView((x) => x.labels), spin = useView((x) => x.spin), theme = useView((x) => x.theme);
  const { set, setTheme, flyTo } = useView.getState();
  const dark = theme === "dark";
  return (
    <div className="toolbar">
      <button className="tb" aria-pressed={xray} onClick={() => set({ xray: !xray })}>X-ray</button>
      <button className="tb" aria-pressed={labels} onClick={() => set({ labels: !labels })}>Labels</button>
      <button className="tb" aria-pressed={spin} onClick={() => set({ spin: !spin })}>Auto-rotate</button>
      <button className="tb tb-theme" title={dark ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setTheme(dark ? "light" : "dark")}>
        <svg className="ico" viewBox="0 0 16 16" aria-hidden="true">{dark ? SUN : MOON}</svg><span>{dark ? "Light" : "Dark"}</span>
      </button>
      <button className="tb" onClick={() => { const [p, t] = resetCam(); flyTo([...p], [...t]); }}>Reset view</button>
    </div>
  );
}

/** Crew-alert window; keyed by airplane so each airplane's alert hook is called consistently. */
function Alerts() {
  const def = useAircraft();
  const { powered, msgs } = def.useAlerts();
  return (
    <div className="cas" aria-live="polite">
      <div className="hd"><span>{def.alertTitle}</span><span>{powered ? `${msgs.length} ${msgs.length === 1 ? "msg" : "msgs"}` : "NO DISPLAY PWR"}</span></div>
      <ul>{msgs.length ? msgs.map(([c, t]) => <li key={t} className={c}>{t}</li>) : <li className="none">{powered ? "No alerts" : "—"}</li>}</ul>
    </div>
  );
}

function Hud() {
  const { Hud: H } = useAircraft();
  return H ? <H /> : null;
}

function Tooltip() {
  const hover = useView((x) => x.hover);
  if (!hover) return null;
  const stage = document.querySelector(".stage") as HTMLElement | null;
  const w = stage?.clientWidth ?? 800, h = stage?.clientHeight ?? 600;
  return (
    <div className="tip" style={{ left: Math.min(hover.x + 14, w - 270), top: Math.min(hover.y + 14, h - 120) }}>
      <h4 style={{ color: hover.color }}>{hover.name}</h4>
      {hover.note && <p>{hover.note}</p>}
    </div>
  );
}

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

/** Restore theme, airplane and last-viewed system. URL hash wins: #c172s/electrical, #c172s, or (SR20) #electrical. */
function useBoot() {
  useEffect(() => {
    const st = useView.getState();
    let theme: Theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const t = read("sr20theme");
    if (t === "light" || t === "dark") theme = t;
    st.setTheme(theme);
    const [a, b] = decodeURIComponent(location.hash.slice(1)).split("/");
    let ac: AircraftId = "sr20", sys: string | null | undefined;
    if (isAircraftId(a)) { ac = a; sys = b; }
    else if (a && hasSys(aircraft("sr20"), a)) sys = a;
    else { const saved = read("fleetAc"); if (isAircraftId(saved)) ac = saved; }
    const def = aircraft(ac);
    if (!hasSys(def, sys)) sys = read("sys:" + ac) ?? (ac === "sr20" ? read("sr20sys") : null);
    const start: SysId = hasSys(def, sys) ? sys : "overview";
    if (ac !== st.ac) selectAircraft(ac, start);
    else if (start !== "overview") selectSys(start);
  }, []);
}

/** Tab title follows the airplane. */
function useTitle() {
  const def = useAircraft();
  useEffect(() => { document.title = `${def.name} Systems`; }, [def]);
}

export default function App() {
  useBoot();
  useTitle();
  const ac = useView((x) => x.ac);
  return (
    <div className="app">
      <Rail />
      <main className="stage">
        <Scene />
        <div className="hint">Hover parts · drag to orbit</div>
        <Toolbar />
        <Alerts key={ac} />
        <Hud />
        <Tooltip />
      </main>
      <Panel />
    </div>
  );
}
