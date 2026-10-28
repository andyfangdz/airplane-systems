/**
 * Flight data replays (`/fdr/<id>`): a real flight shown from its published record (flight data, cockpit audio, the
 * accounts of the people involved) on a model of the airplane and the systems the record shows. Each folder here holds
 * a replay's data, model and SOURCES.md; its page is in `components/fdr/<id>/`, loaded by `components/fdr/FdrPage.tsx`,
 * whose map is keyed by `FdrId` so the two can't drift (`tests/fdr-pages.test.ts` checks it). This list is the picker
 * order.
 */
import { C5_DIEGO_GARCIA } from "./c5-diego-garcia/spec";

export interface FdrEntry {
  id: string;
  /** Short name for the picker and tab title. */
  name: string;
  /** The picker's line under the name: the record replayed. */
  sub: string;
  /** One sentence for the page description. */
  lead: string;
}

export const FDR_REPLAYS = [
  { id: C5_DIEGO_GARCIA.id, name: C5_DIEGO_GARCIA.name, sub: C5_DIEGO_GARCIA.sub, lead: C5_DIEGO_GARCIA.lead },
] as const satisfies readonly FdrEntry[];

export type FdrId = (typeof FDR_REPLAYS)[number]["id"];

export const FDR_IDS = FDR_REPLAYS.map((r) => r.id);

export const fdrById = (id: string) => FDR_REPLAYS.find((r) => r.id === id);
