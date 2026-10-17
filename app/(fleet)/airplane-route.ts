/**
 * What every airplane's route shares. Each airplane has its own route folder, app/(fleet)/<id>/[[...sys]]/page.tsx, whose
 * page imports only that airplane's definition, so its code is its own route chunk (a single [ac] page choosing the
 * airplane at runtime would bundle all six). The page answers /<id> and /<id>/<system>; anything else is a 404.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { AircraftMeta } from "@/aircraft/types";
import type { SysId } from "@/lib/systems";

export type AirplaneProps = { params: Promise<{ sys?: string[] }> };

/** generateStaticParams for an airplane's route: /<id> (sys = []) and /<id>/<system> for each of its systems. */
export const systemParams = (meta: AircraftMeta) => () => [
  { sys: [] as string[] },
  ...meta.systems.map((s) => ({ sys: [s.id as string] })),
];

/** The tab title: the airplane shown. */
export const airplaneMetadata = (meta: AircraftMeta): Metadata => ({ title: `${meta.name} Systems` });

/** The system the path names (undefined at /<id>); 404 for anything that is not one of the airplane's systems. */
export async function routeSys(meta: AircraftMeta, { params }: AirplaneProps): Promise<SysId | undefined> {
  const { sys = [] } = await params;
  if (sys.length === 0) return undefined;
  const found = meta.systems.find((s) => s.id === sys[0]);
  if (sys.length > 1 || !found) notFound();
  return found.id;
}
