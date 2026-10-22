// SPEC 16 — no version string may exist outside src/version.js.
// Exits non-zero (and prints the offenders) if a duplicate is found.
//
// History: this used to scan only `src/ public/ index.html` and exclude
// matches by *basename* (`--exclude=version.js`). A misplaced upload
// (`plano-changed/src/version.js`, a stale `2026-08-23.2`) sat outside the
// scanned roots AND matched the basename exclude, so this check reported OK
// while a duplicate version string was live in the repo. Fixed 2026-08-28:
// scan the whole tree, exclude by path.
//
// 2026-10-22: "the whole tree" is now the files git would commit (tracked,
// plus untracked files that are not ignored), not every file on disk. Walking
// the disk also scanned git-ignored local folders (`Claude outputs/`,
// `.claude/skills/`) that CI never sees, so the check failed on a dev machine
// while CI passed. A misplaced upload like `plano-changed/` is untracked but
// not ignored, so it is still scanned. Ported from bash the same day: npm
// runs scripts through cmd on Windows, where `bash` is usually not on PATH.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';

process.chdir(execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim());

const PATTERN = /20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]\.[0-9]/;

// Tracked files deleted in the working tree are still listed; skip them.
const files = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--deduplicate'],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
)
  .split('\0')
  .filter((file) => file && existsSync(file) && statSync(file).isFile());

// Files allowed to contain a date-dot-N string without being a duplicate of
// APP_VERSION: the source of truth itself, and prose docs that legitimately
// reference past or example versions.
const ALLOWED = new Set([
  'src/version.js',
  'package-lock.json',
  'SPEC.md',
  'CHANGES.md',
  'CHANGELOG.md',
  'scripts/check-version.mjs',
]);

const hits = [];
for (const file of files) {
  if (ALLOWED.has(file)) continue;
  const bytes = readFileSync(file);
  const text = bytes.toString('utf8');
  if (bytes.includes(0)) {
    if (PATTERN.test(text)) hits.push(`${file}: binary file matches`);
    continue;
  }
  text.split(/\r?\n/).forEach((line, i) => {
    if (PATTERN.test(line)) hits.push(`${file}:${i + 1}:${line}`);
  });
}

if (hits.length) {
  console.log('FAIL — hardcoded version string(s) outside src/version.js:');
  console.log(hits.join('\n'));
  process.exit(1);
}

console.log('OK — version string exists only in src/version.js');
readFileSync('src/version.js', 'utf8')
  .split(/\r?\n/)
  .forEach((line, i) => {
    if (line.includes('APP_VERSION')) console.log(`${i + 1}:${line}`);
  });

// Second, independent check: no source file may live outside the paths the
// build and test config actually scan. This is what should have caught
// plano-changed/, domain/, components/, data/ at commit time instead of
// three weeks later — those dirs never broke a build (tsconfig/vitest only
// include src/**), so nothing else would have flagged them.
const ALLOWED_ROOTS = /^(src|public|scripts|\.github)\/|^[^/]+$/;

const stray = files.filter((file) => !ALLOWED_ROOTS.test(file));

if (stray.length) {
  console.log('FAIL — source file(s) outside src/, public/, scripts/, .github/:');
  console.log(stray.join('\n'));
  process.exit(1);
}

console.log('OK — no source files outside src/, public/, scripts/, .github/');
