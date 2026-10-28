import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { OfflineStatus, OfflineSupport } from "@/components/OfflineSupport";

const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  if (originalServiceWorker) Object.defineProperty(navigator, "serviceWorker", originalServiceWorker);
  else Reflect.deleteProperty(navigator, "serviceWorker");
});

class StatusChannel {
  port1 = { onmessage: null as null | ((event: { data: unknown }) => void), close: vi.fn() };
  port2 = {
    postMessage: (data: unknown) => queueMicrotask(() => this.port1.onmessage?.({ data })),
  };
}

class Worker extends EventTarget {
  scriptURL = new URL("/sw.js", location.href).href;
  state = "installing";
  status = {
    type: "OFFLINE_STATUS",
    version: "current",
    state: "downloading",
    completed: 0,
    total: 10,
    bytes: 0,
    totalBytes: 100,
  };
  postMessage = vi.fn((message: { type: string }, ports?: StatusChannel["port2"][]) => {
    if (message.type === "GET_OFFLINE_STATUS") ports?.[0].postMessage({ ...this.status });
  });
}

test("Retry recovers failed installs, newer updates and evicted active packs without replacing the active worker", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("MessageChannel", StatusChannel);
  const first = new Worker();
  const registration = Object.assign(new EventTarget(), {
    active: null as Worker | null,
    installing: first as Worker | null,
    waiting: null as Worker | null,
    update: vi.fn<() => Promise<unknown>>(),
  });
  const serviceWorker = Object.assign(new EventTarget(), {
    getRegistration: vi.fn<() => Promise<typeof registration | undefined>>().mockResolvedValue(undefined),
    register: vi.fn().mockRejectedValueOnce(new Error("Initial download failed")).mockResolvedValue(registration),
  });
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: serviceWorker });
  render(
    <>
      <OfflineSupport />
      <OfflineStatus />
    </>,
  );

  // A failed first install has no active registration to update: Retry must attempt registration again.
  await screen.findByText("Offline download interrupted");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByText("Saving all models for offline use");
  expect(serviceWorker.register).toHaveBeenCalledTimes(2);
  expect(registration.update).not.toHaveBeenCalled();
  await act(async () => {
    first.status.state = "ready";
    first.state = "activated";
    registration.active = first;
    registration.installing = null;
    first.dispatchEvent(new Event("statechange"));
  });
  await screen.findByText("Available offline");
  serviceWorker.getRegistration.mockResolvedValue(registration);

  // A newer download fails. The existing ready worker stays active, and register() returns it unchanged.
  const failed = new Worker();
  await act(async () => {
    registration.installing = failed;
    registration.dispatchEvent(new Event("updatefound"));
  });
  await screen.findByText("Saving the latest version for offline use…");
  await act(async () => {
    failed.status.state = "error";
    failed.state = "redundant";
    registration.installing = null;
    failed.dispatchEvent(new Event("statechange"));
    // The worker's final broadcast arrives after it is no longer registration.installing.
    const message = new Event("message");
    Object.defineProperties(message, { source: { value: failed }, data: { value: { ...failed.status } } });
    serviceWorker.dispatchEvent(message);
  });
  await screen.findByText("The saved version is still available. Retry the update online.");
  expect(screen.getByText("Available offline")).toBeTruthy();
  registration.update.mockImplementationOnce(async () => {
    const interrupted = new Worker();
    registration.installing = interrupted;
    registration.dispatchEvent(new Event("updatefound"));
    await Promise.resolve(); // deliver the downloading status before this update attempt fails
    registration.installing = null;
    interrupted.state = "redundant";
    interrupted.dispatchEvent(new Event("statechange"));
    throw new Error("Update check is offline");
  });
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(registration.update).toHaveBeenCalledTimes(1));
  await screen.findByText("The saved version is still available. Retry the update online.");
  expect(screen.getByText("Available offline")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  expect(first.postMessage.mock.calls.some(([message]) => message.type === "DOWNLOAD_OFFLINE")).toBe(false);

  // Retrying after connectivity returns starts a new update. Its complete pack takes over without a restart.
  const replacement = new Worker();
  registration.update.mockImplementationOnce(async () => {
    registration.installing = replacement;
    registration.dispatchEvent(new Event("updatefound"));
    return registration;
  });
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByText("Saving the latest version for offline use…");
  expect(registration.update).toHaveBeenCalledTimes(2);
  expect(registration.active).toBe(first);
  expect(screen.getByText("Available offline")).toBeTruthy();
  await act(async () => {
    replacement.status.state = "ready";
    replacement.state = "installed";
    registration.installing = null;
    registration.waiting = replacement;
    replacement.dispatchEvent(new Event("statechange"));
  });
  await waitFor(() => expect(screen.queryByText("Saving the latest version for offline use…")).toBeNull());
  expect(screen.queryByText(/close all/i)).toBeNull();
  expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();

  // Retiring the old active worker after a successful activation is not an update failure.
  await act(async () => {
    registration.active = replacement;
    registration.waiting = null;
    replacement.state = "activated";
    replacement.dispatchEvent(new Event("statechange"));
    first.state = "redundant";
    first.dispatchEvent(new Event("statechange"));
  });
  expect(screen.getByText("Available offline")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();

  // Cache eviction is repaired on the active worker, without another update check or forced activation.
  await act(async () => {
    replacement.status.state = "error";
    const message = new Event("message");
    Object.defineProperties(message, { source: { value: replacement }, data: { value: { ...replacement.status } } });
    serviceWorker.dispatchEvent(message);
  });
  await screen.findByText("Offline download interrupted");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(replacement.postMessage).toHaveBeenCalledWith({ type: "DOWNLOAD_OFFLINE" }));
  expect(registration.update).toHaveBeenCalledTimes(2);
  expect(registration.active).toBe(replacement);
});
