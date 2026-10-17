export interface ReleaseFile {
  path: string;
  bytes: number;
  sha256: string;
  cache: "immutable" | "short";
  contentType: string;
}
export interface ReleaseManifest {
  version: 1;
  source: { commit: string; tree: string; dirty: boolean; lockSha256: string };
  toolchain: { node: string; npm: string; platform: string; arch: string };
  files: ReleaseFile[];
}
export interface VerifyOptions {
  sha256?: string;
  commit?: string;
  tree?: string;
  lockSha256?: string;
  nodeVersion?: string;
  npmVersion?: string;
  clean?: boolean;
}
export const MANIFEST: string;
export function digest(bytes: string | Uint8Array): string;
export function immutable(path: string): boolean;
export function cacheControl(path: string): string;
export function contentType(path: string): string;
export function seal(directory: string, repository?: string): Promise<{ manifest: ReleaseManifest; sha256: string }>;
export function verify(
  directory: string,
  options?: VerifyOptions,
): Promise<{ manifest: ReleaseManifest; sha256: string }>;
