#!/usr/bin/env node
/**
 * PostToolUse hook: formats each file Claude writes or edits with the repo's Prettier, so the code stays formatted
 * as it is written (the pre-commit hook and CI check the same). A file Prettier cannot parse is reported back to Claude.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

let input = "";
for await (const chunk of process.stdin) input += chunk;
const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const file = JSON.parse(input || "{}").tool_input?.file_path;
const bin = join(root, "node_modules/.bin/prettier");
// only files inside the repo, and only once dependencies are installed
if (!file || relative(root, resolve(file)).startsWith("..") || !existsSync(file) || !existsSync(bin)) process.exit(0);

const r = spawnSync(bin, ["--write", "--ignore-unknown", "--log-level", "warn", file], { cwd: root, encoding: "utf8" });
if (r.status !== 0) {
  process.stderr.write(`Prettier could not format ${relative(root, file)}:\n${r.stderr || r.stdout}`);
  process.exit(2);
}
