"use client";
import { useLayoutEffect, useId, useRef, useState } from "react";
import { autoUpdate, computePosition, flip, offset, shift } from "@floating-ui/react";
import { FLEET, selectAircraft, useAircraft } from "@/aircraft";

/** An explicit switch control and current airplane share a compact picker. */
export function Fleet() {
  const current = useAircraft();
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const panel = menu.current,
      button = trigger.current;
    if (!open || !panel || !button) return;
    let active = true;
    const stop = autoUpdate(button, panel, () => {
      void computePosition(button, panel, {
        strategy: "fixed",
        placement: "bottom-start",
        middleware: [offset(8), flip({ padding: 12, crossAxis: false }), shift({ padding: 12, crossAxis: true })],
      }).then(({ x, y }) => {
        if (active) Object.assign(panel.style, { left: `${x}px`, top: `${y}px` });
      });
    });
    return () => {
      active = false;
      stop();
    };
  }, [open]);

  function close() {
    menu.current?.hidePopover();
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }

  return (
    <div className="fleet">
      <h1>
        <button
          ref={trigger}
          type="button"
          className="fleet-trigger"
          popoverTarget={id}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={id}
          aria-label={`Switch Airplanes, current airplane ${current.name}`}
          onClick={(event) => {
            event.preventDefault();
            if (menu.current?.matches(":popover-open")) return close();
            menu.current?.showPopover();
            setOpen(true);
            menu.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
          }}
        >
          <span className="fleet-trigger-copy">
            <span className="fleet-trigger-label">
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M3 6h14m-4-4 4 4-4 4M17 14H3m4-4-4 4 4 4" />
              </svg>
              Switch Airplanes
            </span>
            <span className="fleet-current-name">{current.name}</span>
          </span>
        </button>
      </h1>
      <p>{current.sub}</p>
      <div
        ref={menu}
        id={id}
        className="fleet-menu"
        popover="auto"
        role="dialog"
        aria-label="Choose an airplane"
        onToggle={(event) => setOpen(event.newState === "open")}
        onBlur={(event) => {
          // Safari can blur a tapped option without focusing its replacement. Hiding now would swallow the click.
          // Only close for a known focus destination outside; native popover light-dismiss handles outside taps.
          if (
            event.relatedTarget &&
            !event.currentTarget.contains(event.relatedTarget) &&
            event.relatedTarget !== trigger.current
          )
            menu.current?.hidePopover();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            close();
            return;
          }
          if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
          const options = [...event.currentTarget.querySelectorAll<HTMLButtonElement>(".fleet-option")];
          const index = options.indexOf(document.activeElement as HTMLButtonElement);
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? options.length - 1
                : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
          event.preventDefault();
          options[next]?.focus();
        }}
      >
        <div className="fleet-options" role="group" aria-label="Airplanes">
          {FLEET.map((a) => (
            <button
              key={a.id}
              type="button"
              className="fleet-option"
              aria-pressed={a.id === current.id}
              onClick={() => {
                close();
                // Re-selecting the current airplane preserves its system, camera and walk-around.
                if (a.id !== current.id) selectAircraft(a.id);
              }}
            >
              <span className="fleet-option-heading">
                <span className="fleet-name">{a.name}</span>
                {a.walk && (
                  <span className="fleet-walk" title="Preflight walk-around available">
                    Walk-around
                  </span>
                )}
                <span className="fleet-check" aria-hidden="true">
                  {a.id === current.id ? "✓" : ""}
                </span>
              </span>
              <span className="fleet-equipment">{a.sub}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
