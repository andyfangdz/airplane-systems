import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Picker } from "@/components/Picker";

type SizeArgs = { availableHeight: number; elements: { floating: HTMLElement } };
type Request = { resolve: (point: { x: number; y: number }) => void; apply: (args: SizeArgs) => void };
const position = vi.hoisted(() => ({
  requests: [] as Request[],
  update: undefined as (() => void) | undefined,
  stop: vi.fn(),
}));

vi.mock("@floating-ui/react", () => ({
  autoUpdate: (_button: HTMLElement, _menu: HTMLElement, update: () => void) => {
    position.update = update;
    update();
    return position.stop;
  },
  computePosition: (
    _button: HTMLElement,
    _menu: HTMLElement,
    options: { middleware: { name: string; apply?: Request["apply"] }[] },
  ) =>
    new Promise((resolve) => {
      position.requests.push({ resolve, apply: options.middleware.find((item) => item.name === "size")!.apply! });
    }),
  offset: () => ({ name: "offset" }),
  flip: () => ({ name: "flip" }),
  shift: () => ({ name: "shift" }),
  size: ({ apply }: { apply: Request["apply"] }) => ({ name: "size", apply }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  position.requests = [];
  position.update = undefined;
  position.stop.mockClear();
});

test("folding and closing discard obsolete picker placement and size results", async () => {
  const width = vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(382);
  render(
    <div className="eng-app" style={{ padding: 47 }}>
      <Picker current={{ name: "Cylinder", sub: "Study model" }} kind="component" groups={[]} />
    </div>,
  );
  const menu = screen.getByRole("dialog");
  const trigger = screen.getByRole("button", { name: /^Choose a model/ });
  let open = false;
  const matches = menu.matches.bind(menu);
  vi.spyOn(menu, "matches").mockImplementation((selector) => (selector === ":popover-open" ? open : matches(selector)));
  Object.assign(menu, {
    showPopover: () => {
      open = true;
    },
    hidePopover: () => {
      open = false;
    },
  });
  fireEvent.click(trigger);
  expect(menu.style.maxWidth).toBe("264px");
  const old = position.requests[0];
  width.mockReturnValue(669);
  act(() => position.update!());
  expect(menu.style.maxWidth).toBe("551px");
  const current = position.requests[1];
  await act(async () => {
    current.apply({ availableHeight: 600, elements: { floating: menu } });
    current.resolve({ x: 59, y: 120 });
  });
  await act(async () => {
    old.apply({ availableHeight: 0, elements: { floating: menu } });
    old.resolve({ x: -500, y: -500 });
  });
  expect(menu.style.maxHeight).toBe("600px");
  expect(menu.style.left).toBe("59px");
  expect(menu.style.top).toBe("120px");

  act(() => position.update!());
  const pending = position.requests[2];
  fireEvent.click(trigger);
  await act(async () => {
    pending.apply({ availableHeight: 0, elements: { floating: menu } });
    pending.resolve({ x: -500, y: -500 });
  });
  expect(menu.style.maxHeight).toBe("600px");
  expect(menu.style.left).toBe("59px");
  expect(position.stop).toHaveBeenCalledOnce();
  expect(document.activeElement).toBe(trigger);
});
