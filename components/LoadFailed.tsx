/**
 * "didn't load" and Retry. In the Loader it stays hidden until a script of the page fails to download: app/layout.tsx's
 * inline script then marks the page (`data-load-failed` on <html>, which shows this instead of the spinner) and makes
 * Retry (`data-reload`) reload it. Both work before React has run, since a page whose code doesn't arrive never hydrates.
 * A failure once the page runs (another airplane's route, the 3D scene's chunk) shows it at once (`shown`), in
 * app/(fleet)/error.tsx. Retry loads the page afresh: re-rendering would not fetch a failed chunk again.
 */
export function LoadFailed({ name, shown }: { name?: string; shown?: boolean }) {
  return (
    <span className={shown ? "loader-failed loader-failed-shown" : "loader-failed"}>
      <span className="loader-text">
        {name && <b>{name} </b>}
        didn&apos;t load. Check the connection and try again.
      </span>
      <button type="button" className="loader-retry" data-reload="">
        Retry
      </button>
    </span>
  );
}
