#!/usr/bin/env bash
# SPEC 16 — no version string may exist outside src/version.js.
# Exits non-zero (and prints the offenders) if a duplicate is found.
set -euo pipefail

PATTERN='20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]\.[0-9]'

hits=$(grep -rnE "$PATTERN" src/ public/ index.html \
        --exclude=version.js --exclude-dir=node_modules || true)

if [ -n "$hits" ]; then
  echo "FAIL — hardcoded version string(s) outside src/version.js:"
  echo "$hits"
  exit 1
fi

echo "OK — version string exists only in src/version.js"
grep -n "APP_VERSION" src/version.js
