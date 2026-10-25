"use client";
import { useEffect } from "react";
import { create } from "zustand";
import "./offline.css";

type Download = {
  type: "OFFLINE_STATUS";
  version: string;
  state: "downloading" | "ready" | "error";
  completed: number;
  total: number;
  bytes: number;
  totalBytes: number;
  code?: string;
};
type OfflineState = {
  enabled: boolean;
  state: "checking" | "downloading" | "ready" | "error" | "unsupported";
  bytes: number;
  totalBytes: number;
  code?: string;
  update: Download["state"] | null;
  online: boolean;
  retry: () => void;
};
const useOffline = create<OfflineState>(() => ({
  enabled: false,
  state: "checking",
  bytes: 0,
  totalBytes: 0,
  update: null,
  online: true,
  retry: () => {},
}));

function isStatus(value: unknown): value is Download {
  if (!value || typeof value !== "object") return false;
  const status = value as Partial<Download>;
  return (
    status.type === "OFFLINE_STATUS" &&
    typeof status.version === "string" &&
    ["downloading", "ready", "error"].includes(status.state ?? "") &&
    [status.completed, status.total, status.bytes, status.totalBytes].every(
      (n) => typeof n === "number" && Number.isFinite(n) && n >= 0,
    )
  );
}

/** Prepare a complete, versioned study pack without interrupting the current simulation or an older active worker. */
export function OfflineSupport() {
  useEffect(() => {
    // Development chunks change on every edit; only production builds contain the verified offline inventory.
    if (process.env.NODE_ENV !== "production") return;
    useOffline.setState({ enabled: true, online: navigator.onLine });
    if (!window.isSecureContext || !("serviceWorker" in navigator)) {
      useOffline.setState({ state: "unsupported" });
      return;
    }
    let disposed = false;
    let starting = false;
    let registration: ServiceWorkerRegistration | undefined;
    const cleanup: (() => void)[] = [];
    const watched = new Set<ServiceWorker>();
    const workerUrl = new URL("/sw.js", location.href).href;

    const receive = (worker: ServiceWorker, value: unknown) => {
      if (disposed || !registration || !isStatus(value)) return;
      if (worker === registration.active) {
        useOffline.setState({
          state: value.state,
          bytes: value.bytes,
          totalBytes: value.totalBytes,
          code: value.code,
        });
      } else if (worker === registration.installing || worker === registration.waiting) {
        if (registration.active) useOffline.setState({ update: value.state });
        else
          useOffline.setState({
            state: value.state === "ready" ? "downloading" : value.state,
            bytes: value.bytes,
            totalBytes: value.totalBytes,
            code: value.code,
          });
      }
    };
    const query = (worker: ServiceWorker) => {
      const channel = new MessageChannel();
      const close = () => {
        clearTimeout(timeout);
        channel.port1.close();
      };
      const timeout = setTimeout(close, 10_000);
      channel.port1.onmessage = (event) => {
        receive(worker, event.data);
        close();
      };
      cleanup.push(close);
      worker.postMessage({ type: "GET_OFFLINE_STATUS" }, [channel.port2]);
    };
    const watch = (worker: ServiceWorker | null) => {
      if (!worker || watched.has(worker) || worker.scriptURL !== workerUrl) return;
      watched.add(worker);
      let installed = ["installed", "activating", "activated"].includes(worker.state);
      const changed = () => {
        if (disposed) return;
        if (worker.state === "activated" || worker.state === "installed") {
          installed = true;
          query(worker);
        }
        if (worker.state === "redundant") {
          if (!registration?.active) useOffline.setState({ state: "error" });
          // Failed installation can clear registration.installing before its final error message arrives.
          // Installed workers also become redundant when replaced; only an unfinished installer failed here.
          else if (!installed) useOffline.setState({ update: "error" });
        }
      };
      worker.addEventListener("statechange", changed);
      cleanup.push(() => worker.removeEventListener("statechange", changed));
      query(worker);
    };
    const observe = (reg: ServiceWorkerRegistration) => {
      if (registration !== reg) {
        registration = reg;
        const found = () => watch(reg.installing);
        reg.addEventListener("updatefound", found);
        cleanup.push(() => reg.removeEventListener("updatefound", found));
      }
      watch(reg.active);
      watch(reg.waiting);
      watch(reg.installing);
    };
    const prepare = async (retry = false) => {
      if (disposed || starting) return;
      starting = true;
      const retryUpdate = retry && useOffline.getState().update === "error";
      try {
        const existing = await navigator.serviceWorker.getRegistration("/");
        if (disposed) return;
        if (existing?.active?.scriptURL === workerUrl) {
          observe(existing);
          query(existing.active);
          if (useOffline.getState().state === "error") existing.active.postMessage({ type: "DOWNLOAD_OFFLINE" });
        }
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
        if (!disposed) {
          observe(reg);
          // Re-registering the same worker can return without checking its script again. A failed newer pack
          // needs an explicit update check; keep the active pack and its study sessions running throughout.
          if (retryUpdate && reg.active) await reg.update();
        }
      } catch {
        // An existing offline pack remains usable when an online update cannot be checked.
        if (!disposed && !registration?.active) useOffline.setState({ state: "error" });
        else if (!disposed && retryUpdate) useOffline.setState({ update: "error" });
      } finally {
        starting = false;
      }
    };
    const message = (event: MessageEvent) => {
      if (event.source && watched.has(event.source as ServiceWorker))
        receive(event.source as ServiceWorker, event.data);
    };
    const connectivity = () => {
      useOffline.setState({ online: navigator.onLine });
      if (navigator.onLine && useOffline.getState().state === "error") void prepare();
    };
    navigator.serviceWorker.addEventListener("message", message);
    window.addEventListener("online", connectivity);
    window.addEventListener("offline", connectivity);
    useOffline.setState({ retry: () => void prepare(true) });
    void prepare();
    return () => {
      disposed = true;
      for (const stop of cleanup) stop();
      navigator.serviceWorker.removeEventListener("message", message);
      window.removeEventListener("online", connectivity);
      window.removeEventListener("offline", connectivity);
    };
  }, []);
  return null;
}

