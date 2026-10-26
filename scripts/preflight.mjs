// Run before bumping APP_VERSION and before pushing: `npm run preflight`.
//
// Several Claude cloud sessions can work on Plano at once, each from its own
// fresh clone, and none of them can see the others. Two things went wrong
// from that (2026-10-26): a branch was stacked on another session's unmerged
// version, and a bump shipped without its CHANGELOG.md entry, which failed
// the changelog test on main and skipped the deploy.
//
// This compares the working tree with origin/main and fails when:
//   1. the version is OLDER than main's (the base is stale: merge origin/main),
//   2. src/ changed against main but the version did not go up (bump it),
//   3. the top CHANGELOG.md entry or a CHANGES.md heading is not this version.
//
// It only reads; it never edits or pushes. Not part of `verify` or CI: CI runs
// on main itself, where "compare with main" says nothing.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
process.chdir(git('rev-parse', '--show-toplevel').trim());

const VERSION = /APP_VERSION\s*=\s*'(\d{4}-\d{2}-\d{2})\.(\d+)'/;
const parse = (text, where) => {
  const match = VERSION.exec(text);
  if (!match) throw new Error(`no APP_VERSION found in ${where}`);
  return { text: `${match[1]}.${match[2]}`, date: match[1], n: Number(match[2]) };
};
const compare = (a, b) => (a.date === b.date ? a.n - b.n : a.date < b.date ? -1 : 1);

const problems = [];
const notes = [];

try {
  git('fetch', 'origin', 'main', '--quiet');
} catch {
  notes.push('could not fetch origin/main; comparing with the last copy fetched');
}

const mine = parse(readFileSync('src/version.js', 'utf8'), 'src/version.js');
let theirs = null;
try {
  theirs = parse(git('show', 'origin/main:src/version.js'), 'origin/main:src/version.js');
} catch {
  notes.push('origin/main not found; skipped the comparison with main');
}

if (theirs) {
  const order = compare(mine, theirs);
  if (order < 0) {
    problems.push(`version ${mine.text} is older than main's ${theirs.text}: your base is stale. Run: git merge origin/main`);
  } else if (order === 0) {
    const changed = git('diff', '--name-only', 'origin/main', '--', 'src', 'public', 'index.html')
      .split('\n')
      .filter(Boolean);
    if (changed.length > 0) {
      problems.push(
        `src/ changed against main (${changed.slice(0, 3).join(', ')}${changed.length > 3 ? ', ...' : ''}) but the version is still ${mine.text}: bump src/version.js`,
      );
    }
  }
}

const changelogTop = /^## `([^`]+)`/m.exec(readFileSync('CHANGELOG.md', 'utf8'));
if (changelogTop?.[1] !== mine.text) {
  problems.push(`the top CHANGELOG.md entry is ${changelogTop?.[1] ?? '(none)'}, not ${mine.text}: add one (the changelog test fails otherwise)`);
}
if (!new RegExp(`^## \`${mine.text.replace(/\./g, '\\.')}\``, 'm').test(readFileSync('CHANGES.md', 'utf8'))) {
  problems.push(`CHANGES.md has no "## \`${mine.text}\`" heading: add the technical entry`);
}

for (const note of notes) console.log(`note: ${note}`);
if (problems.length > 0) {
  console.error(`preflight FAILED (version ${mine.text}${theirs ? `, main ${theirs.text}` : ''}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`preflight OK: version ${mine.text}${theirs ? ` (main ${theirs.text})` : ''}`);
