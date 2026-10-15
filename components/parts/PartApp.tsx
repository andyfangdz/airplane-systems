"use client";
/** A component simulation page (/parts/<id>): each component brings its own page. */
import dynamic from "next/dynamic";

const APPS: Record<string, React.ComponentType> = {
  "fuel-injector": dynamic(() => import("./fuel-injector/FuelInjectorApp")),
};

export default function PartApp({ id }: { id: string }) {
  const App = APPS[id];
  return App ? <App /> : null;
}