/** Kept inside the model picker so install/offline information never takes space from a study scene. */
export function OfflineStatus() {
  const offline = useOffline();
  if (!offline.enabled) return null;
  const ready = offline.state === "ready";
  const failed = offline.state === "error" || offline.update === "error";
  const size = offline.totalBytes ? `${Math.ceil(offline.totalBytes / 1024 / 1024)} MB` : "";
  const percent = offline.totalBytes ? Math.min(100, Math.floor((offline.bytes / offline.totalBytes) * 100)) : 0;
  const label = ready
    ? offline.online
      ? "Available offline"
      : "Working offline"
    : offline.state === "unsupported"
      ? "Offline access is unavailable in this browser"
      : failed
        ? /quota/i.test(offline.code ?? "")
          ? "Not enough device storage for offline access"
          : "Offline download interrupted"
        : "Saving all models for offline use";
  return (
    <div className="offline-status">
      <div className="offline-status-row">
        <span role="status">{label}</span>
        {failed ? (
          <button type="button" className="tb" onClick={offline.retry}>
            Retry
          </button>
        ) : (
          <small>{size}</small>
        )}
      </div>
      {!ready && !failed && offline.state !== "unsupported" && (
        <progress aria-label="Offline download progress" max={100} value={percent} />
      )}
      {offline.update === "ready" && <small>Update ready. Close all Airplane Systems windows to apply.</small>}
      {ready && offline.update === "downloading" && <small>Downloading an update…</small>}
      {ready && offline.update === "error" && (
        <small>The saved version is still available. Retry the update online.</small>
      )}
      {!ready && offline.state !== "unsupported" && (
        <small>Keep the app open and online until the download finishes.</small>
      )}
    </div>
  );
}
