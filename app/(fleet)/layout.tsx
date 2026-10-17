import { Tour } from "@/components/Tour";

/**
 * The airplane routes' layout (the route group adds nothing to the URL). Switching airplanes navigates between their
 * pages and remounts the shell, but not this layout, so the welcome tour carries on across a switch.
 */
export default function FleetLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Tour />
    </>
  );
}
