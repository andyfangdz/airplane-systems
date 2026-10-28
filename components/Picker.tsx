"use client";
import { useLayoutEffect, useId, useRef, useState } from "react";
import { autoUpdate, computePosition, flip, offset, shift, size } from "@floating-ui/react";
import Link from "next/link";
import { useTouchClick } from "@/lib/useTouchClick";
import { OfflineStatus } from "./OfflineSupport";

/** One choice: a button that acts on this page, or a link to another page (an engine or component from an airplane, or back). */
export interface PickerEntry {
  id: string;
  name: string;
  sub: string;
  current: boolean;
  onPick?: () => void;
  href?: string;
}

/**
 * The airplane picker: an explicit switch control and what is shown share one compact button, and its menu lists the
 * airplanes, then the engine, component and flight data simulations, so each is chosen the way an airplane is. A
 * `compact` group lays its entries out two to a row (with their short descriptions) to keep the menu short.
 */
export function Picker({
  current,
  kind,
  groups,
}: {
  current: { name: string; sub: string };
  kind: "airplane" | "engine" | "component" | "replay";
  groups: { label: string; entries: PickerEntry[]; compact?: boolean }[];
}) {
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const touchClick = useTouchClick();
  // the menu offers airplanes, engines, components and flight data replays; the label names what this page shows
  const label = "Choose a model";

  useLayoutEffect(() => {
    const panel = menu.current,
      button = trigger.current;
    if (!open || !panel || !button) return;
    let active = true;
    let revision = 0;
    let placed = false;
    const stop = autoUpdate(button, panel, () => {
      const current = ++revision;
      const isCurrent = () => active && revision === current;
      // The popover escapes the padded app shell; keep its floating bounds inside the same safe area.
      const shell = getComputedStyle(button.closest(".app, .eng-app") ?? document.body);
      const padding = {
        top: 12 + (parseFloat(shell.paddingTop) || 0),
        right: 12 + (parseFloat(shell.paddingRight) || 0),
        bottom: 12 + (parseFloat(shell.paddingBottom) || 0),
        left: 12 + (parseFloat(shell.paddingLeft) || 0),
      };
      // The top layer is clipped by the visual viewport, not by the app shell. Measure before positioning so
      // horizontal shift can retain a full-width menu beside a narrow inner-display header column.
      const viewportWidth = window.visualViewport?.width ?? document.documentElement.clientWidth;
      panel.style.maxWidth = `${Math.max(0, viewportWidth - padding.left - padding.right)}px`;
      void computePosition(button, panel, {
        strategy: "fixed",
        placement: "bottom-start",
        middleware: [
          offset(8),
          flip({ padding, crossAxis: false }),
          // a list taller than the room below the trigger scrolls rather than sliding up over the trigger
          size({
            padding,
            apply: ({ availableHeight, elements }) => {
              if (isCurrent()) elements.floating.style.maxHeight = `${Math.max(0, Math.min(700, availableHeight))}px`;
            },
          }),
          shift({ padding, crossAxis: true }),
        ],
      }).then(({ x, y }) => {
        if (!isCurrent()) return;
        Object.assign(panel.style, { left: `${x}px`, top: `${y}px` });
        if (placed) return;
        placed = true;
        // the entry shown can sit below a scrolling menu's fold (the flight data replays end it): scroll the menu,
        // and only the menu, to it once its height is set
        const shown = panel.querySelector('[aria-pressed="true"]');
        if (!shown) return;
        const below = shown.getBoundingClientRect().bottom - panel.getBoundingClientRect().bottom;
        if (below > 0) panel.scrollTop += below + 8;
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
          {...touchClick}
          ref={trigger}
          type="button"
          className="fleet-trigger"
          popoverTarget={id}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={id}
          aria-label={`${label}, current ${kind} ${current.name}`}
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
              {label}
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
        aria-label="Choose an airplane, engine, component or flight data replay"
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
                      <span className="fleet-check" aria-hidden="true">
                        {a.current ? "✓" : ""}
                      </span>
                    </span>
                    <span className="fleet-equipment">{a.sub}</span>
                  </>
                );
                return a.href && !a.current ? (
                  <Link key={a.id} className="fleet-option" href={a.href} onNavigate={close}>
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
        <OfflineStatus />
      </div>
    </div>
  );
}
