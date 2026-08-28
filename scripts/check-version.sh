#!/usr/bin/env bash
# SPEC 16 — no version string may exist outside src/version.js.
# Exits non-zero (and prints the offenders) if a duplicate is found.
#
# History: this used to scan only `src/ public/ index.html` and exclude
# matches by *basename* (`--exclude=version.js`). A misplaced upload
# (`plano-changed/src/version.js`, a stale `2026-08-23.2`) sat outside the
# scanned roots AND matched the basename exclude, so this check reported OK
# while a duplicate version string was live in the repo. Fixed 2026-08-28:
# scan the whole tree, exclude by path.
set -euo pipefail

PATTERN='20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]\.[0-9]'

# Files/paths allowed to contain a date-dot-N string without being a
# duplicate of APP_VERSION: the source of truth itself, and prose docs that
# legitimately reference past or example versions.
hits=$(grep -rnE "$PATTERN" . \
        --exclude-dir=node_modules \
        --exclude-dir=.git \
        --exclude-dir=dist \
        --exclude=package-lock.json \
        --exclude=SPEC.md \
        --exclude=CHANGES.md \
        --exclude=check-version.sh \
        | grep -vE '^\./src/version\.js:' || true)

if [ -n "$hits" ]; then
  echo "FAIL — hardcoded version string(s) outside src/version.js:"
  echo "$hits"
  exit 1
fi

echo "OK — version string exists only in src/version.js"
grep -n "APP_VERSION" src/version.js

# Second, independent check: no source file may live outside the paths the
# build and test config actually scan. This is what should have caught
# plano-changed/, domain/, components/, data/ at commit time instead of
# three weeks later — those dirs never broke a build (tsconfig/vitest only
# include src/**), so nothing else would have flagged them.
ALLOWED_ROOTS='^\./(src|public|scripts|\.github)/|^\./[^/]+$'

stray=$(find . \
          \( -path ./node_modules -o -path ./.git -o -path ./dist \) -prune -o \
          -type f -print \
        | grep -vE "$ALLOWED_ROOTS" || true)

if [ -n "$stray" ]; then
  echo "FAIL — source file(s) outside src/, public/, scripts/, .github/:"
  echo "$stray"
  exit 1
fi

echo "OK — no source files outside src/, public/, scripts/, .github/"
