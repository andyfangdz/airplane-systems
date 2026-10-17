/**
 * The engine and component pages' shared scaffold (components/engine/sim.ts, chrome.tsx): the frame loop each
 * simulation runs on, and the view-toggle store with its toolbar buttons.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { createViewStore, useSimLoop } from "@/components/engine/sim";
import { ViewToggles } from "@/components/engine/chrome";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function Loop({ advance, maxDt }: { advance: (dt: number) => void; maxDt: number }) {
  useSimLoop(advance, maxDt);
  return null;
}

test("the loop passes each frame's time, never negative and at most maxDt, and stops on unmount", () => {
  let frame: FrameRequestCallback | null = null;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => ((frame = cb), 1));
  const cancel = vi.fn();
  vi.stubGlobal("cancelAnimationFrame", cancel);
  vi.spyOn(performance, "now").mockReturnValue(1000);
  const seen: number[] = [];
  const { unmount } = render(<Loop advance={(dt) => seen.push(dt)} maxDt={0.1} />);
  // the first frame's timestamp can come before the loop started; then a normal frame, then a long stall
  for (const t of [990, 1006, 1056, 3056]) frame!(t);
  expect(seen).toEqual([0, 0.016, 0.05, 0.1]);
  unmount();
  expect(cancel).toHaveBeenCalled();
});

test("view toggles show and flip their store's settings", () => {
  const useV = createViewStore({ xray: true, labels: false });
  function Bar() {
    const v = useV();
    return (
      <ViewToggles
        items={[
          ["xray", "X-ray", "See through"],
          ["labels", "Labels", "Name parts"],
        ]}
        view={v}
        set={v.set}
      />
    );
  }
  render(<Bar />);
  const xray = screen.getByRole("button", { name: "X-ray" }),
    labels = screen.getByRole("button", { name: "Labels" });
  expect(xray.getAttribute("aria-pressed")).toBe("true");
  expect(labels.getAttribute("aria-pressed")).toBe("false");
  act(() => fireEvent.click(labels));
  expect(useV.getState()).toMatchObject({ xray: true, labels: true });
  expect(labels.getAttribute("aria-pressed")).toBe("true");
});

test("a hidden page pauses its driver and resumes without advancing the hidden duration", () => {
  let hidden = false;
  let frame: FrameRequestCallback | null = null;
  let now = 1000;
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => ((frame = cb), 1));
  const cancel = vi.fn();
  vi.stubGlobal("cancelAnimationFrame", cancel);
  const advance = vi.fn();
  const { unmount } = render(<Loop advance={advance} maxDt={1} />);
  frame!(1010);
  expect(advance).toHaveBeenLastCalledWith(0.01);
  hidden = true;
  document.dispatchEvent(new Event("visibilitychange"));
  frame!(20_000);
  expect(advance).toHaveBeenCalledTimes(1);
  now = 30_000;
  hidden = false;
  document.dispatchEvent(new Event("visibilitychange"));
  frame!(30_020);
  expect(advance).toHaveBeenLastCalledWith(0.02);
  unmount();
  expect(cancel).toHaveBeenCalled();
});
