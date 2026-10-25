"use client";
import dynamic from "next/dynamic";
import { parseCameraPreset } from "@/lib/camera";
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AircraftDef } from "@/aircraft/types";
import {
  AircraftContext,
  applyCameraPreset,
  hasSys,
  registerAircraft,
  resetCam,
  selectAircraft,
  selectSys,
  showInUrl,
  sysOf,
  useAircraft,
} from "@/lib/fleet";
import { setBuild } from "@/lib/build";
import { mountAircraftSession, type AircraftSession } from "@/lib/aircraft-session";
import { useSimulationLoop } from "@/lib/useSimulationLoop";
import { sysColor, sysVars, type SysId, type Theme } from "@/lib/systems";
import { revealPanelStart, revealStage, useAircraftHover, useNarrowLayout, useView } from "@/lib/view";
import { Loader } from "./Loader";
import { Fleet } from "./Fleet";
import { startTour } from "./Tour";
import { Icon, ModelSizeToggle, PREFLIGHT_ICON, ResetViewButton, ThemeButton } from "./ui/chrome";
import { useScenarioMarks } from "./ui/controls";
import { useCollapsed } from "@/lib/panels";

// WebGL scene is client-only; the Loader overlay shows while it loads (the placeholder keeps the canvas's slot)
const Scene = dynamic(() => import("./scene/Scene"), { ssr: false, loading: () => <div /> });

/**
 * The route's system until the shell has booted (so the prerendered HTML and its hydration show the system the path
 * names), the view state's after that.
 */
const RouteSys = createContext<{ sys: SysId; booted: boolean }>({ sys: "overview", booted: false });
function useShownSys() {
  const route = useContext(RouteSys),
    sys = useView((x) => x.selectedSys);
  return route.booted ? sys : route.sys;
}

