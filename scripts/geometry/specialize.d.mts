import type ts from "typescript";
export function digest(value: string | Uint8Array): string;
export function specializeSource(
  program: ts.Program,
  source: ts.SourceFile,
): { code: string; changes: number; sourceDigest: string } | null;
