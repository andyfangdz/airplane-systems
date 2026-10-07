#!/bin/bash
# Claude Code cloud sessions: install dependencies so `npm run check` (Prettier, tsc, Vitest) and `npm run shot` work.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
npm install --no-audit --no-fund
