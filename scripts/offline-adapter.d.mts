import type { NextAdapter } from "next";

type Context = Parameters<NonNullable<NextAdapter["onBuildComplete"]>>[0];
type Prepare = (root: string, options: { adapterContext: Context }) => Promise<unknown>;

export function createOfflineAdapter(loadAdapter: () => Promise<NextAdapter>, prepare?: Prepare): NextAdapter;
declare const adapter: NextAdapter;
export default adapter;
