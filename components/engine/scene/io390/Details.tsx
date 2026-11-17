import { useEffect } from "react";
import type { Mats } from "../kit";
import { P } from "../parts";
import type { Detail } from "./shapes";

/** Caller owns one memoized set of parts, which may be instanced on several moving assemblies. */
export function useDetailDisposal(parts: Detail[]) {
  useEffect(() => () => parts.forEach((p) => p.geometry.dispose()), [parts]);
}

export function Details({ parts, mats, suffix = "" }: { parts: Detail[]; mats: Mats; suffix?: string }) {
  return parts.map((p) => (
    <P
      key={p.name}
      name={p.name + suffix}
      spread={p.spread}
      note={p.note}
      material={mats[p.material]}
      geometry={p.geometry}
    />
  ));
}
