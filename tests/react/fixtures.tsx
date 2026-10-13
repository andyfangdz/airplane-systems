import { useBuiltParts } from "@/lib/build";
import type { Catalogue } from "@/lib/catalogue";

/** Compiled as application code so memoization of the set consumer is exercised too. */
export function BuiltPartNames({ cat }: { cat: Catalogue }) {
  const built = useBuiltParts(cat);
  return (
    <span>
      {cat.parts
        .filter((part) => !built || built.has(part))
        .map((part) => part.name)
        .join(",")}
    </span>
  );
}
