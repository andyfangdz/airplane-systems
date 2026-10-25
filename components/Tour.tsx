"use client";
/**
 * First-visit choices, followed by an optional welcome tour: a few cards that spotlight the parts of the page in turn. The page stays usable underneath (only the card
 * takes pointer input), so visitors can try each thing as it is pointed out. Shown once on a first visit; skipping or
 * finishing it is remembered, and the toolbar's ? button replays it.
 */
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { create } from "zustand";
import { autoUpdate, computePosition, flip, offset, shift, type Placement } from "@floating-ui/react";
import { narrowLayout, useView } from "@/lib/view";
import { aircraft } from "@/lib/fleet";
import { showStudyExample } from "./ui/controls";

const DONE_KEY = "tourDone";

type Place = "right" | "left" | "bottom" | "top" | "inside";
interface Step {
  title: string;
  body: ReactNode;
  /** element to spotlight; none centres the card */ sel?: string;
  place?: Place;
}

const STEPS: Step[] = [
  {
    title: "Start with the aircraft",
    body: (
      <>
        Explore a system, see what changes when a component fails, or follow a guided preflight. Choose where to begin;
        the interface tour is here whenever you need it.
      </>
    ),
  },
  {
    sel: ".fleet",
    place: "right",
    title: "Pick an airplane",
    body: (
      <>
        Switch between the SR20, SR22T, 172S, 182T, DA40 and M20C. Each airplane keeps its own switch positions while
        you look at another. Try one now.
      </>
    ),
  },
  {
    sel: ".syslist",
    place: "right",
    title: "Pick a system",
    body: <>Choose a system and the camera flies to it. The number beside each one is its page in the POH/AFM.</>,
  },
  {
    sel: ".stage",
    place: "inside",
    title: "Explore the model",
    body: (
      <>
        Drag to orbit, scroll or pinch to zoom, right-drag or two-finger drag to pan. Hover or tap a part to read its
        note.
      </>
    ),
  },
  {
    sel: ".toolbar",
    place: "bottom",
    title: "Change the view",
    body: (
      <>
        Preflight starts a guided walk-around. See through the skin with X-ray, show or hide labels, auto-rotate, or
        reset the camera.
      </>
    ),
  },
  {
    sel: ".panel",
    place: "left",
    title: "Operate the systems",
    body: (
      <>
        Each system&apos;s notes and controls live here: switches, levers, breakers and failures. The systems are
        linked, so a change in one shows up in the others.
      </>
    ),
  },
  {
    sel: ".cas",
    place: "top",
    title: "Watch the alerts",
    body: (
      <>
        This window shows the airplane&apos;s crew alerts or annunciators. Try failing an alternator under Electrical
        and watch it respond.
      </>
    ),
  },
  {
    title: "You're all set",
    body: (
      <>
        Replay this tour any time from the ? button beside the light and dark switch. This is an unofficial study aid:
        always use the POH/AFM and supplements for your serial number.
      </>
    ),
  },
];

const useTour = create<{ step: number | null }>(() => ({ step: null }));
export const startTour = () => useTour.setState({ step: 1 });
/** Close the tour (skipped or finished) and remember it, so it isn't shown again on the next visit. */
function endTour() {
  useTour.setState({ step: null });
  try {
    localStorage.setItem(DONE_KEY, "1");
  } catch {}
}
/** Go to step `i`: past the last step finishes the tour, before the first does nothing. */
function go(i: number) {
  if (i >= STEPS.length) endTour();
  else if (i >= 0) useTour.setState({ step: i });
}

const M = 12,
  GAP = 12,
  PAD = 6;
