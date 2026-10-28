export interface OfflineFile {
  url: string;
  bytes: number;
  sha256: string;
  contentType: string;
  /** Content-addressed: the saved copy is served without asking the network. */
  immutable: boolean;
}
export interface OfflineManifest {
  schema: 1;
  version: string;
  buildId: string;
  mode: "server" | "export";
  total: number;
  totalBytes: number;
  files: OfflineFile[];
  routes: Record<string, { html: string; rsc: string; segments: Record<string, string> }>;
  aliases: Record<string, string>;
}
/** The public Next adapter fields used to locate prerenders and publish additional static outputs. */
export interface OfflineAdapterContext {
  distDir: string;
  buildId: string;
  config?: { output?: string };
  routing?: { rsc?: { prefetchSegmentDirSuffix: string; prefetchSegmentSuffix: string } };
  outputs: {
    prerenders: Array<{
      pathname: string;
      routeType?: "route" | "fallback" | "shell" | "page";
      response?: "empty" | "initial" | "complete";
      compute?: "blocking" | "resuming" | "static";
      fallback?: {
        filePath: string | undefined;
        initialStatus?: number;
        initialRevalidate?: number | false;
        postponedState?: string;
      };
      config?: { renderingMode?: "STATIC" | "PARTIALLY_STATIC" };
    }>;
    staticFiles: Array<{
      type: "STATIC_FILE";
      id: string;
      pathname: string;
      filePath: string;
      immutableHash: string | undefined;
    }>;
  };
}
export function buildOffline(
  root?: string,
  options?: { staticExport?: boolean; adapterContext?: OfflineAdapterContext },
): Promise<OfflineManifest>;
