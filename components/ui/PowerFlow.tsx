import { useId, type ReactNode } from "react";
import "./power-flow.css";

/** Keep the live circuit visible while the following breaker controls scroll past it. */
export function PowerFlow({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <section className="power-flow" aria-labelledby={titleId}>
      <h3 id={titleId}>{title}</h3>
      <div className="power-flow-diagram" role="region" aria-label={`${title} diagram`} tabIndex={0}>
        {children}
      </div>
    </section>
  );
}
