"use client";
import { useLayoutEffect, useId, useRef, useState } from "react";
import { autoUpdate, computePosition, flip, offset, shift } from "@floating-ui/react";
import Link from "next/link";

/** One choice: a button that acts on this page, or a link to another page (an engine or component from an airplane, or back). */
export interface PickerEntry {
  id: string;
  name: string;
  sub: string;
  current: boolean;
  walk?: boolean;
  onPick?: () => void;
  href?: string;
}

/**
 * The airplane picker: an explicit switch control and what is shown share one compact button, and its menu lists the
 * airplanes, then the engine simulations and the component simulations, so each is chosen the way an airplane is. A
 * `compact` group lays its entries out two to a row (name only, the type as a tooltip) to keep the menu short.
 */
export function Picker({
  current,
  kind,
  groups,
}: {
  current: { name: string; sub: string };
  kind: "airplane" | "engine" | "component";
  groups: { label: string; entries: PickerEntry[]; compact?: boolean }[];
}) {
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
          aria-label={`Switch Airplanes, current ${kind} ${current.name}`}
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
        aria-label="Choose an airplane, engine or component"
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
        {groups
          .filter((g) => g.entries.length)
          .map((g) => (
            <div
              key={g.label}
              className={g.compact ? "fleet-options fleet-compact" : "fleet-options"}
              role="group"
              aria-label={g.label}
            >
              <div className="fleet-group" aria-hidden="true">
                {g.label}
              </div>
              {g.entries.map((a) => {
                const body = (
                  <>
                    <span className="fleet-option-heading">
                      <span className="fleet-name">{a.name}</span>
                      {a.walk && (
                        <span className="fleet-walk" title="Preflight walk-around available">
                          Walk-around
                        </span>
                      )}
                      <span className="fleet-check" aria-hidden="true">
                        {a.current ? "✓" : ""}
                      </span>
                    </span>
                    <span className="fleet-equipment">{a.sub}</span>
                  </>
                );
                return a.href && !a.current ? (
                  <Link
                    key={a.id}
                    className="fleet-option"
                    href={a.href}
                    title={g.compact ? a.sub : undefined}
                    onClick={close}
                  >
                    {body}
                  </Link>
                ) : (
                  <button
                    key={a.id}
                    type="button"
                    className="fleet-option"
                    aria-pressed={a.current}
                    onClick={() => {
                      close();
                      // Re-selecting what is shown preserves its system, camera and walk-around.
                      if (!a.current) a.onPick?.();
                    }}
                  >
                    {body}
                  </button>
                );
              })}
            </div>
          ))}
      </div>
    </div>
  );
}
