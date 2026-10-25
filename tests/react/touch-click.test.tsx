import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useTouchClick } from "@/lib/useTouchClick";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Button({ activate, disabled = false }: { activate: () => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} {...useTouchClick()} onClick={activate}>
      Choose a model
    </button>
  );
}

const point = (identifier = 1, clientX = 40, clientY = 40) => ({ identifier, clientX, clientY });
type Point = ReturnType<typeof point>;

function touch(
  button: HTMLButtonElement,
  type: string,
  time: number,
  touches: Point[],
  changedTouches = touches,
  { cancelable = true, prevented = false } = {},
) {
  const event = new TouchEvent(type, {
    bubbles: true,
    cancelable,
    touches: touches as Touch[],
    changedTouches: changedTouches as Touch[],
  });
  Object.defineProperty(event, "timeStamp", { value: time });
  if (prevented) event.preventDefault();
  fireEvent(button, event);
  return event;
}

function setup() {
  const activate = vi.fn();
  render(<Button activate={activate} />);
  const button = screen.getByRole("button") as HTMLButtonElement;
  vi.spyOn(button, "getBoundingClientRect").mockReturnValue(new DOMRect(10, 20, 120, 44));
  return { button, activate };
}

test("a completed touch activates once without a browser compatibility click", () => {
  const { button, activate } = setup();
  touch(button, "touchstart", 1000, [point()]);
  const end = touch(button, "touchend", 1100, [], [point()]);
  expect(end.defaultPrevented).toBe(true);
  expect(activate).toHaveBeenCalledTimes(1);
  touch(button, "touchend", 1150, [], [point()]);
  expect(activate).toHaveBeenCalledTimes(1);
  touch(button, "touchstart", 2000, [point()]);
  touch(button, "touchend", 2100, [], [point()]);
  expect(activate).toHaveBeenCalledTimes(2);
});

test.each([
  "moved",
  "cancelled",
  "multiple fingers",
  "long press",
  "outside",
  "noncancelable",
  "prevented",
  "disabled",
] as const)("a %s gesture is not activated manually", (kind) => {
  const { button, activate } = setup();
  const start = kind === "outside" ? point(1, 125, 40) : point();
  touch(button, "touchstart", 1000, [start]);
  if (kind === "moved") touch(button, "touchmove", 1040, [point(1, 51, 40)]);
  if (kind === "cancelled") touch(button, "touchcancel", 1040, [], [start]);
  if (kind === "multiple fingers") touch(button, "touchstart", 1040, [start, point(2)]);
  if (kind === "disabled") button.disabled = true;
  const end = touch(
    button,
    "touchend",
    kind === "long press" ? 1500 : 1100,
    [],
    [kind === "outside" ? point(1, 132, 40) : start],
    { cancelable: kind !== "noncancelable", prevented: kind === "prevented" },
  );
  expect(activate).not.toHaveBeenCalled();
  expect(end.defaultPrevented).toBe(kind === "prevented");
});

test("ordinary mouse and keyboard activation continue through onClick", () => {
  const { button, activate } = setup();
  fireEvent.click(button, { detail: 1 });
  // jsdom does not synthesize the click from a key, so deliver the detail=0 click a browser generates.
  fireEvent.click(button, { detail: 0 });
  expect(activate).toHaveBeenCalledTimes(2);
});
