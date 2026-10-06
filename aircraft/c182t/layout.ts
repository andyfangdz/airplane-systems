/** The stacked phone layout (app/globals.css breakpoint): the 3D view is full width and short, and labels need more room. */
export const narrowLayout = () => typeof window !== "undefined" && window.matchMedia("(max-width: 860px)").matches;
