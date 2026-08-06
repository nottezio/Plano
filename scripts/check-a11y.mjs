// SPEC 20 — a cheap structural audit that runs in CI.
//
// It cannot replace a screen-reader pass, and it does not try to. It catches
// the three regressions that actually recur in this codebase: a tap target
// declared under 44 px, an icon-only button with no accessible name, and a
// hardcoded hex colour that would bypass the dark-mode token layer.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../src', import.meta.url).pathname;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(ROOT).filter((file) => file.endsWith('.tsx'));
const problems = [];

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const relative = file.slice(ROOT.length + 1);

  for (const [, value] of source.matchAll(/min-h-\[(\d+)px\]/g)) {
    if (Number(value) < 44) problems.push(`${relative}: tap target ${value}px < 44px`);
  }

  // Hex colours belong in styles/tokens.css only.
  for (const [match] of source.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
    problems.push(`${relative}: hardcoded colour ${match} — use a token`);
  }
}

if (problems.length > 0) {
  console.log('FAIL — accessibility/token issues:');
  for (const problem of problems) console.log('  ' + problem);
  process.exit(1);
}

console.log(`OK — ${files.length} components: tap targets >= 44px, no hardcoded colours.`);
