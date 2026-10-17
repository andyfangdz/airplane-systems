import { OpenLastViewed } from "@/components/OpenLastViewed";

// The root opens an airplane's route: the last-viewed airplane, else the default one (components/OpenLastViewed.tsx).
// It imports no airplane code; each airplane's page ships its own.
export default function Page() {
  return <OpenLastViewed />;
}