export function Tour() {
  const step = useTour((x) => x.step);
  // switching airplanes remounts the page under the tour (it lives in the airplanes' layout): find the targets again
  const aircraftId = useView((x) => x.ac);
  const spot = useRef<HTMLDivElement>(null),
    card = useRef<HTMLDivElement>(null),
    next = useRef<HTMLButtonElement>(null);

  // first visit: show the tour unless it was skipped or finished before
  useEffect(() => {
    let done: string | null = null;
    try {
      done = localStorage.getItem(DONE_KEY);
    } catch {}
    if (done !== "1") useTour.setState({ step: 0 });
  }, []);

  const s = step === null ? null : STEPS[step];

  // Follow layout changes and reconnect targets (such as keyed alerts) when the airplane changes.
  useLayoutEffect(() => {
    const cd = card.current,
      sp = spot.current;
    if (!s || !cd || !sp) return;
    const el = s.sel ? document.querySelector(s.sel) : null;
    let active = true;
    const reference = {
      contextElement: el ?? document.documentElement,
      getBoundingClientRect: () => {
        const t = el?.getBoundingClientRect();
        if (!t) return new DOMRect(innerWidth / 2, innerHeight / 2, 0, 0);
        // Keep the model's card inside the visible portion of its scene.
        return s.place === "inside"
          ? new DOMRect(t.x, t.y, t.width, Math.max(0, Math.min(t.bottom, innerHeight) - t.y))
          : t;
      },
    };
    const update = () => {
      const t = el?.getBoundingClientRect();
      sp.hidden = !t;
      if (t) {
        const left = Math.max(t.left - PAD, 2),
          top = Math.max(t.top - PAD, 2);
        Object.assign(sp.style, {
          left: `${left}px`,
          top: `${top}px`,
          width: `${Math.max(Math.min(t.right + PAD, innerWidth - 2) - left, 0)}px`,
          height: `${Math.max(Math.min(t.bottom + PAD, innerHeight - 2) - top, 0)}px`,
        });
      }
      const inside = s.place === "inside";
      const side = narrowLayout() ? "bottom" : (s.place ?? "right");
      const placement: Placement =
        !t || inside ? "bottom" : side === "left" || side === "right" ? `${side}-start` : (side as Placement);
      void computePosition(reference, cd, {
        strategy: "fixed",
        placement,
        middleware: [
          offset(({ rects }) => (!t ? -rects.floating.height / 2 : inside ? -rects.floating.height - 2 * M : GAP)),
          ...(t && !inside
            ? [
                flip({
                  padding: M,
                  fallbackPlacements: narrowLayout() ? ["top"] : ["right-start", "left-start", "bottom", "top"],
                }),
              ]
            : []),
          shift({ padding: M, crossAxis: true }),
        ],
      }).then(({ x, y }) => {
        if (active) Object.assign(cd.style, { left: `${x}px`, top: `${y}px` });
      });
    };
    const stop = autoUpdate(reference, cd, update);
    return () => {
      active = false;
      stop();
    };
  }, [s, aircraftId]);

  // phones: the page scrolls, so bring each target into view
  useEffect(() => {
    const el = s?.sel ? document.querySelector(s.sel) : null;
    if (!el || !narrowLayout()) return;
    const tall = el.getBoundingClientRect().height > innerHeight * 0.6;
    const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: tall ? "start" : "center", behavior: smooth ? "smooth" : "auto" });
  }, [s, aircraftId]);

  // focus the card's main button; give focus back to where it was when the tour closes
  const open = step !== null;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    return () => prev?.focus?.({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    next.current?.focus();
  }, [step]);

  useEffect(() => {
    if (step === null) return;
    const onKey = (e: KeyboardEvent) => {
      // arrows step the tour only from the card (or nothing focused), so they still work in sliders and the like
      const a = document.activeElement,
        ours = !a || a === document.body || !!card.current?.contains(a);
      if (e.key === "Escape") endTour();
      else if (!ours) return;
      else if (e.key === "ArrowRight") go(step + 1);
      else if (e.key === "ArrowLeft") go(step - 1);
      else return;
      e.preventDefault();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [step]);

  if (step === null || !s) return null;
  const last = step === STEPS.length - 1;

  return (
    <div className={`tour${s.sel ? "" : " tour-dim"}`}>
      <div ref={spot} className="tour-spot" hidden />
      <div ref={card} className="tour-card" role="dialog" aria-labelledby="tour-title" aria-describedby="tour-body">
        {step > 0 && (
          <div className="tour-count">
            {step} of {STEPS.length - 1}
          </div>
        )}
        <h2 id="tour-title">{s.title}</h2>
        <p id="tour-body">{s.body}</p>
        {step === 0 ? (
          <div className="welcome-choices">
            <button ref={next} type="button" className="btn primary" onClick={endTour}>
              Explore aircraft
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                endTour();
                showStudyExample();
              }}
            >
              Find a quick experiment
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                endTour();
                aircraft(useView.getState().ac).walk?.open();
              }}
            >
              Start preflight
            </button>
          </div>
        ) : (
          <div className="tour-dots" aria-hidden="true">
            {STEPS.slice(1).map((_, i) => (
              <i key={i} className={i + 1 === step ? "on" : ""} />
            ))}
          </div>
        )}
        <div className="tour-actions">
          {!last && step > 0 && (
            <button type="button" className="tour-skip" onClick={endTour}>
              Skip tour
            </button>
          )}
          {step > 1 && (
            <button type="button" className="btn" onClick={() => go(step - 1)}>
              Back
            </button>
          )}
          <button
            ref={step > 0 ? next : undefined}
            type="button"
            className={step === 0 ? "tour-skip" : "btn primary"}
            onClick={() => go(step + 1)}
          >
            {step === 0 ? "Show me around" : last ? "Start exploring" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
