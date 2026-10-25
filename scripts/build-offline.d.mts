export interface OfflineFile {
  url: string;
  bytes: number;
  sha256: string;
  contentType: string;
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
export function buildOffline(root?: string, options?: { staticExport?: boolean }): Promise<OfflineManifest>;
