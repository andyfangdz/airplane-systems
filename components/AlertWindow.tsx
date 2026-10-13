"use client";
import type { CasLevel } from "@/aircraft/types";

/** Aircraft-specific components own their subscriptions; this window only renders immutable alert data. */
export function AlertWindow({ title, powered, msgs }: { title: string; powered: boolean; msgs: [CasLevel, string][] }) {
  return (
    <div className="cas" aria-live="polite">
      <div className="hd">
        <span>{title}</span>
        <span>{powered ? `${msgs.length} ${msgs.length === 1 ? "msg" : "msgs"}` : "NO DISPLAY PWR"}</span>
      </div>
      <ul>
        {msgs.length ? (
          msgs.map(([c, t]) => (
            <li key={t} className={c}>
              {t}
            </li>
          ))
        ) : (
          <li className="none">{powered ? "No alerts" : "—"}</li>
        )}
      </ul>
    </div>
  );
}