function Rail({ collapsed, toggle }: { collapsed: boolean; toggle: () => void }) {
  const def = useAircraft();
  const sys = useShownSys(),
    theme = useView((x) => x.theme);
  // Keep the selected entry visible after navigation or a resize, without scrolling the page.
  useEffect(() => {
    if (collapsed) return;
    const b = document.querySelector<HTMLElement>('.syslist button[aria-current="true"]'),
      ul = b?.closest("ul");
    if (!b || !ul) return;
    const reveal = () => {
      const r = b.getBoundingClientRect(),
        u = ul.getBoundingClientRect();
      if (r.left < u.left) ul.scrollLeft -= u.left - r.left + 10;
      else if (r.right > u.right) ul.scrollLeft += r.right - u.right + 10;
      if (r.top < u.top) ul.scrollTop -= u.top - r.top + 8;
      else if (r.bottom > u.bottom) ul.scrollTop += r.bottom - u.bottom + 8;
    };
    reveal();
    const resize = new ResizeObserver(reveal);
    resize.observe(ul);
    return () => resize.disconnect();
  }, [sys, def, collapsed]);
  return (
    <nav className="rail" aria-label="Systems">
      <PanelToggle
        side="systems"
        collapsed={collapsed}
        toggle={() => {
          toggle();
          // The fixed toggle remains reachable while scrolling. Reopening also brings the header into view.
          if (collapsed && window.matchMedia("(max-width: 1100px)").matches)
            window.scrollTo({ top: 0, behavior: "instant" });
        }}
      />
      <div className="brand">
        <Fleet />
      </div>
      <div id="systems-panel" className="rail-content" hidden={collapsed}>
        <ul className="syslist">
          {def.systems.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                aria-current={s.id === sys}
                style={{ "--c": sysColor(s.id, theme) } as React.CSSProperties}
                onClick={() => selectSys(s.id)}
              >
                <span className="sw" />
                <span className="nm">{s.name}</span>
                <span className="pg">{s.pg}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="foot">
          Drag to orbit · scroll or pinch to zoom · right-drag to pan. Hover a part for its note.
        </div>
      </div>
      <Settings />
    </nav>
  );
}

function Panel({ collapsed, toggle }: { collapsed: boolean; toggle: () => void }) {
  const def = useAircraft();
  const sys = useShownSys(),
    theme = useView((x) => x.theme),
    walking = useView((x) => x.walking);
  const s = sysOf(def, sys),
    Body = def.panels[s.id];
  const inner = useRef<HTMLDivElement>(null);
  const narrow = useNarrowLayout();
  // phones: after picking a system from far down the panel, bring the 3D view and the panel's start back up
  useEffect(() => {
    if (walking) return;
    revealStage();
    revealPanelStart();
  }, [sys, def, walking]);
  useLayoutEffect(() => {
    if (!walking && narrow && inner.current) return clampLead(inner.current);
  }, [sys, def, walking, narrow, collapsed]);
  const Walk = walking ? def.walk?.Panel : undefined;
  return (
    <aside className="panel" aria-label="System details">
      <PanelToggle side="details" collapsed={collapsed} toggle={toggle} />
      <div id="details-panel" hidden={collapsed} tabIndex={-1}>
        {Walk ? (
          <div className="panel-inner">
            <Walk />
          </div>
        ) : (
          <div ref={inner} className="panel-inner" style={sysVars(s.id, theme)}>
            <div className="ref">
              <i />
              {s.ref ?? `${def.doc} · p. ${s.pg}`}
            </div>
            <h2>{s.id === "overview" ? "Airplane & Systems" : s.name}</h2>
            {Body ? <Body /> : <p className="lead">This system isn&apos;t modelled yet for the {def.name}.</p>}
          </div>
        )}
      </div>
    </aside>
  );
}

/**
 * Phones: the 3D view and the panel share the screen, so a long introduction is cut to a few lines with a "Read more"
 * button after it, and the system's controls come into view sooner. The introduction is each panel's own first
 * paragraph (`.lead` just under the heading); the button is added beside it here, outside React's tree, and removed on
 * cleanup. Returns the cleanup.
 */
function clampLead(inner: HTMLElement) {
  const lead = inner.querySelector<HTMLElement>(":scope > h2 + .lead");
  if (!lead) return;
  lead.dataset.clamp = "closed";
  if (lead.scrollHeight <= lead.clientHeight + 1) {
    delete lead.dataset.clamp;
    return;
  }
  const more = document.createElement("button");
  more.type = "button";
  more.className = "lead-more";
  const show = (open: boolean) => {
    lead.dataset.clamp = open ? "open" : "closed";
    more.textContent = open ? "Show less" : "Read more";
    more.setAttribute("aria-expanded", String(open));
  };
  show(false);
  more.onclick = () => show(lead.dataset.clamp !== "open");
  lead.after(more);
  return () => {
    more.remove();
    delete lead.dataset.clamp;
  };
}

function PanelToggle({
  side,
  collapsed,
  toggle,
}: {
  side: "systems" | "details";
  collapsed: boolean;
  toggle: () => void;
}) {
  const label = `${collapsed ? "Show" : "Hide"} ${side} panel`;
  return (
    <div className="panel-toggle-anchor">
      <button
        type="button"
        className="panel-toggle"
        aria-controls={`${side}-panel`}
        aria-expanded={!collapsed}
        aria-label={label}
        title={label}
        onClick={toggle}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <polyline points={(side === "systems") === collapsed ? "8 5 13 10 8 15" : "12 5 7 10 12 15"} />
        </svg>
      </button>
    </div>
  );
}

function Toolbar() {
  const def = useAircraft();
  const xray = useView((x) => x.xray),
    labels = useView((x) => x.labels),
    spin = useView((x) => x.spin),
    walking = useView((x) => x.walking);
  const set = useView((v) => v.set),
    flyTo = useView((v) => v.flyTo);
  const walk = def.walk;
  return (
    <div className="toolbar scene-toolbar">
      {walk && (
        <button
          className="tb tb-mode"
          aria-label="Preflight"
          aria-pressed={walking}
          title={walking ? "Leave the preflight walk-around" : "Guided preflight walk-around"}
          onClick={() => (walking ? walk.close() : walk.open())}
        >
          <Icon>{PREFLIGHT_ICON}</Icon>
          <span className="tb-word">Preflight</span>
        </button>
      )}
      <div className="tb-group" role="group" aria-label="View">
        <button
          className="tb"
          aria-label="X-ray"
          title="X-ray"
          aria-pressed={xray}
          onClick={() => set({ xray: !xray })}
        >
          <span className="tb-symbol">
            <Icon>
              <rect x="2" y="2" width="9" height="9" rx="1.5" />
              <rect x="5" y="5" width="9" height="9" rx="1.5" strokeDasharray="2 2" />
            </Icon>
          </span>
          <span className="tb-word">X-ray</span>
        </button>
        <button
          className="tb"
          aria-label="Labels"
          title="Labels"
          aria-pressed={labels}
          onClick={() => set({ labels: !labels })}
        >
          <span className="tb-symbol">
            <Icon>
              <path d="M2 2h6l6 6-6 6-6-6z" />
              <circle cx="5.5" cy="5.5" r="1" />
            </Icon>
          </span>
          <span className="tb-word">Labels</span>
        </button>
        <button
          className="tb"
          aria-label="Auto-rotate"
          title="Auto-rotate"
          aria-pressed={spin}
          onClick={() => set({ spin: !spin })}
        >
          <span className="tb-symbol">
            <Icon>
              <path d="M13 6a5.2 5.2 0 0 0-9-2L2 6m0-4v4h4M3 10a5.2 5.2 0 0 0 9 2l2-2m0 4v-4h-4" />
            </Icon>
          </span>
          <span className="tb-word">Auto-rotate</span>
        </button>
      </div>
      <ResetViewButton
        onClick={() => {
          const [p, t] = resetCam();
          flyTo([...p], [...t]);
        }}
      />
    </div>
  );
}

/** The page's settings, out of the 3D view: the theme and the welcome tour (the rail's foot; a phone's top corner). */
function Settings() {
  return (
    <div className="rail-settings">
      <ThemeButton />
      <button
        className="tb tb-help"
        title="Show the welcome tour"
        aria-label="Show the welcome tour"
        onClick={startTour}
      >
        ?
      </button>
    </div>
  );
}

function Hud() {
  const H = useAircraft().Hud;
  return H ? <H /> : null;
}

/** A part's colour for the tooltip title, or the ink colour when it is too pale (light theme) or too dark (dark theme) to read. */
function tipColor(c: string, theme: Theme) {
  const m = /^#([0-9a-f]{6})$/i.exec(c);
  if (!m) return c;
  const n = parseInt(m[1], 16),
    lum = (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return (theme === "light" ? lum > 0.75 : lum < 0.25) ? "var(--ink)" : c;
}

function Tooltip() {
  const hover = useAircraftHover((x) => x.hover),
    theme = useView((x) => x.theme);
  const ref = useRef<HTMLDivElement>(null);
  // below-right of the cursor; flipped above it when the note would run past the bottom of the 3D view
  useLayoutEffect(() => {
    const el = ref.current,
      h = el?.parentElement?.clientHeight;
    if (!el || !hover || !h) return;
    const ht = el.offsetHeight,
      below = hover.y + 14;
    el.style.top = `${below + ht <= h ? below : Math.max(0, Math.min(hover.y - 14 - ht, h - ht))}px`;
  }, [hover]);
  if (!hover) return null;
  const stage = document.querySelector(".stage") as HTMLElement | null;
  const w = stage?.clientWidth ?? 800;
  return (
    <div ref={ref} className="tip" style={{ left: Math.min(hover.x + 14, w - 270) }}>
      <h4 style={{ color: tipColor(hover.color, theme) }}>{hover.name}</h4>
      {hover.note && <p>{hover.note}</p>}
    </div>
  );
}

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

/** The system named by the address bar's path (/c172s/electrical), when it is this airplane's. */
function sysInPath(def: AircraftDef): string | undefined {
  let path = location.pathname;
  try {
    path = decodeURIComponent(path);
  } catch {} // malformed escape: use the raw text
  const [ac, sys] = path.replace(/^\/+/, "").split("/");
  return ac === def.id ? sys : undefined;
}

/** Show the airplane at `sys`, or else at its last-viewed system, or else its overview; remember it for the next visit. */
function show(def: AircraftDef, sys?: string | null) {
  // "sr20sys": the SR20's last-viewed system, saved before there was a fleet
  if (!hasSys(def, sys)) sys = read("sys:" + def.id) ?? (def.id === "sr20" ? read("sr20sys") : null);
  const start: SysId = hasSys(def, sys) ? sys : "overview",
    v = useView.getState();
  if (def.id !== v.ac) selectAircraft(def.id, start);
  else if (start !== v.selectedSys) selectSys(start);
  else showInUrl(def.id, start); // already in the view state (e.g. the default airplane's overview on a fresh load): still put the view in the address bar
  try {
    localStorage.setItem("fleetAc", def.id);
  } catch {}
}

/** Theme: the saved choice, else the system setting (followed until the user chooses). */
function useTheme() {
  useEffect(() => {
    // the toolbar's theme toggle saves a choice; until then follow the system setting, without saving it
    const os = matchMedia("(prefers-color-scheme: dark)");
    const t = read("sr20theme"),
      chosen = () => {
        const x = read("sr20theme");
        return x === "light" || x === "dark";
      };
    useView.getState().setTheme(t === "light" || t === "dark" ? t : os.matches ? "dark" : "light", false);
    const onOs = () => {
      if (!chosen()) useView.getState().setTheme(os.matches ? "dark" : "light", false);
    };
    os.addEventListener("change", onOs);
    return () => os.removeEventListener("change", onOs);
  }, []);
}

/**
 * Put this route's airplane in the view state before its 3D scene mounts: its `prepare` first (slow work such as the
 * SR22T's fuselage worker starts at once), then the system the path names (or the last-viewed one), a `?cam=` preset and
 * the walk-around's `?walk=` deep link or saved progress. A layout effect: it runs after Next has put a navigation's URL
 * in the address bar (an insertion effect), so the path and query read here are this route's, and before the first paint.
 */
function useBoot(def: AircraftDef) {
  const [session, setSession] = useState<AircraftSession | null>(null);
  // Strict Mode may rehearse setup after cleanup; consuming ?walk must not lose the original boot intent.
  const bootSearch = useRef<{ aircraft: AircraftDef["id"]; search: string } | null>(null);
  useLayoutEffect(() => {
    const session = mountAircraftSession(def);
    try {
      def.prepare?.();
      setBuild("code");
      show(def, sysInPath(def));
      const search = bootSearch.current?.aircraft === def.id ? bootSearch.current.search : location.search,
        preset = parseCameraPreset(new URLSearchParams(search).get("cam"));
      bootSearch.current = { aircraft: def.id, search };
      if (preset) applyCameraPreset(preset);
      def.walk?.boot(search);
      setSession(session);
    } catch (error) {
      session.dispose();
      throw error;
    }
    return session.dispose;
  }, [def]);
  return session;
}

/**
 * The shell for one airplane. Each airplane's route (app/(fleet)/<id>/[[...sys]]/page.tsx) renders it with that
 * airplane's definition, so a page ships one airplane and switching airplanes is a navigation that remounts the shell and
 * its 3D scene. `sys` is the system the route's path names, for the prerendered HTML.
 */
export default function App({ def, sys }: { def: AircraftDef; sys?: SysId }) {
  registerAircraft(def); // for the view-state helpers in lib/fleet (idempotent)
  useTheme();
  const session = useBoot(def);
  useScenarioMarks();
  // Next may retain this client shell when its catch-all system parameter changes. Apply that navigation without
  // replacing the aircraft session; the URL guard ignores an older server prop after the rail's replaceState.
  useLayoutEffect(() => {
    const view = useView.getState();
    if (session && view.session === session.owner && sys && sysInPath(def) === sys && view.selectedSys !== sys)
      selectSys(sys);
  }, [def, session, sys]);
  useSimulationLoop(session?.advance ?? def.advance, 1, !!session);
  const walking = useView((x) => x.walking);
  const [systemsCollapsed, toggleSystems] = useCollapsed("systems");
  const [detailsCollapsed, toggleDetails] = useCollapsed("details");
  const narrow = useNarrowLayout();
  const [reading, setReading] = useState(false);
  const [focusDetails, setFocusDetails] = useState(false);
  useEffect(() => {
    if (!focusDetails || detailsCollapsed) return;
    const details = document.getElementById("details-panel");
    details?.focus({ preventScroll: true });
    if (narrow) details?.scrollIntoView({ block: "start" });
    setFocusDetails(false);
  }, [focusDetails, detailsCollapsed, narrow]);
  const Alerts = def.Alerts;
  // phones: the alert window is a strip under the 3D view, clear of the model. One copy only: it is a live region.
  return (
    <AircraftContext value={def}>
      <RouteSys value={{ sys: sys ?? "overview", booted: !!session }}>
        <div
          className={`app${walking ? " walking" : ""}${systemsCollapsed ? " systems-collapsed" : ""}${detailsCollapsed ? " details-collapsed" : ""}${reading ? " reading-space" : ""}`}
        >
          <a
            className="skip-controls"
            href="#details-panel"
            onClick={(event) => {
              event.preventDefault();
              if (detailsCollapsed) toggleDetails();
              setFocusDetails(true);
            }}
          >
            Skip to system controls
          </a>
          <Rail collapsed={systemsCollapsed} toggle={toggleSystems} />
          <main className="stage" id="model-view">
            {/* the canvas mounts once the view state shows this airplane: its first camera comes from it */}
            {session ? <Scene owner={session.owner} /> : <div />}
            <Loader />
            <Toolbar />
            <div className="stage-foot">
              {!narrow && <Alerts />}
              <Hud />
              <div id="walk-scene" className="walk-scene" />
            </div>
            <Tooltip />
            {narrow && !walking && !detailsCollapsed && (
              <ModelSizeToggle collapsed={reading} controls="model-view" onClick={() => setReading(!reading)} />
            )}
          </main>
          {/* phones: the alert window and the HUD show here, under the 3D view, instead (see globals.css) */}
          <div className="stage-under">
            {narrow && <Alerts />}
            <Hud />
          </div>
          <Panel collapsed={detailsCollapsed} toggle={toggleDetails} />
        </div>
      </RouteSys>
    </AircraftContext>
  );
}
